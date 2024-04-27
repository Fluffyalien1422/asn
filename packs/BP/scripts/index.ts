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
import { Logger } from "./log";

//TODO: add options for level emitter to test for enchantments and damage like export bus
//TODO: make level emitter test all matching item stacks instead of the first one (switch from array.find to array.filter)

const log = new Logger("index.ts");

system.afterEvents.scriptEventReceive.subscribe(
  (e) => {
    if (!(e.sourceEntity instanceof Player)) return;
    const player = e.sourceEntity;

    if (e.id === "fluffyalien_asn:debug_log_disk_data") {
      const item = getPlayerMainhandSlot(player)?.getItem();

      if (item?.typeId !== "fluffyalien_asn:used_storage_disk") {
        log.warn(
          "scriptEventRecieve event",
          "could not run script event fluffyalien_asn:debug_log_disk_data: not holding fluffyalien_asn:used_storage_disk",
        );
        return;
      }

      const s = item
        .getDynamicProperty(STORAGE_DATA_DYNAMIC_PROPERTY_ID)
        ?.toString();
      if (s)
        log.msg(
          "scriptEventRecieve event",
          `fluffyalien_asn:debug_log_disk_data result: ${s}`,
        );
    } else {
      log.warn(
        "scriptEventRecieve event",
        `could not run script event ${e.id}: this script event does not exist`,
      );
    }
  },
  { namespaces: ["fluffyalien_asn"] },
);
