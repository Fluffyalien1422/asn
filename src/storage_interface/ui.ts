import { Player, RawMessage } from "@minecraft/server";
import { DiscoverCableNetworkConnectionsError } from "../cable_network";
import { ActionFormResponse } from "@minecraft/server-ui";
import { makeErrorMessageUi, showForm } from "../utils/ui";
import { StorageSystemItemStack } from "../storage_system_item_stack";
import { getEnchantmentTypeId, isBlock } from "../utils/item";
import { abbreviateNumber } from "../utils/number";
import { ITEM_TRANSLATION_OVERRIDES } from "./item_translation_overrides";
import { typeIdWithoutNamespace } from "../utils/string";

const ENCHANTMENT_TRANSLATION_KEYS: Record<string, string> = {
  protection: "enchantment.protect.all",
  fire_protection: "enchantment.protect.fire",
  feather_falling: "enchantment.protect.fall",
  blast_protection: "enchantment.protect.explosion",
  projectile_protection: "enchantment.protect.projectile",
  thorns: "enchantment.thorns",
  respiration: "enchantment.oxygen",
  depth_strider: "enchantment.waterWalker",
  aqua_affinity: "enchantment.waterWorker",
  sharpness: "enchantment.damage.all",
  smite: "enchantment.damage.undead",
  bane_of_arthropods: "enchantment.damage.arthropods",
  knockback: "enchantment.knockback",
  fire_aspect: "enchantment.fire",
  looting: "enchantment.lootBonus",
  efficiency: "enchantment.digging",
  silk_touch: "enchantment.untouching",
  unbreaking: "enchantment.durability",
  fortune: "enchantment.lootBonusDigger",
  power: "enchantment.arrowDamage",
  punch: "enchantment.arrowKnockback",
  flame: "enchantment.arrowFire",
  infinity: "enchantment.arrowInfinite",
  luck_of_the_sea: "enchantment.lootBonusFishing",
  lure: "enchantment.fishingSpeed",
  frost_walker: "enchantment.frostwalker",
  mending: "enchantment.mending",
  binding: "enchantment.curse.binding",
  vanishing: "enchantment.curse.vanishing",
  impaling: "enchantment.tridentImpaling",
  riptide: "enchantment.tridentRiptide",
  loyalty: "enchantment.tridentLoyalty",
  channeling: "enchantment.tridentChanneling",
  multishot: "enchantment.crossbowMultishot",
  piercing: "enchantment.crossbowPiercing",
  quick_charge: "enchantment.crossbowQuickCharge",
  soul_speed: "enchantment.soul_speed",
  swift_sneak: "enchantment.swift_sneak",
};

const ITEMS_PER_PAGE = 10;

function getItemTranslationKey(itemId: string): string {
  if (itemId in ITEM_TRANSLATION_OVERRIDES) {
    return ITEM_TRANSLATION_OVERRIDES[itemId];
  }

  const isMinecraftNamespace = itemId.startsWith("minecraft:");
  const translationKeyItemId = isMinecraftNamespace
    ? itemId.slice("minecraft:".length)
    : itemId;

  return isBlock(itemId)
    ? `tile.${translationKeyItemId}.name`
    : isMinecraftNamespace
    ? `item.${translationKeyItemId}.name`
    : `item.${translationKeyItemId}`;
}

export function showEstablishNetworkError(
  player: Player,
  error: DiscoverCableNetworkConnectionsError
): Promise<ActionFormResponse> {
  return showForm(
    makeErrorMessageUi({
      rawtext: [
        {
          translate:
            error === "multipleStorageCores"
              ? "fluffyalien_asn.ui.storageInterface.error.multipleStorageCores"
              : "fluffyalien_asn.ui.storageInterface.error.noStorageCores",
        },
      ],
    }),
    player
  );
}

/**
 * Shows the items list to the player
 * @param player the player to show the UI to
 * @param items all of the items in the storage
 * @param page the zero-based page number
 * @returns the {@link StorageSystemItemStack} that the player requested
 */
