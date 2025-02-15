import { world } from "@minecraft/server";
import * as bec from "bedrock-energistics-core-api";

bec.init("fluffyalien_asn");

world.afterEvents.worldInitialize.subscribe(() => {
  bec.registerMachine({
    description: {
      id: "fluffyalien_asn:storage_power_bank",
      ui: {
        elements: {
          energyBar: {
            type: "storageBar",
            startIndex: 0,
            defaults: {
              type: "energy",
            },
          },
        },
      },
    },
  });

  bec.registerMachine({
    description: {
      id: "fluffyalien_asn:portable_storage_network",
    },
  });

  bec.registerItemMachine({
    description: {
      id: "fluffyalien_asn:wireless_interface",
      defaultIo: {
        categories: ["energy"],
      },
    },
    events: {
      onStorageSet(e) {
        if (e.type !== "energy") return;

        const containerSlot = e.itemMachine.getContainerSlot();
        containerSlot.setLore([`§e${e.value.toString()}/6400 energy`]);
      },
    },
  });

  bec.registerMachine({
    description: {
      id: "fluffyalien_asn:fluid_interface",
      ui: {
        elements: {
          bar1: {
            type: "storageBar",
            startIndex: 0,
          },
          bar2: {
            type: "storageBar",
            startIndex: 4,
          },
          bar3: {
            type: "storageBar",
            startIndex: 8,
          },
          bar4: {
            type: "storageBar",
            startIndex: 12,
          },
          bar5: {
            type: "storageBar",
            startIndex: 16,
          },
        },
      },
    },
  });
});
