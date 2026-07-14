import {
  Dimension,
  DimensionLocation,
  Entity,
  Vector3,
} from "@minecraft/server";

export function getEntityAtBlockLocation(
  location: DimensionLocation,
  entityId: string,
): Entity | undefined {
  return location.dimension
    .getEntitiesAtBlockLocation(location)
    .find((v) => v.typeId === entityId);
}

export function getEntitiesAtBlockLocation(
  location: DimensionLocation,
  entityId: string,
): Entity[] {
  return location.dimension
    .getEntitiesAtBlockLocation(location)
    .filter((v) => v.typeId === entityId);
}

export function getUniqueEntityAtBlockLocation(
  location: DimensionLocation,
  uid: string,
): Entity | undefined {
  return location.dimension
    .getEntitiesAtBlockLocation(location)
    .find((v) => v.id === uid);
}

export function vector3AsDimensionLocation(
  vec: Vector3,
  dimension: Dimension,
): DimensionLocation {
  return { ...vec, dimension };
}

export function dimensionLocationFromEntity(entity: Entity): DimensionLocation {
  return vector3AsDimensionLocation(entity.location, entity.dimension);
}
