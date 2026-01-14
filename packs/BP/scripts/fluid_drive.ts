import {
  Block,
  BlockCustomComponent,
  DimensionLocation,
  ItemStack,
  Player,
  RawMessage,
} from "@minecraft/server";
import { ActionFormData, ActionFormResponse } from "@minecraft/server-ui";
import { makeErrorMessageUi, showForm } from "./utils/ui";
import { RegisteredStorageType } from "bedrock-energistics-core-api";
import {
  getBlockDynamicProperties,
  getBlockDynamicProperty,
  removeAllDynamicPropertiesForBlock,
  setBlockDynamicProperty,
} from "./utils/dynamic_property";
import { NetworkStoredFluids, StorageNetwork } from "./storage_network";
import { getPlayerMainhandSlot } from "./utils/item";

export const FLUID_DRIVE_CAPACITY = 6400;

async function getFluidDriveStorage(
  drive: DimensionLocation,
): Promise<NetworkStoredFluids> {
  let total = 0;
  const types = new Map<string, number>();

  for (const id of await RegisteredStorageType.getAllIds()) {
    const amount = (getBlockDynamicProperty(drive, `fluid${id}`) ??
      0) as number;
    if (amount <= 0) continue;

    total += amount;
    types.set(id, amount);
  }

  return { total, types };
}

async function showFluidDriveUi(
  player: Player,
  drive: Block,
): Promise<ActionFormResponse> {
  const form = new ActionFormData();

  const storage = await getFluidDriveStorage(drive);

  form.title({
    translate: "tile.fluffyalien_asn:fluid_drive.name",
  });

  const storageUsedRawMessages: RawMessage[] = (
    await Promise.all(
      [...storage.types.entries()].map(async ([id, amount]) => [
        {
          translate: "fluffyalien_asn.ui.fluidDrive.body.storageUsed",
          with: {
            rawtext: [
              {
                text: (await RegisteredStorageType.get(id))!.name,
              },
              {
                text: amount.toString(),
              },
              {
                text: Math.floor((amount / storage.total) * 100).toString(),
              },
            ],
          },
        },
        { text: "\n\n" },
      ]),
    )
  ).flat();

  form.body({
    rawtext: [
      ...storageUsedRawMessages,
      {
        translate: "fluffyalien_asn.ui.fluidDrive.body.storageUsedTotal",
        with: {
          rawtext: [
            {
              text: storage.total.toString(),
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

export const fluidDriveComponent: BlockCustomComponent = {
  onPlayerInteract(e) {
    if (!e.player) return;

    const mainHandSlot = getPlayerMainhandSlot(e.player);
    const heldItem = mainHandSlot.getItem();

    if (heldItem?.typeId === "fluffyalien_asn:used_fluid_storage_disk") {
      const existingData = getBlockDynamicProperties(e.block);
      if (existingData.length) {
        void showForm(
          makeErrorMessageUi({
            translate:
              "fluffyalien_asn.ui.storageDrive.error.mustBeEmptyToAddDisk",
          }),
          e.player,
        );

        return;
      }

      const data = heldItem.getDynamicPropertyIds();

      if (data.length) {
        for (const id of data) {
          const value = heldItem.getDynamicProperty(id);
          setBlockDynamicProperty(e.block, id, value);
        }
        // clear the cache so it will be forced to update
        StorageNetwork.getNetwork(e.block)?.clearStoredFluidsCache();
      }

      mainHandSlot.setItem();
      return;
    }

    void showFluidDriveUi(e.player, e.block);
  },
  onPlayerBreak(e) {
    const data = getBlockDynamicProperties(e.block);

    if (data.length) {
      const itemStack = new ItemStack(
        "fluffyalien_asn:used_fluid_storage_disk",
      );
      for (const id of data) {
        const value = getBlockDynamicProperty(e.block, id);
        itemStack.setDynamicProperty(id, value);
      }
      e.block.dimension.spawnItem(itemStack, e.block.location);
    }

    removeAllDynamicPropertiesForBlock(e.block);
  },
};
