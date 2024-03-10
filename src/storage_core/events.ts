import { Vector3Utils } from "@minecraft/math";
import {
  STORAGE_CORE_BLOCK_TYPE_ID,
  STORAGE_CORE_ENTITY_TYPE_ID,
  getStorageCoreEntity,
} from ".";
import { StorageNetwork } from "../storage_network";
import { showStorageCoreUi } from "./ui";

$.server.world.afterEvents.entityLoad.subscribe((e) => {
  if (e.entity.typeId !== STORAGE_CORE_ENTITY_TYPE_ID) return;

  const block = e.entity.dimension.getBlock(e.entity.location);
  if (!block) {
    console.warn(
      `(storage_core/events.ts:entityLoad) Could not get storage core block at (${Vector3Utils.toString(
        e.entity.location
      )}) in ${e.entity.dimension.id}.`
    );
    return;
  }

  // establish a network when the storage core entity is loaded so that the interval
  // will start running without having to open an interface
  StorageNetwork.getOrEstablishNetwork(block);
});

$.server.world.afterEvents.playerPlaceBlock.subscribe((e) => {
  if (e.block.typeId !== STORAGE_CORE_BLOCK_TYPE_ID) return;

  e.block.dimension.spawnEntity(STORAGE_CORE_ENTITY_TYPE_ID, {
    x: e.block.x + 0.5,
    y: e.block.y,
    z: e.block.z + 0.5,
  });

  StorageNetwork.updateConnectableNetworks(e.block);
});

$.server.world.afterEvents.playerBreakBlock.subscribe((e) => {
  if (e.brokenBlockPermutation.type.id !== STORAGE_CORE_BLOCK_TYPE_ID) return;

  getStorageCoreEntity(e.block)?.triggerEvent("fluffyalien_asn:despawn");
  StorageNetwork.getNetwork(e.block)?.destroy();
});

let lastPlayerInteractWithBlockTriggerTick = 0;
$.server.world.afterEvents.playerInteractWithBlock.subscribe((e) => {
  if (
    e.block.typeId !== STORAGE_CORE_BLOCK_TYPE_ID ||
    e.player.isSneaking ||
    lastPlayerInteractWithBlockTriggerTick + 5 > $.server.system.currentTick
  )
    return;

  lastPlayerInteractWithBlockTriggerTick = $.server.system.currentTick;

  const networkResult = StorageNetwork.getOrEstablishNetwork(e.block);
  if (!networkResult.success) {
    throw new Error(
      "(storage_core.ts:playerInteractWithBlock) Could not get or establish network."
    );
  }

  const network = networkResult.value;

  void showStorageCoreUi(e.player, network);
});
