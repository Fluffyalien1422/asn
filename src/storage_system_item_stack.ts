import { Enchantment, EnchantmentType, ItemStack } from "@minecraft/server";
import { DeepReadonly } from "ts-essentials";

export class StorageSystemItemStack {
  constructor(
    readonly typeId: string,
    readonly amount = 1,
    readonly nameTag?: string,
    readonly damage = 0,
    readonly enchantments: DeepReadonly<Enchantment[]> = []
  ) {}

  static fromItemStack(itemStack: ItemStack): StorageSystemItemStack {
    const id = itemStack.typeId;
    const amount = itemStack.amount;
    const nameTag = itemStack.nameTag;
    const damage = itemStack.getComponent("durability")?.damage ?? 0;
    const enchantments =
      itemStack.getComponent("enchantable")?.getEnchantments() ?? [];

    return new StorageSystemItemStack(
      id,
      amount,
      nameTag,
      damage,
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
      this.enchantments
    );
  }

  matches(other: StorageSystemItemStack): boolean {
    return (
      this.typeId === other.typeId &&
      this.amount === other.amount &&
      this.damage === other.damage &&
      this.nameTag === other.nameTag &&
      this.enchantments.length === other.enchantments.length &&
      this.enchantments.every((enchantment) =>
        other.enchantments.some(
          (otherEnchantment) =>
            enchantment.level === otherEnchantment.level &&
            typeof enchantment.type === typeof otherEnchantment.type &&
            (typeof enchantment.type === "string"
              ? enchantment.type === otherEnchantment.type
              : enchantment.type.id ===
                (otherEnchantment.type as EnchantmentType).id)
        )
      )
    );
  }
}
