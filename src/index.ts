import "./storage_drive";
import "./storage_interface";
import "./cable";
import "./crafting_items";
import "./storage_core";

//todo: finish storing storage data in storage disk and interacting with storage drives to set the data
//todo: add a storage_disk_data item with a glint that is used instead of the storage disk crafting item

import { _finishTerrainTexture } from "./terrain_texture";
import { _finishItemTexture } from "./item_texture";

_: {
  _finishTerrainTexture();
  _finishItemTexture();
}
