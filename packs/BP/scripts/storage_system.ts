import { Player } from "@minecraft/server";
import { StorageSystemItemStack } from "./storage_system_item_stack";
import { ErrorResult } from "./utils/result";

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
    itemStack: StorageSystemItemStack,
    player?: Player,
  ) => ErrorResult<AddItemStackToStorageError>;

  /**
   * Removes items from storage. Clamps the amount from 1 to the amount available in storage
   * @returns the amount that was removed
   */
  abstract removeItemStack: (
    itemStack: StorageSystemItemStack,
    player?: Player,
  ) => number;

  abstract getStoredItemStacks(): readonly StorageSystemItemStack[];

  /**
   * Take items out of storage and gives it to the player. Clamps the amount from 1 to the amount available in storage
   * @throws if this object is not valid
   * @see {@link StorageSystem.removeItemStack}
   */
  takeOutItemStack(player: Player, itemStack: StorageSystemItemStack): void {
    const requestAmount = this.removeItemStack(itemStack, player);

    const mcItemStack = itemStack.toItemStack();

    let amountRemaining = requestAmount;

    while (amountRemaining > 0) {
      const amount = Math.min(mcItemStack.maxAmount, amountRemaining);
      amountRemaining -= amount;

      const newItemStack = mcItemStack.clone();
      newItemStack.amount = amount;

      player.dimension.spawnItem(newItemStack, player.location);
    }
  }
}

export function isBannedItem(itemStack: StorageSystemItemStack): boolean {
  return (
    itemStack.typeId.startsWith("minecraft:") &&
    itemStack.typeId.endsWith("_shulker_box")
  );
}
