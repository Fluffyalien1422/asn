import { world } from "@minecraft/server";
import * as beCore from "bedrock-energistics-core-api";

beCore.init({ namespace: "fluffyalien_asn" });

world.afterEvents.worldInitialize.subscribe(() => {
  beCore.registerMachine({
    description: {
      id: "fluffyalien_asn:storage_power_bank",
      ui: {
        elements: {
          energyBar: {
            type: "storageBar",
            startIndex: 0,
          },
        },
      },
    },
    handlers: {
      updateUi() {
        return {
          storageBars: [
            {
              element: "energyBar",
              type: "energy",
              change: 0,
            },
          ],
        };
      },
    },
  });

  beCore.registerMachine({
    description: {
      id: "fluffyalien_asn:portable_storage_network",
    },
  });
});
