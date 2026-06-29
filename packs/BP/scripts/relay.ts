import { StorageNetwork } from "./storage_network";
import {
  Block,
  BlockCustomComponent,
  Entity,
  Player,
  world,
} from "@minecraft/server";
import {
  getEntitiesAtBlockLocation,
  getEntityAtBlockLocation,
} from "./utils/location";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { createErrorMessageForm } from "./utils/ui";
import { logWarn } from "./log";
import { Vector3Utils } from "@minecraft/math";
import { DynamicPropertyAccessor } from "./utils/dynamic_property_v3";
import { getEntitiesInAllDimensions } from "./utils/dimension";
import {
  DiscoverCableNetworkConnectionsError,
  showEstablishNetworkError,
} from "./cable_network";
import {
  canAccessRelayNamespace,
  createRelayNamespace,
  deleteRelayNamespace,
  getAccessibleRelayNamespaces,
  getRelayNamespace,
  getRelayNamespacesByOwner,
  RelayNamespace,
  updateRelayNamespace,
} from "./relay_namespace";

const BLOCK_ID = "fluffyalien_asn:storage_relay";
const ENTITY_ID = "fluffyalien_asn:relay_entity";

/**
 * The id of the {@link RelayNamespace} a relay is assigned to. Stored on the
 * relay entity so it can be read globally during network discovery. Relays
 * bridge to every other relay sharing this id.
 */
export const relayNamespaceId = new DynamicPropertyAccessor<string>(
  "fluffyalien_asn:relay_namespace",
);

/** The id of the player who placed a relay. Stored on the relay entity. */
export const relayOwner = new DynamicPropertyAccessor<string>(
  "fluffyalien_asn:relay_owner",
);

/**
 * Finds every established network that currently contains a relay assigned to
 * the given namespace. Relays bridge networks globally by namespace, so all of
 * these may be affected when a relay is assigned to or away from it.
 */
function getNetworksForRelayNamespace(namespaceId: string): StorageNetwork[] {
  const networks: StorageNetwork[] = [];

  for (const entity of getEntitiesInAllDimensions({ type: ENTITY_ID })) {
    if (relayNamespaceId.safeGet(entity) !== namespaceId) continue;

    const block = entity.dimension.getBlock(entity.location);
    if (!block) continue;

    const network = StorageNetwork.getNetwork(block);
    if (network) networks.push(network);
  }

  return networks;
}

/**
 * Re-discovers every network affected by reassigning a relay from
 * `oldNamespaceId` to `newNamespaceId`: the network that contains the relay,
 * plus every network containing a relay in the old or new namespace. Because
 * relays bridge by namespace across the whole world, a single reassignment can
 * connect or disconnect cable segments far from the relay itself, and each
 * affected network must update independently (updating only the relay's own
 * network would leave the other side stale, and would do nothing at all when the
 * relay sits in a not-yet-established coreless segment). Any error - eg. the
 * change links two storage cores, destroying the network - is surfaced to the
 * player.
 */
async function updateRelayNetworks(
  player: Player,
  relayBlock: Block,
  oldNamespaceId: string | undefined,
  newNamespaceId: string,
): Promise<void> {
  const networks = new Set<StorageNetwork>();

  const ownNetwork = StorageNetwork.getNetwork(relayBlock);
  if (ownNetwork) networks.add(ownNetwork);

  for (const namespaceId of [oldNamespaceId, newNamespaceId]) {
    if (!namespaceId) continue;
    for (const network of getNetworksForRelayNamespace(namespaceId)) {
      networks.add(network);
    }
  }

  return rediscoverNetworks(player, networks);
}

/**
 * Re-discovers the given networks, surfacing the first error to the player.
 */
async function rediscoverNetworks(
  player: Player,
  networks: Iterable<StorageNetwork>,
): Promise<void> {
  let firstError: DiscoverCableNetworkConnectionsError | undefined;
  for (const network of networks) {
    // updating one network can destroy another (eg. it claimed the same blocks
    // via a relay), so skip any that are no longer valid.
    if (!network.isValid()) continue;

    const result = await network.updateConnections();
    if (result.isErr() && firstError === undefined) {
      firstError = result.error;
    }
  }

  if (firstError !== undefined) {
    void showEstablishNetworkError(player, firstError);
  }
}

