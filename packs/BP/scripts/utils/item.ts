import {
  ContainerSlot,
  Enchantment,
  EquipmentSlot,
  ItemStack,
  Player,
} from "@minecraft/server";

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
