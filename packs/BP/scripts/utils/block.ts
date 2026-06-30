import { DimensionLocation } from "@minecraft/server";

export function getBlockUid(loc: DimensionLocation): string {
  return (
    loc.dimension.id +
    "," +
    loc.x.toString() +
    "," +
    loc.y.toString() +
    "," +
    loc.z.toString()
  );
}
