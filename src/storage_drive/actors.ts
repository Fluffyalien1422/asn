import { _addItemTexture } from "../item_texture";
import { _addTerrainTexture } from "../terrain_texture";

export const STORAGE_DRIVE_BLOCK_TYPE_ID = "fluffyalien_asn:storage_drive";
export const STORAGE_DRIVE_ENTITY_TYPE_ID =
  "fluffyalien_asn:storage_drive_entity";
export const STORAGE_DRIVE_PLACER_TYPE_ID =
  "fluffyalien_asn:storage_drive_placer";

_: {
  _addTerrainTexture(
    "fluffyalien_asn:storage_drive_front",
    "textures/fluffyalien/asn/blocks/storage_drive_front"
  );
  _addTerrainTexture(
    "fluffyalien_asn:storage_drive_side",
    "textures/fluffyalien/asn/blocks/storage_drive_side"
  );
  _addTerrainTexture(
    "fluffyalien_asn:storage_drive_top",
    "textures/fluffyalien/asn/blocks/storage_drive_top"
  );
}

_.define.block({
  format_version: "1.20.80",
  "minecraft:block": {
    description: {
      identifier: STORAGE_DRIVE_BLOCK_TYPE_ID,
      //@ts-expect-error traits does not exist
      traits: {
        "minecraft:placement_direction": {
          enabled_states: ["minecraft:cardinal_direction"],
        },
      },
    },
    components: {
      //@ts-expect-error no tag
      "tag:fluffyalien_asn:storage_cable_connectable": {},

      "minecraft:geometry": "minecraft:geometry.full_block",
      "minecraft:material_instances": {
        north: {
          texture: "fluffyalien_asn:storage_drive_side",
        },
        south: {
          texture: "fluffyalien_asn:storage_drive_front",
        },
        up: {
          texture: "fluffyalien_asn:storage_drive_top",
        },
        east: "north",
        west: "north",
        down: "up",
      },

      "minecraft:loot": "loot_tables/empty.json",
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

_: _addItemTexture(
  "fluffyalien_asn:storage_drive_placer",
  "textures/fluffyalien/asn/blocks/storage_drive_front"
);
_.define.item({
  format_version: "1.20.80",
  "minecraft:item": {
    description: {
      identifier: STORAGE_DRIVE_PLACER_TYPE_ID,
    },
    components: {
      "minecraft:max_stack_size": 1,
      "minecraft:icon": {
        //@ts-expect-error no textures property
        textures: {
          default: "fluffyalien_asn:storage_drive_placer",
        },
      },
      "minecraft:block_placer": {
        block: STORAGE_DRIVE_BLOCK_TYPE_ID,
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
