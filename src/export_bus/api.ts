import { Block, DimensionLocation, Entity } from "@minecraft/server";
import { StorageNetwork } from "../storage_network";
import { EXPORT_BUS_ENTITY_TYPE_ID } from ".";

export type ExportBusExportItemEnchantments = "with" | "without" | "ignore";

export interface ExportBusExportItemDamageRange {
  min: number;
  max?: number;
}

export function updateExportBus(block: Block, network: StorageNetwork): void {
  const cardinalDirection = block.permutation.getState(
    "minecraft:cardinal_direction"
  ) as string;

  const target =
    cardinalDirection === "north"
      ? block.north()
      : cardinalDirection === "east"
      ? block.east()
      : cardinalDirection === "south"
      ? block.south()
      : block.west();

  const container = target?.getComponent("inventory")?.container;
  if (!container) return;

  const dummyEntity = getExportBusEntity(block);
  if (!dummyEntity) {
    console.warn(
      `(updateExportBus) Could not update export bus at (${block.x}, ${block.y}, ${block.z}) in ${block.dimension.id}: could not get dummy entity.`
    );
    return;
  }

  const exportItemId = getExportBusExportItemId(dummyEntity);
  if (!exportItemId) {
    return;
  }

  const exportItemEnchantmentsStatus =
    getExportBusExportItemEnchantments(dummyEntity);

  const exportItemDamageRange = getExportBusExportItemDamageRange(dummyEntity);

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
          itemStack.damage <= exportItemDamageRange.max)
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
 */
export function getExportBusEntity(
  location: DimensionLocation
): Entity | undefined {
  return location.dimension
    .getEntitiesAtBlockLocation(location)
    .find((v) => v.typeId === EXPORT_BUS_ENTITY_TYPE_ID);
}

export function getExportBusExportItemId(entity: Entity): string | undefined {
  return entity.getDynamicProperty("fluffyalien_asn:export_item") as
    | string
    | undefined;
}

export function setExportBusExportItemId(entity: Entity, value: string): void {
  entity.setDynamicProperty("fluffyalien_asn:export_item", value);
}

export function getExportBusExportItemEnchantments(
  entity: Entity
): ExportBusExportItemEnchantments {
  return (
    (entity.getDynamicProperty("fluffyalien_asn:export_item_enchantments") as
      | ExportBusExportItemEnchantments
      | undefined) ?? "ignore"
  );
}

export function setExportBusExportItemEnchantments(
  entity: Entity,
  value: ExportBusExportItemEnchantments
): void {
  entity.setDynamicProperty("fluffyalien_asn:export_item_enchantments", value);
}

export function getExportBusExportItemDamageRange(
  entity: Entity
): ExportBusExportItemDamageRange {
  const min =
    (entity.getDynamicProperty("fluffyalien_asn:export_item_damage_min") as
      | number
      | undefined) ?? 0;

  const max = entity.getDynamicProperty(
    "fluffyalien_asn:export_item_damage_max"
  ) as number | undefined;

  return { min, max };
}

export function setExportBusExportItemDamageRange(
  entity: Entity,
  value: ExportBusExportItemDamageRange
): void {
  entity.setDynamicProperty(
    "fluffyalien_asn:export_item_damage_min",
    value.min
  );

  entity.setDynamicProperty(
    "fluffyalien_asn:export_item_damage_max",
    value.max
  );
}
