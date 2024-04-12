import { system, world } from "@minecraft/server";
import { getExportBusEntity, setExportBusExportItemId } from ".";
import { StorageNetwork } from "../storage_network";
import { getPlayerMainhandSlot } from "../utils";
import { showExportBusUi } from "./ui";

world.afterEvents.playerPlaceBlock.subscribe((e) => {
  if (e.block.typeId !== "fluffyalien_asn:export_bus") return;

  e.block.dimension.spawnEntity("fluffyalien_asn:export_bus_entity", {
    x: e.block.x + 0.5,
    y: e.block.y,
    z: e.block.z + 0.5,
  });

  StorageNetwork.updateConnectableNetworks(e.block);
});

world.afterEvents.playerBreakBlock.subscribe((e) => {
  if (e.brokenBlockPermutation.type.id !== "fluffyalien_asn:export_bus") return;

  getExportBusEntity(e.block)?.triggerEvent("fluffyalien_asn:despawn");

  StorageNetwork.getNetwork(
    e.block,
    e.brokenBlockPermutation.type.id,
  )?.updateConnections();
});

let lastPlayerInteractWithBlockTriggerTick = 0;
world.afterEvents.playerInteractWithBlock.subscribe((e) => {
  if (
    e.block.typeId !== "fluffyalien_asn:export_bus" ||
    e.player.isSneaking ||
    lastPlayerInteractWithBlockTriggerTick + 5 > system.currentTick
  )
    return;

  lastPlayerInteractWithBlockTriggerTick = system.currentTick;

  const entity = getExportBusEntity(e.block);
  if (!entity) {
    console.warn(
      "(export_bus/events.ts:playerInteractWithBlock) Cannot get export bus dummy entity.",
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
