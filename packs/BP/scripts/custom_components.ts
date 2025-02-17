import { world } from "@minecraft/server";
import { storageInterfaceComponent } from "./storage_interface";
import { storageDriveComponent } from "./storage_drive";
import { storageCoreComponent } from "./storage_core";
import { storageCableComponent } from "./cable";
import { levelEmitterComponent } from "./level_emitter";
import { importBusComponent } from "./import_bus";
import { exportBusComponent } from "./export_bus";
import { storageRelayComponent } from "./relay";
import { storagePowerBankComponent } from "./power_bank";
import {
  portableStorageNetworkComponent,
  portableStorageNetworkPlacerComponent,
} from "./portable_storage_network";
import { wirelessTransmitterComponent } from "./wireless_transmitter";
import { networkDeviceComponent } from "./network_device_component";
import { fluidDriveComponent } from "./fluid_drive";
import { fluidInterfaceComponent } from "./fluid_interface";

world.beforeEvents.worldInitialize.subscribe((e) => {
  e.blockComponentRegistry.registerCustomComponent(
    "fluffyalien_asn:network_device",
    networkDeviceComponent,
  );

  e.blockComponentRegistry.registerCustomComponent(
    "fluffyalien_asn:storage_interface",
    storageInterfaceComponent,
  );

  e.blockComponentRegistry.registerCustomComponent(
    "fluffyalien_asn:storage_drive",
    storageDriveComponent,
  );

  e.blockComponentRegistry.registerCustomComponent(
    "fluffyalien_asn:storage_core",
    storageCoreComponent,
  );

  e.blockComponentRegistry.registerCustomComponent(
    "fluffyalien_asn:storage_cable",
    storageCableComponent,
  );

  e.blockComponentRegistry.registerCustomComponent(
    "fluffyalien_asn:level_emitter",
    levelEmitterComponent,
  );

  e.blockComponentRegistry.registerCustomComponent(
    "fluffyalien_asn:import_bus",
    importBusComponent,
  );

  e.blockComponentRegistry.registerCustomComponent(
    "fluffyalien_asn:export_bus",
    exportBusComponent,
  );

  e.blockComponentRegistry.registerCustomComponent(
    "fluffyalien_asn:storage_relay",
    storageRelayComponent,
  );

  e.blockComponentRegistry.registerCustomComponent(
    "fluffyalien_asn:storage_power_bank",
    storagePowerBankComponent,
  );

  e.blockComponentRegistry.registerCustomComponent(
    "fluffyalien_asn:portable_storage_network",
    portableStorageNetworkComponent,
  );

  e.blockComponentRegistry.registerCustomComponent(
    "fluffyalien_asn:wireless_transmitter",
    wirelessTransmitterComponent,
  );

  e.blockComponentRegistry.registerCustomComponent(
    "fluffyalien_asn:fluid_drive",
    fluidDriveComponent,
  );

  e.blockComponentRegistry.registerCustomComponent(
    "fluffyalien_asn:fluid_interface",
    fluidInterfaceComponent,
  );

  e.itemComponentRegistry.registerCustomComponent(
    "fluffyalien_asn:portable_storage_network_placer",
    portableStorageNetworkPlacerComponent,
  );
});
