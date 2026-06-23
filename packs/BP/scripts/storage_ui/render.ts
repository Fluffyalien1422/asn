import { Entity, ItemStack } from "@minecraft/server";
import {
  BACK_BUTTON_INDEX,
  CRAFTING_VIEW_BUTTON_INDEX,
  GROUP_VIEW_BUTTON_INDEX,
  NEXT_BUTTON_INDEX,
  PAGE_NUM_DIGIT1_INDEX,
  PAGE_NUM_DIGIT2_INDEX,
  SEARCH_BUTTON_INDEX,
  STACK_SIZE_BUTTON_INDEX,
  BACK_BUTTON_ITEM_ID,
  CANCEL_SEARCH_BUTTON_ITEM_ID,
  CRAFTING_VIEW_BUTTON_ITEM_ID,
  getPageNumberItemStacks,
  NEXT_BUTTON_ITEM_ID,
  SEARCH_BUTTON_ITEM_ID,
  DEFAULT_VIEW_BUTTON_ITEM_ID,
  GROUP_VIEW_BUTTON_ITEM_ID,
} from "./shared";
import { getDisplayItems, getItemsOnPage } from "./items";
import { addDisplayItemLoreMarker } from "./ui_item";
import { StoredItem, ViewerData } from "./state";

/**
 * Rebuilds the storage viewer entity's inventory from its current state:
 * the items for the current page followed by the control buttons.
 */
export function fillViewerInventory(entity: Entity, data: ViewerData): void {
  const inventory = entity.getComponent("inventory")!.container;
  inventory.clearAll();

  // Cache the items for this page so the interaction poll doesn't recompute the
  // display list. The entries are cloned rather than cached as-is: getDisplayItems
  // can return live references into the network's stored-item cache (eg. the
  // default and group_type views), and the network mutates a stack's `amount` in
  // place when items are added (an import bus, autocrafter, or another player
  // depositing items while the viewer is open). The poll detects a "take" by
  // comparing the inventory against these entries, so a live reference would make
  // such an external change look like the player taking the item. Cloning freezes
  // each entry until the inventory is next rebuilt.
  const itemsOnPage: StoredItem[] = getItemsOnPage(
    getDisplayItems(data),
    data.page,
  ).map(([id, stack]): StoredItem => [id, stack.clone()]);
  data.itemsOnPage = itemsOnPage;

  for (let i = 0; i < itemsOnPage.length; i++) {
    // items are stored as real ItemStacks (each up to its max stack size) and
    // the amount is set directly on the stack, so the item can be displayed
    // as-is without using lore to show the amount.
    //
    // the vanilla items shown here do not have the `fluffyalien_asn:ui_item`
    // tag, so a hidden lore marker is prepended so `isUiItem` can still
    // identify them as display items.
    const displayItem = itemsOnPage[i][1].clone();
    addDisplayItemLoreMarker(displayItem);
    inventory.setItem(i, displayItem);
  }

  inventory.setItem(BACK_BUTTON_INDEX, new ItemStack(BACK_BUTTON_ITEM_ID));
  inventory.setItem(
    SEARCH_BUTTON_INDEX,
    new ItemStack(
      data.hasQuery ? CANCEL_SEARCH_BUTTON_ITEM_ID : SEARCH_BUTTON_ITEM_ID,
    ),
  );
  inventory.setItem(NEXT_BUTTON_INDEX, new ItemStack(NEXT_BUTTON_ITEM_ID));

  inventory.setItem(
    GROUP_VIEW_BUTTON_INDEX,
    new ItemStack(
      data.view === "group"
        ? DEFAULT_VIEW_BUTTON_ITEM_ID
        : GROUP_VIEW_BUTTON_ITEM_ID,
    ),
  );

  inventory.setItem(
    STACK_SIZE_BUTTON_INDEX,
    new ItemStack(`fluffyalien_asn:ui_stack_size_${data.stackSize.toString()}`),
  );

  inventory.setItem(
    CRAFTING_VIEW_BUTTON_INDEX,
    new ItemStack(
      data.view === "crafting"
        ? DEFAULT_VIEW_BUTTON_ITEM_ID
        : CRAFTING_VIEW_BUTTON_ITEM_ID,
    ),
  );

  const pageNumItems = getPageNumberItemStacks(data.page);
  inventory.setItem(PAGE_NUM_DIGIT1_INDEX, pageNumItems[0]);
  inventory.setItem(PAGE_NUM_DIGIT2_INDEX, pageNumItems[1]);
}
