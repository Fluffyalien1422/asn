import {
  CommandPermissionLevel,
  CustomCommandStatus,
  Player,
  system,
} from "@minecraft/server";
import {
  loadDataArea,
  loadItemsFromDisk,
  saveItemsToDisk,
  unloadDataArea,
} from "./storage_disk_v3";

async function v3storagetest_save(player: Player): Promise<void> {
  const container = player.getComponent("inventory")!.container;
  const itemSlot = container.getSlot(0);
  const diskSlot = container.getSlot(1);

  (await loadDataArea())._unsafeUnwrap();
  saveItemsToDisk(diskSlot, [itemSlot.getItem()!])._unsafeUnwrap();
  unloadDataArea();
}

async function v3storagetest_load(player: Player): Promise<void> {
  const container = player.getComponent("inventory")!.container;
  const itemSlot = container.getSlot(0);
  const diskSlot = container.getSlot(1);

  (await loadDataArea())._unsafeUnwrap();

  const loadedr = loadItemsFromDisk(diskSlot);
  if (loadedr.isErr()) {
    throw loadedr.error;
  }
  const loaded = loadedr.value;

  itemSlot.setItem(loaded[0]);

  unloadDataArea();
}

system.beforeEvents.startup.subscribe((e) => {
  e.customCommandRegistry.registerCommand(
    {
      name: "fluffyalien_asn:v3storagetest_save",
      description: "v3storagetest_save",
      permissionLevel: CommandPermissionLevel.GameDirectors,
    },
    (e) => {
      system.run(() => {
        void v3storagetest_save(e.sourceEntity as Player);
      });
      return {
        status: CustomCommandStatus.Success,
      };
    },
  );

  e.customCommandRegistry.registerCommand(
    {
      name: "fluffyalien_asn:v3storagetest_load",
      description: "v3storagetest_load",
      permissionLevel: CommandPermissionLevel.GameDirectors,
    },
    (e) => {
      system.run(() => {
        v3storagetest_load(e.sourceEntity as Player);
      });
      return {
        status: CustomCommandStatus.Success,
      };
    },
  );
});
