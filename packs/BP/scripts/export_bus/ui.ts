import { Block, Player, RawMessage } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import {
  ExportBusExportItemEnchantments,
  exportItemEnchantmentsProperty,
  exportItemProperty,
  getExportItemDamageRange,
  resetExportItemFilters,
  setExportItemDamageRange,
} from "./properties";
import {
  createErrorMessageForm,
  createMessageForm,
  showForm,
} from "../utils/ui";
import { createItemStack, getItemTranslationKey } from "../utils/item";

export async function showExportBusUi(
  player: Player,
  block: Block,
): Promise<void> {
  const exportItemId = exportItemProperty.safeGet(block);

  if (!exportItemId) {
    return void showForm(
      createMessageForm(
        { translate: "fluffyalien_asn.ui.exportBus.title" },
        { translate: "fluffyalien_asn.ui.exportBus.noExportItem" },
      ),
      player,
    );
  }

  const exportItemRawMessage: RawMessage = {
    translate: "fluffyalien_asn.ui.exportBus.exportItem",
    with: {
      rawtext: [
        {
          rawtext: [
            {
              text: "§l",
            },
            {
              translate: getItemTranslationKey(exportItemId),
            },
          ],
        },
      ],
    },
  };

  const mcItemStackr = createItemStack(exportItemId);
  if (mcItemStackr.isErr()) {
    return void createErrorMessageForm({
      translate: "fluffyalien_asn.ui.storageInterface.error.unknownError",
      with: { rawtext: [{ text: mcItemStackr.error.toString() }] },
    }).show(player);
  }
  const mcItemStack = mcItemStackr.value;
  const enchantable = !!mcItemStack.getComponent("enchantable");
  const breakable = !!mcItemStack.getComponent("durability");

  if (!enchantable && !breakable) {
    // set to default values
    resetExportItemFilters(block);

    return void showForm(
      createMessageForm(
        { translate: "fluffyalien_asn.ui.exportBus.title" },
        exportItemRawMessage,
      ),
      player,
    );
  }

  const exportItemEnchantmentsStatus =
    exportItemEnchantmentsProperty.safeGet(block);

  const exportItemDamageRange = getExportItemDamageRange(block);

  const body: RawMessage[] = [
    exportItemRawMessage,
    {
      text: "§r\n\n",
    },
  ];

  const form = new ModalFormData();

  form.title({ translate: "fluffyalien_asn.ui.exportBus.title" });

  if (enchantable) {
    form.dropdown(
      {
        rawtext: [
          ...body,
          {
            translate:
              "fluffyalien_asn.ui.exportBus.exportItemEnchantmentsStatus.label",
          },
        ],
      },
      [
        {
          translate:
            "fluffyalien_asn.ui.exportBus.exportItemEnchantmentsStatus.ignore",
        },
        {
          translate:
            "fluffyalien_asn.ui.exportBus.exportItemEnchantmentsStatus.with",
        },
        {
          translate:
            "fluffyalien_asn.ui.exportBus.exportItemEnchantmentsStatus.without",
        },
      ],
      {
        defaultValueIndex:
          exportItemEnchantmentsStatus === "ignore"
            ? 0
            : exportItemEnchantmentsStatus === "with"
              ? 1
              : 2,
      },
    );
  }

  if (breakable) {
    form.textField(
      enchantable
        ? { translate: "fluffyalien_asn.ui.exportBus.exportItemMinDamage" }
        : {
            rawtext: [
              ...body,
              { translate: "fluffyalien_asn.ui.exportBus.exportItemMinDamage" },
            ],
          },
      "0",
      {
        defaultValue: exportItemDamageRange.min.toString(),
      },
    );

    form.textField(
      { translate: "fluffyalien_asn.ui.exportBus.exportItemMaxDamage" },
      "",
      {
        defaultValue: exportItemDamageRange.max?.toString(),
      },
    );
  }

  const response = await showForm(form, player);

  if (!response.formValues) {
    return;
  }

  const enchantmentsDropdownResponse = enchantable
    ? (response.formValues[0] as number)
    : 0;

  const minDamageResponseRaw = breakable
    ? response.formValues[enchantable ? 1 : 0]
    : null;
  const maxDamageResponseRaw = breakable
    ? response.formValues[enchantable ? 2 : 1]
    : null;

  const minDamageResponse = minDamageResponseRaw
    ? Number(minDamageResponseRaw)
    : 0;
  if (isNaN(minDamageResponse)) {
    return void showForm(
      createErrorMessageForm({
        translate: "fluffyalien_asn.ui.exportBus.error.invalidMinDamage",
      }),
      player,
    );
  }

  const maxDamageResponse = maxDamageResponseRaw
    ? Number(maxDamageResponseRaw)
    : undefined;
  if (maxDamageResponse !== undefined && isNaN(maxDamageResponse)) {
    return void showForm(
      createErrorMessageForm({
        translate: "fluffyalien_asn.ui.exportBus.error.invalidMaxDamage",
      }),
      player,
    );
  }

  exportItemEnchantmentsProperty.set(
    block,
    (["ignore", "with", "without"] as ExportBusExportItemEnchantments[])[
      enchantmentsDropdownResponse
    ],
  );

  setExportItemDamageRange(block, {
    min: minDamageResponse,
    max: maxDamageResponse,
  });
}
