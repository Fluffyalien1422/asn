import {
  BlockCustomComponent,
  ItemStack,
  Player,
  world,
} from "@minecraft/server";
import { StorageNetwork } from "./storage_network";
import { STR_DIRECTIONS, StrCardinalDirection } from "./utils/direction";
import {
  busUpdateBlockConnectStatesTransformer,
  updateBlockConnectStates,
} from "./utils/block_connect";
import { logWarn } from "./log";
import { refreshStorageViewerOrLog } from "./storage_ui";
import { useEnergyRule } from "./addon_rules/addon_rules";
import {
  getNetworkOrShowError,
  createErrorMessageForm,
  showForm,
} from "./utils/ui";
import { forceCloseStorageViewerInventory } from "./storage_ui/shared";
import { disableStorageViewer } from "./storage_ui/storage";

export const storageInterfaceComponent: BlockCustomComponent = {
  onPlace(e) {
    if (e.previousBlock.type.id === "fluffyalien_asn:storage_interface") return;

    e.block.dimension.spawnEntity("fluffyalien_asn:storage_interface_entity", {
      x: e.block.x + 0.5,
      y: e.block.y,
      z: e.block.z + 0.5,
    }).nameTag = "fluffyalien_asn:storage_interface";

    StorageNetwork.updateConnectableNetworks(e.block);
  },
  onTick(e) {
    const cardinalDirection = e.block.permutation.getState(
      "minecraft:cardinal_direction",
    ) as StrCardinalDirection;

    updateBlockConnectStates(
      e.block,
      STR_DIRECTIONS,
      (other) => other.hasTag("fluffyalien_asn:storage_network_connectable"),
      busUpdateBlockConnectStatesTransformer(cardinalDirection),
    );
  },
  onPlayerInteract(e) {
    if (!e.player) return;
    e.player.sendMessage({
      rawtext: [
        {
          text: "§c",
        },
        {
          translate: "fluffyalien_asn.message.storageInterface.alreadyOpen",
        },
      ],
    });
  },
};

world.afterEvents.entityHitEntity.subscribe((e) => {
  if (
    e.hitEntity.typeId !== "fluffyalien_asn:storage_interface_entity" ||
    !(e.damagingEntity instanceof Player)
  ) {
    return;
  }

  const block = e.hitEntity.dimension.getBlock(e.hitEntity.location);

  if (block) {
    block.setType("air");

    e.hitEntity.dimension.spawnItem(
      new ItemStack("fluffyalien_asn:storage_interface"),
      e.hitEntity.location,
    );

    void StorageNetwork.getNetwork(
      block,
      "fluffyalien_asn:storage_interface",
    )?.updateConnections();
  }

  e.hitEntity.remove();
});

world.afterEvents.entityContainerOpened.subscribe(
  (e) => {
    const target = e.entity;
    const player = e.openSource.entity as Player;

    const block = target.dimension.getBlock(target.location);
    if (!block) {
      logWarn(
        `Expected a storage interface block at (${target.location.x.toString()}, ${target.location.y.toString()}, ${target.location.z.toString()}) in ${target.dimension.id}.`,
      );
      return;
    }

    target.triggerEvent("fluffyalien_asn:block_interactions");

    void (async (): Promise<void> => {
      const network = await getNetworkOrShowError(block, target, player);
      if (!network) return;

      if (useEnergyRule.get(world) && network.getStoredEnergy() <= 0) {
        await forceCloseStorageViewerInventory(target);
        void showForm(
          createErrorMessageForm({
            translate:
              "fluffyalien_asn.ui.storageInterface.error.insufficientEnergy",
          }),
          player,
        );
        return;
      }

      refreshStorageViewerOrLog(target, player, network);
    })();
  },
  {
    accessSourceFilter: { entityFilter: { type: "minecraft:player" } },
    entityFilter: { type: "fluffyalien_asn:storage_interface_entity" },
  },
);

world.afterEvents.entityContainerClosed.subscribe(
  (e) => {
    disableStorageViewer(e.entity);
    e.entity.triggerEvent("fluffyalien_asn:allow_interactions");
  },
  {
    entityFilter: { type: "fluffyalien_asn:storage_interface_entity" },
  },
);
