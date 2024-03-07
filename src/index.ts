import "./storage_drive";
import "./storage_interface";
import "./cable";
import "./storage_core";

import { _finishTerrainTexture } from "./terrain_texture";
import { _finishItemTexture } from "./item_texture";

_: {
  _finishTerrainTexture();
  _finishItemTexture();
}
