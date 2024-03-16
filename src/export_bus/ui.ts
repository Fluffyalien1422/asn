import { Entity, Player, RawMessage } from "@minecraft/server";
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

  const mcItemStack = new $.server.ItemStack(exportItemId);
  const enchantable = mcItemStack.hasComponent("enchantable");
  const breakable = mcItemStack.hasComponent("durability");

  if (!enchantable && !breakable) {
    // set to default values
    setExportBusExportItemEnchantments(dummyEntity, "ignore");
    setExportBusExportItemDamageRange(dummyEntity, { min: 0 });

    return void showForm(
      makeMessageUi(
        { translate: "fluffyalien_asn.ui.exportBus.title" },
        exportItemRawMessage
      ),
      player
    );
  }

  const exportItemEnchantmentsStatus =
    getExportBusExportItemEnchantments(dummyEntity);

  const exportItemDamageRange = getExportBusExportItemDamageRange(dummyEntity);

  const body: RawMessage[] = [
    exportItemRawMessage,
    {
      text: "§r\n\n",
    },
  ];

  const form = new $.serverUi.ModalFormData();

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
      exportItemEnchantmentsStatus === "ignore"
        ? 0
        : exportItemEnchantmentsStatus === "with"
        ? 1
        : 2
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
      exportItemDamageRange.min.toString()
    );

    form.textField(
      { translate: "fluffyalien_asn.ui.exportBus.exportItemMaxDamage" },
      "",
      exportItemDamageRange.max?.toString()
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
      makeErrorMessageUi({
        translate: "fluffyalien_asn.ui.exportBus.error.invalidMinDamage",
      }),
      player
    );
  }

  const maxDamageResponse = maxDamageResponseRaw
    ? Number(maxDamageResponseRaw)
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
