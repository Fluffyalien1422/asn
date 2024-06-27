import { Dimension } from "@minecraft/server";
import { wait } from "./async";

export interface ChunkLocation {
  x: number;
  z: number;
}

export function addAnonymousTickingArea(
  dimension: Dimension,
  center: ChunkLocation,
  radius: number,
): Promise<void> {
  dimension.runCommand(
    `tickingarea add circle ${center.x.toString()} 0 ${center.z.toString()} ${radius.toString()}`,
  );

  return wait(1);
}

export function removeAnonymousTickingArea(
  dimension: Dimension,
  center: ChunkLocation,
): void {
  dimension.runCommand(
    `tickingarea remove ${center.x.toString()} 0 ${center.z.toString()}`,
  );
}
