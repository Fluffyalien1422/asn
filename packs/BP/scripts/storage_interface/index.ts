import { showEstablishNetworkError } from "../cable_network";
import { Logger } from "../log";
import { StorageNetwork } from "../storage_network";
import { StorageSystemItemStack } from "../storage_system_item_stack";
import { wait } from "../utils/async";
import { updateBlockConnectStates } from "../utils/block_connect";
import {
  STR_DIRECTIONS,
  StrCardinalDirection,
  reverseDirection,
} from "../utils/direction";
import { getItemTranslationKey } from "../utils/item";
import { abbreviateNumber } from "../utils/string";
import { makeErrorMessageUi } from "../utils/ui";
import { showRequestItemUi, showSearchUi } from "./form";
import {
  Block,
  BlockCustomComponent,
  Entity,
  EntityQueryOptions,
  EquipmentSlot,
  ItemStack,
  Player,
  system,
  world,
} from "@minecraft/server";

const ITEMS_PER_PAGE = 27;

const INPUT_SLOT_INDEX = 27;

const BACK_BUTTON_INDEX = 28;
const BACK_BUTTON_ITEM_ID = "fluffyalien_asn:storage_interface_ui_item_back";

const NEXT_BUTTON_INDEX = 29;
const NEXT_BUTTON_ITEM_ID = "fluffyalien_asn:storage_interface_ui_item_next";

const SEARCH_BUTTON_INDEX = 30;
const SEARCH_BUTTON_ITEM_ID =
  "fluffyalien_asn:storage_interface_ui_item_search";
const CANCEL_SEARCH_BUTTON_ITEM_ID =
  "fluffyalien_asn:storage_interface_ui_item_cancel_search";

const DISPLAY_ITEM_LORE_STR_END = "§a§s§n§r";

const log = new Logger("storage_interface/index.ts");

interface InterfaceData {
  enabled: boolean;
  hasQuery: boolean;
  items: readonly StorageSystemItemStack[];
  network: StorageNetwork;
  page: number;
  playerInUi: Player;
}

/**
 * key = dummy entity ID
 */
const interfaceData = new Map<string, InterfaceData>();

function getDisplayItemLoreStr(amount: number): string {
  return `§r§2§l${abbreviateNumber(amount)}${DISPLAY_ITEM_LORE_STR_END}`;
}

function isDisplayItem(itemStack: ItemStack): boolean {
  return !!itemStack.getLore()[0]?.endsWith(DISPLAY_ITEM_LORE_STR_END);
}

function forceCloseInventory(entity: Entity): Promise<void> {
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
  items: readonly StorageSystemItemStack[],
  page: number,
): StorageSystemItemStack[] {
  return items.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
}

