import { DimensionLocation, Entity } from "@minecraft/server";
import { STORAGE_CORE_ENTITY_TYPE_ID } from ".";

/**
 * Gets the storage core dummy entity at a {@link DimensionLocation}
 * @param location the block location of the storage core
 * @returns the {@link Entity} or undefined if it could not be found
 */
export function getStorageCoreEntity(
  location: DimensionLocation
): Entity | undefined {
  return location.dimension
    .getEntitiesAtBlockLocation(location)
    .find((v) => v.typeId === STORAGE_CORE_ENTITY_TYPE_ID);
}
