import {
  ContainerSlot,
  Dimension,
  DimensionLocation,
  Entity,
  ItemStack,
  StructureSaveMode,
  world,
} from "@minecraft/server";
import { DynamicPropertyAccessor } from "./utils/dynamic_property_v3";
import { err, ok, Result } from "neverthrow";
import { getEntityAtBlockLocation } from "./utils/location";

const TICKING_AREA_ID = "fluffyalien_asn:disk_data_area";
const DATA_LOCATION = { x: 0, y: -63, z: 0 };
const DATA_LOCATION_DIMENSION_ID = "minecraft:overworld";
const DISK_ENTITY_ID = "fluffyalien_asn:storage_disk_entity_v3";

const diskIdProperty = new DynamicPropertyAccessor<string>(
  "fluffyalien_asn:disk_id",
);

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

function structureIdFromDiskId(diskId: string): string {
  return `fluffyalien_asn:disk_struct${diskId}`;
}

export async function loadDataArea(): Promise<Result<void, Error>> {
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

export function unloadDataArea(): void {
  try {
    world.tickingAreaManager.removeTickingArea(TICKING_AREA_ID);
  } catch (e) {
    console.warn(e);
  }
}

export function isDataAreaLoaded(): boolean {
  return world.tickingAreaManager.hasTickingArea(TICKING_AREA_ID);
}

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

export function saveItemsToDisk<T extends ItemStack | ContainerSlot>(
  disk: T,
  items: ItemStack[],
): Result<T, Error> {
  if (items.length > 64) {
    return err(
      new Error(
        "Failed to save items to storage disk: Trying to save too many items (>64).",
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

  if (!isDataAreaLoaded()) {
    return err(
      new Error("Failed to save items to storage disk: Data area not loaded."),
    );
  }

  let entity: Entity;
  let structId: string;
  if (diskId) {
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

  entity.remove();

  return ok(disk);
}

export function loadItemsFromDisk(
  disk: ItemStack | ContainerSlot,
): Result<ItemStack[], Error> {
  const diskId = diskIdProperty.safeGet(disk);
  if (!diskId) {
    return ok([]);
  }

  if (!isDataAreaLoaded()) {
    return err(
      new Error(
        "Failed to load items from storage disk: Data area not loaded.",
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

  const items: ItemStack[] = [];
  const container = entity.getComponent("inventory")!.container;
  for (let i = 0; i < container.size; i++) {
    const item = container.getItem(i);
    if (item) items.push(item);
  }

  entity.remove();
  return ok(items);
}
