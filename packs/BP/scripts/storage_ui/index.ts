import { getEntitiesInAllDimensions } from "../utils/dimension";
import { showCraftForm, showSearchForm } from "./form";
import {
  Entity,
  EntityQueryOptions,
  ItemStack,
  system,
  world,
} from "@minecraft/server";
import {
  BACK_BUTTON_ITEM_ID,
  CANCEL_SEARCH_BUTTON_ITEM_ID,
  CRAFTING_VIEW_BUTTON_ITEM_ID,
  forceCloseStorageViewerInventory,
  GROUP_VIEW_CLOSE_ITEM_ID,
  GROUP_VIEW_OPEN_ITEM_ID,
  NEXT_BUTTON_ITEM_ID,
  SEARCH_BUTTON_ITEM_ID,
  BACK_BUTTON_INDEX,
  CRAFTING_VIEW_BUTTON_INDEX,
  GROUP_VIEW_BUTTON_INDEX,
  INPUT_SLOT_INDEX,
  ITEMS_PER_PAGE,
  NEXT_BUTTON_INDEX,
  SEARCH_BUTTON_INDEX,
  STACK_SIZE_BUTTON_INDEX,
} from "./shared";
import {
  StorageViewerStackSize,
  StoredItem,
  ViewerData,
  viewerData,
} from "./state";
import { getDisplayItems, getItemsOnPage, searchFilter } from "./items";
import { fillViewerInventory } from "./render";
import { addItemToStorage, refreshStorageViewer } from "./storage";
import {
  clearUiItemsFromPlayer,
  isStorageInventoryItemTaken,
  isUiItem,
} from "./ui_item";
import { logWarn } from "../log";

// Re-export the public entry point used by storage_interface / wireless_interface.
export { refreshStorageViewer } from "./storage";

/**
 * Prompts the player for a search query and applies it to the viewer. The
 * crafting view filters its recipe list; other views filter the stored items.
 */
async function search(
  interfaceEntity: Entity,
  data: ViewerData,
): Promise<void> {
  await forceCloseStorageViewerInventory(interfaceEntity);

  const query = await showSearchForm(data.playerInUi);
  if (!query) {
    return;
  }

  data.hasQuery = true;
  if (data.view === "crafting") {
    data.craftingQuery = query;
  } else {
    data.filteredItems = searchFilter(query, data.rawItems);
  }

  data.playerInUi.onScreenDisplay.setActionBar({
    translate:
      "fluffyalien_asn.actionbar.storageInterface.openToViewQueryResults",
  });
}

async function craft(
  entity: Entity,
  data: ViewerData,
  itemStack: ItemStack,
): Promise<void> {
  await forceCloseStorageViewerInventory(entity);

  const storedItemsr = await data.storageSystem.getStoredItemStacks();
  if (storedItemsr.isErr()) {
    logWarn(`Failed to prepare crafting UI: ${storedItemsr.error}`);
    return;
  }
  const storedItems = storedItemsr.value;

  showCraftForm(data.playerInUi, itemStack, storedItems);
}

/**
 * Handles one tick of interaction for a single storage viewer entity.
 *
 * The viewer has no input events, so interaction is detected by polling: each
 * control slot is compared against the item it should hold, and any mismatch
 * means the player clicked (took) that button. The first detected change is
 * handled and processing stops for this tick. Item slots are checked last.
 */
