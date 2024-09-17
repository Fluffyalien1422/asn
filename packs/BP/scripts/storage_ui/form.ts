import { Player, RawMessage } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { StorageSystemItemStack } from "../storage_system_item_stack";
import { ENCHANTMENT_TRANSLATION_KEYS } from "../enchantment_translations";
import { getEnchantmentTypeId, getItemTranslationKey } from "../utils/item";
import { makeErrorMessageUi, showForm } from "../utils/ui";

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
    "",
    (item.amount === 1
      ? 1
      : item.amount >= 64
        ? 64
        : Math.floor(item.amount / 2)
    ).toString(),
  );

  const response = await showForm(form, player);

  if (!response.formValues) {
    return;
  }

  const textFieldValue = response.formValues[0] as string;

  let amount = Number(textFieldValue);
  if (!amount || amount < 0 || amount > 1000) {
    await showForm(
      makeErrorMessageUi({
        translate:
          "fluffyalien_asn.ui.storageInterface.requestItem.error.invalidNumber",
      }),
      player,
    );

    return showRequestItemUi(player, item);
  }
  amount = Math.floor(amount);

  if (amount > item.amount) {
    await showForm(
      makeErrorMessageUi({
        translate:
          "fluffyalien_asn.ui.storageInterface.requestItem.error.notEnough",
      }),
      player,
    );

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

  const response = await showForm(form, player);
  if (!response.formValues) {
    return;
  }

  const query = response.formValues[0] as string;
  return query;
}