export async function showItemsListUi(
  player: Player,
  items: readonly StorageSystemItemStack[],
  page = 0,
  query?: string
): Promise<StorageSystemItemStack | undefined> {
  const form = new $.serverUi.ActionFormData();

  form.title({
    rawtext: [
      {
        translate: "fluffyalien_asn.ui.storageInterface.title",
      },
    ],
  });

  const body: RawMessage[] = [];

  if (query) {
    body.push({
      translate:
        "fluffyalien_asn.ui.storageInterface.itemsList.body.searchResults",
      with: {
        rawtext: [
          {
            text: query,
          },
        ],
      },
    });
  }

  const topButtonsCount = 1;

  form.button(
    {
      rawtext: [
        {
          translate: "fluffyalien_asn.ui.storageInterface.itemsList.search",
        },
      ],
    },
    "textures/fluffyalien/asn/ui/search"
  );

  const itemsOnPage = items.slice(
    page * ITEMS_PER_PAGE,
    (page + 1) * ITEMS_PER_PAGE
  );

  if (!itemsOnPage.length) {
    body.push({
      translate: "fluffyalien_asn.ui.storageInterface.itemsList.body.noItems",
    });
  }

  if (body.length) form.body({ rawtext: body });

  for (const item of itemsOnPage) {
    const icons = ["apple", "beef", "sword", "ingot"];
    const icon = icons[Math.floor(Math.random() * icons.length)];

    form.button(
      {
        rawtext: [
          {
            text: `${abbreviateNumber(item.amount)} `,
          },
          {
            translate: getItemTranslationKey(item.typeId),
          },
          {
            text: item.nameTag ? ` §o${item.nameTag}§r` : "",
          },
          ...(item.enchantments.length
            ? [
                { text: " [§b" },
                {
                  translate:
                    "fluffyalien_asn.ui.storageInterface.itemsList.item.enchanted",
                },
                { text: "§r]" },
              ]
            : []),
          ...(item.damage
            ? [
                { text: " [§c" },
                {
                  translate:
                    "fluffyalien_asn.ui.storageInterface.itemsList.item.damaged",
                },
                { text: "§r]" },
              ]
            : []),
        ],
      },
      `textures/fluffyalien/asn/ui/${icon}_outline`
    );
  }

  form.button(
    {
      rawtext: [
        {
          translate:
            "fluffyalien_asn.ui.storageInterface.itemsList.previousPage",
        },
      ],
    },
    "textures/fluffyalien/asn/ui/previous_page"
  );

  form.button(
    {
      rawtext: [
        {
          translate: "fluffyalien_asn.ui.storageInterface.itemsList.nextPage",
        },
      ],
    },
    "textures/fluffyalien/asn/ui/next_page"
  );

  const response = await showForm(form, player);

  if (response.selection === undefined) {
    return;
  }

  const searchButtonPressed = response.selection === 0;
  if (searchButtonPressed) {
    const originalQuery = await showSearchUi(player);
    if (!originalQuery) {
      return showItemsListUi(player, items, page);
    }

    const query = originalQuery.toLowerCase();

    const matchingItems = items
      .filter((item) => item.typeId.includes(query))
      .sort(
        (a, b) =>
          (b.typeId.startsWith(query) ? 1 : 0) -
          (a.typeId.startsWith(query) ? 1 : 0) +
          ((typeIdWithoutNamespace(b.typeId).startsWith(query) ? 1 : 0) -
            (typeIdWithoutNamespace(a.typeId).startsWith(query) ? 1 : 0))
      );

    return showItemsListUi(player, matchingItems, 0, query);
  }

  const previousPageButtonPressed =
    response.selection === topButtonsCount + itemsOnPage.length;

  if (previousPageButtonPressed) {
    return showItemsListUi(player, items, Math.max(page - 1, 0));
  }

  const nextPageButtonPressed =
    response.selection === topButtonsCount + itemsOnPage.length + 1;

  if (nextPageButtonPressed) {
    return showItemsListUi(player, items, page + 1);
  }

  const chosenItemIndex = response.selection - topButtonsCount;
  const chosenItem = itemsOnPage[chosenItemIndex];

  const requestedItem = await showRequestItemUi(player, chosenItem);
  if (!requestedItem) {
    return showItemsListUi(player, items, page);
  }

  return requestedItem;
}

async function showRequestItemUi(
  player: Player,
  item: StorageSystemItemStack
): Promise<StorageSystemItemStack | undefined> {
  const form = new $.serverUi.ModalFormData();

  form.title({
    rawtext: [
      {
        translate: "fluffyalien_asn.ui.storageInterface.title",
      },
    ],
  });

  form.textField(
    {
      rawtext: [
        {
          text: "§l",
        },
        {
          translate: getItemTranslationKey(item.typeId),
        },
        {
          text: "§r" + (item.nameTag ? ` §o${item.nameTag}§r` : ""),
        },
        ...(item.damage
          ? [
              { text: "\n" },
              {
                translate:
                  "fluffyalien_asn.ui.storageInterface.requestItem.itemDamage",
                with: { rawtext: [{ text: item.damage.toString() }] },
              },
            ]
          : []),
        ...(item.enchantments.length
          ? [
              { text: "\n" },
              {
                translate:
                  "fluffyalien_asn.ui.storageInterface.requestItem.itemEnchantments",
              },
            ]
          : []),
        ...item.enchantments.flatMap((enchantment) => {
          const enchantmentTypeId = getEnchantmentTypeId(enchantment);
          const name: RawMessage =
            enchantmentTypeId in ENCHANTMENT_TRANSLATION_KEYS
              ? { translate: ENCHANTMENT_TRANSLATION_KEYS[enchantmentTypeId] }
              : { text: enchantmentTypeId };
          return [
            { text: "\n§r- §7" },
            name,
            { text: " " },
            { translate: `enchantment.level.${enchantment.level}` },
          ];
        }),
        {
          text: "§r\n\n",
        },
        {
          translate:
            "fluffyalien_asn.ui.storageInterface.requestItem.itemAmount",
        },
      ],
    },
    "1",
    "1"
  );

  const response = await showForm(form, player);

  if (!response.formValues) {
    return;
  }

  const textFieldValue = response.formValues[0] as string;

  const amount = Number(textFieldValue);
  if (!amount || amount < 0) {
    await showForm(
      makeErrorMessageUi({
        rawtext: [
          {
            translate:
              "fluffyalien_asn.ui.storageInterface.requestItem.error.invalidNumber",
          },
        ],
      }),
      player
    );

    return showRequestItemUi(player, item);
  }

  if (amount > item.amount) {
    await showForm(
      makeErrorMessageUi({
        rawtext: [
          {
            translate:
              "fluffyalien_asn.ui.storageInterface.requestItem.error.notEnough",
          },
        ],
      }),
      player
    );

    return showRequestItemUi(player, item);
  }

  return item.withAmount(amount);
}

async function showSearchUi(player: Player): Promise<string | undefined> {
  const form = new $.serverUi.ModalFormData();

  form.title({
    rawtext: [
      {
        translate: "fluffyalien_asn.ui.storageInterface.title",
      },
    ],
  });

  form.textField(
    {
      rawtext: [
        {
          translate: "fluffyalien_asn.ui.storageInterface.search.label",
        },
      ],
    },
    "Query"
  );

  const response = await showForm(form, player);
  if (!response.formValues) {
    return;
  }

  const query = response.formValues[0] as string;
  return query;
}
