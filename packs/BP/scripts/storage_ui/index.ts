import { getEntitiesInAllDimensions } from "../utils/dimension";
import { makeErrorString } from "../log";
import { wait } from "../utils/async";
import {
  cloneItemStackWithAmount,
  getItemTranslationKey,
  itemStacksMatch,
} from "../utils/item";
import { makeErrorMessageUi, showForm } from "../utils/ui";
import { showRequestItemUi, showSearchUi } from "./form";
import {
  Entity,
  EntityQueryOptions,
  ItemStack,
  Player,
  system,
  world,
} from "@minecraft/server";
import { showRequestItemDialogRule } from "../addon_rules/addon_rules";
import { StorageSystem } from "../storage_system";
import {
  BACK_BUTTON_ITEM_ID,
  CANCEL_SEARCH_BUTTON_ITEM_ID,
  getPageNumberItemStacks,
  NEXT_BUTTON_ITEM_ID,
  SEARCH_BUTTON_ITEM_ID,
  SORT_AMOUNT_ITEM_ID,
  SORT_INSERTION_ITEM_ID,
  SORT_RELEVANCY_ITEM_ID,
} from "./shared";

const ITEMS_PER_PAGE = 50;
const INPUT_SLOT_INDEX = 51;
const BACK_BUTTON_INDEX = 52;
const NEXT_BUTTON_INDEX = 53;
const PAGE_NUM_DIGIT1_INDEX = 54;
const PAGE_NUM_DIGIT2_INDEX = 55;
const SEARCH_BUTTON_INDEX = 56;
const SORT_BUTTON_INDEX = 57;
const STACK_SIZE_BUTTON_INDEX = 58;

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

type StorageViewerSortOrder = "insertion" | "amount";
type StorageViewerStackSize = 1 | 2 | 4 | 8 | 16 | 32 | 64;

interface ViewerData {
  enabled: boolean;
  hasQuery: boolean;
  items: ItemStack[];
  storageSystem: StorageSystem;
  page: number;
  playerInUi: Player;
  /**
   * this value should be ignored if `hasQuery` is true, sorting should be relevancy
   */
  sortOrder: StorageViewerSortOrder;
  stackSize: StorageViewerStackSize;
}

/**
 * key = dummy entity ID
 */
const viewerData = new Map<string, ViewerData>();

function isUiItem(itemStack: ItemStack): boolean {
  return (
    itemStack.hasTag("fluffyalien_asn:ui_item") ||
    itemStack.getLore()[0] === DISPLAY_ITEM_LORE_MARKER
  );
}

export function forceCloseInventory(entity: Entity): Promise<void> {
  const ogLocation = { ...entity.location };

  entity.teleport({
    x: entity.location.x,
    y: entity.location.y + 99,
    z: entity.location.z,
  });

  entity.teleport(ogLocation);

  return wait(4);
}

function getItemsOnPage(
  items: readonly ItemStack[],
  page: number,
): ItemStack[] {
  return items.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
}

