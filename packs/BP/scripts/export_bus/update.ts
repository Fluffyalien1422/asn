import { Block, ItemStack } from "@minecraft/server";
import { StorageNetwork } from "../storage_network";
import { StrCardinalDirection, getBlockInDirection } from "../utils/direction";
import { cloneItemStackWithAmount, getItemStackDamage } from "../utils/item";
import { logError } from "../log";
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

  // addItem is far cheaper than removeItemStack, so insert into the target
  // first: a non-empty return also tells us the target is full, letting us bail
  // out without paying for the expensive storage removal.
  const notAdded = container.addItem(
    cloneItemStackWithAmount(foundItemStack, 1),
  );
  if (notAdded) {
    return;
  }

  const removedr = await network.removeItemStack(foundId, 1);
  if (removedr.isErr()) {
    // The item is already in the target, but removing it from storage failed
    // (eg. a concurrent export already took this stack). A reliable rollback
    // isn't possible: itemStacksMatch can't guarantee we'd pull the exact item
    // back out, and re-adding a pre-insert snapshot would race with the await
    // above. This is a rare, exceptional case, so just warn.
    logError(
      `Failed to remove item from storage during export after adding it to the target; the item may be duplicated: ${
        removedr.error.type === "unknownError"
          ? removedr.error.message
          : removedr.error.type
      }`,
    );
  }
}
