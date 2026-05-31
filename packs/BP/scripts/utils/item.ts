import {
  ContainerSlot,
  Enchantment,
  EquipmentSlot,
  ItemStack,
  Player,
  Vector3,
} from "@minecraft/server";
import { Vector3Utils } from "@minecraft/math";

export function getPlayerMainhandSlot(player: Player): ContainerSlot {
  return player
    .getComponent("equippable")!
    .getEquipmentSlot(EquipmentSlot.Mainhand);
}

export function getItemTranslationKey(itemId: string): string {
  return new ItemStack(itemId).localizationKey;
}

export function getEnchantmentTypeId(enchantment: Enchantment): string {
  return typeof enchantment.type === "string"
    ? enchantment.type
    : enchantment.type.id;
}

export function getItemStackDamage(itemStack: ItemStack): number {
  return itemStack.getComponent("durability")?.damage ?? 0;
}

/**
 * Manually compares two {@link ItemStack}s for equality (ignoring amount).
 *
 * ItemStack#isStackableWith cannot be used to check if two item stacks
 * match because it always returns `false` for items that are not stackable
 * (eg. items with durability). This function compares the relevant item data
 * directly, mirroring the legacy `StorageSystemItemStack#isStackableWith`.
 */
export function itemStacksMatch(a: ItemStack, b: ItemStack): boolean {
  if (a.typeId !== b.typeId) return false;
  if (a.nameTag !== b.nameTag) return false;
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
  clone.amount = amount;
  return clone;
}
