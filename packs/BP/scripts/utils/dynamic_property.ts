import { Block, DimensionLocation, Vector3, world } from "@minecraft/server";

type DynamicPropertyValue = boolean | number | string | Vector3;

interface HasDynamicProperties {
  getDynamicProperty(id: string): DynamicPropertyValue | undefined;
  setDynamicProperty(id: string, value?: DynamicPropertyValue): unknown;
}

export class DynamicPropertyAccessor<
  TValue extends DynamicPropertyValue,
  TDefault extends TValue | undefined = undefined,
> {
  protected constructor(
    readonly id: string,
    readonly defaultValue: TDefault,
  ) {}

  static withDefault<TValue extends DynamicPropertyValue>(
    id: string,
    defaultValue: TValue,
  ): DynamicPropertyAccessor<TValue, TValue> {
    return new DynamicPropertyAccessor(id, defaultValue);
  }

  static withoutDefault<TValue extends DynamicPropertyValue>(
    id: string,
  ): DynamicPropertyAccessor<TValue> {
    return new DynamicPropertyAccessor(id, undefined);
  }

  get(target: HasDynamicProperties | Block): TValue | TDefault {
    if (target instanceof Block) {
      return (
        (getBlockDynamicProperty(target, this.id) as TValue | undefined) ??
        this.defaultValue
      );
    }

    return (
      (target.getDynamicProperty(this.id) as TValue | undefined) ??
      this.defaultValue
    );
  }

  set(target: HasDynamicProperties | Block, value?: TValue): void {
    if (target instanceof Block) {
      setBlockDynamicProperty(target, this.id, value);
      return;
    }

    target.setDynamicProperty(this.id, value);
  }
}

function getBlockUid(loc: DimensionLocation): string {
  return (
    loc.dimension.id + loc.x.toString() + loc.y.toString() + loc.z.toString()
  );
}

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
