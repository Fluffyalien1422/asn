import { Block, BlockCustomComponent, Player } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { showForm } from "./utils/ui";
import {
  getBlockDynamicProperty,
  removeAllDynamicPropertiesForBlock,
  setBlockDynamicProperty,
} from "./utils/dynamic_property";
import {
  generate,
  getMachineStorage,
  MachineDefinition,
  RegisteredStorageType,
  setMachineStorage,
} from "bedrock-energistics-core-api";
import { StorageNetwork } from "./storage_network";
import { updateBlockConnectStates } from "./utils/block_connect";
import { STR_DIRECTIONS } from "./utils/direction";
import { receivingRedstoneSignal } from "./utils/block";

const MAX_EXTRACTION_AMOUNT = 10; // Max amount to extract per storage network update

async function showFluidExportBusUi(
  player: Player,
  block: Block,
): Promise<RegisteredStorageType | "none" | undefined> {
  const form = new ModalFormData();

  form.title({
    translate: "tile.fluffyalien_asn:fluid_export_bus.name",
  });

  const storageTypes: RegisteredStorageType[] = [];
  for (const storageTypeId of await RegisteredStorageType.getAllIds()) {
    if (storageTypeId === "energy") continue; // Energy is not a fluid
    const storageType = await RegisteredStorageType.get(storageTypeId);
    if (storageType) storageTypes.push(storageType);
  }

  const existingStorageType = getBlockDynamicProperty(
    block,
    "fluidExportBusStorageType",
  ) as string | undefined;

  form.dropdown(
    {
      translate: "fluffyalien_asn.ui.fluidExportBus.storageType",
    },
    ["None", ...storageTypes.map((storageType) => storageType.name)],
    existingStorageType
      ? storageTypes.findIndex(
          (storageType) => storageType.id === existingStorageType,
        ) + 1
      : 0,
  );

  const response = await showForm(form, player);
  if (!response.formValues) {
    return;
  }

  const selectedIndex = response.formValues[0] as number;
  if (selectedIndex === 0) {
    return "none";
  }

  return storageTypes[selectedIndex - 1];
}

export async function updateFluidExportBus(
  block: Block,
  network: StorageNetwork,
): Promise<void> {
  if (receivingRedstoneSignal(block)) return;

  const storageType = getBlockDynamicProperty(
    block,
    "fluidExportBusStorageType",
  ) as string | undefined;
  if (!storageType) return;
  if (getMachineStorage(block, storageType)) {
    return;
  }

  const storedFluids = await network.getStoredFluids();
  const stored = storedFluids.types.get(storageType);
  if (!stored) return;
  const amountToExtract = Math.min(stored, MAX_EXTRACTION_AMOUNT);

  void network.removeFluid(storageType, amountToExtract);
  void setMachineStorage(block, storageType, amountToExtract);
}

export const fluidExportBusMachine: MachineDefinition = {
  description: {
    id: "fluffyalien_asn:fluid_export_bus",
  },
};

export const fluidExportBusComponent: BlockCustomComponent = {
  onPlayerInteract(e) {
    if (!e.player) return;
    const block = e.block;
    void showFluidExportBusUi(e.player, block).then((selectedStorageType) => {
      if (selectedStorageType === undefined) return;

      if (selectedStorageType === "none") {
        setBlockDynamicProperty(block, "fluidExportBusStorageType");
        return;
      }

      setBlockDynamicProperty(
        block,
        "fluidExportBusStorageType",
        selectedStorageType.id,
      );
    });
  },
  onPlayerDestroy(e) {
    removeAllDynamicPropertiesForBlock(e.block);
  },
  onTick(e) {
    updateBlockConnectStates(e.block, STR_DIRECTIONS, (other) =>
      other.hasTag("fluffyalien_energisticscore:machine")
        ? "bus"
        : other.hasTag("fluffyalien_asn:storage_network_connectable")
          ? "cable"
          : "none",
    );

    const storageType = getBlockDynamicProperty(
      e.block,
      "fluidExportBusStorageType",
    ) as string | undefined;
    if (!storageType) return;

    generate(e.block, storageType, 0);
  },
};
