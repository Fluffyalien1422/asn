import { Block, Vector3 } from "@minecraft/server";
import { err, ok, Result } from "neverthrow";
import {
  getBlockDynamicProperty,
  setBlockDynamicProperty,
} from "./block_dynamic_property";

export type DynamicPropertyValue = boolean | number | string | Vector3;

export interface HasDynamicProperties {
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

  get(target: HasDynamicProperties | Block): Result<TValue | TDefault, Error> {
    let value: TValue | undefined;
    try {
      if (target instanceof Block) {
        // Use getBlockDynamicProperty() until Mojang releases
        // 'block.getComponent("dynamic_properties").get()' in stable.
        value = getBlockDynamicProperty(target, this.id) as TValue | undefined;
      } else {
        value = target.getDynamicProperty(this.id) as TValue | undefined;
      }
    } catch (e) {
      return err(new Error(`Failed to get dynamic property: ${String(e)}`));
    }
    return ok(value ?? this.defaultValue);
  }

  safeGet(target: HasDynamicProperties | Block): TValue | TDefault {
    return this.get(target).match(
      /* ok */ (v) => v,
      /* err */ () => this.defaultValue,
    );
  }

  set(
    target: HasDynamicProperties | Block,
    value?: TValue,
  ): Result<void, Error> {
    try {
      if (target instanceof Block) {
        // Use setBlockDynamicProperty() until Mojang releases
        // 'block.getComponent("dynamic_properties").set()' in stable.
        setBlockDynamicProperty(target, this.id, value);
      } else {
        target.setDynamicProperty(this.id, value);
      }
      return ok();
    } catch (e) {
      return err(
        new Error(`Failed to set dynamic property '${this.id}': ${String(e)}`),
      );
    }
  }
}
