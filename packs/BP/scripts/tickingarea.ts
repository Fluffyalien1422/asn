import { Dimension } from "@minecraft/server";

export interface ChunkLocation {
  x: number;
  z: number;
}

export function addAnonymousTickingArea(
  dimension: Dimension,
  center: ChunkLocation,
  radius: number,
): void {
  dimension.runCommand(
    `tickingarea add circle ${center.x.toString()} 0 ${center.z.toString()} ${radius.toString()}`,
  );
}

export function removeAnonymousTickingArea(
  dimension: Dimension,
  center: ChunkLocation,
): void {
  dimension.runCommand(
    `tickingarea remove ${center.x.toString()} 0 ${center.z.toString()}`,
  );
}
