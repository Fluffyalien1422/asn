import { _addBlocksJsonEntry } from "../blocks_json";

export const STORAGE_INTERFACE_BLOCK_TYPE_ID =
  "fluffyalien_asn:storage_interface";

_: _addBlocksJsonEntry(STORAGE_INTERFACE_BLOCK_TYPE_ID, {
  textures: "furnace_front_off",
});
_.define.block({
  format_version: "1.20.60",
  "minecraft:block": {
    description: {
      identifier: STORAGE_INTERFACE_BLOCK_TYPE_ID,
      menu_category: {
        category: "items",
      },
    },
    components: {
      "minecraft:on_interact": {
        event: "fluffyalien_asn:empty",
      },
      "minecraft:destructible_by_explosion": false,
      "minecraft:destructible_by_mining": {
        seconds_to_destroy: 1,
      },
    },
    events: {
      "fluffyalien_asn:empty": {},
    },
  },
});
