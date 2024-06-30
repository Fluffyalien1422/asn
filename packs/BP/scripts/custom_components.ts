import { world } from "@minecraft/server";
import { storageInterfaceComponent } from "./storage_interface";
import { storageDriveComponent } from "./storage_drive";
import { storageCoreComponent } from "./storage_core";
import { storageCableComponent } from "./cable";
import { levelEmitterComponent } from "./level_emitter";
import { importBusComponent } from "./import_bus";
import { exportBusComponent } from "./export_bus";
import { storageRelayComponent } from "./relay";

world.beforeEvents.worldInitialize.subscribe((e) => {
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
});
