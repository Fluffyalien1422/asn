import { ItemStack, Player, RawMessage } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { RECIPES } from "../recipes";

export async function showSearchForm(
  player: Player,
): Promise<string | undefined> {
  const response = await new ModalFormData()
    .title({
      translate: "fluffyalien_asn.ui.storageInterface.title",
    })
    .textField(
      {
        translate: "fluffyalien_asn.ui.storageInterface.search.label",
      },
      "Query",
    )
    .show(player);

  if (!response.formValues) {
    return;
  }
  const query = response.formValues[0] as string;
  return query;
}

export function showCraftForm(
  player: Player,
  itemStack: ItemStack,
  items: Map<string, ItemStack>,
): void {
  if (!(itemStack.typeId in RECIPES)) {
    return;
  }
  const recipes = RECIPES[itemStack.typeId];

  const available = new Map<string, number>();
  for (const [, stack] of items) {
    available.set(
      stack.typeId,
      (available.get(stack.typeId) ?? 0) + stack.amount,
    );
    for (const tag of stack.getTags()) {
      const tagId = "#" + tag;
      available.set(tagId, (available.get(tagId) ?? 0) + stack.amount);
    }
  }

  const craftable = recipes.filter(([, ingredients]) =>
    ingredients.every(([id, count]) => (available.get(id) ?? 0) >= count),
  );

  const form = new ActionFormData()
    .title("fluffyalien_asn.ui.storageInterface.craft.title")
    .body({
      translate: "fluffyalien_asn.ui.storageInterface.craft.body",
      with: { rawtext: [{ translate: itemStack.localizationKey }] },
    });

  const amounts = [1, 2, 4, 8, 16, 32, 64];
  for (const recipe of craftable) {
    for (const amount of amounts) {
      const ingredientsRawMsg: RawMessage[] = recipe[1].flatMap(
        ([id, count]) => {
          const text = { text: `\n${count.toString()} ` };
          const itemName = id.startsWith("#")
            ? {
                translate:
                  "fluffyalien_asn.ui.storageInterface.craft.button.recipe.withTag",
                with: { rawtext: [{ text: id.slice(1) }] },
              }
            : { translate: new ItemStack(id).localizationKey };
          return [text, itemName];
        },
      );
      form.button(
        {
          rawtext: [
            {
              translate:
                "fluffyalien_asn.ui.storageInterface.craft.button.recipe",
              with: { rawtext: [{ text: amount.toString() }] },
            },
            ...ingredientsRawMsg,
          ],
        },
        "textures/blocks/crafting_table_top",
      );
    }
  }

  void form.show(player);
}
