import { Block } from "@minecraft/server";
import { StorageNetwork } from "../storage_network";
import { createItemStack } from "../utils/item";
import { getAvailableIngredients } from "../storage_ui/items";
import { genrecipes, RECIPES } from "../recipes";
import { craftItemProperty, craftRecipeIndexProperty } from "./properties";

/**
 * Performs one craft on the autocrafter: if its recipe's ingredients are all
 * present in the network, the result is added to the network and the
 * ingredients are consumed. Does nothing while receiving a redstone current.
 */
export async function updateAutocrafter(
  block: Block,
  network: StorageNetwork,
): Promise<void> {
  if (block.getRedstonePower()) return;

  const craftItemId = craftItemProperty.safeGet(block);
  if (!craftItemId) return;

  const recipes = RECIPES[craftItemId] as genrecipes.RecipeData[] | undefined;
  if (!recipes?.length) return;

  // The chosen recipe; fall back to the first if the stored index is stale.
  const recipe = recipes[craftRecipeIndexProperty.safeGet(block)] ?? recipes[0];
  const [resultCount, ingredients] = recipe;

  const storedItemsr = await network.getStoredItemStacks();
  if (storedItemsr.isErr()) return;
  const storedItems = storedItemsr.value;

  // Every ingredient must be fully available (matching by item id or by #tag).
  const available = getAvailableIngredients([...storedItems]);
  for (const [id, count] of ingredients) {
    if ((available.get(id) ?? 0) < count) return;
  }

  const resultStackr = createItemStack(craftItemId, resultCount);
  if (resultStackr.isErr()) return;

  // Add the result first (all-or-nothing). If the network has no room for it,
  // abort without consuming any ingredients so nothing is lost.
  const addedr = await network.addItemStack(resultStackr.value);
  if (addedr.isErr()) return;

  // Consume the ingredients from the network.
  for (const [ingredientTypeId, count] of ingredients) {
    let remaining = count;
    for (const [stackId, stack] of storedItems) {
      if (remaining <= 0) break;

      const matches = ingredientTypeId.startsWith("#")
        ? stack.hasTag(ingredientTypeId.slice(1))
        : stack.typeId === ingredientTypeId;
      if (!matches) continue;

      const removedr = await network.removeItemStack(
        stackId,
        Math.min(remaining, stack.amount),
      );
      if (removedr.isErr()) break;
      remaining -= removedr.value.amount;
    }
  }
}
