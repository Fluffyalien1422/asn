import { Block } from "@minecraft/server";
import { DynamicPropertyAccessor } from "../utils/dynamic_property_v3";

export type ExportBusExportItemEnchantments = "with" | "without" | "ignore";

export interface ExportBusExportItemDamageRange {
  min: number;
  max?: number;
}

export const exportItemProperty = new DynamicPropertyAccessor<string>(
  "fluffyalien_asn:export_item",
);

export const exportItemEnchantmentsProperty = new DynamicPropertyAccessor<
  ExportBusExportItemEnchantments,
  ExportBusExportItemEnchantments
>("fluffyalien_asn:export_item_enchants", "ignore");

export const exportItemDamageMinProperty = new DynamicPropertyAccessor<
  number,
  number
>("fluffyalien_asn:export_item_damage_min", 0);

export const exportItemDamageMaxProperty = new DynamicPropertyAccessor<number>(
  "fluffyalien_asn:export_item_damage_max",
);

export function getExportItemDamageRange(
  block: Block,
): ExportBusExportItemDamageRange {
  return {
    min: exportItemDamageMinProperty.safeGet(block),
    max: exportItemDamageMaxProperty.safeGet(block),
  };
}

export function setExportItemDamageRange(
  block: Block,
  range: ExportBusExportItemDamageRange,
): void {
  exportItemDamageMinProperty.set(block, range.min);
  exportItemDamageMaxProperty.set(block, range.max);
}

/** Resets the optional enchantment and damage filters to their defaults. */
export function resetExportItemFilters(block: Block): void {
  exportItemEnchantmentsProperty.set(block, "ignore");
  setExportItemDamageRange(block, { min: 0 });
}
