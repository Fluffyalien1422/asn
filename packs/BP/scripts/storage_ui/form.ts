import { Player } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";

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

  const response = await form.show(player);
  if (!response.formValues) {
    return;
  }

  const query = response.formValues[0] as string;
  return query;
}
