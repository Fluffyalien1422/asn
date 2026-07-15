/**
 * Storage disk persistence (v3).
 *
 * A storage disk is an {@link ItemStack}, but its contents (the items it
 * stores) are far too large to live on the item itself. Instead they are kept
 * in the inventory of a dedicated entity, and that entity is persisted to the
 * world as a named structure via the structure manager. The disk ItemStack only
 * carries a small `disk_id` dynamic property (see {@link diskIdProperty}) that
 * names which structure holds its data.
 *
 * Reading or writing a disk therefore follows this dance:
 *  1. Ensure a ticking area keeps a fixed data location loaded (entities can
 *     only be spawned/placed in loaded chunks) — see {@link loadDataArea}.
 *  2. Place the disk's structure at that location, which materializes the
 *     storage entity — see {@link getEntityFromDisk}.
 *  3. Read from / write to the entity's inventory container.
 *  4. On write, re-save the entity back into its structure.
 *  5. Remove the temporary entity so it does not linger in the world.
 *
 * The data location is deep underground in the overworld at a fixed point, far
 * from where players build, so the transient entity is never seen.
 *
 * CONCURRENCY INVARIANT: every disk operation shares the single
 * {@link DATA_LOCATION}, so correctness relies on each read/write critical
 * section being atomic. Between spawning/placing the storage entity and calling
 * `entity.remove()`, {@link saveItemsToDisk} and {@link loadItemsFromDisk} must
 * not `await` anything. Because the scripting runtime is single-threaded, a
 * fully synchronous critical section guarantees no other operation's entity can
 * coexist at {@link DATA_LOCATION}; if an `await` were introduced there, a
 * concurrent operation could run in the gap and its entity would be captured by
 * this one's `structureManager.createFromWorld` (or read out by the wrong
 * caller), corrupting or duplicating disk contents. Keep those sections free of
 * `await`.
 */

import {
  ContainerSlot,
  Dimension,
  DimensionLocation,
  Entity,
  ItemStack,
  RawMessage,
  StructureSaveMode,
  Vector3,
  world,
} from "@minecraft/server";
import { DynamicPropertyAccessor } from "./utils/dynamic_property_v3";
import { err, ok, Result } from "neverthrow";
import { getEntityAtBlockLocation } from "./utils/location";
import { abbreviateNumber } from "./utils/string";
import { createItemStack } from "./utils/item";

/** Id of the ticking area that keeps {@link DATA_LOCATION} loaded. */
const TICKING_AREA_ID = "fluffyalien_asn:disk_data_area";
/**
 * Fixed point where disk structures are temporarily placed to read/write their
 * contents. Deep underground and far from typical builds so the transient
 * storage entity is never visible to players.
 */
const DATA_LOCATION: Vector3 = { x: 0, y: -63, z: 0 };
const DATA_LOCATION_DIMENSION_ID = "minecraft:overworld";
/** The entity whose inventory holds a disk's stored items. */
const DISK_ENTITY_ID = "fluffyalien_asn:storage_disk_entity_v3";
/** Max number of distinct item types listed in a disk's lore tooltip. */
const DISK_LORE_MAX_DISPLAY_TYPES = 5;
/** Slot capacity for each storage disk item type. */
const DISK_CAPACITIES: Record<string, number> = {
  "fluffyalien_asn:storage_disk_v3_64": 64,
  "fluffyalien_asn:storage_disk_v3_32": 32,
};

/**
 * The disk's id, stored as a dynamic property on the disk ItemStack. Links the
 * disk to the structure that holds its contents (see {@link getDiskId}).
 */
const diskIdProperty = new DynamicPropertyAccessor<string>(
  "fluffyalien_asn:disk_id",
);

/**
 * Gets the slot capacity of a disk by its type id, or `0` if the type id is not
 * a known storage disk.
 */
export function getDiskCapacity(typeId: string): number {
  return DISK_CAPACITIES[typeId] ?? 0;
}

/**
 * Gets the unique id of a storage disk, or `undefined` if it has never been
 * written to (a fresh disk only gets an id the first time items are saved to
 * it, see {@link saveItemsToDisk}). The id is stable for the life of the disk,
 * so it uniquely identifies which data a disk refers to.
 */
