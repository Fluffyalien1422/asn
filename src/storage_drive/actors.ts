import { _addBlocksJsonEntry } from "../blocks_json";

export const STORAGE_DRIVE_BLOCK_TYPE_ID = "fluffyalien_asn:storage_drive";
export const STORAGE_DRIVE_ENTITY_TYPE_ID =
  "fluffyalien_asn:storage_drive_entity";

_: _addBlocksJsonEntry(STORAGE_DRIVE_BLOCK_TYPE_ID, { textures: "end_stone" });
_.define.block({
  format_version: "1.20.60",
  "minecraft:block": {
    description: {
      identifier: STORAGE_DRIVE_BLOCK_TYPE_ID,
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

// dummy entity
_.define.entity({
  format_version: "1.20.80",
  "minecraft:entity": {
    description: {
      identifier: STORAGE_DRIVE_ENTITY_TYPE_ID,
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
