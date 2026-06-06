import { Block, DimensionLocation, Entity, ItemStack } from "@minecraft/server";
import { StorageNetwork } from "../storage_network";
import { StrCardinalDirection, getBlockInDirection } from "../utils/direction";
import {
  getBlockDynamicProperty,
  setBlockDynamicProperty,
} from "../utils/dynamic_property";
import { cloneItemStackWithAmount, getItemStackDamage } from "../utils/item";

export type ExportBusExportItemEnchantments = "with" | "without" | "ignore";

export interface ExportBusExportItemDamageRange {
  min: number;
  max?: number;
}

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

  const dynamicPropertyTarget = getExportBusEntity(block) ?? block;

  const exportItemId = getExportBusExportItemId(dynamicPropertyTarget);
  if (!exportItemId) {
    return;
  }

  const exportItemEnchantmentsStatus = getExportBusExportItemEnchantments(
    dynamicPropertyTarget,
  );

  const exportItemDamageRange = getExportBusExportItemDamageRange(
    dynamicPropertyTarget,
  );

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

  const notAdded = container.addItem(cloneItemStackWithAmount(foundItemStack, 1));
  if (notAdded) {
    return;
  }

  await network.removeItemStack(foundId, 1);
}

/**
 * Gets the export bus dummy entity at a {@link DimensionLocation}
 * @param location the block location of the export bus
 * @returns the {@link Entity} or undefined if it could not be found
 * @deprecated
 * Data is now stored on the block itself, this function is only
 * used for backwards compatibility.
 */
export function getExportBusEntity(
  location: DimensionLocation,
): Entity | undefined {
  return location.dimension
    .getEntitiesAtBlockLocation(location)
    .find((v) => v.typeId === "fluffyalien_asn:export_bus_entity");
}

export function getExportBusExportItemId(
  target: Block | Entity,
): string | undefined {
  if (target instanceof Block) {
    return getBlockDynamicProperty(target, "exportItem") as string | undefined;
  }
  // legacy support
  return target.getDynamicProperty("fluffyalien_asn:export_item") as
    | string
    | undefined;
}

export function setExportBusExportItemId(
  target: Block | Entity,
  value: string,
): void {
  if (target instanceof Block) {
    setBlockDynamicProperty(target, "exportItem", value);
  } else {
    // legacy support
    target.setDynamicProperty("fluffyalien_asn:export_item", value);
  }
}

export function getExportBusExportItemEnchantments(
  target: Block | Entity,
): ExportBusExportItemEnchantments {
  if (target instanceof Block) {
    return (
      (getBlockDynamicProperty(target, "exportItemEnchantments") as
        | ExportBusExportItemEnchantments
        | undefined) ?? "ignore"
    );
  }
  // legacy support
  return (
    (target.getDynamicProperty("fluffyalien_asn:export_item_enchantments") as
      | ExportBusExportItemEnchantments
      | undefined) ?? "ignore"
  );
}

export function setExportBusExportItemEnchantments(
  target: Block | Entity,
  value: ExportBusExportItemEnchantments,
): void {
  if (target instanceof Block) {
    setBlockDynamicProperty(target, "exportItemEnchantments", value);
  } else {
    // legacy support
    target.setDynamicProperty(
      "fluffyalien_asn:export_item_enchantments",
      value,
    );
  }
}

export function getExportBusExportItemDamageRange(
  target: Block | Entity,
): ExportBusExportItemDamageRange {
  if (target instanceof Block) {
    return {
      min:
        (getBlockDynamicProperty(target, "exportItemDamageMin") as
          | number
          | undefined) ?? 0,
      max:
        (getBlockDynamicProperty(target, "exportItemDamageMax") as
          | number
          | undefined) ?? undefined,
    };
  }

  // legacy support
  return {
    min:
      (target.getDynamicProperty("fluffyalien_asn:export_item_damage_min") as
        | number
        | undefined) ?? 0,
    max: target.getDynamicProperty("fluffyalien_asn:export_item_damage_max") as
      | number
      | undefined,
  };
}

export function setExportBusExportItemDamageRange(
  target: Block | Entity,
  value: ExportBusExportItemDamageRange,
): void {
  if (target instanceof Block) {
    setBlockDynamicProperty(target, "exportItemDamageMin", value.min);
    setBlockDynamicProperty(target, "exportItemDamageMax", value.max);
  } else {
    // legacy support

    target.setDynamicProperty(
      "fluffyalien_asn:export_item_damage_min",
      value.min,
    );

    target.setDynamicProperty(
      "fluffyalien_asn:export_item_damage_max",
      value.max,
    );
  }
}
