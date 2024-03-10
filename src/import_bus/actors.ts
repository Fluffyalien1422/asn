import { CABLE_BLOCK_TYPE_ID } from "../cable";
import { _addTerrainTexture } from "../terrain_texture";

export const IMPORT_BUS_BLOCK_TYPE_ID = "fluffyalien_asn:import_bus";

_: _addTerrainTexture(
  IMPORT_BUS_BLOCK_TYPE_ID,
  "textures/fluffyalien/asn/blocks/import_bus"
);
_.define.block({
  format_version: "1.20.80",
  "minecraft:block": {
    description: {
      identifier: IMPORT_BUS_BLOCK_TYPE_ID,
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
        "fluffyalien_asn:south": [0, 1],
        "fluffyalien_asn:east": [0, 1],
        "fluffyalien_asn:west": [0, 1],
        "fluffyalien_asn:up": [0, 1],
        "fluffyalien_asn:down": [0, 1],
      },
    },
    components: {
      "tag:fluffyalien_asn:storage_cable_connectable": {},

      "minecraft:geometry": {
        identifier: "geometry.fluffyalien_asn.storage_bus",
        bone_visibility: {
          //@ts-expect-error no string
          south: "q.block_state('fluffyalien_asn:south')",
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
          texture: IMPORT_BUS_BLOCK_TYPE_ID,
        },
      },
      "minecraft:collision_box": {
        origin: [-4, 4, -8],
        size: [8, 8, 12],
      },
      "minecraft:selection_box": {
        origin: [-3, 5, -8],
        size: [6, 6, 11],
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
              "fluffyalien_asn:south":
                "q.block_neighbor_has_any_tag(0, 0, 1, 'fluffyalien_asn:storage_cable_connectable')",
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
              "fluffyalien_asn:south":
                "q.block_neighbor_has_any_tag(-1, 0, 0, 'fluffyalien_asn:storage_cable_connectable')",
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
              "fluffyalien_asn:south":
                "q.block_neighbor_has_any_tag(0, 0, -1, 'fluffyalien_asn:storage_cable_connectable')",
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
              "fluffyalien_asn:south":
                "q.block_neighbor_has_any_tag(1, 0, 0, 'fluffyalien_asn:storage_cable_connectable')",
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

_.define.recipe({
  format_version: "1.20.80",
  "minecraft:recipe_shaped": {
    description: {
      identifier: IMPORT_BUS_BLOCK_TYPE_ID,
    },
    tags: ["crafting_table"],
    //prettier-ignore
    pattern: [
        "D#R",
        "#H#",
        "C#D"
      ],
    key: {
      R: {
        item: "repeater",
      },
      C: {
        item: "comparator",
      },
      D: {
        item: "redstone",
      },
      "#": {
        item: CABLE_BLOCK_TYPE_ID,
      },
      H: {
        item: "hopper",
      },
    },
    result: {
      item: IMPORT_BUS_BLOCK_TYPE_ID,
    },
    unlock: [
      {
        item: "diamond",
      },
    ],
  },
});
