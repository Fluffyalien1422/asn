import { DimensionLocation, Entity } from "@minecraft/server";
import { STORAGE_DRIVE_ENTITY_TYPE_ID } from "./actors";

export const MAX_STORAGE_DRIVE_BYTES = 30_000;
export const STORAGE_DATA_DYNAMIC_PROPERTY_ID = "fluffyalien_asn:storage_data";

export function getStorageDriveEntity(
  location: DimensionLocation
): Entity | undefined {
  return location.dimension
    .getEntitiesAtBlockLocation(location)
    .find((v) => v.typeId === STORAGE_DRIVE_ENTITY_TYPE_ID);
}

export function getStorageDriveSerializedData(
  location: DimensionLocation
): string | undefined {
  return getStorageDriveEntity(location)?.getDynamicProperty(
    STORAGE_DATA_DYNAMIC_PROPERTY_ID
  ) as string | undefined;
}

export function setStorageDriveSerializedData(
  location: DimensionLocation,
  data: string
): boolean {
  const entity = getStorageDriveEntity(location);
  if (!entity) return false;

  entity.setDynamicProperty(STORAGE_DATA_DYNAMIC_PROPERTY_ID, data);

  return true;
}
