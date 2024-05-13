import { StorageNetwork } from "./storage_network";
import { Block, BlockCustomComponent } from "@minecraft/server";
import {
  busUpdateBlockConnectStatesTransformer,
  updateBlockConnectStates,
} from "./utils/block_connect";
import {
  STR_DIRECTIONS,
  StrCardinalDirection,
  getBlockInDirection,
} from "./utils/direction";
import { receivingRedstoneSignal } from "./utils/block";
import { StorageSystemItemStack } from "./storage_system_item_stack";

export function updateImportBus(block: Block, network: StorageNetwork): void {
  if (receivingRedstoneSignal(block)) return;

  const cardinalDirection = block.permutation.getState(
    "minecraft:cardinal_direction",
  ) as StrCardinalDirection;

  const target = getBlockInDirection(block, cardinalDirection);

  const container = target?.getComponent("inventory")?.container;
  if (!container) return;

  for (let i = 0; i < container.size; i++) {
    const item = container.getItem(i);
    if (!item) continue;

    const result = network.addItemStack(
      StorageSystemItemStack.fromItemStack(item),
    );
    if (!result.success) {
      if (result.error.type === "bannedItem") continue;
      else return;
    }

    container.setItem(i);
  }
}

export const importBusComponent: BlockCustomComponent = {
  onPlace(e) {
    StorageNetwork.updateConnectableNetworks(e.block);
  },
  onPlayerDestroy(e) {
    void StorageNetwork.getNetwork(
      e.block,
      e.destroyedBlockPermutation.type.id,
    )?.updateConnections();
  },
  onTick(e) {
    updateBlockConnectStates(
      e.block,
      STR_DIRECTIONS,
      (other) => other.hasTag("fluffyalien_asn:storage_network_connectable"),
      busUpdateBlockConnectStatesTransformer(
        e.block.permutation.getState(
          "minecraft:cardinal_direction",
        ) as StrCardinalDirection,
      ),
    );
  },
};
