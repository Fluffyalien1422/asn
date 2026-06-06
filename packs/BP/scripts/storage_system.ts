import { ItemStack, Player } from "@minecraft/server";
import { Result } from "neverthrow";
import { MaybePromise } from "./utils/async";

export type AddItemStackToStorageError =
  | {
      type: "unknownError";
      message: string;
    }
  | {
      type: "insufficientStorage";
    }
  | {
      type: "insufficientEnergy";
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
   * Removes an item stack from storage by its unique identifier. Clamps the
   * requested amount to the amount stored in the target slot.
   * @returns the removed {@link ItemStack}, or null if the id was not found
   */
  abstract removeItemStack: (
    id: string,
    amount: number,
    player?: Player,
  ) => MaybePromise<ItemStack | undefined>;

  abstract getStoredItemStacks(): MaybePromise<
    Result<Map<string, ItemStack>, Error>
  >;

  /**
   * Takes items out of storage and spawns them for the player.
   * @see {@link StorageSystem.removeItemStack}
   */
  async takeOutItemStack(
    player: Player,
    id: string,
    amount: number,
  ): Promise<void> {
    const itemStack = await this.removeItemStack(id, amount, player);
    if (!itemStack) return;
    player.dimension.spawnItem(itemStack, player.location);
  }
}
