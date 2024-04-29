import { world } from "@minecraft/server";
import {
  getExportBusEntity,
  setExportBusExportItemDamageRange,
  setExportBusExportItemEnchantments,
  setExportBusExportItemId,
} from ".";
import { StorageNetwork } from "../storage_network";
import { getPlayerMainhandSlot } from "../utils";
import { showExportBusUi } from "./ui";
import { Logger } from "../log";
import { onPlayerInteractWithBlockNoSpam } from "../interact_with_block_no_spam";

const log = new Logger("export_bus/events.ts");

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

onPlayerInteractWithBlockNoSpam((e) => {
  if (e.block.typeId !== "fluffyalien_asn:export_bus" || e.player.isSneaking)
    return;

  const entity = getExportBusEntity(e.block);
  if (!entity) {
    log.warn(
      "playerInteractWithBlock event",
      "cannot get export bus dummy entity",
    );
    return;
  }

  const mainhandSlot = getPlayerMainhandSlot(e.player);
  const heldItem = mainhandSlot?.getItem();
  if (heldItem) {
    setExportBusExportItemId(entity, heldItem.typeId);

    // reset optional values
    setExportBusExportItemEnchantments(entity, "ignore");
    setExportBusExportItemDamageRange(entity, { min: 0 });
  }

  void showExportBusUi(e.player, entity);
});
