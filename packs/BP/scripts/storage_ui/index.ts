import { getEntitiesInAllDimensions } from "../utils/dimension";
import { showSearchForm } from "./form";
import { Entity, EntityQueryOptions, system, world } from "@minecraft/server";
import {
  BACK_BUTTON_ITEM_ID,
  CANCEL_SEARCH_BUTTON_ITEM_ID,
  CRAFTING_VIEW_BUTTON_ITEM_ID,
  forceCloseStorageViewerInventory,
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
  DEFAULT_VIEW_BUTTON_ITEM_ID,
  GROUP_VIEW_BUTTON_ITEM_ID,
} from "./shared";
import {
  StorageViewerStackSize,
  StoredItem,
  ViewerData,
  viewerData,
} from "./state";
import {
  getAvailableIngredients,
  getCraftItemOptions,
  searchFilter,
} from "./items";
import { fillViewerInventory } from "./render";
import { addItemToStorage, refreshStorageViewerOrLog } from "./storage";
import {
  clearUiItemsFromPlayer,
  isStorageInventoryItemTaken,
  isUiItem,
} from "./ui_item";
import { logWarn } from "../log";
import { createItemStack } from "../utils/item";
import { genrecipes } from "../recipes";

// Re-export the public entry point used by storage_interface / wireless_interface.
export { refreshStorageViewerOrLog } from "./storage";

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

/**
 * Crafts `recipe` (producing item `typeId`) up to `craftAmount` times, clamped
 * to the ingredients currently in storage, then refreshes the viewer. This is
 * the action the old craft form performed when a recipe button was pressed.
 */
async function craft(
  entity: Entity,
  data: ViewerData,
  typeId: string,
  recipe: genrecipes.RecipeData,
  craftAmount: number,
): Promise<void> {
  const refresh = (): void => {
    refreshStorageViewerOrLog(
      entity,
      data.playerInUi,
      data.storageSystem,
      true,
    );
  };

  const resultStackr = createItemStack(typeId);
  if (resultStackr.isErr()) {
    logWarn(`Failed to craft item: ${resultStackr.error.message}`);
    refresh();
    return;
  }
  const resultStack = resultStackr.value;

  const storedItemsr = await data.storageSystem.getStoredItemStacks();
  if (storedItemsr.isErr()) {
    logWarn(`Failed to prepare crafting: ${storedItemsr.error}`);
    refresh();
    return;
  }
  const storedItems = storedItemsr.value;
  const [recipeAmount, recipeIngredients] = recipe;

  // `storedItems` is a live reference to the storage system's cache. We compute
  // everything against it before removing anything, so the craft is
  // non-destructive: if it can no longer be fully satisfied we craft the maximum
  // the current contents allow and never remove unused ingredients.
  const available = getAvailableIngredients([...storedItems]);

  // Clamp the requested craft count to what the available ingredients support.
  let crafts = craftAmount;
  for (const [ingredientId, count] of recipeIngredients) {
    crafts = Math.min(
      crafts,
      Math.floor((available.get(ingredientId) ?? 0) / count),
    );
  }
  if (crafts <= 0) {
    refresh();
    return;
  }

  for (const [ingredientId, count] of recipeIngredients) {
    let remaining = count * crafts;
    for (const [stackId, stack] of storedItems) {
      if (remaining <= 0) break;
      const matches = ingredientId.startsWith("#")
        ? stack.hasTag(ingredientId.slice(1))
        : stack.typeId === ingredientId;
      if (!matches) continue;

      const toRemove = Math.min(remaining, stack.amount);
      const removedr = await data.storageSystem.removeItemStack(
        stackId,
        toRemove,
      );
      if (removedr.isErr()) {
        logWarn(
          `Failed to remove ingredient during crafting: ${removedr.error.type === "unknownError" ? removedr.error.message : removedr.error.type}`,
        );
        refresh();
        return;
      }
      remaining -= removedr.value.amount;
    }
  }

  const totalAmount = recipeAmount * crafts;
  const location = data.playerInUi.location;
  const dimension = data.playerInUi.dimension;

  let spawned = 0;
  while (spawned < totalAmount) {
    const spawnStack = resultStack.clone();
    spawnStack.amount = Math.min(totalAmount - spawned, resultStack.maxAmount);
    dimension.spawnItem(spawnStack, location);
    spawned += spawnStack.amount;
  }

  refresh();
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
  if (
    handleButton(
      CRAFTING_VIEW_BUTTON_INDEX,
      data.view === "crafting"
        ? DEFAULT_VIEW_BUTTON_ITEM_ID
        : CRAFTING_VIEW_BUTTON_ITEM_ID,
    )
  ) {
    data.groupTypeId = undefined;
    data.craftItemTypeId = undefined;
    data.craftingQuery = undefined;
    data.hasQuery = false;
    data.page = 0;
    if (data.view === "crafting") {
      data.view = "default";
      refreshStorageViewerOrLog(entity, player, data.storageSystem);
    } else {
      data.view = "crafting";
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
      refreshStorageViewerOrLog(entity, player, data.storageSystem);
    } else {
      data.enabled = false;
      void search(entity, data);
    }
    return;
  }

  // Group view: toggle between the grouped view and the default view.
  if (
    handleButton(
      GROUP_VIEW_BUTTON_INDEX,
      data.view === "group"
        ? DEFAULT_VIEW_BUTTON_ITEM_ID
        : GROUP_VIEW_BUTTON_ITEM_ID,
    )
  ) {
    data.groupTypeId = undefined;
    data.craftItemTypeId = undefined;
    data.craftingQuery = undefined;
    data.hasQuery = false;
    data.page = 0;
    if (data.view === "group") {
      data.view = "default";
      refreshStorageViewerOrLog(entity, player, data.storageSystem);
    } else {
      data.view = "group";
      fillViewerInventory(entity, data);
    }
    return;
  }

  // No control button changed; check whether the player took an item slot.
  // Reuse the page items cached when the inventory was last (re)built rather
  // than recomputing the (potentially expensive) display list every poll.
  const itemsOnPage = data.itemsOnPage;

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
      // Drill into the clicked item's craft options (replaces the craft form).
      data.view = "craft_item";
      data.craftItemTypeId = storageStack.typeId;
      data.page = 0;
      fillViewerInventory(entity, data);
      break;
    }

    if (data.view === "craft_item") {
      // Each item button maps to one recipe×amount option; perform that craft.
      const options = getCraftItemOptions(
        data.rawItems,
        data.craftItemTypeId,
        data.stackSize,
      );
      const optionIndex = data.page * ITEMS_PER_PAGE + i;
      if (optionIndex < options.length) {
        const { recipe, amount } = options[optionIndex];
        data.enabled = false;
        void craft(entity, data, storageStack.typeId, recipe, amount);
      }
      break;
    }

    if (storageStack.amount <= 0) {
      break;
    }

    void data.storageSystem
      .takeOutItemStack(data.playerInUi, storageId, data.stackSize)
      .finally(() => {
        refreshStorageViewerOrLog(
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
        maxDistance: 15,
      }).length
    ) {
      // Handle edge case where the inventory was closed or disabled but interactions
      // were not re-allowed:
      // ---
      // Ensure enabled is false. This will trigger if data.enabled was true
      // but there were no players in range.
      if (data) data.enabled = false;
      // If the viewer is disabled, then ensure interactions are allowed.
      if (
        entity.getProperty("fluffyalien_asn:interactions_allowed") === false
      ) {
        entity.triggerEvent("fluffyalien_asn:allow_interactions");
      }
      // ---

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