/**
 * Deletes the namespace and unassigns every relay using it, then re-discovers
 * the affected networks so the relays stop bridging. The networks are captured
 * before clearing the relays, since clearing changes what each relay belongs to.
 */
async function deleteNamespaceAndUnassignRelays(
  player: Player,
  namespaceId: string,
): Promise<void> {
  deleteRelayNamespace(namespaceId);

  const networks = new Set<StorageNetwork>(
    getNetworksForRelayNamespace(namespaceId),
  );

  for (const entity of getEntitiesInAllDimensions({ type: ENTITY_ID })) {
    if (relayNamespaceId.safeGet(entity) !== namespaceId) continue;
    relayNamespaceId.set(entity);
  }

  return rediscoverNetworks(player, networks);
}

/**
 * Assigns the relay to the namespace and re-discovers the affected networks. A
 * no-op if the relay is already assigned to that namespace.
 */
async function setRelayNamespace(
  player: Player,
  relayBlock: Block,
  relayEntity: Entity,
  namespaceId: string,
): Promise<void> {
  const oldNamespaceId = relayNamespaceId.safeGet(relayEntity);
  if (oldNamespaceId === namespaceId) return;

  relayNamespaceId.set(relayEntity, namespaceId);

  return updateRelayNetworks(player, relayBlock, oldNamespaceId, namespaceId);
}

