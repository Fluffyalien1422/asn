import { Entity, ItemStack, Player } from "@minecraft/server";
import { err, ok, Result } from "neverthrow";
import { logWarn } from "../log";
import { createErrorMessageForm } from "../utils/ui";
import { StorageSystem } from "../storage_system";
import { forceCloseStorageViewerInventory } from "./shared";
import { sortStoredItems } from "./items";
import { fillViewerInventory } from "./render";
import { StoredItem, ViewerData, viewerData } from "./state";
import { isUiItem } from "./ui_item";

/**
 * Gives an item back to the player in the viewer. Used when an item taken out of
 * the viewer's container can't be stored.
 */
function returnItemToPlayer(data: ViewerData, itemStack: ItemStack): void {
  if (!data.playerInUi.isValid) {
    logWarn(
      `Failed to return '${itemStack.typeId}' to the player: the player is no longer valid.`,
    );
    return;
  }

  data.playerInUi.dimension.spawnItem(itemStack, data.playerInUi.location);
}

/**
 * Adds the item to storage. On failure, closes the viewer and shows an error
 * form describing why. Returns whether the item was added.
 */
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
 * add the item in `slotIndex` to the storage or show the appropriate error. automatically refreshes the interface if the item was added.
 * if the item was not added then the item will be given back to the player.
 *
 * the viewer is disabled while the (possibly asynchronous) add is in progress
 * and re-enabled when the interface is refreshed. always `continue`/`break`
 * after calling this so the viewer is not processed again until it finishes.
 */
export function addItemToStorage(
  interfaceEntity: Entity,
  data: ViewerData,
  slotIndex: number,
  itemStack: ItemStack,
): void {
  // Empty the slot in the same tick the item is read so this add owns the stack:
  // nothing else inspecting the container while the asynchronous add is in
  // flight can see it (and add it a second time), and a failed add can hand it
  // back to the player without leaving a copy in the container.
  interfaceEntity.getComponent("inventory")!.container.setItem(slotIndex);

  // disable the viewer until the add finishes so it isn't processed again while
  // the asynchronous add/save is in progress
  data.enabled = false;

  void addItemToStorageOrShowError(interfaceEntity, data, itemStack).then(
    (added) => {
      if (!added) {
        returnItemToPlayer(data, itemStack);
        return;
      }

      refreshStorageViewerOrLog(
        interfaceEntity,
        data.playerInUi,
        data.storageSystem,
        true,
      );
    },
  );
}

/**
 * Moves any real (non-UI) items left in the viewer's container into storage,
 * returning them to the player if they can't be stored.
 *
 * The viewer has no input events, so deposits are only noticed by the
 * interaction poll. Anything deposited in the few ticks between one poll and the
 * viewer no longer being polled - the player closing the interface, or the
 * wireless interface entity being removed - would otherwise be stranded in the
 * container and destroyed by the next `clearAll` in `fillViewerInventory`. Call
 * this whenever the viewer stops being polled.
 *
 * Unlike {@link addItemToStorage} this never refreshes the viewer, since it runs
 * when the container is closing or the entity is about to be removed.
 */
export function drainStorageViewerInput(interfaceEntity: Entity): void {
  const data = viewerData.get(interfaceEntity.id);
  if (!data) return;

  const inventory = interfaceEntity.getComponent("inventory")!.container;

  for (let i = 0; i < inventory.size; i++) {
    const itemStack = inventory.getItem(i);
    if (!itemStack || isUiItem(itemStack)) continue;

    inventory.setItem(i);

    void (async (): Promise<void> => {
      const res = await data.storageSystem.addItemStack(itemStack);
      if (res.isErr()) returnItemToPlayer(data, itemStack);
    })();
  }
}

/**
 * resets interface data and inventory
 * @returns a result containing the new ViewerData, or an error if the passed
 *   entity is not part of the "fluffyalien_asn:storage_viewer" type family
 */
export async function refreshStorageViewer(
  interfaceEntity: Entity,
  player: Player,
  storageSystem: StorageSystem,
  preservePage = false,
): Promise<Result<ViewerData, Error>> {
  if (
    !interfaceEntity.matches({
      families: ["fluffyalien_asn:storage_viewer"],
    })
  ) {
    return err(
      new Error(
        "Expected entity to be member of family 'fluffyalien_asn:storage_viewer'.",
      ),
    );
  }

  const oldData = viewerData.get(interfaceEntity.id);

  // When a search query is active, keep the already-filtered items instead of
  // re-reading (and re-sorting) the full storage contents.
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
    view: oldData?.view ?? "default",
    groupTypeId: oldData?.groupTypeId ?? undefined,
    craftItemTypeId: oldData?.craftItemTypeId,
    stackSize: oldData?.stackSize ?? 64,
    craftingQuery: oldData?.craftingQuery,
    // record the revision the displayed contents correspond to so the poll can
    // detect later external changes and refresh in real time
    storedItemsRevision: storageSystem.getStoredItemsRevision(),
    // populated immediately by the fillViewerInventory call below
    itemsOnPage: [],
  };

  viewerData.set(interfaceEntity.id, data);

  fillViewerInventory(interfaceEntity, data);

  return ok(data);
}

export function disableStorageViewer(entity: Entity): void {
  const data = viewerData.get(entity.id);
  if (data) data.enabled = false;
}

/**
 * Calls {@link refreshStorageViewer} and logs a warning if it fails. Use this
 * for fire-and-forget refreshes where the caller cannot handle the error.
 */
export function refreshStorageViewerOrLog(
  interfaceEntity: Entity,
  player: Player,
  storageSystem: StorageSystem,
  preservePage = false,
): void {
  void refreshStorageViewer(
    interfaceEntity,
    player,
    storageSystem,
    preservePage,
  ).then((result) => {
    if (result.isErr()) {
      logWarn(`Failed to refresh storage viewer: ${result.error}`);
    }
  });
}