function fillInterfaceInventory(entity: Entity, data: InterfaceData): void {
  const inventory = entity.getComponent("inventory")!.container!;
  inventory.clearAll();

  const itemsOnPage = getItemsOnPage(data.items, data.page);

  for (let i = 0; i < itemsOnPage.length; i++) {
    const storageSystemItem = itemsOnPage[i];

    const displayItem = storageSystemItem.toItemStack();
    displayItem.setLore([
      getDisplayItemLoreStr(storageSystemItem.amount),
      ...displayItem.getLore(),
    ]);

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
}

async function getNetworkOrShowError(
  block: Block,
  interfaceEntity: Entity,
  player: Player,
): Promise<StorageNetwork | undefined> {
  const networkResult = await StorageNetwork.getOrEstablishNetwork(block);
  if (!networkResult.success) {
    await forceCloseInventory(interfaceEntity);
    void showEstablishNetworkError(player, networkResult.error);

    return;
  }

  return networkResult.value;
}

function addItemToNetworkOrShowError(
  interfaceEntity: Entity,
  data: InterfaceData,
  itemStack: StorageSystemItemStack,
): boolean {
  const res = data.network.addItemStack(itemStack);
  if (res.success) return true;

  void forceCloseInventory(interfaceEntity).then(() => {
    switch (res.error.type) {
      case "insufficientStorage":
        void makeErrorMessageUi({
          translate:
            "fluffyalien_asn.ui.storageInterface.error.insufficientStorage",
        }).show(data.playerInUi);
        break;
      case "bannedItem":
        void makeErrorMessageUi({
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
        }).show(data.playerInUi);
        break;
    }
  });

  return false;
}

/**
 * resets interface data and inventory
 * @returns the new InterfaceData
 * @throws if the passed entity is not part of the "fluffyalien_asn:storage_interface" type family
 */
export function refreshInterface(
  interfaceEntity: Entity,
  player: Player,
  network: StorageNetwork,
): InterfaceData {
  if (
    !interfaceEntity.matches({
      families: ["fluffyalien_asn:storage_interface"],
    })
  ) {
    throw new Error(
      log.makeRaiseString(
        "refreshInterface",
        "expected `interfaceEntity` to be part of family `fluffyalien_asn:storage_interface`",
      ),
    );
  }

  const oldData = interfaceData.get(interfaceEntity.id);

  const data: InterfaceData = {
    enabled: true,
    hasQuery: oldData?.hasQuery ?? false,
    items: oldData?.hasQuery ? oldData.items : network.getStoredItemStacks(),
    network,
    page: 0,
    playerInUi: player,
  };

  interfaceData.set(interfaceEntity.id, data);

  fillInterfaceInventory(interfaceEntity, data);

  return data;
}

async function requestItem(
  interfaceEntity: Entity,
  player: Player,
  network: StorageNetwork,
  item: StorageSystemItemStack,
): Promise<void> {
  await forceCloseInventory(interfaceEntity);

  const requestedItemStack = await showRequestItemUi(player, item);
  if (!requestedItemStack) return;

  network.takeOutItemStack(player, requestedItemStack);
}

async function search(
  interfaceEntity: Entity,
  data: InterfaceData,
): Promise<void> {
  await forceCloseInventory(interfaceEntity);

  const query = await showSearchUi(data.playerInUi);
  if (!query) {
    return;
  }

  data.hasQuery = true;

  const keywords = query.toLowerCase().split(" ");

  data.items = data.items
    .filter((item) => keywords.some((keyword) => item.typeId.includes(keyword)))
    .sort((a, b) =>
      keywords.filter((keyword) => b.typeId.includes(keyword)).length >
      keywords.filter((keyword) => a.typeId.includes(keyword)).length
        ? 1
        : 0,
    );

  data.playerInUi.onScreenDisplay.setActionBar({
    translate:
      "fluffyalien_asn.actionbar.storageInterface.openToViewQueryResults",
  });
}

/**
 * check if an item in the interface inventory has been taken by the player
 */
function isStorageInventoryItemTaken(
  storageItem: StorageSystemItemStack,
  inventoryItem: ItemStack,
): boolean {
  inventoryItem = inventoryItem.clone();

  // remove the first lore line - it's the line that shows the amount in the storage
  inventoryItem.setLore(inventoryItem.getLore().slice(1));

  if (
    storageItem.isStackableWith(
      StorageSystemItemStack.fromItemStack(inventoryItem),
    )
  ) {
    return false;
  }

  return true;
}

/**
 * removes an item taken from the interface entity's inventory from the player
 */
function clearTakenItemFromPlayer(
  player: Player,
  takenItem: StorageSystemItemStack,
): void {
  const playerInventory = player.getComponent("inventory")!.container!;
  const playerEquipmentInventory = player.getComponent("equippable")!;

  const playerRecoverItems: (ItemStack | null)[] = [];
  for (let i = 0; i < playerInventory.size; i++) {
    const item = playerInventory.getItem(i);

    if (
      item &&
      !takenItem.isStackableWith(StorageSystemItemStack.fromItemStack(item))
    ) {
      playerRecoverItems.push(item);
    } else {
      playerRecoverItems.push(null);
    }
  }

  const playerRecoverEquipment: Record<string, ItemStack> = {};
  for (const equipmentSlot of [
    EquipmentSlot.Chest,
    EquipmentSlot.Feet,
    EquipmentSlot.Head,
    EquipmentSlot.Legs,
    EquipmentSlot.Offhand,
  ]) {
    const item = playerEquipmentInventory.getEquipment(equipmentSlot);
    if (item) {
      playerRecoverEquipment[equipmentSlot] = item;
    }
  }

  player.runCommand("clear @s"); // clearing with script does not remove the item from the player's selection but this does

  for (let i = 0; i < playerInventory.size; i++) {
    const item = playerRecoverItems[i];
    if (item) playerInventory.setItem(i, item);
  }

  for (const [equipmentSlot, item] of Object.entries(playerRecoverEquipment)) {
    playerEquipmentInventory.setEquipment(equipmentSlot as EquipmentSlot, item);
  }
}

/**
 * clear an item taken from the interface entity's inventory from the player's inventory and give the player `itemStack` if it is defined
 */
function handleTakenItem(
  player: Player,
  itemId: string,
  itemStack?: ItemStack,
): void {
  clearTakenItemFromPlayer(player, new StorageSystemItemStack(itemId));

  if (itemStack) {
    player.dimension.spawnItem(itemStack, player.location);
  }
}

/**
 * add an item to the storage or show the appropriate error. automatically refreshes the interface if the item was added
 * @returns whether the item was added or not. note: if this returns false then assume that the inventory has been closed and an error UI is displayed
 */
function addItemToStorage(
  interfaceEntity: Entity,
  data: InterfaceData,
  itemStack: ItemStack,
): boolean {
  const added = addItemToNetworkOrShowError(
    interfaceEntity,
    data,
    StorageSystemItemStack.fromItemStack(itemStack),
  );

  if (!added) {
    data.enabled = false;
    data.playerInUi.dimension.spawnItem(itemStack, data.playerInUi.location);
    return false;
  }

  refreshInterface(interfaceEntity, data.playerInUi, data.network);
  return true;
}

export const storageInterfaceComponent: BlockCustomComponent = {
  onPlace(e) {
    if (e.previousBlock.type.id === "fluffyalien_asn:storage_interface") return;

    e.block.setPermutation(
      e.block.permutation.withState("fluffyalien_asn:update_2_3", true),
    );

    e.block.dimension.spawnEntity("fluffyalien_asn:storage_interface_entity", {
      x: e.block.x + 0.5,
      y: e.block.y,
      z: e.block.z + 0.5,
    }).nameTag = "fluffyalien_asn:storage_interface";

    StorageNetwork.updateConnectableNetworks(e.block);
  },
  onPlayerInteract(e) {
    if (e.block.permutation.getState("fluffyalien_asn:update_2_3")) {
      return;
    }

    e.block.setPermutation(
      e.block.permutation.withState("fluffyalien_asn:update_2_3", true),
    );

    e.block.dimension.spawnEntity("fluffyalien_asn:storage_interface_entity", {
      x: e.block.x + 0.5,
      y: e.block.y,
      z: e.block.z + 0.5,
    }).nameTag = "fluffyalien_asn:storage_interface";
  },
  onTick(e) {
    const cardinalDirection = e.block.permutation.getState(
      "minecraft:cardinal_direction",
    ) as StrCardinalDirection;

    updateBlockConnectStates(
      e.block,
      STR_DIRECTIONS,
      (other) => other.hasTag("fluffyalien_asn:storage_network_connectable"),
      (direction) => {
        if (direction === "up" || direction === "down") {
          return direction;
        }

        switch (cardinalDirection) {
          case "north":
            switch (direction) {
              case "south":
                return;
              default:
                return direction;
            }
          case "east":
            switch (direction) {
              case "north":
                return "west";
              case "east":
                return "north";
              case "south":
                return "east";
              case "west":
                return;
            }
            break;
          case "south":
            switch (direction) {
              case "north":
                return;
              default:
                return reverseDirection(direction);
            }
          case "west":
            switch (direction) {
              case "north":
                return "east";
              case "east":
                return;
              case "south":
                return "west";
              case "west":
                return "north";
            }
        }
      },
    );
  },
};

world.afterEvents.entityHitEntity.subscribe((e) => {
  if (
    e.hitEntity.typeId !== "fluffyalien_asn:storage_interface_entity" ||
    !(e.damagingEntity instanceof Player)
  ) {
    return;
  }

  const block = e.hitEntity.dimension.getBlock(e.hitEntity.location);

  if (block) {
    block.setType("air");

    e.hitEntity.dimension.spawnItem(
      new ItemStack("fluffyalien_asn:storage_interface"),
      e.hitEntity.location,
    );

    void StorageNetwork.getNetwork(
      block,
      "fluffyalien_asn:storage_interface",
    )?.updateConnections();
  }

  e.hitEntity.remove();
});

world.afterEvents.playerInteractWithEntity.subscribe((e) => {
  if (e.target.typeId !== "fluffyalien_asn:storage_interface_entity") return;

  const block = e.target.dimension.getBlock(e.target.location);
  if (!block) {
    log.warn(
      "playerInteractWithEntity event",
      `expected a storage interface block at (${e.target.location.x.toString()},${e.target.location.y.toString()},${e.target.location.z.toString()}) in ${e.target.dimension.id}`,
    );
    return;
  }

  void (async (): Promise<void> => {
    const network = await getNetworkOrShowError(block, e.target, e.player);
    if (!network) return;

    refreshInterface(e.target, e.player, network);
  })();
});

system.runInterval(() => {
  const entityQueryOptions: EntityQueryOptions = {
    // we also want this to run for the wireless interface, so check families instead of type
    families: ["fluffyalien_asn:storage_interface"],
  };

  for (const entity of [
    ...world.getDimension("overworld").getEntities(entityQueryOptions),
    ...world.getDimension("nether").getEntities(entityQueryOptions),
    ...world.getDimension("the_end").getEntities(entityQueryOptions),
  ]) {
    const data = interfaceData.get(entity.id);
    if (
      !data?.enabled ||
      !entity.dimension.getPlayers({
        location: entity.location,
        maxDistance: 10,
      }).length
    )
      continue;

    const inventory = entity.getComponent("inventory")!.container!;

    const inputSlotItem = inventory.getItem(INPUT_SLOT_INDEX);
    if (inputSlotItem && !addItemToStorage(entity, data, inputSlotItem)) {
      continue;
    }

    const backBtnSlotItem = inventory.getItem(BACK_BUTTON_INDEX);
    if (backBtnSlotItem?.typeId !== BACK_BUTTON_ITEM_ID) {
      handleTakenItem(data.playerInUi, BACK_BUTTON_ITEM_ID, backBtnSlotItem);

      data.page = Math.max(data.page - 1, 0);
      fillInterfaceInventory(entity, data);

      continue;
    }

    const nextBtnSlotItem = inventory.getItem(NEXT_BUTTON_INDEX);
    if (nextBtnSlotItem?.typeId !== NEXT_BUTTON_ITEM_ID) {
      handleTakenItem(data.playerInUi, NEXT_BUTTON_ITEM_ID, nextBtnSlotItem);

      data.page++;
      fillInterfaceInventory(entity, data);

      continue;
    }

    const searchButtonSlotItem = inventory.getItem(SEARCH_BUTTON_INDEX);

    if (
      !data.hasQuery &&
      searchButtonSlotItem?.typeId !== SEARCH_BUTTON_ITEM_ID
    ) {
      handleTakenItem(
        data.playerInUi,
        SEARCH_BUTTON_ITEM_ID,
        searchButtonSlotItem,
      );

      data.enabled = false;
      void search(entity, data);

      continue;
    }

    if (
      data.hasQuery &&
      searchButtonSlotItem?.typeId !== CANCEL_SEARCH_BUTTON_ITEM_ID
    ) {
      handleTakenItem(
        data.playerInUi,
        CANCEL_SEARCH_BUTTON_ITEM_ID,
        searchButtonSlotItem,
      );

      data.hasQuery = false;
      refreshInterface(entity, data.playerInUi, data.network);

      continue;
    }

    const itemsOnPage = getItemsOnPage(data.items, data.page);

    for (let i = 0; i < ITEMS_PER_PAGE; i++) {
      const storageItem = itemsOnPage[i] as StorageSystemItemStack | undefined;
      const inventoryItem = inventory.getItem(i);

      if (!storageItem) {
        if (inventoryItem && !isDisplayItem(inventoryItem)) {
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

      clearTakenItemFromPlayer(
        data.playerInUi,
        storageItem.withLore([
          getDisplayItemLoreStr(storageItem.amount),
          ...storageItem.lore,
        ]),
      );

      if (inventoryItem) {
        // give the item back
        data.playerInUi.dimension.spawnItem(
          inventoryItem,
          data.playerInUi.location,
        );
      }

      data.enabled = false;
      void requestItem(entity, data.playerInUi, data.network, storageItem);

      break;
    }
  }
});
