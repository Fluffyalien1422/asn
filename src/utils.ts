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
  direction: Direction
): Block | undefined {
  switch (direction) {
    case $.server.Direction.North:
      return block.north();
    case $.server.Direction.East:
      return block.east();
    case $.server.Direction.South:
      return block.south();
    case $.server.Direction.West:
      return block.west();
    case $.server.Direction.Up:
      return block.above();
    case $.server.Direction.Down:
      return block.below();
  }
}

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

export function abbreviateNumber(value: number): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let newValue: any = value;
  if (value >= 1000) {
    const suffixes = ["", "k", "m", "b", "t"];
    const suffixNum = Math.floor(("" + value).length / 3);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let shortValue: any = "";
    for (let precision = 2; precision >= 1; precision--) {
      shortValue = parseFloat(
        (suffixNum != 0
          ? value / Math.pow(1000, suffixNum)
          : value
        ).toPrecision(precision)
      );
      const dotLessShortValue = (shortValue + "").replace(
        /[^a-zA-Z 0-9]+/g,
        ""
      );
      if (dotLessShortValue.length <= 2) {
        break;
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    if (shortValue % 1 != 0) shortValue = shortValue.toFixed(1);
    newValue = shortValue + suffixes[suffixNum];
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return newValue;
}

export function typeIdWithoutNamespace(typeId: string): string {
  return typeId.split(":").slice(1).join("");
}

export function showForm<T extends ActionFormData | ModalFormData>(
  form: T,
  player: Player
): Promise<T extends ActionFormData ? ActionFormResponse : ModalFormResponse> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
  return form.show(player as any);
}

export function makeMessageUi(
  title: RawMessage,
  body: RawMessage
): ActionFormData {
  const form = new $.serverUi.ActionFormData();

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
    body
  );
}

export function vector3AsDimensionLocation(
  vec: Vector3,
  dimension: Dimension
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
