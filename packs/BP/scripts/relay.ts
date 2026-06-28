import { StorageNetwork } from "./storage_network";
import { Block, BlockCustomComponent, Entity, Player } from "@minecraft/server";
import { getEntityAtBlockLocation } from "./utils/location";
import { ModalFormData } from "@minecraft/server-ui";
import { createErrorMessageForm } from "./utils/ui";
import { logWarn } from "./log";
import { Vector3Utils } from "@minecraft/math";
import { DynamicPropertyAccessor } from "./utils/dynamic_property_v3";
import { getEntitiesInAllDimensions } from "./utils/dimension";
import {
  DiscoverCableNetworkConnectionsError,
  showEstablishNetworkError,
} from "./cable_network";

export const relayName = new DynamicPropertyAccessor<string>(
  "fluffyalien_asn:relay_name",
);

/**
 * Shows the relay naming UI. If the player submits a valid name it is saved to
 * the relay entity and returned. Returns `undefined` if the form was cancelled
 * or the submitted name was invalid, in which case nothing is changed.
 */
async function showRelayForm(
  player: Player,
  relayEntity: Entity,
): Promise<string | undefined> {
  const form = new ModalFormData();
  form.title({ translate: "tile.fluffyalien_asn:relay.name" });

  form.textField({ translate: "fluffyalien_asn.ui.relay.name" }, "", {
    defaultValue: relayName.safeGet(relayEntity),
  });

  const response = await form.show(player);
  if (!response.formValues) return undefined;

  const name = response.formValues[0] as string;
  if (!name) {
    void createErrorMessageForm({
      translate: "fluffyalien_asn.ui.relay.error.invalidName",
    }).show(player);
    return undefined;
  }

  relayName.set(relayEntity, name);
  return name;
}

/**
 * Finds every established network that currently contains a relay with the
 * given name. Relays bridge networks globally by name, so all of these may be
 * affected when a relay is renamed to or from `name`.
 */
function getNetworksForRelayName(name: string): StorageNetwork[] {
  const networks: StorageNetwork[] = [];

  for (const entity of getEntitiesInAllDimensions({
    type: "fluffyalien_asn:relay_entity",
  })) {
    if (relayName.safeGet(entity) !== name) continue;

    const block = entity.dimension.getBlock(entity.location);
    if (!block) continue;

    const network = StorageNetwork.getNetwork(block);
    if (network) networks.push(network);
  }

  return networks;
}

/**
 * Re-discovers every network affected by renaming a relay from `oldName` to
 * `newName`: the network that contains the relay, plus every network containing
 * a relay that shares the old or new name. Because relays bridge by name across
 * the whole world, a single rename can connect or disconnect cable segments far
 * from the relay itself, and each affected network must update independently
 * (updating only the relay's own network would leave the other side stale, and
 * would do nothing at all when the relay sits in a not-yet-established coreless
 * segment). Any error - eg. the rename links two storage cores, destroying the
 * network - is surfaced to the player.
 */
async function updateRelayNetworks(
  player: Player,
  relayBlock: Block,
  oldName: string | undefined,
  newName: string,
): Promise<void> {
  const networks = new Set<StorageNetwork>();

  const ownNetwork = StorageNetwork.getNetwork(relayBlock);
  if (ownNetwork) networks.add(ownNetwork);

  for (const name of [oldName, newName]) {
    if (!name) continue;
    for (const network of getNetworksForRelayName(name)) {
      networks.add(network);
    }
  }

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

export const storageRelayComponent: BlockCustomComponent = {
  onPlace(e) {
    if (e.previousBlock.type.id === e.block.typeId) return;

    e.block.dimension.spawnEntity("fluffyalien_asn:relay_entity", {
      x: e.block.x + 0.5,
      y: e.block.y,
      z: e.block.z + 0.5,
    });
  },
  onBreak(e) {
    getEntityAtBlockLocation(e.block, "fluffyalien_asn:relay_entity")?.remove();
  },
  onPlayerInteract(e) {
    if (!e.player) return;
    const player = e.player;
    const block = e.block;

    const entity = getEntityAtBlockLocation(
      block,
      "fluffyalien_asn:relay_entity",
    );
    if (!entity) {
      logWarn(
        `could not get relay entity at ${Vector3Utils.toString(block.location)} in ${block.dimension.id} to process interaction`,
      );
      return;
    }

    const oldName = relayName.safeGet(entity);

    void showRelayForm(player, entity).then((newName) => {
      if (newName === undefined || newName === oldName) return;
      void updateRelayNetworks(player, block, oldName, newName);
    });
  },
};
