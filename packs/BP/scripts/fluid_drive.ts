import {
  Block,
  BlockCustomComponent,
  DimensionLocation,
  Player,
  RawMessage,
} from "@minecraft/server";
import { ActionFormData, ActionFormResponse } from "@minecraft/server-ui";
import { showForm } from "./utils/ui";
import {
  getMachineStorage,
  MachineDefinition,
  RegisteredStorageType,
} from "bedrock-energistics-core-api";

const FLUID_DRIVE_MAX_CAPACITY = 6400;

interface FluidDriveStorageData {
  total: number;
  types: [string, number][];
}

async function getFluidDriveStorage(
  drive: DimensionLocation,
): Promise<FluidDriveStorageData> {
  let total = 0;

  const types = (await RegisteredStorageType.getAllIds())
    .map((id): [string, number] | undefined => {
      // @ts-expect-error incompatible DimensionLocation
      const amount = getMachineStorage(drive, id);
      if (amount <= 0) return;

      total += amount;

      return [id, amount];
    })
    .filter((v) => v !== undefined);

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
      storage.types.map(async ([id, amount]) => [
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

    void showFluidDriveUi(e.player, e.block);
  },
};

export const fluidDriveMachine: MachineDefinition = {
  description: {
    id: "fluffyalien_asn:fluid_drive",
  },
  handlers: {
    async receive(e) {
      if (e.receiveType === "energy") return { amount: 0 };

      // @ts-expect-error incompatible DimensionLocation
      const stored = await getFluidDriveStorage(e.blockLocation);
      const availableStorage = Math.max(
        FLUID_DRIVE_MAX_CAPACITY - stored.total,
        0,
      );
      const recievable = Math.min(availableStorage, e.receiveAmount);

      return { amount: recievable };
    },
  },
};
