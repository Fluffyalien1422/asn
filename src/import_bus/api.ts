import { DimensionLocation } from "@minecraft/server";

export function updateImportBus(location: DimensionLocation): void {
  const block = location.dimension.getBlock(location);
  if (!block) {
    console.warn(
      `(updateImportBus) Could not get the block at (${location.x}, ${location.y}, ${location.z}) in ${location.dimension.id}.`
    );
  }
}
