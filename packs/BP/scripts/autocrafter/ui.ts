import { Block, Player, RawMessage } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { createMessageForm } from "../utils/ui";
import { getItemTranslationKey } from "../utils/item";
import { genrecipes, RECIPES } from "../recipes";
import { craftItemProperty, setCraftRecipe } from "./properties";

/** The item name in bold, for use as a `with` substitution in a RawMessage. */
function boldItemName(itemId: string): RawMessage {
  return {
    rawtext: [{ text: "§l" }, { translate: getItemTranslationKey(itemId) }],
  };
}

/** Body shown when the autocrafter has a recipe set: "Crafting <item>". */
function craftingItemBody(itemId: string): RawMessage {
  return {
    translate: "fluffyalien_asn.ui.autocrafter.craftingItem",
    with: { rawtext: [boldItemName(itemId)] },
  };
}

/**
 * A button label describing a recipe: the result count followed by one line per
 * ingredient. Mirrors the craft button lore used by the storage viewer.
 */
function getRecipeButtonLabel(recipe: genrecipes.RecipeData): RawMessage {
  const [resultCount, ingredients] = recipe;
  return {
    rawtext: [
      {
        translate: "fluffyalien_asn.ui.storageInterface.craft.button.recipe",
        with: { rawtext: [{ text: resultCount.toString() }] },
      },
      ...ingredients.flatMap(([id, count]): RawMessage[] => {
        const itemName: RawMessage = id.startsWith("#")
          ? {
              translate:
                "fluffyalien_asn.ui.storageInterface.craft.button.recipe.withTag",
              with: { rawtext: [{ text: id.slice(1) }] },
            }
          : { translate: getItemTranslationKey(id) };
        return [{ text: `\n${count.toString()} ` }, itemName];
      }),
    ],
  };
}

/**
 * Prompts the player to choose one of `recipes` for `itemId`, then stores the
 * selection on the block.
 */
async function showRecipeChooser(
  player: Player,
  block: Block,
  itemId: string,
  recipes: readonly genrecipes.RecipeData[],
): Promise<void> {
  const form = new ActionFormData();
  form.title({ translate: "tile.fluffyalien_asn:autocrafter.name" });
  form.body({
    translate: "fluffyalien_asn.ui.autocrafter.chooseRecipe",
    with: { rawtext: [boldItemName(itemId)] },
  });

  for (const recipe of recipes) {
    form.button(getRecipeButtonLabel(recipe));
  }

  const response = await form.show(player);
  if (response.canceled || response.selection === undefined) {
    return;
  }

  setCraftRecipe(block, itemId, response.selection);
}

/**
 * Shows the autocrafter UI. When `heldItemId` is set (the player interacted
 * while holding an item) the recipe is (re)configured to that item; otherwise
 * the current status is shown.
 */
export async function showAutocrafterUi(
  player: Player,
  block: Block,
  heldItemId: string | undefined,
): Promise<void> {
  // Configuring a new recipe from the held item.
  if (heldItemId !== undefined) {
    const recipes = RECIPES[heldItemId] as genrecipes.RecipeData[] | undefined;

    if (!recipes?.length) {
      await createMessageForm(
        { translate: "tile.fluffyalien_asn:autocrafter.name" },
        {
          translate: "fluffyalien_asn.ui.autocrafter.noRecipes",
          with: { rawtext: [boldItemName(heldItemId)] },
        },
      ).show(player);
      return;
    }

    if (recipes.length === 1) {
      setCraftRecipe(block, heldItemId, 0);
      await createMessageForm(
        { translate: "tile.fluffyalien_asn:autocrafter.name" },
        craftingItemBody(heldItemId),
      ).show(player);
      return;
    }

    await showRecipeChooser(player, block, heldItemId, recipes);
    return;
  }

  // Empty hand: show the current status.
  const craftItemId = craftItemProperty.safeGet(block);
  if (!craftItemId) {
    await createMessageForm(
      { translate: "tile.fluffyalien_asn:autocrafter.name" },
      { translate: "fluffyalien_asn.ui.autocrafter.noRecipe" },
    ).show(player);
    return;
  }

  // If the crafted item has multiple recipes, let the player re-pick which one.
  const recipes = RECIPES[craftItemId] as genrecipes.RecipeData[] | undefined;
  if (recipes && recipes.length > 1) {
    await showRecipeChooser(player, block, craftItemId, recipes);
    return;
  }

  await createMessageForm(
    { translate: "tile.fluffyalien_asn:autocrafter.name" },
    craftingItemBody(craftItemId),
  ).show(player);
}
