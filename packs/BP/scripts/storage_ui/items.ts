/**
 * Selection, filtering and sorting of the stored items shown in the viewer.
 */

import { abbreviateNumber } from "../utils/string";
import { createItemStack } from "../utils/item";
import { RECIPES_ENTRIES } from "../recipes";
import { ITEMS_PER_PAGE } from "./shared";
import { StoredItem, ViewerData } from "./state";

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
 * Returns one entry per recipe whose ingredients can all be satisfied by the
 * currently stored items (matching either by item id or by `#tag`), optionally
 * narrowed by a search query. Used by the "crafting" view.
 */
export function getCraftingViewItems(
  rawItems: readonly StoredItem[],
  query?: string,
): StoredItem[] {
  const available = new Map<string, number>();
  for (const [, stack] of rawItems) {
    available.set(
      stack.typeId,
      (available.get(stack.typeId) ?? 0) + stack.amount,
    );
    for (const tag of stack.getTags()) {
      const tagId = "#" + tag;
      available.set(tagId, (available.get(tagId) ?? 0) + stack.amount);
    }
  }

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
