import { getEntitiesInAllDimensions } from "../utils/dimension";
import { logWarn, makeErrorString } from "../log";
import { itemStacksMatch } from "../utils/item";
import { createErrorMessageForm } from "../utils/ui";
import { showSearchUi } from "./form";
import { abbreviateNumber } from "../utils/string";
import {
  Entity,
  EntityQueryOptions,
  ItemStack,
  Player,
  RawMessage,
  system,
  world,
} from "@minecraft/server";
import { StorageSystem } from "../storage_system";
import {
  BACK_BUTTON_ITEM_ID,
  CANCEL_SEARCH_BUTTON_ITEM_ID,
  CRAFTING_VIEW_BUTTON_ITEM_ID,
  forceCloseStorageViewerInventory,
  getPageNumberItemStacks,
  GROUP_VIEW_CLOSE_ITEM_ID,
  GROUP_VIEW_OPEN_ITEM_ID,
  NEXT_BUTTON_ITEM_ID,
  SEARCH_BUTTON_ITEM_ID,
} from "./shared";
import { RECIPES, RECIPES_ENTRIES } from "../recipes";

const ITEMS_PER_PAGE = 50;
const INPUT_SLOT_INDEX = 50;
const BACK_BUTTON_INDEX = 51;
const NEXT_BUTTON_INDEX = 52;
const PAGE_NUM_DIGIT1_INDEX = 53;
const PAGE_NUM_DIGIT2_INDEX = 54;
const CRAFTING_VIEW_BUTTON_INDEX = 55;
const GROUP_VIEW_BUTTON_INDEX = 56;
const STACK_SIZE_BUTTON_INDEX = 57;
const SEARCH_BUTTON_INDEX = 58;

/**
 * hidden lore marker appended to display items so they can be identified as ui
 * items. the vanilla items shown in the storage viewer do not have the
 * `fluffyalien_asn:ui_item` tag, so this marker is needed to detect them.
 *
 * every character is hidden behind a color code (`§a§s§n` spells "asn") and the
 * trailing `§r` resets the color. the game does not render any visible text for
 * this string, but it can still be read back from the item's lore.
 */
const DISPLAY_ITEM_LORE_MARKER = "§a§s§n§r";

type StorageViewerMode = "default" | "group" | "group_type" | "crafting";
type StorageViewerStackSize = 1 | 2 | 4 | 8 | 16 | 32 | 64;

/**
 * A stored item entry: [Unique ID, ItemStack].
 * Unique ID refers to the UID of the ItemStack assigned by the storage system.
 * Note: Unique ID is an empty string in views where items cannot be removed (eg. crafting, group).
 */
type StoredItem = [string, ItemStack];

interface ViewerData {
  enabled: boolean;
  hasQuery: boolean;
  rawItems: readonly StoredItem[];
  filteredItems: readonly StoredItem[];
  storageSystem: StorageSystem;
  page: number;
  playerInUi: Player;
  mode: StorageViewerMode;
  stackSize: StorageViewerStackSize;
  groupTypeId?: string;
  craftingQuery?: string;
}

/**
 * key = dummy entity ID
 */
const viewerData = new Map<string, ViewerData>();

function isUiItem(itemStack: ItemStack): boolean {
  if (itemStack.hasTag("fluffyalien_asn:ui_item")) return true;
  const firstLine = itemStack.getRawLore()[0] as RawMessage | undefined;
  return (
    (firstLine?.text ?? firstLine?.rawtext?.[0]?.text)?.startsWith(
      DISPLAY_ITEM_LORE_MARKER,
    ) === true
  );
}

/**
 * Prepends DISPLAY_ITEM_LORE_MARKER to the item's lore so it can be
 * identified as a UI display item (see isUiItem).
 */
