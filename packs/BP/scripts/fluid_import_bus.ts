import { MachineDefinition } from "bedrock-energistics-core-api";
import { StorageNetwork } from "./storage_network";
import { Block } from "@minecraft/server";

export const fluidImportBusMachine: MachineDefinition = {
  description: {
    id: "fluffyalien_asn:fluid_import_bus",
  },
  handlers: {
    async receive(e) {
      if (e.receiveType === "energy") {
        return { amount: 0 };
      }

      const block = e.blockLocation.dimension.getBlock(
        e.blockLocation,
      ) as Block;
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
