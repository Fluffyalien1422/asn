import {
  Block,
  BlockCustomComponent,
  Entity,
  ItemStack,
  Player,
  world,
} from "@minecraft/server";
import { StorageNetwork } from "./storage_network";
import {
  reverseDirection,
  STR_DIRECTIONS,
  StrCardinalDirection,
} from "./utils/direction";
import { updateBlockConnectStates } from "./utils/block_connect";
import { logWarn } from "./log";
import { forceCloseInventory, refreshStorageViewer } from "./storage_ui";
import { useEnergyRule } from "./addon_rules";
import { makeErrorMessageUi } from "./utils/ui";
import { showEstablishNetworkError } from "./cable_network";

async function getNetworkOrShowError(
  block: Block,
  interfaceEntity: Entity,
  player: Player,
): Promise<StorageNetwork | undefined> {
  const networkResult = await StorageNetwork.getOrEstablishNetwork(block);
  if (!networkResult.success) {
    await forceCloseInventory(interfaceEntity);
    void showEstablishNetworkError(player, networkResult.error);

    return;
  }

  return networkResult.value;
}

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
      (direction) => {
        if (direction === "up" || direction === "down") {
          return direction;
        }

        switch (cardinalDirection) {
          case "north":
            switch (direction) {
              case "south":
                return;
              default:
                return direction;
            }
          case "east":
            switch (direction) {
              case "north":
                return "west";
              case "east":
                return "north";
              case "south":
                return "east";
              case "west":
                return;
            }
            break;
          case "south":
            switch (direction) {
              case "north":
                return;
              default:
                return reverseDirection(direction);
            }
          case "west":
            switch (direction) {
              case "north":
                return "east";
              case "east":
                return;
              case "south":
                return "west";
              case "west":
                return "north";
            }
        }
      },
    );
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

world.afterEvents.playerInteractWithEntity.subscribe((e) => {
  if (e.target.typeId !== "fluffyalien_asn:storage_interface_entity") return;

  const block = e.target.dimension.getBlock(e.target.location);
  if (!block) {
    logWarn(
      `expected a storage interface block at (${e.target.location.x.toString()},${e.target.location.y.toString()},${e.target.location.z.toString()}) in ${e.target.dimension.id}`,
    );
    return;
  }

  void (async (): Promise<void> => {
    const network = await getNetworkOrShowError(block, e.target, e.player);
    if (!network) return;

    if (useEnergyRule.get(world) && network.getStoredEnergy() <= 0) {
      await forceCloseInventory(e.target);
      void makeErrorMessageUi({
        translate:
          "fluffyalien_asn.ui.storageInterface.error.insufficientEnergy",
      }).show(e.player);
      return;
    }

    refreshStorageViewer(e.target, e.player, network);
  })();
});
