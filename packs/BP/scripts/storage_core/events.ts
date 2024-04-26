import { Vector3Utils } from "@minecraft/math";
import { getStorageCoreEntity } from ".";
import { StorageNetwork } from "../storage_network";
import { showStorageCoreUi } from "./ui";
import { world } from "@minecraft/server";
import { Logger } from "../log";
import { showEstablishNetworkError } from "../cable_network";
import { onPlayerInteractWithBlockNoSpam } from "../interact_with_block_no_spam";

const log = new Logger("storage_core/events.ts");

world.afterEvents.entityLoad.subscribe((e) => {
  if (e.entity.typeId !== "fluffyalien_asn:storage_core_entity") return;

  const block = e.entity.dimension.getBlock(e.entity.location);
  if (!block) {
    log.warn(
      "entityLoad event",
      `could not get storage core block at (${Vector3Utils.toString(
        e.entity.location,
      )}) in ${e.entity.dimension.id}`,
    );
    return;
  }

  // establish a network when the storage core entity is loaded so that the processes
  // will start running without having to open an interface
  StorageNetwork.getOrEstablishNetwork(block);
});

world.afterEvents.playerPlaceBlock.subscribe((e) => {
  if (e.block.typeId !== "fluffyalien_asn:storage_core") return;

  e.block.dimension.spawnEntity("fluffyalien_asn:storage_core_entity", {
    x: e.block.x + 0.5,
    y: e.block.y,
    z: e.block.z + 0.5,
  });

  StorageNetwork.updateConnectableNetworks(e.block);
});

world.afterEvents.playerBreakBlock.subscribe((e) => {
  if (e.brokenBlockPermutation.type.id !== "fluffyalien_asn:storage_core")
    return;

  getStorageCoreEntity(e.block)?.triggerEvent("fluffyalien_asn:despawn");
  StorageNetwork.getNetwork(
    e.block,
    e.brokenBlockPermutation.type.id,
  )?.destroy();
});

onPlayerInteractWithBlockNoSpam((e) => {
  if (e.block.typeId !== "fluffyalien_asn:storage_core" || e.player.isSneaking)
    return;

  const networkResult = StorageNetwork.getOrEstablishNetwork(e.block);
  if (!networkResult.success) {
    void showEstablishNetworkError(e.player, networkResult.error);
    return;
  }

  const network = networkResult.value;

  void showStorageCoreUi(e.player, network);
});
