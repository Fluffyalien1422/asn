/**
 * Selection, filtering and sorting of the stored items shown in the viewer.
 */

import { RawMessage } from "@minecraft/server";
import { abbreviateNumber } from "../utils/string";
import { createItemStack, getItemTranslationKey } from "../utils/item";
import { genrecipes, RECIPES, RECIPES_ENTRIES } from "../recipes";
import { ITEMS_PER_PAGE } from "./shared";
import { StoredItem, ViewerData } from "./state";

/** A craftable recipe paired with the number of times to craft it. */
export interface CraftItemOption {
  recipe: genrecipes.RecipeData;
  amount: number;
}

/** Returns the slice of items that belongs on the given (zero-based) page. */
export function getItemsOnPage(
  items: readonly StoredItem[],
  page: number,
): StoredItem[] {
  return items.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
}

/**
 * Collapses items into one entry per type, with the combined amount shown in
 * the lore. Used by the "group" view.
 */
export function getGroupViewItems(items: readonly StoredItem[]): StoredItem[] {
  const types = new Map<string, number>();
  for (const [, item] of items) {
    types.set(item.typeId, (types.get(item.typeId) ?? 0) + item.amount);
  }
  const result: StoredItem[] = [];
  for (const [typeId, count] of types) {
    const itemStackr = createItemStack(typeId);
    if (itemStackr.isErr()) continue;
    const itemStack = itemStackr.value;
    itemStack.setLore([`§7${abbreviateNumber(count)} total`]);
    result.push(["", itemStack]);
  }
  return result;
}

/**
 * Total available count per ingredient id across the given items, keyed by
 * `typeId` and by `#tag` for every tag the items carry.
 */
export function getAvailableIngredients(
  items: readonly StoredItem[],
): Map<string, number> {
  const available = new Map<string, number>();
  for (const [, stack] of items) {
    available.set(
      stack.typeId,
      (available.get(stack.typeId) ?? 0) + stack.amount,
    );
    for (const tag of stack.getTags()) {
      const tagId = "#" + tag;
      available.set(tagId, (available.get(tagId) ?? 0) + stack.amount);
    }
  }
  return available;
}

/**
 * Returns one entry per recipe whose ingredients can all be satisfied by the
 * currently stored items (matching either by item id or by `#tag`), optionally
 * narrowed by a search query. Used by the "crafting" view.
 */
export function getCraftingViewItems(
  rawItems: readonly StoredItem[],
  query?: string,
): StoredItem[] {
  const available = getAvailableIngredients(rawItems);

  const craftable: StoredItem[] = [];
  for (const [item, recipes] of RECIPES_ENTRIES) {
    const amount = Math.max(
      ...recipes.map(([resultCount, ingredients]) =>
        Math.min(
          ...ingredients.map(
            ([id, count]) =>
              Math.floor((available.get(id) ?? 0) / count) * resultCount,
          ),
        ),
      ),
    );
    if (amount <= 0) continue;
    const itemStackr = createItemStack(item);
    if (itemStackr.isErr()) continue;
    const itemStack = itemStackr.value;
    itemStack.setLore([`§7${abbreviateNumber(amount)} craftable`]);
    craftable.push(["", itemStack]);
  }

  if (!query) return craftable;
  return searchFilter(query, craftable);
}

/**
 * Returns the craftable options for `typeId`: every recipe whose ingredients
 * are all currently available, each paired with `amount` (the number of times
 * to craft it, taken from the viewer's stack size).
 */
export function getCraftItemOptions(
  rawItems: readonly StoredItem[],
  typeId: string | undefined,
  amount: number,
): CraftItemOption[] {
  if (typeId === undefined || !(typeId in RECIPES)) return [];

  const available = getAvailableIngredients(rawItems);
  return RECIPES[typeId]
    .filter(([, ingredients]) =>
      ingredients.every(([id, count]) => (available.get(id) ?? 0) >= count),
    )
    .map((recipe) => ({ recipe, amount }));
}

/**
 * The lore for a craft button: the resulting amount followed by one line per ingredient.
 */
