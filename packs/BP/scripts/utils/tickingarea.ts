import { Dimension, world } from "@minecraft/server";

export interface ChunkLocation {
  x: number;
  z: number;
}

function anonymousTickingAreaId(
  dimension: Dimension,
  center: ChunkLocation,
): string {
  return `fluffyalien_asn:anon_${dimension.id}_${center.x.toString()}_${center.z.toString()}`;
}

export async function addAnonymousTickingArea(
  dimension: Dimension,
  center: ChunkLocation,
  radius: number,
): Promise<void> {
  const id = anonymousTickingAreaId(dimension, center);

  if (world.tickingAreaManager.hasTickingArea(id)) {
    return;
  }

  const offset = radius * 16;

  await world.tickingAreaManager.createTickingArea(id, {
    dimension,
    from: { x: center.x - offset, y: 0, z: center.z - offset },
    to: { x: center.x + offset, y: 0, z: center.z + offset },
  });
}

export function removeAnonymousTickingArea(
  dimension: Dimension,
  center: ChunkLocation,
): void {
  world.tickingAreaManager.removeTickingArea(
    anonymousTickingAreaId(dimension, center),
  );
}