/** Parses a comma/newline separated list of player names. */
function parsePlayerNameList(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

/**
 * Shows the namespace configuration form. With no `existing` namespace it
 * creates a new one (owned by the player) and assigns the relay to it; with an
 * `existing` namespace it edits that namespace's settings in place (its id and
 * owner are preserved, and the relay's assignment is left unchanged).
 */
async function showNamespaceConfigForm(
  player: Player,
  relayBlock: Block,
  relayEntity: Entity,
  back: () => Promise<void>,
  existing?: RelayNamespace,
): Promise<void> {
  const form = new ModalFormData();
  form.title({
    translate: existing
      ? "fluffyalien_asn.ui.relay.config.optionsTitle"
      : "fluffyalien_asn.ui.relay.config.newTitle",
  });

  form.textField(
    { translate: "fluffyalien_asn.ui.relay.config.label.name" },
    "",
    {
      defaultValue: existing?.name,
    },
  );
  form.toggle(
    { translate: "fluffyalien_asn.ui.relay.config.label.open" },
    { defaultValue: existing?.open ?? false },
  );
  form.textField(
    { translate: "fluffyalien_asn.ui.relay.config.label.allowlist" },
    "",
    {
      defaultValue: existing?.allowlist.join(", "),
      tooltip: { translate: "fluffyalien_asn.ui.relay.config.tip.playerList" },
    },
  );
  form.textField(
    { translate: "fluffyalien_asn.ui.relay.config.label.denylist" },
    "",
    {
      defaultValue: existing?.denylist.join(", "),
      tooltip: { translate: "fluffyalien_asn.ui.relay.config.tip.playerList" },
    },
  );

  const response = await form.show(player);
  if (!response.formValues) {
    return back();
  }

  const name = (response.formValues[0] as string).trim();
  const open = response.formValues[1] as boolean;
  const allowlist = parsePlayerNameList(response.formValues[2] as string);
  const denylist = parsePlayerNameList(response.formValues[3] as string);

  if (!name) {
    void createErrorMessageForm({
      translate: "fluffyalien_asn.ui.relay.error.invalidNamespaceName",
    }).show(player);
    return;
  }

  if (existing) {
    updateRelayNamespace(existing.id, { name, open, allowlist, denylist });
    return;
  }

  const namespace = createRelayNamespace(player, {
    name,
    open,
    allowlist,
    denylist,
  });

  return setRelayNamespace(player, relayBlock, relayEntity, namespace.id);
}

/**
 * Shows the per-namespace actions form. The owner gets Delete, Configure, and
 * Select; everyone else gets only Select (they may not configure or delete a
 * namespace they don't own).
 */
async function showNamespaceActionsForm(
  player: Player,
  relayBlock: Block,
  relayEntity: Entity,
  namespace: RelayNamespace,
  back: () => Promise<void>,
): Promise<void> {
  const isOwner = namespace.owner === player.id;

  const form = new ActionFormData()
    .title(namespace.name)
    .body({ translate: "fluffyalien_asn.ui.relay.actions.body" });

  form.button({ translate: "fluffyalien_asn.ui.relay.actions.button.select" });
  if (isOwner) {
    form.button({
      translate: "fluffyalien_asn.ui.relay.actions.button.configure",
    });
    form.button({
      translate: "fluffyalien_asn.ui.relay.actions.button.delete",
    });
  }

  const response = await form.show(player);
  if (response.selection === undefined) {
    return back();
  }

  if (!isOwner) {
    // the only button is Select
    return setRelayNamespace(player, relayBlock, relayEntity, namespace.id);
  }

  const reopen = (): Promise<void> =>
    showNamespaceActionsForm(player, relayBlock, relayEntity, namespace, back);

  switch (response.selection) {
    case 0:
      return setRelayNamespace(player, relayBlock, relayEntity, namespace.id);
    case 1:
      return showNamespaceConfigForm(
        player,
        relayBlock,
        relayEntity,
        reopen,
        namespace,
      );
    case 2:
      return showDeleteNamespaceConfirmForm(player, namespace, reopen);
  }
}

/**
 * Shows a confirmation before deleting a namespace, since deletion disconnects
 * every relay that uses it.
 */
async function showDeleteNamespaceConfirmForm(
  player: Player,
  namespace: RelayNamespace,
  back: () => Promise<void>,
): Promise<void> {
  const form = new ActionFormData()
    .title({ translate: "fluffyalien_asn.ui.relay.deleteConfirm.title" })
    .body({
      translate: "fluffyalien_asn.ui.relay.deleteConfirm.body",
      with: [namespace.name],
    })
    .button({
      translate: "fluffyalien_asn.ui.relay.deleteConfirm.button.confirm",
    })
    .button({
      translate: "fluffyalien_asn.ui.relay.deleteConfirm.button.cancel",
    });

  const response = await form.show(player);
  if (response.selection === 0) {
    return deleteNamespaceAndUnassignRelays(player, namespace.id);
  }

  // the cancel button or closing the form returns to the previous form
  return back();
}

/**
 * Shows the namespaces owned by `ownerId` that the player can access. Selecting
 * one assigns the relay to it. When the player is viewing their own relays, a
 * "New namespace" button is shown first.
 */
async function showNamespaceListForm(
  player: Player,
  relayBlock: Block,
  relayEntity: Entity,
  ownerId: string,
  isOwn: boolean,
  back: () => Promise<void>,
): Promise<void> {
  const namespaces = getRelayNamespacesByOwner(ownerId).filter((ns) =>
    canAccessRelayNamespace(player, ns),
  );

  const form = new ActionFormData()
    .title({
      translate: "fluffyalien_asn.ui.relay.namespaceList.title",
    })
    .body({ translate: "fluffyalien_asn.ui.relay.namespaceList.body" });

  // when present, the "New namespace" button occupies index 0, shifting the
  // namespace buttons by one.
  const offset = isOwn ? 1 : 0;
  if (isOwn) {
    form.button({
      translate: "fluffyalien_asn.ui.relay.namespaceList.button.new",
    });
  }

  for (const ns of namespaces) {
    form.button(ns.name);
  }

  const response = await form.show(player);
  if (response.selection === undefined) {
    return back();
  }

  const reopen = (): Promise<void> =>
    showNamespaceListForm(
      player,
      relayBlock,
      relayEntity,
      ownerId,
      isOwn,
      back,
    );

  if (isOwn && response.selection === 0) {
    return showNamespaceConfigForm(player, relayBlock, relayEntity, reopen);
  }

  // the selection maps directly to a button we added, so the namespace at this
  // index always exists.
  const namespace = namespaces[response.selection - offset];

  return showNamespaceActionsForm(
    player,
    relayBlock,
    relayEntity,
    namespace,
    reopen,
  );
}

/**
 * Shows the relay's top-level form: a "Your namespaces" button plus a button for
 * every other player that owns a namespace the current player can access.
 */
async function showRelayForm(
  player: Player,
  relayBlock: Block,
  relayEntity: Entity,
): Promise<void> {
  // distinct other owners (excluding the current player) among the namespaces
  // this player can access, mapped to their display names, in insertion order.
  const otherOwnerNames = new Map<string, string>();
  for (const ns of getAccessibleRelayNamespaces(player)) {
    if (ns.owner === player.id) continue;
    if (!otherOwnerNames.has(ns.owner)) {
      otherOwnerNames.set(ns.owner, ns.ownerName);
    }
  }

  const currentNamespaceId = relayNamespaceId.safeGet(relayEntity);
  const currentNamespace =
    currentNamespaceId !== undefined
      ? getRelayNamespace(currentNamespaceId)
      : undefined;

  const form = new ActionFormData()
    .title({ translate: "tile.fluffyalien_asn:storage_relay.name" })
    .body({
      translate: "fluffyalien_asn.ui.relay.currentNamespace",
      with: {
        rawtext: [
          currentNamespace
            ? { text: currentNamespace.name }
            : { translate: "fluffyalien_asn.ui.relay.noNamespace" },
        ],
      },
    })
    .button({ translate: "fluffyalien_asn.ui.relay.button.yourNamespaces" });

  const ownerIds = [...otherOwnerNames.keys()];
  for (const ownerId of ownerIds) {
    form.button(otherOwnerNames.get(ownerId)!);
  }

  const response = await form.show(player);
  // this is the top-level form, so closing it simply exits.
  if (response.canceled || response.selection === undefined) return;

  // re-opens this form; the previous form for the list views below.
  const back = (): Promise<void> =>
    showRelayForm(player, relayBlock, relayEntity);

  if (response.selection === 0) {
    return showNamespaceListForm(
      player,
      relayBlock,
      relayEntity,
      player.id,
      true,
      back,
    );
  }

  // selection 0 is "Your namespaces" (handled above); every other index maps to
  // an owner button we added, so the owner id at this index always exists.
  const ownerId = ownerIds[response.selection - 1];

  return showNamespaceListForm(
    player,
    relayBlock,
    relayEntity,
    ownerId,
    false,
    back,
  );
}

/**
 * Removes every relay entity at the given block's location. A relay should only
 * ever have one, but removing all of them defends against duplicates/orphans
 * (eg. a prior entity whose removal failed).
 */
function removeRelayEntities(block: Block): void {
  for (const entity of getEntitiesAtBlockLocation(block, ENTITY_ID)) {
    entity.remove();
  }
}

export const storageRelayComponent: BlockCustomComponent = {
  onPlace(e) {
    if (e.previousBlock.type.id === e.block.typeId) return;

    // clear any stray entities first so the new relay starts with exactly one
    removeRelayEntities(e.block);

    e.block.dimension.spawnEntity(ENTITY_ID, e.block.bottomCenter());
  },
  onBreak(e) {
    removeRelayEntities(e.block);
  },
  onPlayerInteract(e) {
    if (!e.player) return;
    const player = e.player;
    const block = e.block;

    const entity = getEntityAtBlockLocation(block, ENTITY_ID);
    if (!entity) {
      logWarn(
        `Failed to get relay entity at ${Vector3Utils.toString(block.location)} in ${block.dimension.id} to process interaction.`,
      );
      return;
    }

    const owner = relayOwner.safeGet(entity);
    if (owner !== player.id) {
      void createErrorMessageForm({
        translate: "fluffyalien_asn.ui.relay.error.notOwner",
      }).show(player);
      return;
    }

    void showRelayForm(player, block, entity);
  },
};

// Record the placing player as the relay's owner. onPlace (a block component)
// has no access to the player, so the owner is set from this player event,
// which fires after the entity has been spawned in onPlace.
world.afterEvents.playerPlaceBlock.subscribe((e) => {
  if (e.block.typeId !== BLOCK_ID) return;

  const entity = getEntityAtBlockLocation(e.block, ENTITY_ID);
  if (!entity) return;

  relayOwner.set(entity, e.player.id);
});
