import {
  Block,
  Direction,
  ContainerSlot,
  Enchantment,
  Player,
  RawMessage,
  Vector3,
  Dimension,
  DimensionLocation,
  BlockPermutation,
  EquipmentSlot,
  Entity,
} from "@minecraft/server";
import {
  ActionFormData,
  ActionFormResponse,
  ModalFormData,
  ModalFormResponse,
} from "@minecraft/server-ui";
import { ITEM_TRANSLATION_OVERRIDES } from "./item_translation_overrides";

export function getBlockInDirection(
  block: Block,
  direction: Direction,
): Block | undefined {
  switch (direction) {
    case Direction.North:
      return block.north();
    case Direction.East:
      return block.east();
    case Direction.South:
      return block.south();
    case Direction.West:
      return block.west();
    case Direction.Up:
      return block.above();
    case Direction.Down:
      return block.below();
  }
}

export function isBlock(itemId: string): boolean {
  try {
    BlockPermutation.resolve(itemId);
    return true;
  } catch {
    return false;
  }
}

export function getPlayerMainhandSlot(
  player: Player,
): ContainerSlot | undefined {
  return player
    .getComponent("equippable")
    ?.getEquipmentSlot(EquipmentSlot.Mainhand);
}

export function getEnchantmentTypeId(enchantment: Enchantment): string {
  return typeof enchantment.type === "string"
    ? enchantment.type
    : enchantment.type.id;
}

export function abbreviateNumber(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "k";
  }

  return num.toString();
}

export function typeIdWithoutNamespace(typeId: string): string {
  return typeId.split(":").slice(1).join("");
}

export function makeMessageUi(
  title: RawMessage,
  body: RawMessage,
): ActionFormData {
  const form = new ActionFormData();

  form.title(title);
  form.body(body);
  form.button({
    translate: "fluffyalien_asn.ui.common.close",
  });

  return form;
}

export function makeErrorMessageUi(body: RawMessage): ActionFormData {
  return makeMessageUi(
    {
      translate: "fluffyalien_asn.ui.common.error",
    },
    body,
  );
}

export function vector3AsDimensionLocation(
  vec: Vector3,
  dimension: Dimension,
): DimensionLocation {
  return { ...vec, dimension };
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

export function receivingRedstoneSignal(block: Block): boolean {
  return (
    !!block.north()?.getRedstonePower() ||
    !!block.east()?.getRedstonePower() ||
    !!block.south()?.getRedstonePower() ||
    !!block.west()?.getRedstonePower()
  );
}

export function getEntityAtBlockLocation(
  location: DimensionLocation,
  entityId: string,
): Entity | undefined {
  return location.dimension
    .getEntitiesAtBlockLocation(location)
    .find((v) => v.typeId === entityId);
}
