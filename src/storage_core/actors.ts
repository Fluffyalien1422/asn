import { _addTerrainTexture } from "../terrain_texture";

export const STORAGE_CORE_BLOCK_TYPE_ID = "fluffyalien_asn:storage_core";
export const STORAGE_CORE_ENTITY_TYPE_ID =
  "fluffyalien_asn:storage_core_entity";

_: _addTerrainTexture(
  "fluffyalien_asn:storage_core",
  "textures/fluffyalien/asn/blocks/storage_core"
);
_.define.block({
  format_version: "1.20.80",
  "minecraft:block": {
    description: {
      identifier: STORAGE_CORE_BLOCK_TYPE_ID,
      menu_category: {
        category: "items",
      },
    },
    components: {
      //@ts-expect-error no tag
      "tag:fluffyalien_asn:storage_cable_connectable": {},

      "minecraft:geometry": "minecraft:geometry.full_block",
      "minecraft:material_instances": {
        "*": {
          texture: "fluffyalien_asn:storage_core",
        },
      },
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

// dummy entity
_.define.entity({
  format_version: "1.20.80",
  "minecraft:entity": {
    description: {
      identifier: STORAGE_CORE_ENTITY_TYPE_ID,
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
      identifier: STORAGE_CORE_BLOCK_TYPE_ID,
    },
    tags: ["crafting_table"],
    //prettier-ignore
    pattern: [
        "DDD",
        "REC",
        "ISI"
      ],
    key: {
      D: {
        item: "diamond",
      },
      R: {
        item: "repeater",
      },
      E: {
        item: "emerald",
      },
      C: {
        item: "comparator",
      },
      S: {
        item: "smooth_stone",
      },
      I: {
        item: "iron_block",
      },
    },
    result: {
      item: STORAGE_CORE_BLOCK_TYPE_ID,
    },
    unlock: [
      {
        item: "diamond",
      },
    ],
  },
});
