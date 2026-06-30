import { Vector3Utils } from "@minecraft/math";
import { Entity, ItemStack, system } from "@minecraft/server";

/** Number of storage items shown on a single page. */
export const ITEMS_PER_PAGE = 50;

// Fixed slot indices in the storage viewer inventory. Slots 0..49 hold the
// items on the current page; the slots below are the control buttons.
export const INPUT_SLOT_INDEX = 50;
export const BACK_BUTTON_INDEX = 51;
export const NEXT_BUTTON_INDEX = 52;
export const PAGE_NUM_DIGIT1_INDEX = 53;
export const PAGE_NUM_DIGIT2_INDEX = 54;
export const CRAFTING_VIEW_BUTTON_INDEX = 55;
export const GROUP_VIEW_BUTTON_INDEX = 56;
export const STACK_SIZE_BUTTON_INDEX = 57;
export const SEARCH_BUTTON_INDEX = 58;

// Button item IDs.
export const BACK_BUTTON_ITEM_ID = "fluffyalien_asn:ui_back";
export const NEXT_BUTTON_ITEM_ID = "fluffyalien_asn:ui_next";
export const SEARCH_BUTTON_ITEM_ID = "fluffyalien_asn:ui_search";
export const CANCEL_SEARCH_BUTTON_ITEM_ID = "fluffyalien_asn:ui_search_cancel";
export const DEFAULT_VIEW_BUTTON_ITEM_ID = "fluffyalien_asn:ui_view_default";
export const GROUP_VIEW_BUTTON_ITEM_ID = "fluffyalien_asn:ui_view_group";
export const CRAFTING_VIEW_BUTTON_ITEM_ID = "fluffyalien_asn:ui_view_crafting";

export const STORAGE_VIEWER_FORCE_CLOSE_TAG =
  "fluffyalien_asn:storage_viewer_force_close";

export function getPageNumberItemStacks(page: number): [ItemStack, ItemStack] {
  if (page < 9) {
    return [
      new ItemStack("fluffyalien_asn:ui_page_number0"),
      new ItemStack(`fluffyalien_asn:ui_page_number${(page + 1).toString()}`),
    ];
  } else if (page >= 99) {
    return [
      new ItemStack("fluffyalien_asn:ui_page_number9"),
      new ItemStack("fluffyalien_asn:ui_page_number10"),
    ];
  } else {
    const pageNumStr = (page + 1).toString();
    return [
      new ItemStack(`fluffyalien_asn:ui_page_number${pageNumStr[0]}`),
      new ItemStack(`fluffyalien_asn:ui_page_number${pageNumStr[1]}`),
    ];
  }
}

export async function forceCloseStorageViewerInventory(
  entity: Entity,
): Promise<void> {
  entity.addTag(STORAGE_VIEWER_FORCE_CLOSE_TAG);
  const ogLocation = { ...entity.location };
  entity.teleport(Vector3Utils.add(entity.location, { y: 99 }));
  await system.waitTicks(4);
  entity.teleport(ogLocation);
  entity.removeTag(STORAGE_VIEWER_FORCE_CLOSE_TAG);
}