function addDisplayItemLoreMarker(itemStack: ItemStack): ItemStack {
  if (isUiItem(itemStack)) return itemStack;

  const lore = itemStack.getRawLore();

  if (!lore.length) {
    itemStack.setLore([DISPLAY_ITEM_LORE_MARKER]);
    return itemStack;
  }

  // If the first line has text, merge the marker into it to avoid adding an
  // extra visible line. Otherwise insert the marker as a new first line.
  const firstLine = lore[0];
  if (firstLine.text) {
    itemStack.setLore([
      DISPLAY_ITEM_LORE_MARKER + firstLine.text,
      ...lore.slice(1),
    ]);
  } else if (firstLine.rawtext?.[0]?.text) {
    const [first, ...restRawtext] = firstLine.rawtext;
    itemStack.setLore([
      {
        rawtext: [
          { text: DISPLAY_ITEM_LORE_MARKER + first.text! },
          ...restRawtext,
        ],
      },
      ...lore.slice(1),
    ]);
  } else {
    itemStack.setLore([DISPLAY_ITEM_LORE_MARKER, ...lore]);
  }
  return itemStack;
}

function removeDisplayItemLoreMarker(itemStack: ItemStack): ItemStack {
  const lore = itemStack.getRawLore();
  const firstLine = lore[0] as RawMessage | undefined;

  // Strip the marker prefix. If the marker was the entire line (standalone),
  // drop the line; otherwise keep the remaining text (merged case).
  if (firstLine?.text?.startsWith(DISPLAY_ITEM_LORE_MARKER)) {
    const stripped = firstLine.text.slice(DISPLAY_ITEM_LORE_MARKER.length);
    itemStack.setLore(stripped ? [stripped, ...lore.slice(1)] : lore.slice(1));
    return itemStack;
  }

  const firstNestedText = firstLine?.rawtext?.[0]?.text;
  if (firstNestedText?.startsWith(DISPLAY_ITEM_LORE_MARKER)) {
    const stripped = firstNestedText.slice(DISPLAY_ITEM_LORE_MARKER.length);
    const restRawtext = firstLine!.rawtext!.slice(1);
    const newRawtext = stripped
      ? [{ text: stripped }, ...restRawtext]
      : restRawtext;
    itemStack.setLore(
      newRawtext.length
        ? [{ rawtext: newRawtext }, ...lore.slice(1)]
        : lore.slice(1),
    );
    return itemStack;
  }

  return itemStack;
}

function getItemsOnPage(
  items: readonly StoredItem[],
  page: number,
): StoredItem[] {
  return items.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
}

function getGroupViewItems(items: readonly StoredItem[]): StoredItem[] {
  const types = new Map<string, number>();
  for (const [, item] of items) {
    types.set(item.typeId, (types.get(item.typeId) ?? 0) + item.amount);
  }
  const result: StoredItem[] = [];
  for (const [typeId, count] of types) {
    const itemStack = new ItemStack(typeId);
    itemStack.setLore([`§7${abbreviateNumber(count)} total`]);
    result.push(["", itemStack]);
  }
  return result;
}

function getDisplayItems(data: ViewerData): readonly StoredItem[] {
  switch (data.mode) {
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

function getCraftingViewItems(
  rawItems: readonly StoredItem[],
  query?: string,
): StoredItem[] {
  const available = new Map<string, number>();
  for (const [, stack] of rawItems) {
    available.set(
      stack.typeId,
      (available.get(stack.typeId) ?? 0) + stack.amount,
    );
  }

  const craftable: StoredItem[] = RECIPES_ENTRIES.filter(([, recipeData]) =>
    recipeData.some(([, ingredients]) =>
      ingredients.every(([id, count]) => (available.get(id) ?? 0) >= count),
    ),
  ).map(([item]) => ["", new ItemStack(item)]);

  if (!query) return craftable;
  return searchFilter(query, craftable);
}

function fillViewerInventory(entity: Entity, data: ViewerData): void {
  const inventory = entity.getComponent("inventory")!.container;
  inventory.clearAll();

  const itemsOnPage = getItemsOnPage(getDisplayItems(data), data.page);

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
      data.mode === "group"
        ? GROUP_VIEW_CLOSE_ITEM_ID
        : GROUP_VIEW_OPEN_ITEM_ID,
    ),
  );

  inventory.setItem(
    STACK_SIZE_BUTTON_INDEX,
    new ItemStack(`fluffyalien_asn:ui_stack_size_${data.stackSize.toString()}`),
  );

  inventory.setItem(
    CRAFTING_VIEW_BUTTON_INDEX,
    new ItemStack(CRAFTING_VIEW_BUTTON_ITEM_ID),
  );

  const pageNumItems = getPageNumberItemStacks(data.page);
  inventory.setItem(PAGE_NUM_DIGIT1_INDEX, pageNumItems[0]);
  inventory.setItem(PAGE_NUM_DIGIT2_INDEX, pageNumItems[1]);
}

