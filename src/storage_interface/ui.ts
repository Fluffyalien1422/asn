import { Player } from "@minecraft/server";
import { DiscoverCableNetworkConnectionsError } from "../cable";
import { ActionFormResponse } from "@minecraft/server-ui";
import { makeErrorMessageUi, showForm } from "../utils/ui";
import { StorageSystemItemStack } from "../storage_system_item_stack";
import { isBlock } from "../utils/items";
import { abbreviateNumber } from "../utils/number";
import { itemTranslationOverrides } from "./item_translation_overrides";

const ITEMS_PER_PAGE = 10;

function getItemTranslationKey(itemId: string): string {
  if (itemId in itemTranslationOverrides) {
    return itemTranslationOverrides[itemId];
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
  page = 0
): Promise<StorageSystemItemStack | undefined> {
  const form = new $.serverUi.ActionFormData();

  form.title({
    rawtext: [
      {
        translate: "fluffyalien_asn.ui.storageInterface.title",
      },
    ],
  });

  const topButtonsCount = 2;

  form.button({
    rawtext: [
      {
        translate: "fluffyalien_asn.ui.storageInterface.itemsList.search",
      },
    ],
  });

  form.button({
    rawtext: [
      {
        translate: "fluffyalien_asn.ui.storageInterface.itemsList.options",
      },
    ],
  });

  const itemsOnPage = items.slice(
    page * ITEMS_PER_PAGE,
    (page + 1) * ITEMS_PER_PAGE
  );

  if (!itemsOnPage.length) {
    form.body({
      rawtext: [
        {
          translate:
            "fluffyalien_asn.ui.storageInterface.itemsList.body.noItems",
        },
      ],
    });
  }

  for (const item of itemsOnPage) {
    form.button({
      rawtext: [
        {
          text: `${abbreviateNumber(item.amount)} `,
        },
        {
          translate: getItemTranslationKey(item.typeId),
        },
      ],
    });
  }

  form.button({
    rawtext: [
      {
        translate: "fluffyalien_asn.ui.storageInterface.itemsList.previousPage",
      },
    ],
  });

  form.button({
    rawtext: [
      {
        translate: "fluffyalien_asn.ui.storageInterface.itemsList.nextPage",
      },
    ],
  });

  const response = await showForm(form, player);

  if (response.selection === undefined) {
    return;
  }

  const searchButtonPressed = response.selection === 0;
  if (searchButtonPressed) {
    console.warn("search");
    return;
  }

  const optionsButtonPressed = response.selection === 1;
  if (optionsButtonPressed) {
    console.warn("options");
    return;
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
