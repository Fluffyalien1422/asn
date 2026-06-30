import { Player } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";

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
