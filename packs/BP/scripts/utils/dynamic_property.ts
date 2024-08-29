import { Vector3 } from "@minecraft/server";

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

  get(target: HasDynamicProperties): TValue | TDefault {
    return (
      (target.getDynamicProperty(this.id) as TValue | undefined) ??
      this.defaultValue
    );
  }

  set(target: HasDynamicProperties, value?: TValue): void {
    target.setDynamicProperty(this.id, value);
  }
}
