import { Player } from "@minecraft/server";
import { StorageNetwork } from "./storage_network";
import { showForm } from "./utils/ui";
import { ActionFormResponse } from "@minecraft/server-ui";
import { _addTerrainTexture } from "./terrain_texture";

export const STORAGE_CORE_BLOCK_TYPE_ID = "fluffyalien_asn:storage_core";

$.server.world.afterEvents.playerPlaceBlock.subscribe((e) => {
  if (e.block.typeId !== STORAGE_CORE_BLOCK_TYPE_ID) return;

  StorageNetwork.updateConnectableNetworks(e.block);
});

$.server.world.afterEvents.playerBreakBlock.subscribe((e) => {
  if (e.brokenBlockPermutation.type.id !== STORAGE_CORE_BLOCK_TYPE_ID) return;

  StorageNetwork.getNetwork(e.block)?.destroy();
});

function showStorageCoreUi(
  player: Player,
  network: StorageNetwork
): Promise<ActionFormResponse> {
  const form = new $.serverUi.ActionFormData();

  form.title({
    rawtext: [
      {
        translate: "fluffyalien_asn.ui.storageCore.title",
      },
    ],
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
    rawtext: [
      {
        translate: "fluffyalien_asn.ui.common.close",
      },
    ],
  });

  return showForm(form, player);
}

let lastPlayerInteractWithBlockTriggerTick = 0;
$.server.world.afterEvents.playerInteractWithBlock.subscribe((e) => {
  if (
    e.block.typeId !== STORAGE_CORE_BLOCK_TYPE_ID ||
    e.player.isSneaking ||
    lastPlayerInteractWithBlockTriggerTick + 5 > $.server.system.currentTick
  )
    return;

  lastPlayerInteractWithBlockTriggerTick = $.server.system.currentTick;

  const networkResult = StorageNetwork.getOrEstablishNetwork(e.block);
  if (!networkResult.success) {
    throw new Error(
      "(storage_core.ts:playerInteractWithBlock) Could not get or establish network."
    );
  }

  const network = networkResult.value;

  void showStorageCoreUi(e.player, network);
});

_: _addTerrainTexture(
  "fluffyalien_asn:storage_core",
  "textures/fluffyalien/asn/storage_core"
);
_.define.block({
  format_version: "1.20.80",
  "minecraft:block": {
    description: {
      identifier: STORAGE_CORE_BLOCK_TYPE_ID,
      menu_category: {
        category: "items",
      },
    },
    components: {
      //@ts-expect-error no tag
      "tag:fluffyalien_asn:storage_cable_connectable": {},

      "minecraft:geometry": "minecraft:geometry.full_block",
      "minecraft:material_instances": {
        "*": {
          texture: "fluffyalien_asn:storage_core",
        },
      },
      "minecraft:on_interact": {
        event: "fluffyalien_asn:empty",
      },
      "minecraft:destructible_by_explosion": false,
      "minecraft:destructible_by_mining": {
        seconds_to_destroy: 1,
      },
    },
    events: {
      "fluffyalien_asn:empty": {},
    },
  },
});
