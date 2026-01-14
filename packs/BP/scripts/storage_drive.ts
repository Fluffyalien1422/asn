import { ActionFormData, ActionFormResponse } from "@minecraft/server-ui";
import { StorageNetwork } from "./storage_network";
import { getPlayerMainhandSlot } from "./utils/item";
import { makeErrorMessageUi, showForm } from "./utils/ui";
import {
  Block,
  BlockCustomComponent,
  DimensionLocation,
  Entity,
  ItemStack,
  Player,
} from "@minecraft/server";
import {
  getBlockDynamicProperty,
  removeAllDynamicPropertiesForBlock,
  setBlockDynamicProperty,
} from "./utils/dynamic_property";

export const MAX_STORAGE_DRIVE_DATA_LENGTH = 3_000;
/**
 * @deprecated
 * This is a legacy property that should only be used for backwards compatibility.
 */
export const STORAGE_DATA_DYNAMIC_PROPERTY_ID = "fluffyalien_asn:storage_data";

/**
 * Gets the storage drive dummy entity at a {@link DimensionLocation}
 * @param location the block location of the storage drive
 * @returns the {@link Entity} or undefined if it could not be found
 * @deprecated
 * Storage drive data is now stored on the block itself, this function is only
 * used for backwards compatibility.
 */
function getStorageDriveEntity(
  location: DimensionLocation,
): Entity | undefined {
  return location.dimension
    .getEntitiesAtBlockLocation(location)
    .find((v) => v.typeId === "fluffyalien_asn:storage_drive_entity");
}

/**
 * Gets the serialized storage data of a storage drive
 * @param location the block location of the storage drive
 * @returns the serialized data, `undefined` if the data does not exist
 */
export function getStorageDriveSerializedData(
  location: DimensionLocation,
): string | undefined {
  const entity = getStorageDriveEntity(location);
  if (entity) {
    // legacy support
    return entity.getDynamicProperty(STORAGE_DATA_DYNAMIC_PROPERTY_ID) as
      | string
      | undefined;
  }
  return getBlockDynamicProperty(location, "storageData") as string | undefined;
}

/**
 * Sets the serialized storage data of a storage drive
 * @param location the block location of the storage drive
 * @param data the serialized data
 */
export function setStorageDriveSerializedData(
  location: DimensionLocation,
  data: string,
): void {
  const entity = getStorageDriveEntity(location);
  if (entity) {
    entity.setDynamicProperty(STORAGE_DATA_DYNAMIC_PROPERTY_ID, data);
  } else {
    setBlockDynamicProperty(location, "storageData", data);
  }
}

function showStorageDriveUi(
  player: Player,
  storageDrive: Block,
): Promise<ActionFormResponse> {
  const form = new ActionFormData();

  form.title({
    translate: "fluffyalien_asn.ui.storageDrive.title",
  });

  form.body({
    translate: "fluffyalien_asn.ui.storageDrive.body.storageUsed",
    with: {
      rawtext: [
        {
          text:
            getStorageDriveSerializedData(storageDrive)?.length.toString() ??
            "0",
        },
      ],
    },
  });

  form.button({
    translate: "fluffyalien_asn.ui.common.close",
  });

  return showForm(form, player);
}

export const storageDriveComponent: BlockCustomComponent = {
  onPlayerBreak(e) {
    const data = getStorageDriveSerializedData(e.block);
    if (data) {
      const itemStack = new ItemStack("fluffyalien_asn:used_storage_disk");
      itemStack.setDynamicProperty(STORAGE_DATA_DYNAMIC_PROPERTY_ID, data);
      e.block.dimension.spawnItem(itemStack, e.block.location);
    }

    removeAllDynamicPropertiesForBlock(e.block);

    // legacy support - remove the entity if it exists
    getStorageDriveEntity(e.block)?.triggerEvent("fluffyalien_asn:despawn");
  },
  onPlayerInteract(e) {
    if (!e.player) return;

    const mainHandSlot = getPlayerMainhandSlot(e.player);
    const heldItem = mainHandSlot.getItem();

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

      mainHandSlot.setItem();
      return;
    }

    void showStorageDriveUi(e.player, e.block);
  },
};
