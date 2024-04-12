import { Player } from "@minecraft/server";
import { StorageNetwork } from "../storage_network";
import { ActionFormResponse } from "@minecraft/server-ui";
import { showForm } from "../utils";
import { ActionFormData } from "@minecraft/server-ui";

export function showStorageCoreUi(
  player: Player,
  network: StorageNetwork,
): Promise<ActionFormResponse> {
  const form = new ActionFormData();

  form.title({
    translate: "fluffyalien_asn.ui.storageCore.title",
  });

  form.body({
    rawtext: [
      {
        translate: "fluffyalien_asn.ui.storageCore.body.storageUsed",
        with: {
          rawtext: [
            {
              text: network.getUsedDataLength().toString(),
            },
            {
              text: network.getMaxDataLength().toString(),
            },
          ],
        },
      },
      {
        text: "\n\n",
      },
      {
        translate: "fluffyalien_asn.ui.storageCore.body.connectedInterfaces",
        with: {
          rawtext: [
            {
              text: network
                .getConnections()
                .storageInterfaces.length.toString(),
            },
          ],
        },
      },
      {
        text: "\n\n",
      },
      {
        translate: "fluffyalien_asn.ui.storageCore.body.connectedDrives",
        with: {
          rawtext: [
            {
              text: network.getConnections().storageDrives.length.toString(),
            },
          ],
        },
      },
    ],
  });

  form.button({
    translate: "fluffyalien_asn.ui.common.close",
  });

  return showForm(form, player);
}
