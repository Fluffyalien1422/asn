import "./storage_drive";
import "./storage_interface";
import { _finishBlocksJson } from "./blocks_json";
import { _finishTerrainTexture } from "./terrain_texture";
import { _finishTexts } from "./texts";

_: {
  _finishBlocksJson();
  _finishTerrainTexture();
  _finishTexts();
}
