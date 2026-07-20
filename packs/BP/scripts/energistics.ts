import { world } from "@minecraft/server";
import * as bec from "bedrock-energistics-core-api";
import { fluidInterfaceMachine } from "./fluid_interface";
import { fluidImportBusMachine } from "./fluid_import_bus";
import { fluidExportBusMachine } from "./fluid_export_bus";
import { diskUpgraderMachine } from "./disk_upgrader";
import { FLUID_DISK_ITEM_IDS, getFluidDiskCapacity } from "./fluid_disk";

world.afterEvents.worldLoad.subscribe(() => {
  bec.init("fluffyalien_asn");

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

  // Register each fluid disk tier as an item machine so BEC persists its fluids
  // on the item. The disk's fluids are driven by the storage network (see
  // fluid_disk.ts / storage_network.ts), which also keeps the disk lore in sync;
  // maxStorage caps each fluid type at the disk's total capacity, and the
  // fluid+gas IO lets the disk accept non-energy storage when used elsewhere.
  for (const id of FLUID_DISK_ITEM_IDS) {
    bec.registerItemMachine({
      description: {
        id,
        maxStorage: getFluidDiskCapacity(id)!.maxTotal,
        defaultIo: {
          categories: ["fluid", "gas"],
        },
      },
    });
  }

  bec.registerMachine(fluidInterfaceMachine);
  bec.registerMachine(fluidImportBusMachine);
  bec.registerMachine(fluidExportBusMachine);
  bec.registerMachine(diskUpgraderMachine);
});
