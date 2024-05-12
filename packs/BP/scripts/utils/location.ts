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

export function vector3AsDimensionLocation(
  vec: Vector3,
  dimension: Dimension,
): DimensionLocation {
  return { ...vec, dimension };
}
