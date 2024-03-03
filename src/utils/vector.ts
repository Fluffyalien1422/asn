import { Dimension, DimensionLocation, Vector3 } from "@minecraft/server";

export function vector3Matches(a: Vector3, b: Vector3): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

export function vector3AsDimensionLocation(
  vec: Vector3,
  dimension: Dimension
): DimensionLocation {
  return { ...vec, dimension };
}
