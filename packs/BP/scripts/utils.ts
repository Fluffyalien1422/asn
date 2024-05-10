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
  system,
} from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { ITEM_TRANSLATION_OVERRIDES } from "./item_translation_overrides";
import { Vector3Utils } from "@minecraft/math";

export type CardinalDirection = "north" | "east" | "south" | "west";
export type VerticalDirection = "up" | "down";
export type FacingDirection = CardinalDirection | VerticalDirection;

export function getBlockInDirection(
  block: Block,
  direction: Direction | FacingDirection,
): Block | undefined {
  switch (direction) {
    case "north":
    case Direction.North:
      return block.north();
    case "east":
    case Direction.East:
      return block.east();
    case "south":
    case Direction.South:
      return block.south();
    case "west":
    case Direction.West:
      return block.west();
    case "up":
    case Direction.Up:
      return block.above();
    case "down":
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

export function truncateNumber(num: number, decPlaces: number): string {
  const [beforeDec, afterDec] = num.toString().split(".");

  if (afterDec) {
    return `${beforeDec}.${afterDec.slice(0, decPlaces)}`;
  }

  return beforeDec;
}

export function abbreviateNumber(num: number): string {
  if (num === 1_000_000) {
    return "1M";
  }

  if (num > 1_000_000) {
    return "1M+";
  }

  if (num >= 1000) {
    return truncateNumber(num / 1000, 1) + "k";
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

export function recievingRedstoneSignalFromDirection(
  block: Block,
  direction: Direction,
): boolean {
  const target = getBlockInDirection(block, direction);
  if (!target?.getRedstonePower()) {
    return false;
  }

  if (direction === Direction.Up || direction === Direction.Down) {
    return ![
      "minecraft:redstone_wire",
      "minecraft:powered_comparator",
      "minecraft:powered_repeater",
    ].includes(target.typeId);
  }

  if (
    target.typeId === "minecraft:powered_comparator" ||
    target.typeId === "minecraft:powered_repeater"
  ) {
    const facingBlock = getBlockInDirection(
      target,
      reverseDirection(
        target.permutation.getState(
          "minecraft:cardinal_direction",
        ) as CardinalDirection,
      ),
    );

    if (!facingBlock) {
      return false;
    }

    return Vector3Utils.equals(block, facingBlock);
  }

  return true;
}

export function receivingRedstoneSignal(block: Block): boolean {
  return (
    recievingRedstoneSignalFromDirection(block, Direction.North) ||
    recievingRedstoneSignalFromDirection(block, Direction.East) ||
    recievingRedstoneSignalFromDirection(block, Direction.South) ||
    recievingRedstoneSignalFromDirection(block, Direction.West) ||
    recievingRedstoneSignalFromDirection(block, Direction.Up) ||
    recievingRedstoneSignalFromDirection(block, Direction.Down)
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
export function reverseDirection(dir: Direction): Direction;
export function reverseDirection(dir: CardinalDirection): CardinalDirection;
export function reverseDirection(dir: VerticalDirection): VerticalDirection;
export function reverseDirection(dir: FacingDirection): FacingDirection;
export function reverseDirection(
  dir: Direction | FacingDirection,
): Direction | FacingDirection {
  switch (dir) {
    case Direction.North:
      return Direction.South;
    case Direction.East:
      return Direction.West;
    case Direction.South:
      return Direction.North;
    case Direction.West:
      return Direction.West;
    case Direction.Up:
      return Direction.Down;
    case Direction.Down:
      return Direction.Up;
    case "north":
      return "south";
    case "east":
      return "west";
    case "south":
      return "north";
    case "west":
      return "east";
    case "up":
      return "down";
    case "down":
      return "up";
  }
}

export function wait(ticks: number): Promise<void> {
  return new Promise((resolve) => {
    system.runInterval(resolve, ticks);
  });
}
