import { StorageNetwork } from "./storage_network";
import { Block, BlockCustomComponent, ItemStack } from "@minecraft/server";
import {
  busUpdateBlockConnectStatesTransformer,
  updateBlockConnectStates,
} from "./utils/block_connect";
import {
  STR_DIRECTIONS,
  StrCardinalDirection,
  getBlockInDirection,
} from "./utils/direction";

export async function updateImportBus(
  block: Block,
  network: StorageNetwork,
): Promise<void> {
  if (block.getRedstonePower()) return;

  const cardinalDirection = block.permutation.getState(
    "minecraft:cardinal_direction",
  ) as StrCardinalDirection;

  const target = getBlockInDirection(block, cardinalDirection);

  const container = target?.getComponent("inventory")?.container;
  if (!container) return;

  // collect every item with its source slot, then add them all in one batch so
  // the network only writes to disk once instead of once per item.
  const slots: number[] = [];
  const items: ItemStack[] = [];
  for (let i = 0; i < container.size; i++) {
    const item = container.getItem(i);
    if (!item) continue;
    slots.push(i);
    items.push(item);
  }
  if (!items.length) return;

  const addedr = await network.addItemStacks(items);
  if (addedr.isErr()) return;

  // addItemStacks stores a prefix of `items`; clear exactly those source slots.
  for (let i = 0; i < addedr.value; i++) {
    container.setItem(slots[i]);
  }
}

export const importBusComponent: BlockCustomComponent = {
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
