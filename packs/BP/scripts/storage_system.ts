import { ItemStack, Player } from "@minecraft/server";
import { Result } from "neverthrow";
import { MaybePromise } from "./utils/async";
import { cloneItemStackWithAmount } from "./utils/item";

export type AddItemStackToStorageError =
  | {
      type: "insufficientStorage";
    }
  | {
      type: "insufficientEnergy";
    }
  | {
      type: "bannedItem";
      itemId: string;
    };

/**
 * A system that can hold {@link StorageSystemItemStacks}.
 */
export abstract class StorageSystem {
  // this must be a property so subclasses will be forced to take player as optional.
  // subclasses are allowed to take less specific argument types for methods.
  // same for removeItemStack.
  abstract addItemStack: (
    itemStack: ItemStack,
    player?: Player,
  ) => MaybePromise<Result<void, AddItemStackToStorageError>>;

  /**
   * Removes items from storage. Clamps the amount from 1 to the amount available in storage
   * @returns the amount that was removed
   */
  abstract removeItemStack: (
    itemStack: ItemStack,
    player?: Player,
  ) => MaybePromise<number>;

  abstract getStoredItemStacks(): MaybePromise<
    Result<readonly ItemStack[], Error>
  >;

  /**
   * Take items out of storage and gives it to the player. Clamps the amount from 1 to the amount available in storage
   * @throws if this object is not valid
   * @see {@link StorageSystem.removeItemStack}
   */
  async takeOutItemStack(player: Player, itemStack: ItemStack): Promise<void> {
    const requestAmount = await this.removeItemStack(itemStack, player);

    let amountRemaining = requestAmount;
    while (amountRemaining > 0) {
      const amount = Math.min(itemStack.maxAmount, amountRemaining);
      amountRemaining -= amount;
      const newItemStack = cloneItemStackWithAmount(itemStack, amount);
      player.dimension.spawnItem(newItemStack, player.location);
    }
  }
}

export function isBannedItem(itemStack: ItemStack): boolean {
  return (
    itemStack.typeId === "minecraft:potion" ||
    itemStack.typeId === "minecraft:splash_potion" ||
    itemStack.typeId === "minecraft:lingering_potion" ||
    (itemStack.typeId.startsWith("minecraft:") &&
      itemStack.typeId.endsWith("_shulker_box"))
  );
}
