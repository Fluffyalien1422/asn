import "./storage_drive";
import "./storage_interface";
import "./cable";
import "./storage_core";

import { _finishBlocksJson } from "./blocks_json";
import { _finishTerrainTexture } from "./terrain_texture";

_: {
  _finishBlocksJson();
  _finishTerrainTexture();
}
