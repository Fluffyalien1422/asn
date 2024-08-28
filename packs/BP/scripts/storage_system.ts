import { Player } from "@minecraft/server";
import { StorageSystemItemStack } from "./storage_system_item_stack";
import { ErrorResult } from "./utils/result";

export type AddItemStackToStorageError =
  | {
      type: "insufficientStorage";
    }
  | {
      type: "bannedItem";
      itemId: string;
    };

/**
 * A system that can hold {@link StorageSystemItemStacks}.
 */
export interface StorageSystem {
  addItemStack(
    itemStack: StorageSystemItemStack,
  ): ErrorResult<AddItemStackToStorageError>;
  getStoredItemStacks(): readonly StorageSystemItemStack[];
  takeOutItemStack(player: Player, itemStack: StorageSystemItemStack): void;
}
