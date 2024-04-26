import { Block, Player } from "@minecraft/server";
import { STORAGE_DATA_DYNAMIC_PROPERTY_ID, getStorageDriveEntity } from ".";
import { ActionFormResponse, ActionFormData } from "@minecraft/server-ui";

export function showStorageDriveUi(
  player: Player,
  storageDrive: Block,
): Promise<ActionFormResponse> {
  const form = new ActionFormData();

  form.title({
    translate: "fluffyalien_asn.ui.storageDrive.title",
  });

  form.body({
    translate: "fluffyalien_asn.ui.storageDrive.body.storageUsed",
    with: {
      rawtext: [
        {
          text:
            (
              getStorageDriveEntity(storageDrive)?.getDynamicProperty(
                STORAGE_DATA_DYNAMIC_PROPERTY_ID,
              ) as string | undefined
            )?.length.toString() ?? "0",
        },
      ],
    },
  });

  form.button({
    translate: "fluffyalien_asn.ui.common.close",
  });

  return form.show(player);
}
