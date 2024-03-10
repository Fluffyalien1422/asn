import {
  getStorageDriveEntity,
  getStorageDriveSerializedData,
  setStorageDriveSerializedData,
  STORAGE_DATA_DYNAMIC_PROPERTY_ID,
  STORAGE_DRIVE_BLOCK_TYPE_ID,
  STORAGE_DRIVE_ENTITY_TYPE_ID,
  USED_STORAGE_DISK_ITEM_TYPE_ID,
} from ".";
import { StorageNetwork } from "../storage_network";
import {
  getBlockInDirection,
  getPlayerMainhandSlot,
  makeErrorMessageUi,
  showForm,
} from "../utils";
import { showStorageDriveUi } from "./ui";

$.server.world.afterEvents.itemUseOn.subscribe((e) => {
  if (e.itemStack.typeId !== STORAGE_DRIVE_BLOCK_TYPE_ID) return;

  const targetBlock = getBlockInDirection(e.block, e.blockFace);
  if (!targetBlock) {
    throw new Error(
      "(storage_drive/events.ts:itemUseOn) Could not get target block to spawn drive entity."
    );
  }

  const entity = targetBlock.dimension.spawnEntity(
    STORAGE_DRIVE_ENTITY_TYPE_ID,
    {
      x: targetBlock.x + 0.5,
      y: targetBlock.y,
      z: targetBlock.z + 0.5,
    }
  );

  entity.setDynamicProperty(
    STORAGE_DATA_DYNAMIC_PROPERTY_ID,
    e.itemStack.getDynamicProperty(STORAGE_DATA_DYNAMIC_PROPERTY_ID)
  );
});

$.server.world.afterEvents.playerPlaceBlock.subscribe((e) => {
  if (e.block.typeId !== STORAGE_DRIVE_BLOCK_TYPE_ID) return;

  StorageNetwork.updateConnectableNetworks(e.block);
});

$.server.world.afterEvents.playerBreakBlock.subscribe((e) => {
  if (e.brokenBlockPermutation.type.id !== STORAGE_DRIVE_BLOCK_TYPE_ID) return;

  const data = getStorageDriveSerializedData(e.block);
  if (data === false) {
    console.warn(
      `(storage_drive/events.ts:playerBreakBlock) Could not read data from storage drive at (${e.block.x}, ${e.block.y}, ${e.block.z}) in ${e.block.dimension.id}. Items will be lost.`
    );
  }

  if (data) {
    const itemStack = new $.server.ItemStack(USED_STORAGE_DISK_ITEM_TYPE_ID);
    itemStack.setDynamicProperty(STORAGE_DATA_DYNAMIC_PROPERTY_ID, data);
    e.block.dimension.spawnItem(itemStack, e.block.location);
  }

  getStorageDriveEntity(e.block)?.triggerEvent("fluffyalien_asn:despawn");

  StorageNetwork.getNetwork(e.block)?.updateConnections();
});

let lastPlayerInteractWithBlockTriggerTick = 0;
$.server.world.afterEvents.playerInteractWithBlock.subscribe((e) => {
  if (
    e.block.typeId !== STORAGE_DRIVE_BLOCK_TYPE_ID ||
    e.player.isSneaking ||
    lastPlayerInteractWithBlockTriggerTick + 5 > $.server.system.currentTick
  )
    return;

  lastPlayerInteractWithBlockTriggerTick = $.server.system.currentTick;

  const mainHandSlot = getPlayerMainhandSlot(e.player);
  const heldItem = mainHandSlot?.getItem();

  if (heldItem?.typeId === USED_STORAGE_DISK_ITEM_TYPE_ID) {
    const existingData = getStorageDriveSerializedData(e.block);
    if (existingData !== undefined) {
      void showForm(
        makeErrorMessageUi({
          rawtext: [
            {
              translate:
                "fluffyalien_asn.ui.storageDrive.error.mustBeEmptyToAddDisk",
            },
          ],
        }),
        e.player
      );

      return;
    }

    const data = heldItem.getDynamicProperty(
      STORAGE_DATA_DYNAMIC_PROPERTY_ID
    ) as string | undefined;

    if (data) {
      setStorageDriveSerializedData(e.block, data);
      // clear the cache so the items will be forced to update
      StorageNetwork.getNetwork(e.block)?.clearStoredItemsCache();
    }

    mainHandSlot?.setItem();
    return;
  }

  void showStorageDriveUi(e.player, e.block);
});
