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
 * whatever the disk held before. On a fresh disk (one with no id yet) this
 * spawns a new storage entity and assigns the disk its id; otherwise it loads
 * the existing entity and overwrites its inventory. Either way the entity is
 * re-saved into the disk's structure and then removed.
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
  // an entity inventory holds at most 64 slots, so cap capacity there.
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

  let entity: Entity;
  let structId: string;
  if (diskId) {
    // existing disk: bring back its storage entity to overwrite.
    structId = structureIdFromDiskId(diskId);
    const loadedEntityr = getEntityFromDisk(diskId);
    if (loadedEntityr.isErr()) {
      return err(
        new Error(
          `Failed to save items to storage disk: ${loadedEntityr.error}`,
        ),
      );
    }
    const loadedEntity = loadedEntityr.value;
    entity = loadedEntity;
  } else {
    // fresh disk: spawn a new storage entity and adopt its id as the disk id,
    // so the disk only gets an id the first time it is written to.
    try {
      entity = location.dimension.spawnEntity(DISK_ENTITY_ID, location);
    } catch (e) {
      return err(
        new Error(`Failed to save items to storage disk: ${String(e)}`),
      );
    }
    structId = structureIdFromDiskId(entity.id);
    diskIdProperty.set(disk, entity.id);
  }

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
  try {
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
  } catch (e) {
    return err(new Error(`Failed to save items to storage disk: ${String(e)}`));
  }

  // the structure now holds the data; the live entity is no longer needed.
  entity.remove();
  setDiskLore(disk, items);

  return ok(disk);
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

  // collect the non-empty slots from the storage entity's inventory.
  const items: ItemStack[] = [];
  const container = entity.getComponent("inventory")!.container;
  for (let i = 0; i < container.size; i++) {
    const item = container.getItem(i);
    if (item) items.push(item);
  }

  // the read is complete; remove the transient entity.
  entity.remove();
  return ok(items);
}
