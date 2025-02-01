import { ActionFormData, ActionFormResponse } from "@minecraft/server-ui";
import { logWarn } from "./log";
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

export const MAX_STORAGE_DRIVE_DATA_LENGTH = 3_000;
export const STORAGE_DATA_DYNAMIC_PROPERTY_ID = "fluffyalien_asn:storage_data";

/**
 * Gets the storage drive dummy entity at a {@link DimensionLocation}
 * @param location the block location of the storage drive
 * @returns the {@link Entity} or undefined if it could not be found
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
 * @returns the serialized data, `undefined` if the data does not exist, or `false` if there was an error
 */
export function getStorageDriveSerializedData(
  location: DimensionLocation,
): string | undefined | false {
  const entity = getStorageDriveEntity(location);
  if (!entity) return false;
  return entity.getDynamicProperty(STORAGE_DATA_DYNAMIC_PROPERTY_ID) as
    | string
    | undefined;
}

/**
 * Sets the serialized storage data of a storage drive
 * @param location the block location of the storage drive
 * @param data the serialized data
 * @returns a boolean indicating whether the operation was successful or not
 */
export function setStorageDriveSerializedData(
  location: DimensionLocation,
  data: string,
): boolean {
  const entity = getStorageDriveEntity(location);
  if (!entity) return false;

  entity.setDynamicProperty(STORAGE_DATA_DYNAMIC_PROPERTY_ID, data);

  return true;
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
            (
              getStorageDriveEntity(storageDrive)?.getDynamicProperty(
                STORAGE_DATA_DYNAMIC_PROPERTY_ID,
              ) as string | undefined
            )?.length.toString() ?? "0",
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
  onPlace(e) {
    if (e.previousBlock.type.id === "fluffyalien_asn:storage_drive") return;

    e.block.dimension.spawnEntity("fluffyalien_asn:storage_drive_entity", {
      x: e.block.x + 0.5,
      y: e.block.y,
      z: e.block.z + 0.5,
    });
  },
  onPlayerDestroy(e) {
    const data = getStorageDriveSerializedData(e.block);
    if (data === false) {
      logWarn(
        `couldn't create storage disk with data: could not read data from storage drive at (${e.block.x.toString()}, ${e.block.y.toString()}, ${e.block.z.toString()}) in ${
          e.block.dimension.id
        }`,
      );
    }

    if (data) {
      const itemStack = new ItemStack("fluffyalien_asn:used_storage_disk");
      itemStack.setDynamicProperty(STORAGE_DATA_DYNAMIC_PROPERTY_ID, data);
      e.block.dimension.spawnItem(itemStack, e.block.location);
    }

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
