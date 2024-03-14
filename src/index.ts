import "./import_bus";
import "./storage_core";
import "./storage_drive";
import "./storage_interface";
import "./tutorial_book";
import "./cable";
import "./crafting_items";

import { _finishTerrainTexture } from "./terrain_texture";
import { _finishItemTexture } from "./item_texture";
import { getPlayerMainhandSlot } from "./utils";
import {
  STORAGE_DATA_DYNAMIC_PROPERTY_ID,
  USED_STORAGE_DISK_ITEM_TYPE_ID,
} from "./storage_drive";

//todo: add export bus ui

_: {
  _finishTerrainTexture();
  _finishItemTexture();
}

$.server.system.afterEvents.scriptEventReceive.subscribe(
  (e) => {
    if (!(e.sourceEntity instanceof $.server.Player)) return;
    const player = e.sourceEntity;

    if (e.id === "fluffyalien_asn:debug_log_disk_data") {
      const item = getPlayerMainhandSlot(player)?.getItem();
      if (item?.typeId !== USED_STORAGE_DISK_ITEM_TYPE_ID) return;
      console.warn(item.getDynamicProperty(STORAGE_DATA_DYNAMIC_PROPERTY_ID));
    }
  },
  { namespaces: ["fluffyalien_asn"] }
);
