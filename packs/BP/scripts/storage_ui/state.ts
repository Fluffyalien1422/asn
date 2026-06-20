import { ItemStack, Player } from "@minecraft/server";
import { StorageSystem } from "../storage_system";

/** Which view the storage viewer is currently displaying. */
export type StorageViewerView = "default" | "group" | "group_type" | "crafting";

/** How many items are taken out per click in the storage view. */
export type StorageViewerStackSize = 1 | 2 | 4 | 8 | 16 | 32 | 64;

/**
 * A stored item entry: [Unique ID, ItemStack].
 * Unique ID refers to the UID of the ItemStack assigned by the storage system.
 * Note: Unique ID is an empty string in views where items cannot be removed (eg. crafting, group).
 */
export type StoredItem = [string, ItemStack];

export interface ViewerData {
  enabled: boolean;
  hasQuery: boolean;
  rawItems: readonly StoredItem[];
  filteredItems: readonly StoredItem[];
  storageSystem: StorageSystem;
  page: number;
  playerInUi: Player;
  view: StorageViewerView;
  stackSize: StorageViewerStackSize;
  groupTypeId?: string;
  craftingQuery?: string;
  /**
   * The display items for the current page/view, cached whenever the inventory
   * is (re)built in `fillViewerInventory`. The interaction poll reuses this
   * instead of recomputing the (potentially expensive) display list every tick.
   */
  itemsOnPage: readonly StoredItem[];
}

/**
 * Per-viewer state, keyed by the dummy storage viewer entity's ID.
 */
export const viewerData = new Map<string, ViewerData>();
