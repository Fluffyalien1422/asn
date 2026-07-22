/**
 * Fluid storage drive.
 *
 * A fluid drive is a block backed by an 8-slot container entity that holds up to
 * eight fluid disks (mirroring the item {@link ./storage_drive_v3 storage drive}).
 * The disks store the fluids (see {@link ./fluid_disk}); the drive is just the
 * container. Right-clicking the drive opens the container entity's native
 * inventory, skinned by `chest_screen.json` via the entity's name tag.
 */

import {
  Block,
  BlockCustomComponent,
  ContainerSlot,
  DimensionLocation,
  Entity,
  EntityInventoryComponent,
} from "@minecraft/server";
import { err, ok, Result } from "neverthrow";
import { getEntityAtBlockLocation } from "./utils/location";
import { getBlockUid } from "./utils/block";
import { logWarn } from "./log";
import { StorageNetwork } from "./storage_network";
import { getFluidDiskCapacity, getFluidDiskSignature } from "./fluid_disk";

const ENTITY_ID = "fluffyalien_asn:fluid_drive";

interface DriveData {
  /**
   * A stable signature per drive slot describing which disk it held last tick,
   * so {@link fluidDriveComponent.onTick} can detect disks being inserted,
   * removed, or swapped. `null` means the slot held no disk.
   */
  diskSignatures: (string | null)[];
}
const driveData = new Map<string, DriveData>();

/** A fluid disk held in a drive, located for building an `ItemMachine`. */
export interface FluidDiskRef {
  /** The drive entity's inventory component (the item machine's inventory). */
  inventory: EntityInventoryComponent;
  /** The slot index the disk occupies. */
  slot: number;
  /** The disk's container slot, for reading its type/lore/id. */
  containerSlot: ContainerSlot;
}

function getFluidDriveEntity(location: DimensionLocation): Entity | undefined {
  return getEntityAtBlockLocation(location, ENTITY_ID);
}

/**
 * Gets all fluid disks across the drive at `location`, located so each can be
 * addressed by a BEC `ItemMachine` (inventory component + slot index).
 */
export function getFluidDisksInDrive(
  location: DimensionLocation,
): Result<FluidDiskRef[], Error> {
  const entity = getFluidDriveEntity(location);
  if (!entity) {
    return err(
      new Error("Failed to get disks in fluid drive: Entity not found."),
    );
  }

  const inventory = entity.getComponent("inventory")!;
  const container = inventory.container;
  const disks: FluidDiskRef[] = [];
  for (let i = 0; i < container.size; i++) {
    const containerSlot = container.getSlot(i);
    if (containerSlot.hasItem() && getFluidDiskCapacity(containerSlot.typeId)) {
      disks.push({ inventory, slot: i, containerSlot });
    }
  }

  return ok(disks);
}

/**
 * Clears the cached data for the drive at `block`. Runs whenever the drive is
 * broken, whether by the block's own break handler or the shared
 * persistent-entity break handler.
 */
export function clearFluidDriveData(block: Block): void {
  driveData.delete(getBlockUid(block));
}

/**
 * Builds the per-slot swap-detection signatures for a drive's container: the
 * disk's id for a valid fluid disk (assigning one if needed), otherwise `null`.
 */
function getDriveDiskSignatures(entity: Entity): (string | null)[] {
  const container = entity.getComponent("inventory")!.container;
  const signatures: (string | null)[] = [];
  for (let i = 0; i < container.size; i++) {
    const slot = container.getSlot(i);
    signatures.push(
      slot.hasItem() && getFluidDiskCapacity(slot.typeId)
        ? getFluidDiskSignature(slot)
        : null,
    );
  }
  return signatures;
}

export const fluidDriveComponent: BlockCustomComponent = {
  onPlace(e) {
    e.dimension.spawnEntity(ENTITY_ID, e.block.bottomCenter()).nameTag =
      e.block.typeId;
  },
  onBreak(e) {
    clearFluidDriveData(e.block);
  },
  onTick(e) {
    const uid = getBlockUid(e.block);
    const entity = getFluidDriveEntity(e.block);
    if (!entity) {
      logWarn(`Failed to tick fluid drive (uid: '${uid}'): Entity not found.`);
      return;
    }
    const diskSignatures = getDriveDiskSignatures(entity);

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
      void StorageNetwork.getNetwork(e.block)?.clearStoredFluidsCache();
    }

    data.diskSignatures = diskSignatures;
  },
};
