import {
  getStorageDriveEntity,
  getStorageDriveSerializedData,
  setStorageDriveSerializedData,
  STORAGE_DATA_DYNAMIC_PROPERTY_ID,
} from ".";
import { Logger } from "../log";
import { StorageNetwork } from "../storage_network";
import {
  getBlockInDirection,
  getPlayerMainhandSlot,
  makeErrorMessageUi,
  showForm,
} from "../utils";
import { showStorageDriveUi } from "./ui";
import { ItemStack, system, world } from "@minecraft/server";

const log = new Logger("storage_drive/events.ts");

world.afterEvents.itemUseOn.subscribe((e) => {
  if (e.itemStack.typeId !== "fluffyalien_asn:storage_drive") return;

  const targetBlock = getBlockInDirection(e.block, e.blockFace);
  if (!targetBlock) {
    throw new Error(
      "(storage_drive/events.ts:itemUseOn) Could not get target block to spawn drive entity.",
    );
  }

  const entity = targetBlock.dimension.spawnEntity(
    "fluffyalien_asn:storage_drive_entity",
    {
      x: targetBlock.x + 0.5,
      y: targetBlock.y,
      z: targetBlock.z + 0.5,
    },
  );

  entity.setDynamicProperty(
    STORAGE_DATA_DYNAMIC_PROPERTY_ID,
    e.itemStack.getDynamicProperty(STORAGE_DATA_DYNAMIC_PROPERTY_ID),
  );
});

world.afterEvents.playerPlaceBlock.subscribe((e) => {
  if (e.block.typeId !== "fluffyalien_asn:storage_drive") return;

  StorageNetwork.updateConnectableNetworks(e.block);
});

world.afterEvents.playerBreakBlock.subscribe((e) => {
  if (e.brokenBlockPermutation.type.id !== "fluffyalien_asn:storage_drive")
    return;

  const data = getStorageDriveSerializedData(e.block);
  if (data === false) {
    log.warn(
      "playerBreakBlock",
      `could not read data from storage drive at (${e.block.x.toString()}, ${e.block.y.toString()}, ${e.block.z.toString()}) in ${
        e.block.dimension.id
      }. items will be lost`,
    );
  }

  if (data) {
    const itemStack = new ItemStack("fluffyalien_asn:used_storage_disk");
    itemStack.setDynamicProperty(STORAGE_DATA_DYNAMIC_PROPERTY_ID, data);
    e.block.dimension.spawnItem(itemStack, e.block.location);
  }

  getStorageDriveEntity(e.block)?.triggerEvent("fluffyalien_asn:despawn");

  StorageNetwork.getNetwork(
    e.block,
    e.brokenBlockPermutation.type.id,
  )?.updateConnections();
});

let lastPlayerInteractWithBlockTriggerTick = 0;
world.afterEvents.playerInteractWithBlock.subscribe((e) => {
  if (
    e.block.typeId !== "fluffyalien_asn:storage_drive" ||
    e.player.isSneaking ||
    lastPlayerInteractWithBlockTriggerTick + 5 > system.currentTick
  )
    return;

  lastPlayerInteractWithBlockTriggerTick = system.currentTick;

  const mainHandSlot = getPlayerMainhandSlot(e.player);
  const heldItem = mainHandSlot?.getItem();

  if (heldItem?.typeId === "fluffyalien_asn:used_storage_disk") {
    const existingData = getStorageDriveSerializedData(e.block);
    if (existingData !== undefined) {
      void showForm(
        makeErrorMessageUi({
          translate:
            "fluffyalien_asn.ui.storageDrive.error.mustBeEmptyToAddDisk",
        }),
        e.player,
      );

      return;
    }

    const data = heldItem.getDynamicProperty(
      STORAGE_DATA_DYNAMIC_PROPERTY_ID,
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
