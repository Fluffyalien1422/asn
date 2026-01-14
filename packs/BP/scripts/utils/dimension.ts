import {
  Dimension,
  Entity,
  EntityQueryOptions,
  world,
} from "@minecraft/server";

export const overworld = (): Dimension => world.getDimension("overworld");
export const nether = (): Dimension => world.getDimension("nether");
export const end = (): Dimension => world.getDimension("the_end");

export function getEntitiesInAllDimensions(
  query: EntityQueryOptions,
): Entity[] {
  return [
    ...overworld().getEntities(query),
    ...nether().getEntities(query),
    ...end().getEntities(query),
  ];
}
