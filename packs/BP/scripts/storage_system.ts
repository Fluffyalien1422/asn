import { ItemStack, Player } from "@minecraft/server";
import { Result } from "neverthrow";
import { MaybePromise } from "./utils/async";
import { logWarn } from "./log";

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

export type RemoveItemStackFromStorageError =
  | {
      type: "unknownError";
      message: string;
    }
  | {
      type: "notFound";
    };

/**
 * A system that can hold {@link StorageSystemItemStacks}.
 */
export abstract class StorageSystem {
  private storedItemsRevision = 0;

  /**
   * A counter that increases whenever this system's stored items change. The
   * storage viewer records it and refreshes in real time when it advances, so
   * external changes (eg. an import bus or another player adding items) are
   * reflected while the viewer is open. Subclasses must call
   * {@link StorageSystem.markStoredItemsChanged} whenever their stored items change.
   */
  getStoredItemsRevision(): number {
    return this.storedItemsRevision;
  }

  /**
   * Records that this system's stored items have changed.
   * @see {@link StorageSystem.getStoredItemsRevision}
   */
  protected markStoredItemsChanged(): void {
    this.storedItemsRevision++;
  }

  // this must be a property so subclasses will be forced to take player as optional.
  // subclasses are allowed to take less specific argument types for methods.
  // same for removeItemStack.
  /**
   * Adds an item stack to storage.
   * @param itemStack the item stack to add
   * @param player the player triggering the add, if applicable
   * @returns a result containing an error if the item could not be stored
   */
  abstract addItemStack: (
    itemStack: ItemStack,
  ) => MaybePromise<Result<void, AddItemStackToStorageError>>;

  /**
   * Removes an item stack from storage by its unique identifier. Clamps the
   * requested amount to the amount stored in the target slot.
   * @param id the unique identifier of the item stack to remove
   * @param amount the number of items to remove; clamped to the amount stored in the slot
   * @param player the player triggering the remove, if applicable
   * @returns a result containing the removed {@link ItemStack}, or an error if the removal failed
   */
  abstract removeItemStack: (
    id: string,
    amount: number,
  ) => MaybePromise<Result<ItemStack, RemoveItemStackFromStorageError>>;

  /**
   * Gets all item stacks currently stored in this system.
   * @returns a result containing a map of unique IDs to item stacks
   */
  abstract getStoredItemStacks(): MaybePromise<
    Result<Map<string, ItemStack>, Error>
  >;

  /**
   * Takes items out of storage and spawns them at the player's location.
   * @param player the player to spawn items for
   * @param id the unique identifier of the item stack to take out
   * @param amount the number of items to take out
   * @see {@link StorageSystem.removeItemStack}
   */
  async takeOutItemStack(
    player: Player,
    id: string,
    amount: number,
  ): Promise<void> {
    const itemStackr = await this.removeItemStack(id, amount);
    if (itemStackr.isErr()) {
      if (itemStackr.error.type === "unknownError") {
        logWarn(`Failed to remove item stack: ${itemStackr.error.message}`);
      }
      return;
    }
    const itemStack = itemStackr.value;
    player.dimension.spawnItem(itemStack, player.location);
  }
}
