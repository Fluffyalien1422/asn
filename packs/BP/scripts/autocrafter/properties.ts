import { Block } from "@minecraft/server";
import { DynamicPropertyAccessor } from "../utils/dynamic_property_v3";

/** The id of the item this autocrafter produces, or undefined if no recipe is set. */
export const craftItemProperty = new DynamicPropertyAccessor<string>(
  "fluffyalien_asn:craft_item",
);

/**
 * The index of the chosen recipe within the crafted item's recipe list (an item
 * can have multiple recipes). Defaults to the first recipe.
 */
export const craftRecipeIndexProperty = new DynamicPropertyAccessor<
  number,
  number
>("fluffyalien_asn:craft_recipe_index", 0);

/** Sets the recipe this autocrafter should produce. */
export function setCraftRecipe(
  block: Block,
  itemId: string,
  recipeIndex: number,
): void {
  craftItemProperty.set(block, itemId);
  craftRecipeIndexProperty.set(block, recipeIndex);
}
