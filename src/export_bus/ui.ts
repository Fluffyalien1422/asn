import { Entity, Player } from "@minecraft/server";
import {
  ExportBusExportItemEnchantments,
  getExportBusExportItemDamageRange,
  getExportBusExportItemEnchantments,
  getExportBusExportItemId,
  setExportBusExportItemDamageRange,
  setExportBusExportItemEnchantments,
} from ".";
import {
  getItemTranslationKey,
  makeErrorMessageUi,
  makeMessageUi,
  showForm,
} from "../utils";

export async function showExportBusUi(
  player: Player,
  dummyEntity: Entity
): Promise<void> {
  const exportItemId = getExportBusExportItemId(dummyEntity);

  if (!exportItemId) {
    return void showForm(
      makeMessageUi(
        { translate: "fluffyalien_asn.ui.exportBus.title" },
        { translate: "fluffyalien_asn.ui.exportBus.noExportItem" }
      ),
      player
    );
  }

  const exportItemEnchantmentsStatus =
    getExportBusExportItemEnchantments(dummyEntity);

  const exportItemDamageRange = getExportBusExportItemDamageRange(dummyEntity);

  const form = new $.serverUi.ModalFormData();

  form.title({ translate: "fluffyalien_asn.ui.exportBus.title" });

  form.dropdown(
    {
      rawtext: [
        {
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
        },
        {
          text: "§r\n\n",
        },
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
    exportItemEnchantmentsStatus === "ignore"
      ? 0
      : exportItemEnchantmentsStatus === "with"
      ? 1
      : 2
  );

  form.textField(
    { translate: "fluffyalien_asn.ui.exportBus.exportItemMinDamage" },
    "0",
    exportItemDamageRange.min.toString()
  );

  form.textField(
    { translate: "fluffyalien_asn.ui.exportBus.exportItemMaxDamage" },
    "",
    exportItemDamageRange.max?.toString()
  );

  const response = await showForm(form, player);

  if (!response.formValues) {
    return;
  }

  const enchantmentsDropdownResponse = response.formValues[0] as number;

  const minDamageResponse = response.formValues[1]
    ? Number(response.formValues[1])
    : 0;
  if (isNaN(minDamageResponse)) {
    return void showForm(
      makeErrorMessageUi({
        translate: "fluffyalien_asn.ui.exportBus.error.invalidMinDamage",
      }),
      player
    );
  }

  const maxDamageResponse = response.formValues[2]
    ? Number(response.formValues[2])
    : undefined;
  if (maxDamageResponse !== undefined && isNaN(maxDamageResponse)) {
    return void showForm(
      makeErrorMessageUi({
        translate: "fluffyalien_asn.ui.exportBus.error.invalidMaxDamage",
      }),
      player
    );
  }

  setExportBusExportItemEnchantments(
    dummyEntity,
    (["ignore", "with", "without"] as ExportBusExportItemEnchantments[])[
      enchantmentsDropdownResponse
    ]
  );

  setExportBusExportItemDamageRange(dummyEntity, {
    min: minDamageResponse,
    max: maxDamageResponse,
  });
}
