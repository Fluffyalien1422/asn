import { Entity, EntityQueryOptions, world } from "@minecraft/server";

export const overworld = world.getDimension("overworld");
export const nether = world.getDimension("nether");
export const end = world.getDimension("the_end");

export function getEntitiesInAllDimensions(
  query: EntityQueryOptions,
): Entity[] {
  return [
    ...overworld.getEntities(query),
    ...nether.getEntities(query),
    ...end.getEntities(query),
  ];
}
