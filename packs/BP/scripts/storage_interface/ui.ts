import { Player, RawMessage } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import {
  makeErrorMessageUi,
  getEnchantmentTypeId,
  abbreviateNumber,
  getItemTranslationKey,
} from "../utils";
import { StorageSystemItemStack } from "../storage_system_item_stack";
import { ENCHANTMENT_TRANSLATION_KEYS } from "../enchantment_translations";

const ITEMS_PER_PAGE = 10;

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
  query?: string,
): Promise<StorageSystemItemStack | undefined> {
  const form = new ActionFormData();

  form.title({
    translate: "fluffyalien_asn.ui.storageInterface.title",
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
      translate: "fluffyalien_asn.ui.storageInterface.itemsList.search",
    },
    "textures/fluffyalien/asn/ui/search",
  );

  const itemsOnPage = items.slice(
    page * ITEMS_PER_PAGE,
    (page + 1) * ITEMS_PER_PAGE,
  );

  if (!itemsOnPage.length) {
    body.push({
      translate: "fluffyalien_asn.ui.storageInterface.itemsList.body.noItems",
    });
  }

  if (body.length) form.body({ rawtext: body });

  for (const item of itemsOnPage) {
    const icons = ["apple", "beef", "sword", "ingot", "flower"];
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
      `textures/fluffyalien/asn/ui/${icon}_outline`,
    );
  }

  form.button(
    {
      translate: "fluffyalien_asn.ui.storageInterface.itemsList.previousPage",
    },
    "textures/fluffyalien/asn/ui/previous_page",
  );

  form.button(
    {
      translate: "fluffyalien_asn.ui.storageInterface.itemsList.nextPage",
    },
    "textures/fluffyalien/asn/ui/next_page",
  );

  const response = await form.show(player);

  if (response.selection === undefined) {
    return;
  }

  const searchButtonPressed = response.selection === 0;
  if (searchButtonPressed) {
    const query = await showSearchUi(player);
    if (!query) {
      return showItemsListUi(player, items, page);
    }

    const keywords = query.toLowerCase().split(" ");

    const matchingItems = items
      .filter((item) =>
        keywords.some((keyword) => item.typeId.includes(keyword)),
      )
      .sort((a, b) =>
        keywords.filter((keyword) => b.typeId.includes(keyword)).length >
        keywords.filter((keyword) => a.typeId.includes(keyword)).length
          ? 1
          : 0,
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

export async function showRequestItemUi(
  player: Player,
  item: StorageSystemItemStack,
): Promise<StorageSystemItemStack | undefined> {
  const form = new ModalFormData();

  form.title({
    translate: "fluffyalien_asn.ui.storageInterface.title",
  });

  const mcItemStack = item.toItemStack();
  const maxDurability =
    mcItemStack.getComponent("durability")?.maxDurability ?? 0;

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
                  "fluffyalien_asn.ui.storageInterface.requestItem.itemDurability",
                with: {
                  rawtext: [
                    { text: (maxDurability - item.damage).toString() },
                    { text: maxDurability.toString() },
                  ],
                },
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
              ...item.enchantments.flatMap((enchantment) => {
                const enchantmentTypeId = getEnchantmentTypeId(enchantment);
                const name: RawMessage =
                  enchantmentTypeId in ENCHANTMENT_TRANSLATION_KEYS
                    ? {
                        translate:
                          ENCHANTMENT_TRANSLATION_KEYS[enchantmentTypeId],
                      }
                    : { text: enchantmentTypeId };
                return [
                  { text: "\n§r- §7" },
                  name,
                  { text: " " },
                  {
                    translate: `enchantment.level.${enchantment.level.toString()}`,
                  },
                ];
              }),
            ]
          : []),
        ...(item.lore.length
          ? [
              { text: "§r\n" },
              {
                translate:
                  "fluffyalien_asn.ui.storageInterface.requestItem.itemLore",
              },
              ...item.lore.flatMap((lore) =>
                lore.split("\n").map((line) => ({ text: "\n§r- §5§o" + line })),
              ),
            ]
          : []),
        ...(item.dynamicProperties.length
          ? [{ text: "§r\n§7" }, { translate: "item.customProperties" }]
          : []),
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
    "1",
  );

  const response = await form.show(player);

  if (!response.formValues) {
    return;
  }

  const textFieldValue = response.formValues[0] as string;

  const amount = Number(textFieldValue);
  if (!amount || amount < 0) {
    await makeErrorMessageUi({
      translate:
        "fluffyalien_asn.ui.storageInterface.requestItem.error.invalidNumber",
    }).show(player);

    return showRequestItemUi(player, item);
  }

  if (amount > item.amount) {
    await makeErrorMessageUi({
      translate:
        "fluffyalien_asn.ui.storageInterface.requestItem.error.notEnough",
    }).show(player);

    return showRequestItemUi(player, item);
  }

  return item.withAmount(amount);
}

export async function showSearchUi(
  player: Player,
): Promise<string | undefined> {
  const form = new ModalFormData();

  form.title({
    translate: "fluffyalien_asn.ui.storageInterface.title",
  });

  form.textField(
    {
      translate: "fluffyalien_asn.ui.storageInterface.search.label",
    },
    "Query",
  );

  const response = await form.show(player);
  if (!response.formValues) {
    return;
  }

  const query = response.formValues[0] as string;
  return query;
}
