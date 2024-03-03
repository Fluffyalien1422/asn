import { Player } from "@minecraft/server";
import { DiscoverCableNetworkConnectionsError } from "../cable";
import { ActionFormResponse } from "@minecraft/server-ui";
import { makeErrorMessageUi, showForm } from "../utils/ui";
import { StorageSystemItemStack } from "../storage_system_item_stack";
import { isBlock } from "../utils/items";
import { abbreviateNumber } from "../utils/number";

const ITEMS_PER_PAGE = 10;

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
export async function showItemsList(
  player: Player,
  items: readonly StorageSystemItemStack[],
  page: number
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
    const translationKeyItemId = item.typeId.startsWith("minecraft:")
      ? item.typeId.slice("minecraft:".length)
      : item.typeId;

    form.button({
      rawtext: [
        {
          text: `${abbreviateNumber(item.amount)} `,
        },
        {
          translate: isBlock(item.typeId)
            ? `tile.${translationKeyItemId}.name`
            : `item.${translationKeyItemId}`,
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
    return showItemsList(player, items, Math.max(page - 1, 0));
  }

  const nextPageButtonPressed =
    response.selection === topButtonsCount + itemsOnPage.length + 1;

  if (nextPageButtonPressed) {
    return showItemsList(player, items, page + 1);
  }

  const chosenItemIndex = response.selection - topButtonsCount;

  console.warn(chosenItemIndex);
}
