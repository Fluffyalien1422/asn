import { Block } from "@minecraft/server";
import { StorageNetwork } from "../storage_network";
import { StorageSystemItemStack } from "../storage_system_item_stack";

export function updateImportBus(block: Block, network: StorageNetwork): void {
  const cardinalDirection = block.permutation.getState(
    "minecraft:cardinal_direction"
  ) as string;

  const target =
    cardinalDirection === "north"
      ? block.north()
      : cardinalDirection === "east"
      ? block.east()
      : cardinalDirection === "south"
      ? block.south()
      : block.west();

  const container = target?.getComponent("inventory")?.container;
  if (!container) return;

  for (let i = 0; i < container.size; i++) {
    const item = container.getItem(i);
    if (!item) continue;

    network.addItemStack(StorageSystemItemStack.fromItemStack(item));

    container.setItem(i);
  }
}