export function getDiskId(disk: ItemStack | ContainerSlot): string | undefined {
  return diskIdProperty.safeGet(disk);
}

/**
 * Updates a disk's lore tooltip to summarize its contents: a header line with
 * the used/total stack count and total item count, followed by the
 * {@link DISK_LORE_MAX_DISPLAY_TYPES} most numerous item types and a
 * "and N more..." line if there are additional types.
 * @returns the same disk, for chaining
 */
function setDiskLore<T extends ItemStack | ContainerSlot>(
  disk: T,
  itemStacks: readonly ItemStack[],
): T {
  // sum the amounts per item type (keyed by localization key) so the tooltip
  // can show a per-type breakdown rather than one line per stack.
  const localizationToAmount = new Map<string, number>();
  let totalItemsCount = 0;
  for (const itemStack of itemStacks) {
    totalItemsCount += itemStack.amount;
    localizationToAmount.set(
      itemStack.localizationKey,
      (localizationToAmount.get(itemStack.localizationKey) ?? 0) +
        itemStack.amount,
    );
  }

  const capacity = getDiskCapacity(disk.typeId);
  // show only the most numerous types, descending by amount.
  const displayEntries = [...localizationToAmount.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, DISK_LORE_MAX_DISPLAY_TYPES);
  const displayEntriesRawMsg: RawMessage[] = displayEntries.flatMap(
    ([localizationKey, amount]) => [
      { text: `\n§r§7${abbreviateNumber(amount)} ` },
      { translate: localizationKey },
    ],
  );
  if (localizationToAmount.size > DISK_LORE_MAX_DISPLAY_TYPES) {
    const remaining = localizationToAmount.size - DISK_LORE_MAX_DISPLAY_TYPES;
    displayEntriesRawMsg.push({
      text: `\n§r§7and ${remaining.toString()} more...`,
    });
  }

  disk.setLore([
    {
      rawtext: [
        {
          text: `§r§7${itemStacks.length.toString()}/${capacity.toString()} stacks (${abbreviateNumber(totalItemsCount)} items)`,
        },
        ...displayEntriesRawMsg,
      ],
    },
  ]);

  return disk;
}

/** Resolves {@link DATA_LOCATION} into a {@link DimensionLocation}. */
function getDataDimensionLocation(): Result<DimensionLocation, Error> {
  let dimension: Dimension;
  try {
    dimension = world.getDimension(DATA_LOCATION_DIMENSION_ID);
  } catch (e) {
    return err(
      new Error(`Failed to get data dimension location: ${String(e)}`),
    );
  }

  return ok({ ...DATA_LOCATION, dimension });
}

/** The structure name that holds the contents of the disk with this id. */
function structureIdFromDiskId(diskId: string): string {
  return `fluffyalien_asn:disk_struct${diskId}`;
}

/**
 * Ensures the ticking area covering {@link DATA_LOCATION} exists, so the data
 * location's chunk is loaded and entities can be spawned/placed there. A no-op
 * if the ticking area already exists.
 */
async function loadDataArea(): Promise<Result<void, Error>> {
  if (world.tickingAreaManager.hasTickingArea(TICKING_AREA_ID)) return ok();

  const locationr = getDataDimensionLocation();
  if (locationr.isErr()) {
    return err(new Error(`Failed to load data area: ${locationr.error}`));
  }
  const location = locationr.value;

  try {
    await world.tickingAreaManager.createTickingArea(TICKING_AREA_ID, {
      dimension: location.dimension,
      from: location,
      to: location,
    });
  } catch (e) {
    return err(new Error(`Failed to load data area: ${String(e)}`));
  }

  return ok();
}

/**
 * Materializes a disk's storage entity by placing its structure at
 * {@link DATA_LOCATION} and returning the entity that appears there. Callers are
 * responsible for removing the returned entity once done with it.
 *
 * Always fails if the data area is not loaded (the structure can only be placed
 * in loaded chunks), so call {@link loadDataArea} first.
 */
