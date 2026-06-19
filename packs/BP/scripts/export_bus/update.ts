import { Block, ItemStack } from "@minecraft/server";
import { StorageNetwork } from "../storage_network";
import { StrCardinalDirection, getBlockInDirection } from "../utils/direction";
import { cloneItemStackWithAmount, getItemStackDamage } from "../utils/item";
import {
  exportItemEnchantmentsProperty,
  exportItemProperty,
  getExportItemDamageRange,
} from "./properties";

export async function updateExportBus(
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

  const exportItemId = exportItemProperty.safeGet(block);
  if (!exportItemId) {
    return;
  }

  const exportItemEnchantmentsStatus =
    exportItemEnchantmentsProperty.safeGet(block);

  const exportItemDamageRange = getExportItemDamageRange(block);

  const storedItemStacksResult = await network.getStoredItemStacks();
  if (storedItemStacksResult.isErr()) {
    return;
  }

  let foundId: string | undefined;
  let foundItemStack: ItemStack | undefined;
  for (const [id, itemStack] of storedItemStacksResult.value) {
    const hasEnchantments =
      (itemStack.getComponent("enchantable")?.getEnchantments().length ?? 0) >
      0;
    const damage = getItemStackDamage(itemStack);

    if (
      itemStack.typeId === exportItemId &&
      (exportItemEnchantmentsStatus === "ignore" ||
        (exportItemEnchantmentsStatus === "with" && hasEnchantments) ||
        (exportItemEnchantmentsStatus === "without" && !hasEnchantments)) &&
      damage >= exportItemDamageRange.min &&
      (exportItemDamageRange.max === undefined ||
        damage <= exportItemDamageRange.max)
    ) {
      foundId = id;
      foundItemStack = itemStack;
      break;
    }
  }

  if (!foundId || !foundItemStack) {
    return;
  }

  const notAdded = container.addItem(
    cloneItemStackWithAmount(foundItemStack, 1),
  );
  if (notAdded) {
    return;
  }

  const removedr = await network.removeItemStack(foundId, 1);
  if (removedr.isErr()) {
    return;
  }
}