function processStorageViewerEntity(entity: Entity, data: ViewerData): void {
  const inventory = entity.getComponent("inventory")!.container;

  // An item placed in the input slot is added to storage. UI items must never
  // be stored, so a stray UI item there just closes the viewer.
  const inputSlotItem = inventory.getItem(INPUT_SLOT_INDEX);
  if (inputSlotItem) {
    if (isUiItem(inputSlotItem)) {
      inventory.setItem(INPUT_SLOT_INDEX);
      data.enabled = false;
      void forceCloseStorageViewerInventory(entity);
      return;
    }

    addItemToStorage(entity, data, inputSlotItem);
    return;
  }

  const player = data.playerInUi;

  const handleButton = (index: number, id: string): boolean => {
    if (inventory.getItem(index)?.typeId === id) return false;
    clearUiItemsFromPlayer(player);
    return true;
  };

  // Back: go to the previous page (clamped at the first page).
  if (handleButton(BACK_BUTTON_INDEX, BACK_BUTTON_ITEM_ID)) {
    data.page = Math.max(data.page - 1, 0);
    fillViewerInventory(entity, data);
    return;
  }

  // Next: go to the next page.
  if (handleButton(NEXT_BUTTON_INDEX, NEXT_BUTTON_ITEM_ID)) {
    data.page++;
    fillViewerInventory(entity, data);
    return;
  }

  // Crafting view: toggle between the crafting view and the default view.
  if (handleButton(CRAFTING_VIEW_BUTTON_INDEX, CRAFTING_VIEW_BUTTON_ITEM_ID)) {
    data.view = data.view === "crafting" ? "default" : "crafting";
    data.craftingQuery = undefined;
    data.page = 0;
    if (data.view === "default") {
      void refreshStorageViewer(entity, player, data.storageSystem);
    } else {
      fillViewerInventory(entity, data);
    }
    return;
  }

  // Stack size: cycle 1 -> 2 -> 4 -> ... -> 64 -> 1.
  if (
    handleButton(
      STACK_SIZE_BUTTON_INDEX,
      `fluffyalien_asn:ui_stack_size_${data.stackSize.toString()}`,
    )
  ) {
    data.stackSize = (
      data.stackSize >= 64 ? 1 : data.stackSize * 2
    ) as StorageViewerStackSize;
    fillViewerInventory(entity, data);
    return;
  }

  // Search: this slot toggles between "search" and "cancel search" depending on
  // whether a query is active, so its expected item and action both vary.
  if (
    handleButton(
      SEARCH_BUTTON_INDEX,
      data.hasQuery ? CANCEL_SEARCH_BUTTON_ITEM_ID : SEARCH_BUTTON_ITEM_ID,
    )
  ) {
    if (data.hasQuery) {
      // cancel the active query and reload the full storage contents
      data.hasQuery = false;
      data.craftingQuery = undefined;
      void refreshStorageViewer(entity, player, data.storageSystem);
    } else {
      data.enabled = false;
      void search(entity, data);
    }
    return;
  }

  // Group view: toggle between the grouped view and the default view. In the
  // crafting view this button has no effect, so it just refills the inventory.
  if (
    handleButton(
      GROUP_VIEW_BUTTON_INDEX,
      data.view === "group"
        ? GROUP_VIEW_CLOSE_ITEM_ID
        : GROUP_VIEW_OPEN_ITEM_ID,
    )
  ) {
    if (data.view === "crafting") {
      fillViewerInventory(entity, data);
    } else if (data.view === "group") {
      data.view = "default";
      data.groupTypeId = undefined;
      data.page = 0;
      void refreshStorageViewer(entity, player, data.storageSystem);
    } else {
      data.view = "group";
      data.groupTypeId = undefined;
      data.page = 0;
      fillViewerInventory(entity, data);
    }
    return;
  }

  // No control button changed; check whether the player took an item slot.
  const itemsOnPage = getItemsOnPage(getDisplayItems(data), data.page);

  for (let i = 0; i < ITEMS_PER_PAGE; i++) {
    const storageEntry = itemsOnPage[i] as StoredItem | undefined;
    const inventoryItem = inventory.getItem(i);

    if (!storageEntry) {
      // Empty display slot: a real item here was deposited by the player.
      if (inventoryItem && !isUiItem(inventoryItem)) {
        addItemToStorage(entity, data, inventoryItem);
        break;
      }

      continue;
    }

    const [storageId, storageStack] = storageEntry;

    if (
      inventoryItem &&
      !isStorageInventoryItemTaken(storageStack, inventoryItem)
    ) {
      continue;
    }

    // An item has been selected:

    clearUiItemsFromPlayer(data.playerInUi);

    if (inventoryItem) {
      // give the item back
      data.playerInUi.dimension.spawnItem(
        inventoryItem,
        data.playerInUi.location,
      );
    }

    if (data.view === "group") {
      // Drill into the clicked type's individual stacks.
      data.view = "group_type";
      data.groupTypeId = storageStack.typeId;
      data.page = 0;
      fillViewerInventory(entity, data);
      break;
    }

    if (data.view === "crafting") {
      data.enabled = false;
      void craft(entity, data, storageStack);
      break;
    }

    if (storageStack.amount <= 0) {
      break;
    }

    void data.storageSystem
      .takeOutItemStack(data.playerInUi, storageId, data.stackSize)
      .finally(() => {
        void refreshStorageViewer(
          entity,
          data.playerInUi,
          data.storageSystem,
          true,
        );
      });

    break;
  }
}

// Prevent UI items from escaping into the world (eg. if one is somehow dropped).
world.afterEvents.entitySpawn.subscribe((e) => {
  if (e.entity.typeId !== "minecraft:item" || !e.entity.isValid) return;

  const itemStack = e.entity.getComponent("item")!.itemStack;
  if (isUiItem(itemStack)) {
    e.entity.remove();
  }
});

// Poll every storage viewer for player interaction. The viewer is only
// processed while enabled and while a player is nearby.
system.runInterval(() => {
  const entityQueryOptions: EntityQueryOptions = {
    // we also want this to run for the wireless interface, so check families instead of type
    families: ["fluffyalien_asn:storage_viewer"],
  };

  for (const entity of getEntitiesInAllDimensions(entityQueryOptions)) {
    const data = viewerData.get(entity.id);
    if (
      !data?.enabled ||
      !entity.dimension.getPlayers({
        location: entity.location,
        maxDistance: 10,
      }).length
    ) {
      continue;
    }

    processStorageViewerEntity(entity, data);
  }
}, 4);

// Strip UI items that end up in a player's inventory (eg. left over from a view).
world.afterEvents.playerInventoryItemChange.subscribe((e) => {
  if (!e.itemStack || !isUiItem(e.itemStack)) return;
  e.player.getComponent("inventory")?.container.setItem(e.slot);
});
