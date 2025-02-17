import { ItemStack } from "@minecraft/server";

export const BACK_BUTTON_ITEM_ID = "fluffyalien_asn:storage_viewer_ui_back";
export const NEXT_BUTTON_ITEM_ID = "fluffyalien_asn:storage_viewer_ui_next";
export const SEARCH_BUTTON_ITEM_ID = "fluffyalien_asn:storage_viewer_ui_search";
export const CANCEL_SEARCH_BUTTON_ITEM_ID =
  "fluffyalien_asn:storage_viewer_ui_cancel_search";
export const SORT_AMOUNT_ITEM_ID =
  "fluffyalien_asn:storage_viewer_ui_sort_amount";
export const SORT_INSERTION_ITEM_ID =
  "fluffyalien_asn:storage_viewer_ui_sort_insertion";
export const SORT_RELEVANCY_ITEM_ID =
  "fluffyalien_asn:storage_viewer_ui_sort_relevancy";

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
