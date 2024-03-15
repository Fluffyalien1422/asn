import {
  EXPORT_BUS_BLOCK_TYPE_ID,
  EXPORT_BUS_ENTITY_TYPE_ID,
  getExportBusEntity,
  setExportBusExportItemId,
} from ".";
import { StorageNetwork } from "../storage_network";
import { getPlayerMainhandSlot } from "../utils";
import { showExportBusUi } from "./ui";

$.server.world.afterEvents.playerPlaceBlock.subscribe((e) => {
  if (e.block.typeId !== EXPORT_BUS_BLOCK_TYPE_ID) return;

  e.block.dimension.spawnEntity(EXPORT_BUS_ENTITY_TYPE_ID, {
    x: e.block.x + 0.5,
    y: e.block.y,
    z: e.block.z + 0.5,
  });

  StorageNetwork.updateConnectableNetworks(e.block);
});

$.server.world.afterEvents.playerBreakBlock.subscribe((e) => {
  if (e.brokenBlockPermutation.type.id !== EXPORT_BUS_BLOCK_TYPE_ID) return;

  getExportBusEntity(e.block)?.triggerEvent("fluffyalien_asn:despawn");

  StorageNetwork.getNetwork(
    e.block,
    e.brokenBlockPermutation.type.id
  )?.updateConnections();
});

let lastPlayerInteractWithBlockTriggerTick = 0;
$.server.world.afterEvents.playerInteractWithBlock.subscribe((e) => {
  if (
    e.block.typeId !== EXPORT_BUS_BLOCK_TYPE_ID ||
    e.player.isSneaking ||
    lastPlayerInteractWithBlockTriggerTick + 5 > $.server.system.currentTick
  )
    return;

  lastPlayerInteractWithBlockTriggerTick = $.server.system.currentTick;

  const entity = getExportBusEntity(e.block);
  if (!entity) {
    console.warn(
      "(export_bus/events.ts:playerInteractWithBlock) Cannot get export bus dummy entity."
    );
    return;
  }

  const mainhandSlot = getPlayerMainhandSlot(e.player);
  const heldItem = mainhandSlot?.getItem();
  if (heldItem) {
    setExportBusExportItemId(entity, heldItem.typeId);
  }

  void showExportBusUi(e.player, entity);
});
