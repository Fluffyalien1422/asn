import { ItemStack } from "@minecraft/server";

export const BACK_BUTTON_ITEM_ID = "fluffyalien_asn:ui_back";
export const NEXT_BUTTON_ITEM_ID = "fluffyalien_asn:ui_next";
export const SEARCH_BUTTON_ITEM_ID = "fluffyalien_asn:ui_search";
export const CANCEL_SEARCH_BUTTON_ITEM_ID = "fluffyalien_asn:ui_cancel_search";
export const GROUP_VIEW_OPEN_ITEM_ID = "fluffyalien_asn:ui_group_view_open";
export const GROUP_VIEW_CLOSE_ITEM_ID = "fluffyalien_asn:ui_group_view_close";

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
