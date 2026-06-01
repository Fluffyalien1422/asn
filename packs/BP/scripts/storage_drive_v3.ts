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
import { itemStacksMatch } from "./utils/item";
import { StorageNetwork } from "./storage_network";

const ENTITY_ID = "fluffyalien_asn:storage_drive_entity_v3";

interface DriveData {
  disks: (ContainerSlot | null)[];
}
const driveData = new Map<string, DriveData>();

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
    if (
      slot.hasItem() &&
      slot.typeId === "fluffyalien_asn:storage_disk_v3_64"
    ) {
      disks.push(slot);
    } else if (useNullForEmpty) {
      disks.push(null);
    }
  }

  return ok(disks);
}

export const storageDriveV3Component: BlockCustomComponent = {
  onPlace(e) {
    e.dimension.spawnEntity(ENTITY_ID, e.block.center());
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
    const disks = disksr.value;

    if (!driveData.has(uid)) {
      driveData.set(uid, { disks });
      return;
    }

    const data = driveData.get(uid)!;
    for (let i = 0; i < disks.length; i++) {
      const oldDisk = data.disks[i];
      const newDisk = disks[i];

      if (
        (oldDisk === null && newDisk === null) ||
        (oldDisk !== null &&
          newDisk !== null &&
          itemStacksMatch(oldDisk.getItem()!, newDisk.getItem()!))
      ) {
        continue;
      }

      // disk was changed
      StorageNetwork.getNetwork(e.block)?.clearStoredItemsCache();
      break;
    }

    data.disks = disks;
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
