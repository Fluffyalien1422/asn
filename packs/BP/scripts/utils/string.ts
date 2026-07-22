import { DimensionLocation } from "@minecraft/server";

export function truncateNumber(num: number, decPlaces: number): string {
  const [beforeDec, afterDec] = num.toString().split(".");

  if (afterDec) {
    return `${beforeDec}.${afterDec.slice(0, decPlaces)}`;
  }

  return beforeDec;
}

export function abbreviateNumber(num: number): string {
  if (num === 1_000_000) {
    return "1M";
  }

  if (num > 1_000_000) {
    return "1M+";
  }

  if (num >= 1000) {
    return truncateNumber(num / 1000, 1) + "k";
  }

  return num.toString();
}

/**
 * Converts a `DimensionLocation` to a human-readable string for debug output.
 * @param loc The `DimensionLocation` to stringify.
 */
export function stringifyDimensionLocation(loc: DimensionLocation): string {
  return `DimensionLocation {${loc.dimension.id} (${loc.x.toString()}, ${loc.y.toString()}, ${loc.z.toString()})}`;
}
