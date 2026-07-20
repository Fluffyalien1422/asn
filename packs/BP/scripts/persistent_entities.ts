/**
 * Break-on-hit behavior for persistent entities.
 *
 * Several blocks in this add-on keep a persistent entity on the block (to hold
 * an inventory or a custom UI). Because the entity covers the block, players
 * break the block by hitting the entity rather than by mining it. This module
 * centralizes that behavior: a single `entityHitEntity` handler removes any
 * configured entity a player hits, dropping its stored contents first.
 *
 * To give a new persistent entity this behavior, add an entry to
 * {@link PERSISTENT_ENTITIES}.
 */

import { Block, Entity, GameMode, Player, world } from "@minecraft/server";
import { destroyMachine } from "bedrock-energistics-core-api";
import { dimensionLocationFromEntity } from "./utils/location";
import { dropDiskUpgraderContents } from "./disk_upgrader";
import {
  clearStorageDriveData,
  dropStorageDriveContents,
} from "./storage_drive_v3";
import { clearFluidDriveData } from "./fluid_drive";

interface PersistentEntity {
  /** The persistent entity's type id. */
  entityId: string;
  /**
   * Whether the entity's block is a Bedrock Energistics Core machine. When a
   * machine is broken in creative mode it is removed with {@link destroyMachine}
   * so its network data is cleaned up; otherwise the block is broken with a
   * command (which drops it as an item for the player).
   */
  isMachine?: boolean;
  /**
   * Drops the entity's unmanaged items — those Bedrock Energistics Core doesn't
   * track in registered item slots — into the world before it is removed. BEC
   * automatically drops its managed items when the block is destroyed (via
   * either {@link destroyMachine} or the `setblock ... destroy` command), so
   * only unmanaged items need to be handled here. Called in every game mode.
   */
  dropUnmanagedContents?(entity: Entity): void;
  /**
   * Cleans up state associated with the block when the entity is destroyed.
   * A block's own `onBreak` handler doesn't run on every destruction path (e.g.
   * replacing the block with air in creative mode), so pass its cleanup here to
   * guarantee it runs. Must be idempotent, as the block's `onBreak` may also run.
   */
  onBreak?(block: Block): void;
}

/**
 * The persistent entities that are removed when a player hits them. Add an
 * entry here to give a new persistent entity the same break-on-hit behavior.
 */
const PERSISTENT_ENTITIES: PersistentEntity[] = [
  {
    entityId: "fluffyalien_asn:disk_upgrader",
    isMachine: true,
    dropUnmanagedContents: dropDiskUpgraderContents,
  },
  {
    entityId: "fluffyalien_asn:fluid_interface",
    isMachine: true,
  },
  {
    entityId: "fluffyalien_asn:storage_drive_entity_v3",
    dropUnmanagedContents: dropStorageDriveContents,
    onBreak: clearStorageDriveData,
  },
  {
    entityId: "fluffyalien_asn:fluid_drive",
    dropUnmanagedContents: dropStorageDriveContents,
    onBreak: clearFluidDriveData,
  },
  {
    entityId: "fluffyalien_asn:storage_interface_entity",
  },
];

world.afterEvents.entityHitEntity.subscribe((e) => {
  if (e.damagingEntity.typeId !== "minecraft:player") return;
  const player = e.damagingEntity as Player;

  const config = PERSISTENT_ENTITIES.find(
    (persistentEntity) => persistentEntity.entityId === e.hitEntity.typeId,
  );
  if (!config) return;

  const entity = e.hitEntity;
  const block = entity.dimension.getBlock(entity.location);

  config.dropUnmanagedContents?.(entity);
  if (block) config.onBreak?.(block);

  const isCreative = player.getGameMode() === GameMode.Creative;

  // A machine in creative is removed through BEC so its network data is cleaned
  // up; destroyMachine removes the entity itself, so there's nothing more to do.
  if (isCreative && config.isMachine) {
    void destroyMachine(dimensionLocationFromEntity(entity));
    return;
  }

  // In creative, replace the block with air so it isn't dropped as an item;
  // otherwise break it with a command so the player recovers it.
  if (isCreative) {
    block?.setType("air");
  } else {
    entity.runCommand("setblock ~~~ air destroy");
  }
  entity.remove();
});
