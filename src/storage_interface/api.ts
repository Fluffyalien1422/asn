import { DimensionLocation, Entity } from "@minecraft/server";
import { STORAGE_INTERFACE_ENTITY_TYPE_ID } from ".";

/**
 * Gets the storage interface dummy entity at a {@link DimensionLocation}
 * @param location the block location of the storage interface
 * @returns the {@link Entity} or undefined if it could not be found
 */
export function getStorageInterfaceEntity(
  location: DimensionLocation
): Entity | undefined {
  return location.dimension
    .getEntitiesAtBlockLocation(location)
    .find((v) => v.typeId === STORAGE_INTERFACE_ENTITY_TYPE_ID);
}
