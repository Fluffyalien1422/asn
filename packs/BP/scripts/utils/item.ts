import {
  ContainerSlot,
  Enchantment,
  EquipmentSlot,
  ItemStack,
  Player,
  Vector3,
} from "@minecraft/server";
import { Vector3Utils } from "@minecraft/math";
import { err, ok, Result } from "neverthrow";

export function getPlayerMainhandSlot(player: Player): ContainerSlot {
  return player
    .getComponent("equippable")!
    .getEquipmentSlot(EquipmentSlot.Mainhand);
}

export function getItemTranslationKey(itemId: string): string {
  const itemStackr = createItemStack(itemId);
  if (itemStackr.isErr()) return `item.${itemId}`;
  const itemStack = itemStackr.value;
  return itemStack.localizationKey;
}

export function getEnchantmentTypeId(enchantment: Enchantment): string {
  return enchantment.type.id;
}

export function getItemStackDamage(itemStack: ItemStack): number {
  return itemStack.getComponent("durability")?.damage ?? 0;
}

/**
 * Manually compares two {@link ItemStack}s for equality (ignoring amount unless
 * `compareAmount` is set).
 *
 * ItemStack#isStackableWith cannot be used to check if two item stacks
 * match because it always returns `false` for items that are not stackable
 * (eg. items with durability). This function compares the relevant item data
 * directly, mirroring the legacy `StorageSystemItemStack#isStackableWith`.
 *
 * NOTE: this is NOT a complete equality check. It can only compare the item
 * data that the scripting API exposes; the game stores additional NBT (eg. when
 * an item is saved into a structure) that the API does not surface. Two stacks
 * this function considers equal may therefore still differ in non-exposed data.
 * Do not rely on it to prove two stacks are byte-for-byte identical.
 */
export function itemStacksMatch(
  a: ItemStack,
  b: ItemStack,
  compareAmount = false,
): boolean {
  if (a.typeId !== b.typeId) return false;
  if (a.nameTag !== b.nameTag) return false;
  if (compareAmount && a.amount !== b.amount) return false;
  if (getItemStackDamage(a) !== getItemStackDamage(b)) return false;

  // lore
  const aLore = a.getLore();
  const bLore = b.getLore();
  if (aLore.length !== bLore.length || !aLore.every((v, i) => bLore[i] === v)) {
    return false;
  }

  // dynamic properties
  const aDynamicPropertyIds = a.getDynamicPropertyIds();
  const bDynamicPropertyIds = b.getDynamicPropertyIds();
  if (aDynamicPropertyIds.length !== bDynamicPropertyIds.length) {
    return false;
  }
  for (const id of aDynamicPropertyIds) {
    const aValue = a.getDynamicProperty(id);
    const bValue = b.getDynamicProperty(id);
    if (typeof aValue !== typeof bValue) return false;
    if (typeof aValue === "object") {
      if (!Vector3Utils.equals(aValue, bValue as Vector3)) return false;
    } else if (aValue !== bValue) {
      return false;
    }
  }

  // enchantments
  const aEnchantments = a.getComponent("enchantable")?.getEnchantments() ?? [];
  const bEnchantments = b.getComponent("enchantable")?.getEnchantments() ?? [];
  if (aEnchantments.length !== bEnchantments.length) return false;
  if (
    !aEnchantments.every((enchantment) =>
      bEnchantments.some(
        (other) =>
          enchantment.level === other.level &&
          getEnchantmentTypeId(enchantment) === getEnchantmentTypeId(other),
      ),
    )
  ) {
    return false;
  }

  return true;
}

/**
 * Returns a clone of `itemStack` with the given amount.
 */
export function cloneItemStackWithAmount(
  itemStack: ItemStack,
  amount: number,
): ItemStack {
  const clone = itemStack.clone();
  clone.amount = Math.min(Math.max(amount, 1), clone.maxAmount);
  return clone;
}

export function createItemStack(
  itemType: string,
  amount = 1,
): Result<ItemStack, Error> {
  try {
    return ok(new ItemStack(itemType, amount));
  } catch (e) {
    return err(new Error(`Failed to create ItemStack: ${String(e)}`));
  }
}
