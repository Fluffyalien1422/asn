import { Block, Player } from "@minecraft/server";
import { TRANSLATION_COMMON_UI_OK, _addTranslation } from "../texts";
import { STORAGE_DATA_DYNAMIC_PROPERTY_ID, getStorageDriveEntity } from ".";
import { ActionFormResponse } from "@minecraft/server-ui";

const TRANSLATION_UI_STORAGE_DRIVE_TITLE =
  "fluffyalien_asn.ui.storageDrive.title";
_: _addTranslation(TRANSLATION_UI_STORAGE_DRIVE_TITLE, "Storage Drive");

const TRANSLATION_UI_STORAGE_DRIVE_BODY_BYTES_USED =
  "fluffyalien_asn.ui.storageDrive.body.bytesUsed";
_: _addTranslation(
  TRANSLATION_UI_STORAGE_DRIVE_BODY_BYTES_USED,
  "Bytes used: %s/30000"
);

export function showStorageDriveUi(
  player: Player,
  storageDrive: Block
): Promise<ActionFormResponse> {
  const form = new $.serverUi.ActionFormData();

  form.title({
    rawtext: [
      {
        translate: TRANSLATION_UI_STORAGE_DRIVE_TITLE,
      },
    ],
  });

  form.body({
    rawtext: [
      {
        translate: TRANSLATION_UI_STORAGE_DRIVE_BODY_BYTES_USED,
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
        translate: TRANSLATION_COMMON_UI_OK,
      },
    ],
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
  return form.show(player as any);
}
