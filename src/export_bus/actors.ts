import { CABLE_BLOCK_TYPE_ID } from "../cable";
import { _addTerrainTexture } from "../terrain_texture";

export const EXPORT_BUS_BLOCK_TYPE_ID = "fluffyalien_asn:export_bus";
export const EXPORT_BUS_ENTITY_TYPE_ID = "fluffyalien_asn:export_bus_entity";

_: _addTerrainTexture(
  EXPORT_BUS_BLOCK_TYPE_ID,
  "textures/fluffyalien/asn/blocks/export_bus"
);
_.define.block({
  format_version: "1.20.80",
  "minecraft:block": {
    description: {
      identifier: EXPORT_BUS_BLOCK_TYPE_ID,
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
          texture: EXPORT_BUS_BLOCK_TYPE_ID,
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
      "minecraft:on_interact": {
        event: "fluffyalien_asn:empty",
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

// dummy entity
_.define.entity({
  format_version: "1.20.80",
  "minecraft:entity": {
    description: {
      identifier: EXPORT_BUS_ENTITY_TYPE_ID,
      is_summonable: true,
      is_spawnable: false,
    },
    component_groups: {
      "fluffyalien_asn:despawn": {
        "minecraft:instant_despawn": {},
      },
    },
    components: {
      "minecraft:breathable": {
        breathes_water: true,
      },
      "minecraft:physics": {
        has_gravity: false,
        has_collision: false,
      },
      "minecraft:custom_hit_test": {
        hitboxes: [
          {
            pivot: [0, 99, 0],
            width: 0,
            height: 0,
          },
        ],
      },
      "minecraft:damage_sensor": {
        triggers: {
          deals_damage: false,
        },
      },
      "minecraft:pushable": {
        is_pushable: false,
        is_pushable_by_piston: false,
      },
      "minecraft:collision_box": {
        width: 0,
        height: 0,
      },
    },
    events: {
      "fluffyalien_asn:despawn": {
        add: {
          component_groups: ["fluffyalien_asn:despawn"],
        },
      },
    },
  },
});

_.define.recipe({
  format_version: "1.20.80",
  "minecraft:recipe_shaped": {
    description: {
      identifier: EXPORT_BUS_BLOCK_TYPE_ID,
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
        item: "dropper",
      },
    },
    result: {
      item: EXPORT_BUS_BLOCK_TYPE_ID,
    },
    unlock: [
      {
        item: "diamond",
      },
    ],
  },
});
