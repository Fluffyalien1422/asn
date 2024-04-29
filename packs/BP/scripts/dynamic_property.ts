import { Vector3 } from "@minecraft/server";

type DynamicPropertyValue = boolean | number | string | Vector3;

interface HasDynamicProperties {
  getDynamicProperty(id: string): DynamicPropertyValue | undefined;
  setDynamicProperty(id: string, value?: DynamicPropertyValue): unknown;
}

export class DynamicProperty<TValue extends DynamicPropertyValue> {
  constructor(readonly id: string) {}

  get(target: HasDynamicProperties): TValue | undefined {
    return target.getDynamicProperty(this.id) as TValue | undefined;
  }

  set(target: HasDynamicProperties, value?: TValue): void {
    target.setDynamicProperty(this.id, value);
  }
}
