import { Block, Player } from "@minecraft/server";
import { STORAGE_DATA_DYNAMIC_PROPERTY_ID, getStorageDriveEntity } from ".";
import { showForm } from "../utils/ui";
import { ActionFormResponse } from "@minecraft/server-ui";

export function showStorageDriveUi(
  player: Player,
  storageDrive: Block
): Promise<ActionFormResponse> {
  const form = new $.serverUi.ActionFormData();

  form.title({
    rawtext: [
      {
        translate: "fluffyalien_asn.ui.storageDrive.title",
      },
    ],
  });

  form.body({
    rawtext: [
      {
        translate: "fluffyalien_asn.ui.storageDrive.body.bytesUsed",
        with: {
          rawtext: [
            {
              text:
                (
                  getStorageDriveEntity(storageDrive)?.getDynamicProperty(
                    STORAGE_DATA_DYNAMIC_PROPERTY_ID
                  ) as string | undefined
                )?.length.toString() ?? "0",
            },
          ],
        },
      },
    ],
  });

  form.button({
    rawtext: [
      {
        translate: "fluffyalien_asn.ui.common.ok",
      },
    ],
  });

  return showForm(form, player);
}
