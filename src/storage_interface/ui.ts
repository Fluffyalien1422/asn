import { Player } from "@minecraft/server";
import { DiscoverCableNetworkConnectionsError } from "../cable";
import { _addTranslation } from "../texts";
import { ActionFormResponse } from "@minecraft/server-ui";
import { makeErrorMessageUi, showForm } from "../utils/ui";
import { StorageSystemItemStack } from "../storage_system_item_stack";
import { isBlock } from "../utils/items";
import { abbreviateNumber } from "../utils/number";

const TRANSLATION_UI_STORAGE_INTERFACE_TITLE =
  "fluffyalien_asn.ui.storageInterface.title";
_: _addTranslation(TRANSLATION_UI_STORAGE_INTERFACE_TITLE, "Storage Interface");

const TRANSLATION_UI_STORAGE_INTERFACE_ITEMS_LIST_SEARCH =
  "fluffyalien_asn.ui.storageInterface.itemsList.search";
_: _addTranslation(
  TRANSLATION_UI_STORAGE_INTERFACE_ITEMS_LIST_SEARCH,
  "Search"
);

const TRANSLATION_UI_STORAGE_INTERFACE_ITEMS_LIST_OPTIONS =
  "fluffyalien_asn.ui.storageInterface.itemsList.options";
_: _addTranslation(
  TRANSLATION_UI_STORAGE_INTERFACE_ITEMS_LIST_OPTIONS,
  "Options"
);

const TRANSLATION_UI_STORAGE_INTERFACE_ITEMS_LIST_PREVIOUS_PAGE =
  "fluffyalien_asn.ui.storageInterface.itemsList.previousPage";
_: _addTranslation(
  TRANSLATION_UI_STORAGE_INTERFACE_ITEMS_LIST_PREVIOUS_PAGE,
  "Previous"
);

const TRANSLATION_UI_STORAGE_INTERFACE_ITEMS_LIST_NEXT_PAGE =
  "fluffyalien_asn.ui.storageInterface.itemsList.nextPage";
_: _addTranslation(
  TRANSLATION_UI_STORAGE_INTERFACE_ITEMS_LIST_NEXT_PAGE,
  "Next"
);

const TRANSLATION_UI_STORAGE_INTERFACE_ERROR_MULTIPLE_STORAGE_CORES =
  "fluffyalien_asn.ui.storageInterface.error.multipleStorageCores";
_: _addTranslation(
  TRANSLATION_UI_STORAGE_INTERFACE_ERROR_MULTIPLE_STORAGE_CORES,
  "Cannot establish a storage network: multiple storage cores found."
);

const TRANSLATION_UI_STORAGE_INTERFACE_ERROR_NO_STORAGE_CORES =
  "fluffyalien_asn.ui.storageInterface.error.noStorageCores";
_: _addTranslation(
  TRANSLATION_UI_STORAGE_INTERFACE_ERROR_NO_STORAGE_CORES,
  "Cannot establish a storage network: no storage cores found."
);

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
              ? TRANSLATION_UI_STORAGE_INTERFACE_ERROR_MULTIPLE_STORAGE_CORES
              : TRANSLATION_UI_STORAGE_INTERFACE_ERROR_NO_STORAGE_CORES,
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
        translate: TRANSLATION_UI_STORAGE_INTERFACE_TITLE,
      },
    ],
  });

  form.button({
    rawtext: [
      {
        translate: TRANSLATION_UI_STORAGE_INTERFACE_ITEMS_LIST_SEARCH,
      },
    ],
  });

  form.button({
    rawtext: [
      {
        translate: TRANSLATION_UI_STORAGE_INTERFACE_ITEMS_LIST_OPTIONS,
      },
    ],
  });

  const itemsOnPage = items.slice(
    page * ITEMS_PER_PAGE,
    (page + 1) * ITEMS_PER_PAGE
  );

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
        translate: TRANSLATION_UI_STORAGE_INTERFACE_ITEMS_LIST_PREVIOUS_PAGE,
      },
    ],
  });

  form.button({
    rawtext: [
      {
        translate: TRANSLATION_UI_STORAGE_INTERFACE_ITEMS_LIST_NEXT_PAGE,
      },
    ],
  });

  const response = await showForm(form, player);

  if (response.selection === undefined) {
    return;
  }

  //todo: finish ui
}
