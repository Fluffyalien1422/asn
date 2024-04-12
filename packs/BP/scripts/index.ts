import "./export_bus";
import "./import_bus";
import "./storage_core";
import "./storage_drive";
import "./storage_interface";
import "./cable";
import "./tutorial_book";

import { getPlayerMainhandSlot } from "./utils";
import { STORAGE_DATA_DYNAMIC_PROPERTY_ID } from "./storage_drive";
import { system, Player } from "@minecraft/server";

system.afterEvents.scriptEventReceive.subscribe(
  (e) => {
    if (!(e.sourceEntity instanceof Player)) return;
    const player = e.sourceEntity;

    if (e.id === "fluffyalien_asn:debug_log_disk_data") {
      const item = getPlayerMainhandSlot(player)?.getItem();
      if (item?.typeId !== "fluffyalien_asn:used_storage_disk") return;
      console.warn(item.getDynamicProperty(STORAGE_DATA_DYNAMIC_PROPERTY_ID));
    }
  },
  { namespaces: ["fluffyalien_asn"] },
);
