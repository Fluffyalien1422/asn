import { showTutorialBookUi } from "./ui";

const TUTORIAL_BOOK_ITEM_TYPE_ID = "fluffyalien_asn:tutorial_book";

const NOT_FIRST_JOIN_DYNAMIC_PROPERTY_ID = "fluffyalien_asn:not_first_join";

$.server.world.afterEvents.playerSpawn.subscribe((e) => {
  if (
    !e.initialSpawn ||
    e.player.getDynamicProperty(NOT_FIRST_JOIN_DYNAMIC_PROPERTY_ID)
  )
    return;

  e.player.setDynamicProperty(NOT_FIRST_JOIN_DYNAMIC_PROPERTY_ID, true);

  const tutorialBook = new $.server.ItemStack(TUTORIAL_BOOK_ITEM_TYPE_ID);
  e.player.dimension.spawnItem(tutorialBook, e.player.location);
});

$.server.world.afterEvents.itemUse.subscribe((e) => {
  if (e.itemStack.typeId !== TUTORIAL_BOOK_ITEM_TYPE_ID) return;

  void showTutorialBookUi(e.source);
});

_.define.item({
  format_version: "1.20.80",
  "minecraft:item": {
    description: {
      identifier: TUTORIAL_BOOK_ITEM_TYPE_ID,
    },
    components: {
      "minecraft:glint": true,
      "minecraft:max_stack_size": 1,
      "minecraft:icon": {
        //@ts-expect-error no textures property
        textures: {
          default: "book_written",
        },
      },
    },
  },
});

_.define.recipe({
  format_version: "1.20.80",
  "minecraft:recipe_shapeless": {
    description: {
      identifier: TUTORIAL_BOOK_ITEM_TYPE_ID,
    },
    tags: ["crafting_table"],
    ingredients: [
      {
        item: "book",
      },
      {
        item: "emerald",
      },
    ],
    result: {
      item: TUTORIAL_BOOK_ITEM_TYPE_ID,
    },
    unlock: [
      {
        item: "diamond",
      },
    ],
  },
});
