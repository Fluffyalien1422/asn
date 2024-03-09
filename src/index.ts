import "./storage_drive";
import "./storage_interface";
import "./cable";
import "./crafting_items";
import "./storage_core";

//todo: finish storing storage data in storage disk and interacting with storage drives to set the data
//todo: add a storage_disk_data item with a glint that is used instead of the storage disk crafting item

import { _finishTerrainTexture } from "./terrain_texture";
import { _finishItemTexture } from "./item_texture";
import { getPlayerMainhandSlot } from "./utils/item";
import {
  STORAGE_DATA_DYNAMIC_PROPERTY_ID,
  USED_STORAGE_DISK_ITEM_TYPE_ID,
} from "./storage_drive";

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
