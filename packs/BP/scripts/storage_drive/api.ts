import { DimensionLocation, Entity } from "@minecraft/server";

export const MAX_STORAGE_DRIVE_DATA_LENGTH = 1_000;
export const STORAGE_DATA_DYNAMIC_PROPERTY_ID = "fluffyalien_asn:storage_data";

/**
 * Gets the storage drive dummy entity at a {@link DimensionLocation}
 * @param location the block location of the storage drive
 * @returns the {@link Entity} or undefined if it could not be found
 */
export function getStorageDriveEntity(
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