function fillViewerInventory(entity: Entity, data: ViewerData): void {
  const inventory = entity.getComponent("inventory")!.container;
  inventory.clearAll();

  const itemsOnPage = getItemsOnPage(data.items, data.page);

  for (let i = 0; i < itemsOnPage.length; i++) {
    // items are stored as real ItemStacks (each up to its max stack size) and
    // the amount is set directly on the stack, so the item can be displayed
    // as-is without using lore to show the amount.
    //
    // the vanilla items shown here do not have the `fluffyalien_asn:ui_item`
    // tag, so a hidden lore marker is prepended so `isUiItem` can still
    // identify them as display items.
    const displayItem = itemsOnPage[i].clone();
    displayItem.setLore([DISPLAY_ITEM_LORE_MARKER, ...displayItem.getLore()]);
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
    SORT_BUTTON_INDEX,
    new ItemStack(
      data.hasQuery
        ? SORT_RELEVANCY_ITEM_ID
        : data.sortOrder === "insertion"
          ? SORT_INSERTION_ITEM_ID
          : SORT_AMOUNT_ITEM_ID,
    ),
  );

  inventory.setItem(
    STACK_SIZE_BUTTON_INDEX,
    new ItemStack(
      `fluffyalien_asn:storage_viewer_ui_stack_size_${data.stackSize.toString()}`,
    ),
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
  const res = await data.storageSystem.addItemStack(itemStack, data.playerInUi);
  if (res.success) return true;

  void forceCloseInventory(interfaceEntity).then(() => {
    switch (res.error.type) {
      case "insufficientStorage":
        void showForm(
          makeErrorMessageUi({
            translate:
              "fluffyalien_asn.ui.storageInterface.error.insufficientStorage",
          }),
          data.playerInUi,
        );
        break;
      case "insufficientEnergy":
        void showForm(
          makeErrorMessageUi({
            translate:
              "fluffyalien_asn.ui.storageInterface.error.insufficientEnergy",
          }),
          data.playerInUi,
        );
        break;
      case "bannedItem":
        void showForm(
          makeErrorMessageUi({
            translate: "fluffyalien_asn.ui.storageInterface.error.bannedItem",
            with: {
              rawtext: [
                {
                  rawtext: [
                    { text: "§l" },
                    { translate: getItemTranslationKey(res.error.itemId) },
                    { text: "§r" },
                  ],
                },
              ],
            },
          }),
          data.playerInUi,
        );
        break;
    }
  });

  return false;
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
  const sortOrder = oldData?.sortOrder ?? "insertion";

  let items: ItemStack[];
  if (oldData?.hasQuery) {
    items = oldData.items;
  } else {
    items = [...(await storageSystem.getStoredItemStacks())._unsafeUnwrap()];

    if (sortOrder === "amount") {
      items.sort((a, b) => b.amount - a.amount);
    }
  }

  const data: ViewerData = {
    enabled: true,
    hasQuery: oldData?.hasQuery ?? false,
    items,
    storageSystem,
    page: preservePage ? (oldData?.page ?? 0) : 0,
    playerInUi: player,
    sortOrder,
    stackSize: oldData?.stackSize ?? 64,
  };

  viewerData.set(interfaceEntity.id, data);

  fillViewerInventory(interfaceEntity, data);

  return data;
}

async function requestItemLegacy(
  interfaceEntity: Entity,
  player: Player,
  network: StorageSystem,
  item: ItemStack,
): Promise<void> {
  await forceCloseInventory(interfaceEntity);

  const requestedItemStack = await showRequestItemUi(player, item);
  if (!requestedItemStack) return;

  await network.takeOutItemStack(player, requestedItemStack);
}

async function search(
  interfaceEntity: Entity,
  data: ViewerData,
): Promise<void> {
  await forceCloseInventory(interfaceEntity);

  const query = await showSearchUi(data.playerInUi);
  if (!query) {
    return;
  }

  data.hasQuery = true;

  const queryKeywords = query.toLowerCase().split(" ");

  const reducer = (matchingCount: number, keyword: string): number =>
    matchingCount +
    (queryKeywords.some((queryKeyword) => keyword.includes(queryKeyword))
      ? 1
      : 0);

  data.items = data.items
    .filter((item) =>
      queryKeywords.some((keyword) => item.typeId.includes(keyword)),
    )
    .sort((a, b) => {
      const aKeywords = a.typeId.split(/:|_/);
      const bKeywords = b.typeId.split(/:|_/);

      const aMatchingKeywordsCount = aKeywords.reduce(reducer, 0);
      const bMatchingKeywordsCount = bKeywords.reduce(reducer, 0);

      const aRelevancy = aMatchingKeywordsCount / aKeywords.length;
      const bRelevancy = bMatchingKeywordsCount / bKeywords.length;

      return bRelevancy - aRelevancy;
    });

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

  // remove the first lore line - it's the hidden marker added to display items
  // so they match the stored item again
  inventoryItem.setLore(inventoryItem.getLore().slice(1));

  // use itemStacksMatch instead of ItemStack#isStackableWith because
  // isStackableWith always returns false for non-stackable items.
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

  void Promise.resolve(
    addItemToStorageOrShowError(interfaceEntity, data, itemStack),
  ).then((added) => {
    if (!added) {
      data.playerInUi.dimension.spawnItem(itemStack, data.playerInUi.location);
      return;
    }

    void refreshStorageViewer(
      interfaceEntity,
      data.playerInUi,
      data.storageSystem,
      true,
    );
  });
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
        void forceCloseInventory(entity);
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

    const expectedStackSizeBtnItemId = `fluffyalien_asn:storage_viewer_ui_stack_size_${data.stackSize.toString()}`;
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
    const sortButtonSlotItem = inventory.getItem(SORT_BUTTON_INDEX);

    if (data.hasQuery) {
      if (searchButtonSlotItem?.typeId !== CANCEL_SEARCH_BUTTON_ITEM_ID) {
        clearUiItemsFromPlayer(data.playerInUi);

        data.hasQuery = false;
        void refreshStorageViewer(entity, data.playerInUi, data.storageSystem);

        continue;
      }

      if (sortButtonSlotItem?.typeId !== SORT_RELEVANCY_ITEM_ID) {
        clearUiItemsFromPlayer(data.playerInUi);

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

      if (
        data.sortOrder === "insertion" &&
        sortButtonSlotItem?.typeId !== SORT_INSERTION_ITEM_ID
      ) {
        clearUiItemsFromPlayer(data.playerInUi);

        data.sortOrder = "amount";
        void refreshStorageViewer(entity, data.playerInUi, data.storageSystem);

        continue;
      }

      if (
        data.sortOrder === "amount" &&
        sortButtonSlotItem?.typeId !== SORT_AMOUNT_ITEM_ID
      ) {
        clearUiItemsFromPlayer(data.playerInUi);

        data.sortOrder = "insertion";
        void refreshStorageViewer(entity, data.playerInUi, data.storageSystem);

        continue;
      }
    }

    const itemsOnPage = getItemsOnPage(data.items, data.page);

    for (let i = 0; i < ITEMS_PER_PAGE; i++) {
      const storageItem = itemsOnPage[i] as ItemStack | undefined;
      const inventoryItem = inventory.getItem(i);

      if (!storageItem) {
        if (inventoryItem && !isUiItem(inventoryItem)) {
          addItemToStorage(entity, data, inventoryItem);
          break;
        }

        continue;
      }

      if (
        inventoryItem &&
        !isStorageInventoryItemTaken(storageItem, inventoryItem)
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

      if (showRequestItemDialogRule.get(world)) {
        data.enabled = false;
        void requestItemLegacy(
          entity,
          data.playerInUi,
          data.storageSystem,
          storageItem,
        );
        break;
      }

      if (storageItem.amount <= 0) {
        break;
      }

      void Promise.resolve(
        data.storageSystem.takeOutItemStack(
          data.playerInUi,
          // takeOutItemStack will clamp this value if it is greater than the amount available in storage
          cloneItemStackWithAmount(
            storageItem,
            Math.min(data.stackSize, storageItem.maxAmount),
          ),
        ),
      ).then(() => {
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
