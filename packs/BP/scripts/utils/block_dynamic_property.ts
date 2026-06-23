import { DimensionLocation, world } from "@minecraft/server";
import { getBlockUid } from "./block";
import { DynamicPropertyValue } from "./dynamic_property_v3";

function makeBlockBaseDynamicPropertyId(loc: DimensionLocation): string {
  return "_bdp" + getBlockUid(loc);
}

export function getBlockDynamicProperty(
  loc: DimensionLocation,
  id: string,
): DynamicPropertyValue | undefined {
  return world.getDynamicProperty(makeBlockBaseDynamicPropertyId(loc) + id);
}

export function setBlockDynamicProperty(
  loc: DimensionLocation,
  id: string,
  value?: DynamicPropertyValue,
): void {
  world.setDynamicProperty(makeBlockBaseDynamicPropertyId(loc) + id, value);
}

export function getBlockDynamicProperties(loc: DimensionLocation): string[] {
  const blockBaseId = makeBlockBaseDynamicPropertyId(loc);

  return world
    .getDynamicPropertyIds()
    .filter((id) => id.startsWith(blockBaseId))
    .map((id) => id.slice(blockBaseId.length));
}

export function removeAllDynamicPropertiesForBlock(
  loc: DimensionLocation,
): void {
  const blockBaseId = makeBlockBaseDynamicPropertyId(loc);

  const properties = world
    .getDynamicPropertyIds()
    .filter((id) => id.startsWith(blockBaseId));

  for (const property of properties) {
    world.setDynamicProperty(property);
  }
}