function getEntityFromDisk(diskId: string): Result<Entity, Error> {
  const locationr = getDataDimensionLocation();
  if (locationr.isErr()) {
    return err(
      new Error(`Failed to get entity from storage disk: ${locationr.error}`),
    );
  }
  const location = locationr.value;

  const structId = structureIdFromDiskId(diskId);
  try {
    world.structureManager.place(structId, location.dimension, location);
  } catch (e) {
    return err(
      new Error(`Failed to get entity from storage disk: ${String(e)}`),
    );
  }

  const entity = getEntityAtBlockLocation(location, DISK_ENTITY_ID);
  if (!entity) {
    return err(
      new Error("Failed to get entity from storage disk: Entity not found."),
    );
  }

  return ok(entity);
}

/**
 * Persists `items` as the full contents of a disk. The given items replace
 * whatever the disk held before. This always spawns a fresh storage entity,
 * fills it with `items`, and saves it into the disk's structure, overwriting
 * any previously stored structure. On a fresh disk (one with no id yet) the new
 * entity's id becomes the disk's id, so the disk only gets an id the first time
 * it is written to. Either way the live entity is removed once the structure is
 * written.
 *
 * Also refreshes the disk's lore tooltip via {@link setDiskLore}.
 * @param disk the disk ItemStack (or slot) to write to
 * @param items the items to store; must not exceed `capacity_`
 * @param capacity_ the disk's slot capacity (clamped to an entity inventory's
 *   max of 64 slots)
 * @returns the same disk on success, or an error if any step failed
 */
export async function saveItemsToDisk<T extends ItemStack | ContainerSlot>(
  disk: T,
  items: ItemStack[],
  capacity_: number,
): Promise<Result<T, Error>> {
  // the entity inventory holds at most 64 slots, so cap capacity there.
  const capacity = Math.min(capacity_, 64);
  if (items.length > capacity) {
    return err(
      new Error(
        `Failed to save items to storage disk: Trying to save too many items (>${capacity.toString()}).`,
      ),
    );
  }

  const locationr = getDataDimensionLocation();
  if (locationr.isErr()) {
    return err(
      new Error(`Failed to save items to storage disk: ${locationr.error}`),
    );
  }
  const location = locationr.value;
  const diskId = diskIdProperty.safeGet(disk);

  const loadDataAreaResult = await loadDataArea();
  if (loadDataAreaResult.isErr()) {
    return err(
      new Error(
        `Failed to save items to storage disk: ${loadDataAreaResult.error}`,
      ),
    );
  }

  // always spawn a fresh storage entity; any previously stored entity is
  // discarded and its structure overwritten below, so there's no need to bring
  // the old one back.
  //
  // CONCURRENCY: there must be no `await` from here until `entity.remove()` in
  // the finally below - see the concurrency invariant in the module doc.
  let entity: Entity;
  try {
    entity = location.dimension.spawnEntity(DISK_ENTITY_ID, location);
  } catch (e) {
    return err(new Error(`Failed to save items to storage disk: ${String(e)}`));
  }

  // a fresh disk has no id yet; it adopts the new entity's id, but only once its
  // structure has actually been written (below), so a failed first write can't
  // leave the disk pointing at a structure that doesn't exist.
  const structId = structureIdFromDiskId(diskId ?? entity.id);

  try {
    // overwrite the entity's inventory with the new contents.
    const container = entity.getComponent("inventory")?.container;
    if (!container) {
      return err(
        new Error(
          "Failed to save items to storage disk: Cannot get entity container.",
        ),
      );
    }
    container.clearAll();
    for (let i = 0; i < items.length; i++) {
      container.setItem(i, items[i]);
    }

    // re-save the entity into its structure (replacing the old one) so the
    // contents persist across reloads.
    world.structureManager.delete(structId);
    world.structureManager.createFromWorld(
      structId,
      location.dimension,
      location,
      location,
      {
        includeBlocks: false,
        includeEntities: true,
        saveMode: StructureSaveMode.World,
      },
    );

    // the structure now exists, so it's safe to commit the id to a fresh disk.
    // doing this only after a successful write ensures the disk never references
    // a missing structure.
    if (!diskId) {
      const setResult = diskIdProperty.set(disk, entity.id);
      if (setResult.isErr()) {
        // couldn't record the id on the disk (eg. the slot became invalid), so
        // the structure we just wrote would be orphaned; delete it so it doesn't
        // leak.
        world.structureManager.delete(structId);
        return err(
          new Error(`Failed to save items to storage disk: ${setResult.error}`),
        );
      }
    }

    setDiskLore(disk, items);

    return ok(disk);
  } catch (e) {
    // Any failure while writing the container, saving the structure, or setting
    // the lore (eg. the disk slot became invalid) is returned as an error
    // rather than thrown, so callers can rely on the Result contract instead of
    // having to guard against a rejected promise.
    return err(new Error(`Failed to save items to storage disk: ${String(e)}`));
  } finally {
    // whether the save succeeded or bailed out early, the live entity is no
    // longer needed (the structure, if written, now holds the data).
    entity.remove();
  }
}

