import { MachineDefinition } from "bedrock-energistics-core-api";
import { StorageNetwork } from "./storage_network";
import { BlockCustomComponent } from "@minecraft/server";
import { updateBlockConnectStates } from "./utils/block_connect";
import { STR_DIRECTIONS } from "./utils/direction";
import { receivingRedstoneSignal } from "./utils/block";

export const fluidImportBusMachine: MachineDefinition = {
  description: {
    id: "fluffyalien_asn:fluid_import_bus",
  },
  handlers: {
    async receive(e) {
      if (e.receiveType === "energy") {
        return { amount: 0 };
      }

      const block = e.blockLocation.dimension.getBlock(e.blockLocation)!;
      if (receivingRedstoneSignal(block)) {
        return { amount: 0 };
      }

      const network = StorageNetwork.getNetwork(block);
      if (!network) {
        return { amount: 0 };
      }

      const amountAdded = await network.addFluid(
        e.receiveType,
        e.receiveAmount,
      );

      return {
        amount: amountAdded,
        handleStorage: false,
      };
    },
  },
};

export const fluidImportBusComponent: BlockCustomComponent = {
  onTick(e) {
    updateBlockConnectStates(e.block, STR_DIRECTIONS, (other) =>
      other.hasTag("fluffyalien_energisticscore:machine")
        ? "bus"
        : other.hasTag("fluffyalien_asn:storage_network_connectable")
          ? "cable"
          : "none",
    );
  },
};
