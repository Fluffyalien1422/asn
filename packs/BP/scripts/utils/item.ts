import {
  BlockPermutation,
  ContainerSlot,
  Enchantment,
  EquipmentSlot,
  Player,
} from "@minecraft/server";
import { ITEM_TRANSLATION_OVERRIDES } from "../item_translation_overrides";

export function isBlock(itemId: string): boolean {
  try {
    BlockPermutation.resolve(itemId);
    return true;
  } catch {
    return false;
  }
}

export function getPlayerMainhandSlot(player: Player): ContainerSlot {
  return player
    .getComponent("equippable")!
    .getEquipmentSlot(EquipmentSlot.Mainhand);
}

export function getItemTranslationKey(itemId: string): string {
  if (itemId in ITEM_TRANSLATION_OVERRIDES) {
    return ITEM_TRANSLATION_OVERRIDES[itemId];
  }

  const isMinecraftNamespace = itemId.startsWith("minecraft:");
  const translationKeyItemId = isMinecraftNamespace
    ? itemId.slice("minecraft:".length)
    : itemId;

  return isBlock(itemId)
    ? `tile.${translationKeyItemId}.name`
    : isMinecraftNamespace
      ? `item.${translationKeyItemId}.name`
      : `item.${translationKeyItemId}`;
}

export function getEnchantmentTypeId(enchantment: Enchantment): string {
  return typeof enchantment.type === "string"
    ? enchantment.type
    : enchantment.type.id;
}
