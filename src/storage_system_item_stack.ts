import { Enchantment, ItemStack, Vector3 } from "@minecraft/server";
import { DeepReadonly } from "ts-essentials";
import { getEnchantmentTypeId } from "./utils";
import { Vector3Utils } from "@minecraft/math";

export interface StorageSystemItemStackDynamicProperty {
  readonly id: string;
  readonly value: string | boolean | number | Vector3;
}

export class StorageSystemItemStack {
  constructor(
    readonly typeId: string,
    public amount = 1,
    readonly nameTag?: string,
    readonly damage = 0,
    readonly lore: readonly string[] = [],
    readonly dynamicProperties: readonly StorageSystemItemStackDynamicProperty[] = [],
    readonly enchantments: DeepReadonly<Enchantment[]> = []
  ) {}

  static fromItemStack(itemStack: ItemStack): StorageSystemItemStack {
    const id = itemStack.typeId;
    const amount = itemStack.amount;
    const nameTag = itemStack.nameTag;
    const damage = itemStack.getComponent("durability")?.damage ?? 0;
    const lore = itemStack.getLore();
    const dynamicProperties: StorageSystemItemStackDynamicProperty[] = itemStack
      .getDynamicPropertyIds()
      .map((id) => ({ id, value: itemStack.getDynamicProperty(id)! }));
    const enchantments =
      itemStack.getComponent("enchantable")?.getEnchantments() ?? [];

    return new StorageSystemItemStack(
      id,
      amount,
      nameTag,
      damage,
      lore,
      dynamicProperties,
      enchantments
    );
  }

  toItemStack(amount = 1): ItemStack {
    const result = new $.server.ItemStack(this.typeId, amount);

    result.nameTag = this.nameTag;

    {
      const durabilityComponent = result.getComponent("durability");
      if (durabilityComponent) {
        durabilityComponent.damage = this.damage;
      }
    }

    result.setLore(this.lore as string[]);

    for (const dynamicProperty of this.dynamicProperties) {
      result.setDynamicProperty(dynamicProperty.id, dynamicProperty.value);
    }

    result
      .getComponent("enchantable")
      ?.addEnchantments(this.enchantments as Enchantment[]);

    return result;
  }

  withAmount(amount?: number): StorageSystemItemStack {
    return new StorageSystemItemStack(
      this.typeId,
      amount,
      this.nameTag,
      this.damage,
      this.lore,
      this.dynamicProperties,
      this.enchantments
    );
  }

  isStackableWith(other: StorageSystemItemStack): boolean {
    return (
      this.typeId === other.typeId &&
      this.damage === other.damage &&
      this.nameTag === other.nameTag &&
      // lore
      this.lore.length === other.lore.length &&
      this.lore.every((v, i) => other.lore[i] === v) &&
      // dynamic properties
      this.dynamicProperties.length === other.dynamicProperties.length &&
      this.dynamicProperties.every((dynamicProperty) =>
        other.dynamicProperties.some(
          (otherDynamicProperty) =>
            dynamicProperty.id === otherDynamicProperty.id &&
            typeof dynamicProperty.value ===
              typeof otherDynamicProperty.value &&
            (typeof dynamicProperty.value === "object"
              ? Vector3Utils.equals(
                  dynamicProperty.value,
                  otherDynamicProperty.value as Vector3
                )
              : dynamicProperty.value === otherDynamicProperty.value)
        )
      ) &&
      // enchantments
      this.enchantments.length === other.enchantments.length &&
      this.enchantments.every((enchantment) =>
        other.enchantments.some(
          (otherEnchantment) =>
            enchantment.level === otherEnchantment.level &&
            getEnchantmentTypeId(enchantment) ===
              getEnchantmentTypeId(otherEnchantment)
        )
      )
    );
  }
}
