import { _addTerrainTexture } from "../terrain_texture";

export const STORAGE_INTERFACE_BLOCK_TYPE_ID =
  "fluffyalien_asn:storage_interface";

_: _addTerrainTexture(
  "fluffyalien_asn:storage_interface",
  "textures/fluffyalien/asn/storage_interface"
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
    },
    components: {
      //@ts-expect-error no tag
      "tag:fluffyalien_asn:storage_cable_connectable": {},

      "minecraft:geometry": "geometry.fluffyalien_asn.storage_interface",
      "minecraft:material_instances": {
        "*": {
          texture: "fluffyalien_asn:storage_interface",
        },
      },
      "minecraft:collision_box": {
        origin: [-5, 3, -2],
        size: [10, 10, 10],
      },
      "minecraft:selection_box": {
        origin: [-5, 3, -2],
        size: [10, 10, 10],
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
    permutations: [
      {
        condition: "q.block_state('minecraft:cardinal_direction') == 'north'",
        components: {
          "minecraft:transformation": {
            rotation: [0, 180, 0],
          },
        },
      },
      {
        condition: "q.block_state('minecraft:cardinal_direction') == 'south'",
        components: {
          "minecraft:transformation": {
            rotation: [0, 0, 0],
          },
        },
      },
      {
        condition: "q.block_state('minecraft:cardinal_direction') == 'west'",
        components: {
          "minecraft:transformation": {
            rotation: [0, -90, 0],
          },
        },
      },
      {
        condition: "q.block_state('minecraft:cardinal_direction') == 'east'",
        components: {
          "minecraft:transformation": {
            rotation: [0, 90, 0],
          },
        },
      },
    ],
  },
});