/**
 * Creates a new disk of `resultTypeId` that shares the contents of `source` by
 * copying its disk id (see {@link getDiskId}). Used to "upgrade" a disk to a
 * larger capacity without moving or resetting its contents: both disks point at
 * the same stored data, so the source must be consumed by the caller afterwards.
 *
 * If `source` has never been written to (it has no id), the result is a fresh,
 * empty disk of the new type. The result's lore is refreshed for its capacity by
 * re-reading the (shared) contents; this is a read, so it moves no items.
 * @returns the new disk on success, or an error if the lore refresh failed
 */
export async function upgradeDisk(
  source: ItemStack,
  resultTypeId: string,
): Promise<Result<ItemStack, Error>> {
  if (!getDiskCapacity(resultTypeId)) {
    return err(
      new Error(`Failed to upgrade disk: Invalid disk type '${resultTypeId}'.`),
    );
  }

  const itemStackr = createItemStack(resultTypeId);
  if (itemStackr.isErr()) {
    return err(
      new Error(`Failed to create upgraded disk: ${itemStackr.error}`),
    );
  }
  const itemStack = itemStackr.value;

  const diskId = diskIdProperty.safeGet(source);
  if (diskId === undefined) {
    return ok(itemStack);
  }

  diskIdProperty.set(itemStack, diskId);
  const itemsr = await loadItemsFromDisk(itemStack);
  if (itemsr.isErr()) {
    return err(new Error(`Failed to upgrade disk: ${itemsr.error}`));
  }
  const items = itemsr.value;

  setDiskLore(itemStack, items);

  return ok(itemStack);
}

/**
 * Loads the items currently stored on a disk. Returns an empty array for a disk
 * that has never been written to (one with no id). Materializes the disk's
 * storage entity, reads its inventory, then removes the entity.
 * @returns a result containing the stored items, or an error if loading failed
 */
export async function loadItemsFromDisk(
  disk: ItemStack | ContainerSlot,
): Promise<Result<ItemStack[], Error>> {
  const diskId = diskIdProperty.safeGet(disk);
  if (!diskId) {
    // never written to, so it holds nothing.
    return ok([]);
  }

  const loadDataAreaResult = await loadDataArea();
  if (loadDataAreaResult.isErr()) {
    return err(
      new Error(
        `Failed to load items from storage disk: ${loadDataAreaResult.error}`,
      ),
    );
  }

  const entityr = getEntityFromDisk(diskId);
  if (entityr.isErr()) {
    return err(
      new Error(`Failed to load items from storage disk: ${entityr.error}`),
    );
  }
  const entity = entityr.value;

  // CONCURRENCY: there must be no `await` from here until `entity.remove()` in
  // the finally below - see the concurrency invariant in the module doc.
  try {
    // collect the non-empty slots from the storage entity's inventory.
    const container = entity.getComponent("inventory")?.container;
    if (!container) {
      return err(
        new Error(
          "Failed to load items from storage disk: Cannot get entity container.",
        ),
      );
    }

    const items: ItemStack[] = [];
    for (let i = 0; i < container.size; i++) {
      const item = container.getItem(i);
      if (item) items.push(item);
    }

    return ok(items);
  } catch (e) {
    // as with saveItemsToDisk, any failure reading the container is returned as
    // an error rather than thrown, so callers can rely on the Result contract.
    return err(
      new Error(`Failed to load items from storage disk: ${String(e)}`),
    );
  } finally {
    // the read is complete (or threw); remove the transient entity either way.
    entity.remove();
  }
}
