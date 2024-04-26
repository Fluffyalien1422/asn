import { Block } from "@minecraft/server";
import { StorageNetwork } from "../storage_network";
import { StorageSystemItemStack } from "../storage_system_item_stack";
import {
  CardinalDirection,
  getBlockInDirection,
  receivingRedstoneSignal,
} from "../utils";

export function updateImportBus(block: Block, network: StorageNetwork): void {
  if (receivingRedstoneSignal(block)) return;

  const cardinalDirection = block.permutation.getState(
    "minecraft:cardinal_direction",
  ) as CardinalDirection;

  const target = getBlockInDirection(block, cardinalDirection);

  const container = target?.getComponent("inventory")?.container;
  if (!container) return;

  for (let i = 0; i < container.size; i++) {
    const item = container.getItem(i);
    if (!item) continue;

    network.addItemStack(StorageSystemItemStack.fromItemStack(item));

    container.setItem(i);
  }
}
