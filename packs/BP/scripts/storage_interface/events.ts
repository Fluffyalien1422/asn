import { showEstablishNetworkError } from "../cable_network";
import { Logger } from "../log";
import { StorageNetwork } from "../storage_network";
import { StorageSystemItemStack } from "../storage_system_item_stack";
import {
  abbreviateNumber,
  getPlayerMainhandSlot,
  makeErrorMessageUi,
} from "../utils";
import { showRequestItemUi, showSearchUi } from "./ui";
import {
  Block,
  Entity,
  EntityQueryOptions,
  ItemStack,
  Player,
  system,
  world,
} from "@minecraft/server";

const ITEMS_PER_PAGE = 18;

const BACK_BUTTON_INDEX = 21;
const BACK_BUTTON_ITEM_ID = "fluffyalien_asn:storage_interface_button_back";

const SEARCH_BUTTON_INDEX = 22;
const SEARCH_BUTTON_ITEM_ID = "fluffyalien_asn:storage_interface_button_search";
const CANCEL_SEARCH_BUTTON_ITEM_ID =
  "fluffyalien_asn:storage_interface_button_cancel_search";

const NEXT_BUTTON_INDEX = 23;
const NEXT_BUTTON_ITEM_ID = "fluffyalien_asn:storage_interface_button_next";

const log = new Logger("storage_interface.ts");

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

function forceCloseInventory(entity: Entity): Promise<void> {
  const ogLocation = { ...entity.location };

  entity.teleport({
    x: entity.location.x,
    y: entity.location.y + 99,
    z: entity.location.z,
  });

  entity.teleport(ogLocation);

  return new Promise((resolve) => {
    system.runTimeout(resolve, 4);
  });
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
      `§r§2§l${abbreviateNumber(storageSystemItem.amount)}§r`,
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
    void forceCloseInventory(interfaceEntity).then(() => {
      void showEstablishNetworkError(player, networkResult.error);
    });

    return;
  }

  return networkResult.value;
}

/**
 * resets interface data and inventory
 */
function refreshInterface(
  interfaceEntity: Entity,
  player: Player,
  network: StorageNetwork,
): void {
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
}

world.afterEvents.playerPlaceBlock.subscribe((e) => {
  if (e.block.typeId !== "fluffyalien_asn:storage_interface") return;

  e.block.dimension.spawnEntity("fluffyalien_asn:storage_interface_entity", {
    x: e.block.x + 0.5,
    y: e.block.y,
    z: e.block.z + 0.5,
  }).nameTag = "Storage Interface";

  StorageNetwork.updateConnectableNetworks(e.block);
});

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

    const mainhandSlot = getPlayerMainhandSlot(e.player);
    const heldItem = mainhandSlot?.getItem();
    if (mainhandSlot && heldItem) {
      const res = network.addItemStack(
        StorageSystemItemStack.fromItemStack(heldItem),
      );
      if (!res.success) {
        void forceCloseInventory(e.target).then(() => {
          void makeErrorMessageUi({
            translate:
              "fluffyalien_asn.ui.storageInterface.error.insufficientStorage",
          }).show(e.player);
        });

        return;
      }

      mainhandSlot.setItem();
    }

    refreshInterface(e.target, e.player, network);
  })();
});

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

function isStorageInventoryItemTaken(
  storageItem: StorageSystemItemStack,
  inventoryItem?: ItemStack,
): boolean {
  if (!inventoryItem) return true;

  // remove the first lore line - it's the line that shows the amount in the storage
  inventoryItem.setLore(inventoryItem.getLore().slice(1));

  if (inventoryItem.isStackableWith(storageItem.toItemStack())) {
    return false;
  }

  return true;
}

function clearPlayerSelectedItem(player: Player): void {
  const playerInventory = player.getComponent("inventory")!.container!;

  const playerItems: (ItemStack | undefined)[] = [];
  for (let i = 0; i < playerInventory.size; i++) {
    playerItems.push(playerInventory.getItem(i));
  }

  player.runCommand("clear @s"); // clearing with script does not remove the item from the player's selection but this does

  for (let i = 0; i < playerInventory.size; i++) {
    const item = playerItems[i];
    playerInventory.setItem(i, item);
  }
}

system.runInterval(() => {
  const entityQueryOptions: EntityQueryOptions = {
    type: "fluffyalien_asn:storage_interface_entity",
  };

  entityLoop: for (const entity of [
    ...world.getDimension("overworld").getEntities(entityQueryOptions),
    ...world.getDimension("nether").getEntities(entityQueryOptions),
    ...world.getDimension("the_end").getEntities(entityQueryOptions),
  ]) {
    const data = interfaceData.get(entity.id);
    if (!data?.enabled) continue;

    const inventory = entity.getComponent("inventory")!.container!;

    if (!inventory.getItem(BACK_BUTTON_INDEX)?.matches(BACK_BUTTON_ITEM_ID)) {
      clearPlayerSelectedItem(data.playerInUi);

      data.page = Math.max(data.page - 1, 0);
      fillInterfaceInventory(entity, data);

      continue;
    }

    if (!inventory.getItem(NEXT_BUTTON_INDEX)?.matches(NEXT_BUTTON_ITEM_ID)) {
      clearPlayerSelectedItem(data.playerInUi);

      data.page++;
      fillInterfaceInventory(entity, data);

      continue;
    }

    const searchButtonSlotItem = inventory.getItem(SEARCH_BUTTON_INDEX);

    if (
      !data.hasQuery &&
      !searchButtonSlotItem?.matches(SEARCH_BUTTON_ITEM_ID)
    ) {
      clearPlayerSelectedItem(data.playerInUi);

      data.enabled = false;
      void search(entity, data);

      continue;
    }

    if (
      data.hasQuery &&
      !searchButtonSlotItem?.matches(CANCEL_SEARCH_BUTTON_ITEM_ID)
    ) {
      clearPlayerSelectedItem(data.playerInUi);

      data.hasQuery = false;
      refreshInterface(entity, data.playerInUi, data.network);
      data.enabled = false;

      continue;
    }

    const itemsOnPage = getItemsOnPage(data.items, data.page);

    for (let i = 0; i < itemsOnPage.length; i++) {
      const storageItem = itemsOnPage[i];

      if (!isStorageInventoryItemTaken(storageItem, inventory.getItem(i))) {
        continue;
      }

      clearPlayerSelectedItem(data.playerInUi);

      data.enabled = false;
      void requestItem(entity, data.playerInUi, data.network, storageItem);

      continue entityLoop;
    }
  }
});
