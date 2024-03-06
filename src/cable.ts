import { StorageNetwork } from "./storage_network";
import { _addTerrainTexture } from "./terrain_texture";

export const CABLE_BLOCK_TYPE_ID = "fluffyalien_asn:storage_cable";

$.server.world.afterEvents.playerPlaceBlock.subscribe((e) => {
  if (e.block.typeId !== CABLE_BLOCK_TYPE_ID) return;

  StorageNetwork.updateConnectableNetworks(e.block);
});

$.server.world.afterEvents.playerBreakBlock.subscribe((e) => {
  if (e.brokenBlockPermutation.type.id !== CABLE_BLOCK_TYPE_ID) return;

  StorageNetwork.getNetwork(e.block)?.updateConnections();
});

_: _addTerrainTexture(
  "fluffyalien_asn:storage_cable",
  "textures/fluffyalien/asn/storage_cable"
);
_.define.block({
  format_version: "1.20.80",
  "minecraft:block": {
    description: {
      identifier: CABLE_BLOCK_TYPE_ID,
      menu_category: {
        category: "items",
      },
      //@ts-expect-error no states
      states: {
        "fluffyalien_asn:north": [0, 1],
        "fluffyalien_asn:east": [0, 1],
        "fluffyalien_asn:south": [0, 1],
        "fluffyalien_asn:west": [0, 1],
        "fluffyalien_asn:up": [0, 1],
        "fluffyalien_asn:down": [0, 1],
      },
    },
    components: {
      "tag:fluffyalien_asn:storage_cable_connectable": {},

      "minecraft:geometry": {
        identifier: "geometry.fluffyalien_asn.storage_cable",
        bone_visibility: {
          //@ts-expect-error no string
          north: "q.block_state('fluffyalien_asn:north')",
          //@ts-expect-error no string
          east: "q.block_state('fluffyalien_asn:east')",
          //@ts-expect-error no string
          south: "q.block_state('fluffyalien_asn:south')",
          //@ts-expect-error no string
          west: "q.block_state('fluffyalien_asn:west')",
          //@ts-expect-error no string
          up: "q.block_state('fluffyalien_asn:up')",
          //@ts-expect-error no string
          down: "q.block_state('fluffyalien_asn:down')",
        },
      },
      "minecraft:material_instances": {
        "*": {
          texture: "fluffyalien_asn:storage_cable",
        },
      },
      "minecraft:collision_box": {
        origin: [-3, 5, -3],
        size: [8, 8, 8],
      },
      "minecraft:selection_box": {
        origin: [-3, 5, -3],
        size: [6, 6, 6],
      },
      "minecraft:destructible_by_explosion": false,
      "minecraft:destructible_by_mining": {
        seconds_to_destroy: 1,
      },
      "minecraft:queued_ticking": {
        looping: true,
        //@ts-expect-error no interval_range
        interval_range: [0, 0],
        on_tick: {
          event: "fluffyalien_asn:update",
        },
      },
    },
    events: {
      "fluffyalien_asn:update": {
        set_block_state: {
          "fluffyalien_asn:north":
            "q.block_neighbor_has_any_tag(0, 0, -1, 'fluffyalien_asn:storage_cable_connectable')",
          "fluffyalien_asn:east":
            "q.block_neighbor_has_any_tag(1, 0, 0, 'fluffyalien_asn:storage_cable_connectable')",
          "fluffyalien_asn:south":
            "q.block_neighbor_has_any_tag(0, 0, 1, 'fluffyalien_asn:storage_cable_connectable')",
          "fluffyalien_asn:west":
            "q.block_neighbor_has_any_tag(-1, 0, 0, 'fluffyalien_asn:storage_cable_connectable')",
          "fluffyalien_asn:up":
            "q.block_neighbor_has_any_tag(0, 1, 0, 'fluffyalien_asn:storage_cable_connectable')",
          "fluffyalien_asn:down":
            "q.block_neighbor_has_any_tag(0, -1, 0, 'fluffyalien_asn:storage_cable_connectable')",
        },
      },
    },
  },
});