async function addItemToStorageOrShowError(
  interfaceEntity: Entity,
  data: ViewerData,
  itemStack: ItemStack,
): Promise<boolean> {
  const res = await data.storageSystem.addItemStack(itemStack);
  if (res.isOk()) return true;

  void forceCloseStorageViewerInventory(interfaceEntity).then(() => {
    switch (res.error.type) {
      case "unknownError":
        void createErrorMessageForm({
          translate: "fluffyalien_asn.ui.storageInterface.error.unknownError",
          with: {
            rawtext: [
              {
                text: res.error.message,
              },
            ],
          },
        }).show(data.playerInUi);

        break;
      case "insufficientStorage":
        void createErrorMessageForm({
          translate:
            "fluffyalien_asn.ui.storageInterface.error.insufficientStorage",
        }).show(data.playerInUi);
        break;
      case "insufficientEnergy":
        void createErrorMessageForm({
          translate:
            "fluffyalien_asn.ui.storageInterface.error.insufficientEnergy",
        }).show(data.playerInUi);
        break;
    }
  });

  return false;
}

/**
 * Sorts stored item entries the same way the network previously did: group
 * items of the same type together, then sort within each group by amount
 * ascending.
 */
function sortStoredItems(entries: readonly StoredItem[]): StoredItem[] {
  const groups: ItemStack[] = [];
  const indexed = entries.map(([id, stack]) => {
    let groupIdx = groups.findIndex((g) => g.typeId === stack.typeId);
    if (groupIdx === -1) {
      groupIdx = groups.length;
      groups.push(stack);
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
 * resets interface data and inventory
 * @returns the new ViewerData
 * @throws if the passed entity is not part of the "fluffyalien_asn:storage_viewer" type family
 */
export async function refreshStorageViewer(
  interfaceEntity: Entity,
  player: Player,
  storageSystem: StorageSystem,
  preservePage = false,
): Promise<ViewerData> {
  if (
    !interfaceEntity.matches({
      families: ["fluffyalien_asn:storage_viewer"],
    })
  ) {
    throw new Error(
      makeErrorString(
        "(in refreshStorageViewer) expected `interfaceEntity` to be part of family `fluffyalien_asn:storage_viewer`",
      ),
    );
  }

  const oldData = viewerData.get(interfaceEntity.id);

  let rawItems: readonly StoredItem[];
  let filteredItems: readonly StoredItem[];
  if (oldData?.hasQuery) {
    rawItems = oldData.rawItems;
    filteredItems = oldData.filteredItems;
  } else {
    const storedItemsr = await storageSystem.getStoredItemStacks();
    if (storedItemsr.isErr()) {
      logWarn(`Failed to get stored item stacks: ${storedItemsr.error}`);
      rawItems = [];
      filteredItems = [];
    } else {
      const storedItems = storedItemsr.value;
      const sorted = sortStoredItems([...storedItems.entries()]);
      rawItems = sorted;
      filteredItems = sorted;
    }
  }

  const data: ViewerData = {
    enabled: true,
    hasQuery: oldData?.hasQuery ?? false,
    rawItems,
    filteredItems,
    storageSystem,
    page: preservePage ? (oldData?.page ?? 0) : 0,
    playerInUi: player,
    mode: oldData?.mode ?? "default",
    groupTypeId: oldData?.groupTypeId ?? undefined,
    stackSize: oldData?.stackSize ?? 64,
    craftingQuery: oldData?.craftingQuery,
  };

  viewerData.set(interfaceEntity.id, data);

  fillViewerInventory(interfaceEntity, data);

  return data;
}

function searchFilter(
  query: string,
  items: readonly StoredItem[],
): StoredItem[] {
  const queryKeywords = query.toLowerCase().split(" ");

  const reducer = (matchingCount: number, keyword: string): number =>
    matchingCount +
    (queryKeywords.some((queryKeyword) => keyword.includes(queryKeyword))
      ? 1
      : 0);

  return items
    .filter(([, item]) =>
      queryKeywords.some((keyword) => item.typeId.includes(keyword)),
    )
    .sort(([, a], [, b]) => {
      const aKeywords = a.typeId.split(/:|_/);
      const bKeywords = b.typeId.split(/:|_/);

      const aMatchingKeywordsCount = aKeywords.reduce(reducer, 0);
      const bMatchingKeywordsCount = bKeywords.reduce(reducer, 0);

      const aRelevancy = aMatchingKeywordsCount / aKeywords.length;
      const bRelevancy = bMatchingKeywordsCount / bKeywords.length;

      return bRelevancy - aRelevancy;
    });
}

async function search(
  interfaceEntity: Entity,
  data: ViewerData,
): Promise<void> {
  await forceCloseStorageViewerInventory(interfaceEntity);

  const query = await showSearchUi(data.playerInUi);
  if (!query) {
    return;
  }

  data.hasQuery = true;
  if (data.mode === "crafting") {
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
 * check if an item in the interface inventory has been taken by the player
 */
function isStorageInventoryItemTaken(
  storageItem: ItemStack,
  inventoryItem_: ItemStack,
): boolean {
  const inventoryItem = inventoryItem_.clone();
  removeDisplayItemLoreMarker(inventoryItem);
  return !itemStacksMatch(storageItem, inventoryItem, true);
}

function clearUiItemsFromPlayer(player: Player): void {
  const playerCursorInventory = player.getComponent("cursor_inventory")!;
  if (playerCursorInventory.item && isUiItem(playerCursorInventory.item)) {
    playerCursorInventory.clear();
    return;
  }

  const playerInventory = player.getComponent("inventory")!.container;
  for (let i = 0; i < playerInventory.size; i++) {
    const item = playerInventory.getItem(i);

    if (item && isUiItem(item)) {
      playerInventory.setItem(i);
      return;
    }
  }
}

/**
 * add an item to the storage or show the appropriate error. automatically refreshes the interface if the item was added.
 * if the item was not added then the item will be given back to the player.
 *
 * the viewer is disabled while the (possibly asynchronous) add is in progress
 * and re-enabled when the interface is refreshed. always `continue`/`break`
 * after calling this so the viewer is not processed again until it finishes.
 */
function addItemToStorage(
  interfaceEntity: Entity,
  data: ViewerData,
  itemStack: ItemStack,
): void {
  // disable the viewer until the add finishes so it isn't processed again while
  // the asynchronous add/save is in progress
  data.enabled = false;

  void addItemToStorageOrShowError(interfaceEntity, data, itemStack).then(
    (added) => {
      if (!added) {
        data.playerInUi.dimension.spawnItem(
          itemStack,
          data.playerInUi.location,
        );
        return;
      }

      void refreshStorageViewer(
        interfaceEntity,
        data.playerInUi,
        data.storageSystem,
        true,
      );
    },
  );
}

world.afterEvents.entitySpawn.subscribe((e) => {
  if (e.entity.typeId !== "minecraft:item" || !e.entity.isValid) return;

  const itemStack = e.entity.getComponent("item")!.itemStack;
  if (isUiItem(itemStack)) {
    e.entity.remove();
  }
});

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

    const inventory = entity.getComponent("inventory")!.container;

    const inputSlotItem = inventory.getItem(INPUT_SLOT_INDEX);
    if (inputSlotItem) {
      if (isUiItem(inputSlotItem)) {
        inventory.setItem(INPUT_SLOT_INDEX);
        data.enabled = false;
        void forceCloseStorageViewerInventory(entity);
        continue;
      }

      addItemToStorage(entity, data, inputSlotItem);
      continue;
    }

    const backBtnSlotItem = inventory.getItem(BACK_BUTTON_INDEX);
    if (backBtnSlotItem?.typeId !== BACK_BUTTON_ITEM_ID) {
      clearUiItemsFromPlayer(data.playerInUi);

      data.page = Math.max(data.page - 1, 0);
      fillViewerInventory(entity, data);

      continue;
    }

    const nextBtnSlotItem = inventory.getItem(NEXT_BUTTON_INDEX);
    if (nextBtnSlotItem?.typeId !== NEXT_BUTTON_ITEM_ID) {
      clearUiItemsFromPlayer(data.playerInUi);

      data.page++;
      fillViewerInventory(entity, data);

      continue;
    }

    const craftingViewBtnSlotItem = inventory.getItem(
      CRAFTING_VIEW_BUTTON_INDEX,
    );
    if (craftingViewBtnSlotItem?.typeId !== CRAFTING_VIEW_BUTTON_ITEM_ID) {
      clearUiItemsFromPlayer(data.playerInUi);

      if (data.mode === "crafting") {
        data.mode = "default";
        data.craftingQuery = undefined;
        data.page = 0;
        void refreshStorageViewer(entity, data.playerInUi, data.storageSystem);
      } else {
        data.mode = "crafting";
        data.craftingQuery = undefined;
        data.page = 0;
        fillViewerInventory(entity, data);
      }

      continue;
    }

    const expectedStackSizeBtnItemId = `fluffyalien_asn:ui_stack_size_${data.stackSize.toString()}`;
    const stackSizeBtnSlotItem = inventory.getItem(STACK_SIZE_BUTTON_INDEX);
    if (stackSizeBtnSlotItem?.typeId !== expectedStackSizeBtnItemId) {
      clearUiItemsFromPlayer(data.playerInUi);

      data.stackSize = (
        data.stackSize >= 64 ? 1 : data.stackSize * 2
      ) as StorageViewerStackSize;

      fillViewerInventory(entity, data);

      continue;
    }

    const searchButtonSlotItem = inventory.getItem(SEARCH_BUTTON_INDEX);
    const groupViewButtonSlotItem = inventory.getItem(GROUP_VIEW_BUTTON_INDEX);

    if (data.hasQuery) {
      if (searchButtonSlotItem?.typeId !== CANCEL_SEARCH_BUTTON_ITEM_ID) {
        clearUiItemsFromPlayer(data.playerInUi);

        data.hasQuery = false;
        data.craftingQuery = undefined;
        void refreshStorageViewer(entity, data.playerInUi, data.storageSystem);

        continue;
      }
    } else {
      if (searchButtonSlotItem?.typeId !== SEARCH_BUTTON_ITEM_ID) {
        clearUiItemsFromPlayer(data.playerInUi);

        data.enabled = false;
        void search(entity, data);

        continue;
      }
    }

    const expectedGroupViewItemId: string =
      data.mode === "group"
        ? GROUP_VIEW_CLOSE_ITEM_ID
        : GROUP_VIEW_OPEN_ITEM_ID;
    if (groupViewButtonSlotItem?.typeId !== expectedGroupViewItemId) {
      clearUiItemsFromPlayer(data.playerInUi);

      if (data.mode === "crafting") {
        fillViewerInventory(entity, data);
      } else if (data.mode === "group") {
        data.mode = "default";
        data.groupTypeId = undefined;
        data.page = 0;
        void refreshStorageViewer(entity, data.playerInUi, data.storageSystem);
      } else {
        data.mode = "group";
        data.groupTypeId = undefined;
        data.page = 0;
        fillViewerInventory(entity, data);
      }

      continue;
    }

    const itemsOnPage = getItemsOnPage(getDisplayItems(data), data.page);

    for (let i = 0; i < ITEMS_PER_PAGE; i++) {
      const storageEntry = itemsOnPage[i] as StoredItem | undefined;
      const inventoryItem = inventory.getItem(i);

      if (!storageEntry) {
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

      clearUiItemsFromPlayer(data.playerInUi);

      if (inventoryItem) {
        // give the item back
        data.playerInUi.dimension.spawnItem(
          inventoryItem,
          data.playerInUi.location,
        );
      }

      if (data.mode === "group") {
        data.mode = "group_type";
        data.groupTypeId = storageStack.typeId;
        data.page = 0;
        fillViewerInventory(entity, data);
        break;
      }

      if (data.mode === "crafting") {
        console.log(
          `[ASN] Recipe selected: ${storageStack.typeId}`,
          JSON.stringify(RECIPES[storageStack.typeId]),
        );
        fillViewerInventory(entity, data);
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
}, 4);

world.afterEvents.playerInventoryItemChange.subscribe((e) => {
  if (!e.itemStack || !isUiItem(e.itemStack)) return;
  e.player.getComponent("inventory")?.container.setItem(e.slot);
});
