import { _addBlocksJsonEntry } from "./blocks_json";
import { StorageNetwork } from "./storage_network";

export const CABLE_BLOCK_TYPE_ID = "fluffyalien_asn:storage_cable";

$.server.world.afterEvents.playerPlaceBlock.subscribe((e) => {
  if (e.block.typeId !== CABLE_BLOCK_TYPE_ID) return;

  StorageNetwork.getConnectableNetwork(e.block)?.updateConnections();
});

$.server.world.afterEvents.playerBreakBlock.subscribe((e) => {
  if (e.brokenBlockPermutation.type.id !== CABLE_BLOCK_TYPE_ID) return;

  StorageNetwork.getNetwork(e.block)?.updateConnections();
});

_: _addBlocksJsonEntry(CABLE_BLOCK_TYPE_ID, {
  textures: "gilded_blackstone",
});
_.define.block({
  format_version: "1.20.60",
  "minecraft:block": {
    description: {
      identifier: CABLE_BLOCK_TYPE_ID,
      menu_category: {
        category: "items",
      },
    },
    components: {
      "minecraft:destructible_by_explosion": false,
      "minecraft:destructible_by_mining": {
        seconds_to_destroy: 1,
      },
    },
  },
});
