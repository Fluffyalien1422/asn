import { Entity, EntityQueryOptions, world } from "@minecraft/server";

/**
 * Returns the IDs of all dimensions that currently have a player in them.
 *
 * A dimension only ticks and can be queried while it is loaded, and a
 * dimension is guaranteed to be loaded if a player is present. This is used
 * as an approximation of the set of loaded dimensions.
 */
export function getLoadedDimensions(): Set<string> {
  const dimensions = new Set<string>();
  for (const player of world.getAllPlayers()) {
    dimensions.add(player.dimension.id);
  }
  return dimensions;
}

/**
 * Runs an {@link EntityQueryOptions} query across every loaded dimension and
 * returns the combined results.
 *
 * Only dimensions returned by {@link getLoadedDimensions} are searched, so
 * entities in dimensions without a player will not be found.
 */
export function getEntitiesInAllDimensions(
  query: EntityQueryOptions,
): Entity[] {
  const entities: Entity[] = [];
  for (const dimensionId of getLoadedDimensions()) {
    const dimension = world.getDimension(dimensionId);
    entities.push(...dimension.getEntities(query));
  }
  return entities;
}
