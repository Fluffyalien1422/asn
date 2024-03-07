import { ContainerSlot, Enchantment, Player } from "@minecraft/server";

export function isBlock(itemId: string): boolean {
  try {
    $.server.BlockPermutation.resolve(itemId);
    return true;
  } catch {
    return false;
  }
}

export function getPlayerMainhandSlot(
  player: Player
): ContainerSlot | undefined {
  return player
    .getComponent("equippable")
    ?.getEquipmentSlot($.server.EquipmentSlot.Mainhand);
}

export function getEnchantmentTypeId(enchantment: Enchantment): string {
  return typeof enchantment.type === "string"
    ? enchantment.type
    : enchantment.type.id;
}
