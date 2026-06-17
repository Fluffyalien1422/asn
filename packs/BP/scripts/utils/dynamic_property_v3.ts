import { Vector3 } from "@minecraft/server";
import { err, ok, Result } from "neverthrow";

type DynamicPropertyValue = boolean | number | string | Vector3;

interface HasDynamicProperties {
  getDynamicProperty(id: string): DynamicPropertyValue | undefined;
  setDynamicProperty(id: string, value?: DynamicPropertyValue): unknown;
}

export class DynamicPropertyAccessor<
  TValue extends DynamicPropertyValue,
  TDefault extends TValue | undefined = undefined,
> {
  readonly id: string;
  readonly defaultValue: TDefault;

  constructor(id: string);
  constructor(id: string, defaultValue: TDefault);
  constructor(id: string, defaultValue?: TDefault) {
    this.id = id;
    this.defaultValue = defaultValue as TDefault;
  }

  get(target: HasDynamicProperties): Result<TValue | TDefault, Error> {
    let value: TValue | undefined;
    try {
      value = target.getDynamicProperty(this.id) as TValue | undefined;
    } catch (e) {
      return err(new Error(`Failed to get dynamic property: ${String(e)}`));
    }
    return ok(value ?? this.defaultValue);
  }

  safeGet(target: HasDynamicProperties): TValue | TDefault {
    return this.get(target).match(
      /* ok */ (v) => v,
      /* err */ () => this.defaultValue,
    );
  }

  set(target: HasDynamicProperties, value?: TValue): Result<void, Error> {
    try {
      target.setDynamicProperty(this.id, value);
      return ok();
    } catch (e) {
      return err(
        new Error(`Failed to set dynamic property '${this.id}': ${String(e)}`),
      );
    }
  }
}
