import { Enchantment, ItemStack } from "@minecraft/server";
import { DeepReadonly } from "ts-essentials";
import { getEnchantmentTypeId } from "./utils";

export class StorageSystemItemStack {
  constructor(
    readonly typeId: string,
    public amount = 1,
    readonly nameTag?: string,
    readonly damage = 0,
    readonly lore: readonly string[] = [],
    readonly enchantments: DeepReadonly<Enchantment[]> = []
  ) {}

  static fromItemStack(itemStack: ItemStack): StorageSystemItemStack {
    const id = itemStack.typeId;
    const amount = itemStack.amount;
    const nameTag = itemStack.nameTag;
    const damage = itemStack.getComponent("durability")?.damage ?? 0;
    const lore = itemStack.getLore();
    const enchantments =
      itemStack.getComponent("enchantable")?.getEnchantments() ?? [];

    return new StorageSystemItemStack(
      id,
      amount,
      nameTag,
      damage,
      lore,
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
