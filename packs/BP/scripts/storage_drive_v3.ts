import {
  BlockCustomComponent,
  DimensionLocation,
  Entity,
  ItemStack,
  world,
} from "@minecraft/server";
import { err, ok, Result } from "neverthrow";
import {
  dimensionLocationFromEntity,
  getEntityAtBlockLocation,
} from "./utils/location";

const ENTITY_ID = "fluffyalien_asn:storage_drive_entity_v3";

function getStorageDriveEntity(
  location: DimensionLocation,
): Entity | undefined {
  return getEntityAtBlockLocation(location, ENTITY_ID);
}

function getDisksInDrive(
  location: DimensionLocation,
): Result<ItemStack[], Error> {
  const entity = getStorageDriveEntity(location);
  if (!entity) {
    return err(
      new Error("Failed to get disks in drive: Associated entity not found."),
    );
  }

  const container = entity.getComponent("inventory")!.container;
  const disks: ItemStack[] = [];
  for (let i = 0; i < container.size; i++) {
    const item = container.getItem(i);
    if (item) disks.push(item);
  }

  return ok(disks);
}

export const storageDriveV3Component: BlockCustomComponent = {
  onPlace(e) {
    e.dimension.spawnEntity(ENTITY_ID, e.block.center());
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
    e.hitEntity.dimension.spawnItem(disk, e.hitEntity.location);
  }

  e.hitEntity.runCommand("setblock ~~~ air destroy");
  e.hitEntity.remove();
});
