import { Block, DimensionLocation, Entity } from "@minecraft/server";
import { StorageNetwork } from "../storage_network";
import { StrCardinalDirection, getBlockInDirection } from "../utils/direction";
import {
  getBlockDynamicProperty,
  setBlockDynamicProperty,
} from "../utils/dynamic_property";

export type ExportBusExportItemEnchantments = "with" | "without" | "ignore";

export interface ExportBusExportItemDamageRange {
  min: number;
  max?: number;
}

export function updateExportBus(block: Block, network: StorageNetwork): void {
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

  const itemStack = network
    .getStoredItemStacks()
    .find(
      (itemStack) =>
        itemStack.typeId === exportItemId &&
        (exportItemEnchantmentsStatus === "ignore" ||
          (exportItemEnchantmentsStatus === "with" &&
            itemStack.enchantments.length) ||
          (exportItemEnchantmentsStatus === "without" &&
            !itemStack.enchantments.length)) &&
        itemStack.damage >= exportItemDamageRange.min &&
        (exportItemDamageRange.max === undefined ||
          itemStack.damage <= exportItemDamageRange.max),
    );

  if (!itemStack) {
    return;
  }

  const notAdded = container.addItem(itemStack.toItemStack(1));
  if (notAdded) {
    return;
  }

  network.removeItemStack(itemStack.withAmount(1));
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