function getCraftButtonLore(
  recipe: genrecipes.RecipeData,
  amount: number,
): RawMessage {
  const [recipeAmount, recipeIngredients] = recipe;
  return {
    rawtext: [
      {
        text: "§7",
      },
      {
        translate: "fluffyalien_asn.ui.storageInterface.craft.button.recipe",
        with: { rawtext: [{ text: (recipeAmount * amount).toString() }] },
      },
      ...recipeIngredients.flatMap(([id, count]): RawMessage[] => {
        const itemName: RawMessage = id.startsWith("#")
          ? {
              translate:
                "fluffyalien_asn.ui.storageInterface.craft.button.recipe.withTag",
              with: { rawtext: [{ text: id.slice(1) }] },
            }
          : { translate: getItemTranslationKey(id) };
        return [{ text: `\n${(count * amount).toString()} ` }, itemName];
      }),
    ],
  };
}

/**
 * Item buttons for the "craft_item" view: one entry per option from
 * {@link getCraftItemOptions}, each an item of the crafted type carrying the
 * recipe details in its lore. The order matches getCraftItemOptions so the
 * interaction poll can map a clicked slot back to its option.
 */
export function getCraftItemDisplayItems(
  rawItems: readonly StoredItem[],
  typeId: string | undefined,
  amount: number,
): StoredItem[] {
  if (typeId === undefined) return [];
  const samplerr = createItemStack(typeId);
  if (samplerr.isErr()) return [];
  const sampler = samplerr.value;

  return getCraftItemOptions(rawItems, typeId, amount).map(
    (option): StoredItem => {
      const itemStack = sampler.clone();
      itemStack.setLore([getCraftButtonLore(option.recipe, option.amount)]);
      return ["", itemStack];
    },
  );
}

/** Returns the items to display for the viewer's current view. */
export function getDisplayItems(data: ViewerData): readonly StoredItem[] {
  switch (data.view) {
    case "group":
      return getGroupViewItems(data.filteredItems);
    case "group_type":
      return data.rawItems.filter(
        ([, item]) => item.typeId === data.groupTypeId,
      );
    case "crafting":
      return getCraftingViewItems(data.rawItems, data.craftingQuery);
    case "craft_item":
      return getCraftItemDisplayItems(
        data.rawItems,
        data.craftItemTypeId,
        data.stackSize,
      );
    case "default":
      return data.filteredItems;
  }
}

/**
 * Sorts stored item entries: group items of the same type together,
 * then sort within each group by amount ascending.
 */
export function sortStoredItems(entries: readonly StoredItem[]): StoredItem[] {
  // assign each item type a group index in first-seen order so items of the
  // same type stay grouped. a Map keeps this O(n) instead of O(n^2).
  const groupIndexes = new Map<string, number>();
  const indexed = entries.map(([id, stack]) => {
    let groupIdx = groupIndexes.get(stack.typeId);
    if (groupIdx === undefined) {
      groupIdx = groupIndexes.size;
      groupIndexes.set(stack.typeId, groupIdx);
    }
    return { id, stack, groupIdx };
  });
  indexed.sort((a, b) =>
    a.groupIdx !== b.groupIdx
      ? a.groupIdx - b.groupIdx
      : b.stack.amount - a.stack.amount,
  );
  return indexed.map(({ id, stack }) => [id, stack]);
}

/**
 * Filters items to those matching the space-separated query, sorted by how
 * large a fraction of each item id's keywords match the query.
 */
export function searchFilter(
  query: string,
  items: readonly StoredItem[],
): StoredItem[] {
  const queryKeywords = query.toLowerCase().split(" ");

  // relevancy is the fraction of an item id's keywords that match the query.
  // compute it once per item id (cached, since storage holds many duplicates)
  // instead of recomputing it for both operands of every sort comparison.
  const relevancyCache = new Map<string, number>();
  const getRelevancy = (typeId: string): number => {
    let relevancy = relevancyCache.get(typeId);
    if (relevancy === undefined) {
      const keywords = typeId.split(/:|_/);
      const matchingCount = keywords.reduce(
        (count, keyword) =>
          count +
          (queryKeywords.some((queryKeyword) => keyword.includes(queryKeyword))
            ? 1
            : 0),
        0,
      );
      relevancy = matchingCount / keywords.length;
      relevancyCache.set(typeId, relevancy);
    }
    return relevancy;
  };

  return items
    .filter(([, item]) =>
      queryKeywords.some((keyword) => item.typeId.includes(keyword)),
    )
    .map((entry) => ({ entry, relevancy: getRelevancy(entry[1].typeId) }))
    .sort((a, b) => b.relevancy - a.relevancy)
    .map(({ entry }) => entry);
}
