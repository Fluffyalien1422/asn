import {
  BlockCustomComponent,
  ContainerSlot,
  DimensionLocation,
  Entity,
  world,
} from "@minecraft/server";
import { err, ok, Result } from "neverthrow";
import {
  dimensionLocationFromEntity,
  getEntityAtBlockLocation,
} from "./utils/location";
import { getBlockUid } from "./utils/block";
import { logWarn } from "./log";
import { StorageNetwork } from "./storage_network";
import { getDiskCapacity, getDiskId } from "./storage_disk_v3";

const ENTITY_ID = "fluffyalien_asn:storage_drive_entity_v3";

interface DriveData {
  /**
   * A stable signature per drive slot describing which disk it held last tick,
   * so {@link storageDriveV3Component.onTick} can detect disks being inserted,
   * removed, or swapped. `null` means the slot held no disk.
   */
  diskSignatures: (string | null)[];
}
const driveData = new Map<string, DriveData>();

/**
 * A signature that identifies the disk in a slot across ticks. A written disk
 * has a stable unique id; a fresh disk has none yet, so its type is used as a
 * fallback under a `fresh:` namespace (disk ids are numeric, so they can't
 * collide). Two empty fresh disks of the same type are indistinguishable, but
 * swapping them changes nothing.
 */
function getDiskSignature(disk: ContainerSlot): string {
  return getDiskId(disk) ?? `fresh:${disk.typeId}`;
}

/** Builds the per-slot signatures for a drive's disks (see {@link getDiskSignature}). */
function getDiskSignatures(disks: (ContainerSlot | null)[]): (string | null)[] {
  return disks.map((disk) => (disk ? getDiskSignature(disk) : null));
}

function getStorageDriveEntity(
  location: DimensionLocation,
): Entity | undefined {
  return getEntityAtBlockLocation(location, ENTITY_ID);
}

export function getDisksInDrive(
  location: DimensionLocation,
  useNullForEmpty?: false,
): Result<ContainerSlot[], Error>;
export function getDisksInDrive(
  location: DimensionLocation,
  useNullForEmpty: true,
): Result<(ContainerSlot | null)[], Error>;
export function getDisksInDrive(
  location: DimensionLocation,
  useNullForEmpty = false,
): Result<(ContainerSlot | null)[], Error> {
  const entity = getStorageDriveEntity(location);
  if (!entity) {
    return err(
      new Error("Failed to get disks in drive: Associated entity not found."),
    );
  }

  const container = entity.getComponent("inventory")!.container;
  const disks: (ContainerSlot | null)[] = [];
  for (let i = 0; i < container.size; i++) {
    const slot = container.getSlot(i);
    if (slot.hasItem() && getDiskCapacity(slot.typeId)) {
      disks.push(slot);
    } else if (useNullForEmpty) {
      disks.push(null);
    }
  }

  return ok(disks);
}

export const storageDriveV3Component: BlockCustomComponent = {
  onPlace(e) {
    e.dimension.spawnEntity(ENTITY_ID, e.block.bottomCenter()).nameTag =
      e.block.typeId;
  },
  onBreak(e) {
    const uid = getBlockUid(e.block);
    driveData.delete(uid);
  },
  onTick(e) {
    const uid = getBlockUid(e.block);
    const disksr = getDisksInDrive(e.block, true);
    if (disksr.isErr()) {
      logWarn(
        `Failed to get disks in drive (uid: '${uid}') during tick: ${disksr.error.message}`,
      );
      return;
    }
    const diskSignatures = getDiskSignatures(disksr.value);

    if (!driveData.has(uid)) {
      driveData.set(uid, { diskSignatures });
      return;
    }

    const data = driveData.get(uid)!;

    // a disk was inserted, removed, or swapped if any slot's signature changed
    let changed = diskSignatures.length !== data.diskSignatures.length;
    for (let i = 0; !changed && i < diskSignatures.length; i++) {
      if (diskSignatures[i] !== data.diskSignatures[i]) {
        changed = true;
      }
    }

    if (changed) {
      StorageNetwork.getNetwork(e.block)?.clearStoredItemsCache();
    }

    data.diskSignatures = diskSignatures;
  },
};

world.afterEvents.entityHitEntity.subscribe((e) => {
  if (
    e.damagingEntity.typeId !== "minecraft:player" ||
    e.hitEntity.typeId !== ENTITY_ID
  ) {
    return;
  }

  const disks = getDisksInDrive(
    dimensionLocationFromEntity(e.hitEntity),
  ).unwrapOr([]);
  for (const disk of disks) {
    e.hitEntity.dimension.spawnItem(disk.getItem()!, e.hitEntity.location);
  }

  e.hitEntity.runCommand("setblock ~~~ air destroy");
  e.hitEntity.remove();
});
