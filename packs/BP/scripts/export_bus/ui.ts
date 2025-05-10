import {
  Block,
  Entity,
  ItemStack,
  Player,
  RawMessage,
} from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import {
  ExportBusExportItemEnchantments,
  getExportBusExportItemDamageRange,
  getExportBusExportItemEnchantments,
  getExportBusExportItemId,
  setExportBusExportItemDamageRange,
  setExportBusExportItemEnchantments,
} from ".";
import { makeErrorMessageUi, makeMessageUi, showForm } from "../utils/ui";
import { getItemTranslationKey } from "../utils/item";

export async function showExportBusUi(
  player: Player,
  dynamicPropertyTarget: Entity | Block,
): Promise<void> {
  const exportItemId = getExportBusExportItemId(dynamicPropertyTarget);

  if (!exportItemId) {
    return void showForm(
      makeMessageUi(
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

  const mcItemStack = new ItemStack(exportItemId);
  const enchantable = !!mcItemStack.getComponent("enchantable");
  const breakable = !!mcItemStack.getComponent("durability");

  if (!enchantable && !breakable) {
    // set to default values
    setExportBusExportItemEnchantments(dynamicPropertyTarget, "ignore");
    setExportBusExportItemDamageRange(dynamicPropertyTarget, { min: 0 });

    return void showForm(
      makeMessageUi(
        { translate: "fluffyalien_asn.ui.exportBus.title" },
        exportItemRawMessage,
      ),
      player,
    );
  }

  const exportItemEnchantmentsStatus = getExportBusExportItemEnchantments(
    dynamicPropertyTarget,
  );

  const exportItemDamageRange = getExportBusExportItemDamageRange(
    dynamicPropertyTarget,
  );

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
      exportItemEnchantmentsStatus === "ignore"
        ? 0
        : exportItemEnchantmentsStatus === "with"
          ? 1
          : 2,
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
      exportItemDamageRange.min.toString(),
    );

    form.textField(
      { translate: "fluffyalien_asn.ui.exportBus.exportItemMaxDamage" },
      "",
      exportItemDamageRange.max?.toString(),
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
      player,
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
      player,
    );
  }

  setExportBusExportItemEnchantments(
    dynamicPropertyTarget,
    (["ignore", "with", "without"] as ExportBusExportItemEnchantments[])[
      enchantmentsDropdownResponse
    ],
  );

  setExportBusExportItemDamageRange(dynamicPropertyTarget, {
    min: minDamageResponse,
    max: maxDamageResponse,
  });
}
