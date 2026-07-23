import { Entity, EntityQueryOptions, world } from "@minecraft/server";

/** Stores a JSON string array of every dimension ID a player has entered. */
const TRACKED_DIMENSIONS_PROP = "fluffyalien_asn:tracked_dimensions";

/** @returns the IDs of every dimension a player has entered. */
function getAllTrackedDimensions(): Set<string> {
  const raw = world.getDynamicProperty(TRACKED_DIMENSIONS_PROP);
  if (typeof raw !== "string") {
    return new Set();
  }

  try {
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

/** Records `dimensionId`, persisting the set only when it is a new dimension. */
function trackDimension(dimensionId: string): void {
  const dimensions = getAllTrackedDimensions();
  if (dimensions.has(dimensionId)) return;

  dimensions.add(dimensionId);
  world.setDynamicProperty(
    TRACKED_DIMENSIONS_PROP,
    JSON.stringify([...dimensions]),
  );
}

/**
 * Runs an {@link EntityQueryOptions} query across every tracked dimension and
 * returns the combined results.
 *
 * Only dimensions returned by {@link getAllDimensions} are searched, so
 * entities in dimensions that no player has entered will not be found.
 */
export function getEntitiesInAllDimensions(
  query: EntityQueryOptions,
): Entity[] {
  const entities: Entity[] = [];
  for (const dimensionId of getAllTrackedDimensions()) {
    const dimension = world.getDimension(dimensionId);
    entities.push(...dimension.getEntities(query));
  }
  return entities;
}

world.afterEvents.playerDimensionChange.subscribe((e) => {
  trackDimension(e.toDimension.id);
});

// The dimension change event does not fire for the dimension a player is
// already in on join, so seed the initial dimension from the spawn event.
world.afterEvents.playerSpawn.subscribe((e) => {
  trackDimension(e.player.dimension.id);
});
