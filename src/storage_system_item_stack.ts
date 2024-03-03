import { Enchantment, ItemStack } from "@minecraft/server";

export class StorageSystemItemStack {
  constructor(
    public typeId: string,
    public amount = 1,
    public nameTag?: string,
    public damage = 0,
    public enchantments: Enchantment[] = []
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

    result.getComponent("enchantable")?.addEnchantments(this.enchantments);

    return result;
  }
}
