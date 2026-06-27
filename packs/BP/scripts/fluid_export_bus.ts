import { Block, BlockCustomComponent, Player } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { removeAllDynamicPropertiesForBlock } from "./utils/block_dynamic_property";
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
import { DynamicPropertyAccessor } from "./utils/dynamic_property_v3";

const MAX_EXTRACTION_AMOUNT = 10; // Max amount to extract per storage network update

const exportStorageTypeProperty = new DynamicPropertyAccessor<string>(
  "fluffyalien_asn:export_storage_type",
);

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

  const existingStorageType = exportStorageTypeProperty.safeGet(block);

  form.dropdown(
    {
      translate: "fluffyalien_asn.ui.fluidExportBus.storageType",
    },
    ["None", ...storageTypes.map((storageType) => storageType.name)],
    {
      defaultValueIndex: existingStorageType
        ? storageTypes.findIndex(
            (storageType) => storageType.id === existingStorageType,
          ) + 1
        : 0,
    },
  );

  const response = await form.show(player);
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
  if (block.getRedstonePower()) return;

  const storageType = exportStorageTypeProperty.safeGet(block);
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
        exportStorageTypeProperty.set(block);
        return;
      }

      exportStorageTypeProperty.set(block, selectedStorageType.id);
    });
  },
  onBreak(e) {
    removeAllDynamicPropertiesForBlock(e.block);
  },
  onTick(e) {
    updateBlockConnectStates(e.block, STR_DIRECTIONS, (other) =>
      other.hasTag("fluffyalien_energisticscore:machine") ||
      other.hasTag("fluffyalien_energisticscore:conduit")
        ? "bus"
        : other.hasTag("fluffyalien_asn:storage_network_connectable")
          ? "cable"
          : "none",
    );

    const storageType = exportStorageTypeProperty.safeGet(e.block);
    if (!storageType) return;

    generate(e.block, storageType, 0);
  },
};
