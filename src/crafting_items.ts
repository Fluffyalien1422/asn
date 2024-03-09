import { _addItemTexture } from "./item_texture";

export const STORAGE_DISK_ITEM_ID = "fluffyalien_asn:storage_disk";
export const STORAGE_DISK_CASING_ITEM_ID =
  "fluffyalien_asn:storage_disk_casing";
export const STORAGE_DISK_CORE_ITEM_ID = "fluffyalien_asn:storage_disk_core";
export const STORAGE_CRYSTAL_ITEM_ID = "fluffyalien_asn:storage_crystal";
export const RAW_STORAGE_CRYSTAL_ITEM_ID =
  "fluffyalien_asn:raw_storage_crystal";

_: _addItemTexture(
  STORAGE_DISK_ITEM_ID,
  "textures/fluffyalien/asn/items/storage_disk"
);
_.define.item({
  format_version: "1.20.80",
  "minecraft:item": {
    description: {
      identifier: STORAGE_DISK_ITEM_ID,
    },
    components: {
      "minecraft:max_stack_size": 16,
      "minecraft:icon": {
        //@ts-expect-error no textures property
        textures: {
          default: STORAGE_DISK_ITEM_ID,
        },
      },
    },
  },
});

_.define.recipe({
  format_version: "1.20.80",
  "minecraft:recipe_shapeless": {
    description: {
      identifier: STORAGE_DISK_ITEM_ID,
    },
    tags: ["crafting_table"],
    ingredients: [
      {
        item: STORAGE_DISK_CASING_ITEM_ID,
      },
      {
        item: STORAGE_DISK_CORE_ITEM_ID,
      },
    ],
    result: {
      item: STORAGE_DISK_ITEM_ID,
    },
    unlock: [
      {
        item: "diamond",
      },
    ],
  },
});

_: _addItemTexture(
  STORAGE_DISK_CASING_ITEM_ID,
  "textures/fluffyalien/asn/items/storage_disk_casing"
);
_.define.item({
  format_version: "1.20.80",
  "minecraft:item": {
    description: {
      identifier: STORAGE_DISK_CASING_ITEM_ID,
    },
    components: {
      "minecraft:max_stack_size": 16,
      "minecraft:icon": {
        //@ts-expect-error no textures property
        textures: {
          default: STORAGE_DISK_CASING_ITEM_ID,
        },
      },
    },
  },
});

_.define.recipe({
  format_version: "1.20.80",
  "minecraft:recipe_shaped": {
    description: {
      identifier: STORAGE_DISK_CASING_ITEM_ID,
    },
    tags: ["crafting_table"],
    pattern: ["NIN", "ISI", "NIN"],
    key: {
      I: {
        item: "iron_ingot",
      },
      S: {
        item: "smooth_stone",
      },
      N: {
        item: "iron_nugget",
      },
    },
    result: {
      item: STORAGE_DISK_CASING_ITEM_ID,
    },
    unlock: [
      {
        item: "diamond",
      },
    ],
  },
});

_: _addItemTexture(
  STORAGE_DISK_CORE_ITEM_ID,
  "textures/fluffyalien/asn/items/storage_disk_core"
);
_.define.item({
  format_version: "1.20.80",
  "minecraft:item": {
    description: {
      identifier: STORAGE_DISK_CORE_ITEM_ID,
    },
    components: {
      "minecraft:max_stack_size": 16,
      "minecraft:icon": {
        //@ts-expect-error no textures property
        textures: {
          default: STORAGE_DISK_CORE_ITEM_ID,
        },
      },
    },
  },
});

_.define.recipe({
  format_version: "1.20.80",
  "minecraft:recipe_shaped": {
    description: {
      identifier: STORAGE_DISK_CORE_ITEM_ID,
    },
    tags: ["crafting_table"],
    pattern: ["SIS", "ICI", "SIS"],
    key: {
      I: {
        item: "iron_ingot",
      },
      S: {
        item: "smooth_stone",
      },
      C: {
        item: STORAGE_CRYSTAL_ITEM_ID,
      },
    },
    result: {
      item: STORAGE_DISK_CORE_ITEM_ID,
    },
    unlock: [
      {
        item: "diamond",
      },
    ],
  },
});

_: _addItemTexture(
  STORAGE_CRYSTAL_ITEM_ID,
  "textures/fluffyalien/asn/items/storage_crystal"
);
_.define.item({
  format_version: "1.20.80",
  "minecraft:item": {
    description: {
      identifier: STORAGE_CRYSTAL_ITEM_ID,
    },
    components: {
      "minecraft:max_stack_size": 16,
      "minecraft:icon": {
        //@ts-expect-error no textures property
        textures: {
          default: STORAGE_CRYSTAL_ITEM_ID,
        },
      },
    },
  },
});

_.define.recipe({
  format_version: "1.20.80",
  "minecraft:recipe_furnace": {
    description: {
      identifier: STORAGE_CRYSTAL_ITEM_ID,
    },
    tags: ["furnace", "blast_furnace"],
    input: RAW_STORAGE_CRYSTAL_ITEM_ID,
    output: STORAGE_CRYSTAL_ITEM_ID,
  },
});

_: _addItemTexture(
  RAW_STORAGE_CRYSTAL_ITEM_ID,
  "textures/fluffyalien/asn/items/raw_storage_crystal"
);
_.define.item({
  format_version: "1.20.80",
  "minecraft:item": {
    description: {
      identifier: RAW_STORAGE_CRYSTAL_ITEM_ID,
    },
    components: {
      "minecraft:max_stack_size": 16,
      "minecraft:icon": {
        //@ts-expect-error no textures property
        textures: {
          default: RAW_STORAGE_CRYSTAL_ITEM_ID,
        },
      },
    },
  },
});

_.define.recipe({
  format_version: "1.20.80",
  "minecraft:recipe_shapeless": {
    description: {
      identifier: RAW_STORAGE_CRYSTAL_ITEM_ID,
    },
    tags: ["crafting_table"],
    ingredients: [
      {
        item: "emerald",
        count: 3,
      },
      {
        item: "diamond",
        count: 3,
      },
      {
        item: "lapis_block",
      },
      {
        item: "redstone_block",
      },
      {
        item: "amethyst_shard",
      },
    ],
    result: {
      item: RAW_STORAGE_CRYSTAL_ITEM_ID,
    },
    unlock: [
      {
        item: "diamond",
      },
    ],
  },
});
