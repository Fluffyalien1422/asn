import { Block } from "@minecraft/server";
import { DynamicPropertyAccessor } from "../utils/dynamic_property_v3";

// members should be in the same order as OPERATOR_STRS in ./ui
export enum Operator {
  GreaterThan,
  LessThan,
  EqEq,
  NotEq,
}

export enum TestItemEnchantableStatus {
  Ignore,
  WithEnchantments,
  WithoutEnchantments,
}

export const itemProperty = new DynamicPropertyAccessor<string>(
  "fluffyalien_asn:level_emitter_item",
);

export const testAmountProperty = new DynamicPropertyAccessor<number, number>(
  "fluffyalien_asn:level_emitter_test_amount",
  0,
);

export const operatorProperty = new DynamicPropertyAccessor<Operator, Operator>(
  "fluffyalien_asn:level_emitter_operator",
  Operator.GreaterThan,
);

export const testEnchantmentsProperty = new DynamicPropertyAccessor<
  TestItemEnchantableStatus,
  TestItemEnchantableStatus
>(
  "fluffyalien_asn:level_emitter_test_enchantments",
  TestItemEnchantableStatus.Ignore,
);

export const itemMinDamageProperty = new DynamicPropertyAccessor<
  number,
  number
>("fluffyalien_asn:level_emitter_item_min_damage", 0);

export const itemMaxDamageProperty = new DynamicPropertyAccessor<number>(
  "fluffyalien_asn:level_emitter_item_max_damage",
);

/** Resets the optional enchantment and damage filters to their defaults. */
export function resetLevelEmitterFilters(block: Block): void {
  testEnchantmentsProperty.set(block);
  itemMinDamageProperty.set(block);
  itemMaxDamageProperty.set(block);
}
