import { Block, Player } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import {
  createErrorMessageForm,
  createMessageForm,
  showForm,
} from "../utils/ui";
import { createItemStack, getItemTranslationKey } from "../utils/item";
import {
  itemMaxDamageProperty,
  itemMinDamageProperty,
  itemProperty,
  operatorProperty,
  testAmountProperty,
  testEnchantmentsProperty,
} from "./properties";

// should be in the same order as the Operator enum in ./properties
const OPERATOR_STRS = [">", "<", "==", "!="];

export async function showLevelEmitterUi(
  player: Player,
  block: Block,
): Promise<void> {
  const itemId = itemProperty.safeGet(block);

  if (!itemId) {
    return void showForm(
      createMessageForm(
        { translate: "fluffyalien_asn.ui.levelEmitter.title" },
        { translate: "fluffyalien_asn.ui.levelEmitter.noItem" },
      ),
      player,
    );
  }

  const form = new ModalFormData();
  form.title({ translate: "fluffyalien_asn.ui.levelEmitter.title" });

  form.dropdown(
    {
      rawtext: [
        {
          translate: "fluffyalien_asn.ui.levelEmitter.testItem",
          with: {
            rawtext: [
              {
                rawtext: [
                  {
                    text: "§l",
                  },
                  {
                    translate: getItemTranslationKey(itemId),
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
          translate: "fluffyalien_asn.ui.levelEmitter.operator",
        },
      ],
    },
    OPERATOR_STRS,
    { defaultValueIndex: operatorProperty.safeGet(block) },
  );

  form.textField({ translate: "fluffyalien_asn.ui.levelEmitter.amount" }, "", {
    defaultValue: testAmountProperty.safeGet(block).toString(),
  });

  const itemStackr = createItemStack(itemId);
  if (itemStackr.isErr()) {
    return void showForm(
      createErrorMessageForm({
        translate: "fluffyalien_asn.ui.storageInterface.error.unknownError",
        with: { rawtext: [{ text: itemStackr.error.message }] },
      }),
      player,
    );
  }
  const itemStack = itemStackr.value;
  const enchantable = itemStack.hasComponent("enchantable");
  const breakable = itemStack.hasComponent("durability");

  const itemEnchantmentsStatus = testEnchantmentsProperty.safeGet(block);

  if (enchantable) {
    form.dropdown(
      {
        translate:
          "fluffyalien_asn.ui.exportBus.exportItemEnchantmentsStatus.label",
      },
      [
        // should be in the same order as the enum
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
      { defaultValueIndex: itemEnchantmentsStatus },
    );
  }

  if (breakable) {
    form.textField(
      { translate: "fluffyalien_asn.ui.exportBus.exportItemMinDamage" },
      "0",
      {
        defaultValue: itemMinDamageProperty.safeGet(block).toString(),
      },
    );

    form.textField(
      { translate: "fluffyalien_asn.ui.exportBus.exportItemMaxDamage" },
      "",
      {
        defaultValue: itemMaxDamageProperty.safeGet(block)?.toString(),
      },
    );
  }

  const response = await showForm(form, player);

  if (!response.formValues) {
    return;
  }

  const operator = response.formValues[0] as number;

  const amountStr = response.formValues[1] as string;
  const amount = Number(amountStr);

  if (isNaN(amount) || amount < 0) {
    return void showForm(
      createErrorMessageForm({
        translate: "fluffyalien_asn.ui.levelEmitter.error.invalidAmount",
      }),
      player,
    );
  }

  const enchantmentsDropdownResponse = enchantable
    ? (response.formValues[2] as number)
    : undefined;

  const minDamageResponseRaw = breakable
    ? response.formValues[enchantable ? 3 : 2]
    : null;
  const maxDamageResponseRaw = breakable
    ? response.formValues[enchantable ? 4 : 3]
    : null;

  const minDamageResponse = minDamageResponseRaw
    ? Number(minDamageResponseRaw)
    : undefined;
  if (minDamageResponse !== undefined && isNaN(minDamageResponse)) {
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

  operatorProperty.set(block, operator);
  testAmountProperty.set(block, amount);
  testEnchantmentsProperty.set(block, enchantmentsDropdownResponse);
  itemMinDamageProperty.set(block, minDamageResponse);
  itemMaxDamageProperty.set(block, maxDamageResponse);
}
