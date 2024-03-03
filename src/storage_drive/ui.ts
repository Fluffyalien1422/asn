import { Block, Player } from "@minecraft/server";
import { STORAGE_DATA_DYNAMIC_PROPERTY_ID, getStorageDriveEntity } from ".";
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
              text: (
                getStorageDriveEntity(storageDrive)?.getDynamicProperty(
                  STORAGE_DATA_DYNAMIC_PROPERTY_ID
                ) as string | undefined
              )?.length.toString(),
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

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
  return form.show(player as any);
}
