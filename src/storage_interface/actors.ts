import { _addTerrainTexture } from "../terrain_texture";

export const STORAGE_INTERFACE_BLOCK_TYPE_ID =
  "fluffyalien_asn:storage_interface";

_: _addTerrainTexture(
  "fluffyalien_asn:storage_interface",
  "textures/fluffyalien/asn/blocks/storage_interface"
);
_.define.block({
  format_version: "1.20.80",
  "minecraft:block": {
    description: {
      identifier: STORAGE_INTERFACE_BLOCK_TYPE_ID,
      menu_category: {
        category: "items",
      },
      //@ts-expect-error traits does not exist
      traits: {
        "minecraft:placement_direction": {
          enabled_states: ["minecraft:cardinal_direction"],
        },
      },
      states: {
        "fluffyalien_asn:north": [0, 1],
        "fluffyalien_asn:east": [0, 1],
        "fluffyalien_asn:west": [0, 1],
        "fluffyalien_asn:up": [0, 1],
        "fluffyalien_asn:down": [0, 1],
      },
    },
    components: {
      "tag:fluffyalien_asn:storage_cable_connectable": {},

      "minecraft:geometry": {
        identifier: "geometry.fluffyalien_asn.storage_interface",
        bone_visibility: {
          //@ts-expect-error no string
          north: "q.block_state('fluffyalien_asn:north')",
          //@ts-expect-error no string
          east: "q.block_state('fluffyalien_asn:east')",
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
          texture: "fluffyalien_asn:storage_interface",
        },
      },
      "minecraft:collision_box": {
        origin: [-5, 3, -3],
        size: [10, 10, 11],
      },
      "minecraft:selection_box": {
        origin: [-5, 3, -3],
        size: [10, 10, 11],
      },
      "minecraft:on_interact": {
        event: "fluffyalien_asn:empty",
      },
      "minecraft:light_dampening": 0,
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
      "fluffyalien_asn:empty": {},
      "fluffyalien_asn:update": {
        sequence: [
          {
            set_block_state: {
              "fluffyalien_asn:up":
                "q.block_neighbor_has_any_tag(0, 1, 0, 'fluffyalien_asn:storage_cable_connectable')",
              "fluffyalien_asn:down":
                "q.block_neighbor_has_any_tag(0, -1, 0, 'fluffyalien_asn:storage_cable_connectable')",
            },
          },
          {
            condition:
              "q.block_state('minecraft:cardinal_direction') == 'north'",
            set_block_state: {
              "fluffyalien_asn:north":
                "q.block_neighbor_has_any_tag(0, 0, -1, 'fluffyalien_asn:storage_cable_connectable')",
              "fluffyalien_asn:east":
                "q.block_neighbor_has_any_tag(1, 0, 0, 'fluffyalien_asn:storage_cable_connectable')",
              "fluffyalien_asn:west":
                "q.block_neighbor_has_any_tag(-1, 0, 0, 'fluffyalien_asn:storage_cable_connectable')",
            },
          },
          {
            condition:
              "q.block_state('minecraft:cardinal_direction') == 'east'",
            set_block_state: {
              "fluffyalien_asn:north":
                "q.block_neighbor_has_any_tag(1, 0, 0, 'fluffyalien_asn:storage_cable_connectable')",
              "fluffyalien_asn:east":
                "q.block_neighbor_has_any_tag(0, 0, 1, 'fluffyalien_asn:storage_cable_connectable')",
              "fluffyalien_asn:west":
                "q.block_neighbor_has_any_tag(0, 0, -1, 'fluffyalien_asn:storage_cable_connectable')",
            },
          },
          {
            condition:
              "q.block_state('minecraft:cardinal_direction') == 'south'",
            set_block_state: {
              "fluffyalien_asn:north":
                "q.block_neighbor_has_any_tag(0, 0, 1, 'fluffyalien_asn:storage_cable_connectable')",
              "fluffyalien_asn:east":
                "q.block_neighbor_has_any_tag(-1, 0, 0, 'fluffyalien_asn:storage_cable_connectable')",
              "fluffyalien_asn:west":
                "q.block_neighbor_has_any_tag(1, 0, 0, 'fluffyalien_asn:storage_cable_connectable')",
            },
          },
          {
            condition:
              "q.block_state('minecraft:cardinal_direction') == 'west'",
            set_block_state: {
              "fluffyalien_asn:north":
                "q.block_neighbor_has_any_tag(-1, 0, 0, 'fluffyalien_asn:storage_cable_connectable')",
              "fluffyalien_asn:east":
                "q.block_neighbor_has_any_tag(0, 0, -1, 'fluffyalien_asn:storage_cable_connectable')",
              "fluffyalien_asn:west":
                "q.block_neighbor_has_any_tag(0, 0, 1, 'fluffyalien_asn:storage_cable_connectable')",
            },
          },
        ],
      },
    },
    permutations: [
      {
        condition: "q.block_state('minecraft:cardinal_direction') == 'north'",
        components: {
          "minecraft:transformation": {
            rotation: [0, 0, 0],
          },
        },
      },
      {
        condition: "q.block_state('minecraft:cardinal_direction') == 'south'",
        components: {
          "minecraft:transformation": {
            rotation: [0, 180, 0],
          },
        },
      },
      {
        condition: "q.block_state('minecraft:cardinal_direction') == 'west'",
        components: {
          "minecraft:transformation": {
            rotation: [0, 90, 0],
          },
        },
      },
      {
        condition: "q.block_state('minecraft:cardinal_direction') == 'east'",
        components: {
          "minecraft:transformation": {
            rotation: [0, -90, 0],
          },
        },
      },
    ],
  },
});
