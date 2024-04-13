import { ItemStack, Player, world } from "@minecraft/server";
import { makeMessageUi, showForm } from "./utils";
import { ActionFormData } from "@minecraft/server-ui";

const NOT_FIRST_JOIN_DYNAMIC_PROPERTY_ID = "fluffyalien_asn:not_first_join";

interface TutorialEntry {
  id: string;
  icon: string;
}

const TUTORIAL_ENTRIES: TutorialEntry[] = [
  {
    id: "storageNetwork",
    icon: "textures/fluffyalien/asn/ui/tutorial_book/storage_core_icon",
  },
  {
    id: "storageCore",
    icon: "textures/fluffyalien/asn/ui/tutorial_book/storage_core_icon",
  },
  {
    id: "storageCable",
    icon: "textures/fluffyalien/asn/ui/tutorial_book/storage_cable_icon",
  },
  {
    id: "storageDrive",
    icon: "textures/fluffyalien/asn/ui/tutorial_book/storage_drive_icon",
  },
  {
    id: "storageInterface",
    icon: "textures/fluffyalien/asn/ui/tutorial_book/storage_interface_icon",
  },
  {
    id: "importBus",
    icon: "textures/fluffyalien/asn/ui/tutorial_book/import_bus_icon",
  },
  {
    id: "exportBus",
    icon: "textures/fluffyalien/asn/ui/tutorial_book/export_bus_icon",
  },
  // {
  //   id: "levelEmitter",
  //   icon: "textures/fluffyalien/asn/ui/tutorial_book/import_bus_icon",
  // },
  {
    id: "storageDisk",
    icon: "textures/fluffyalien/asn/items/storage_disk",
  },
  {
    id: "storageCrystal",
    icon: "textures/fluffyalien/asn/items/storage_crystal",
  },
];

export async function showTutorialBookUi(player: Player): Promise<void> {
  const form = new ActionFormData();

  form.title({ translate: "fluffyalien_asn.ui.tutorialBook.title" });

  for (const entry of TUTORIAL_ENTRIES) {
    form.button(
      {
        translate: `fluffyalien_asn.ui.tutorialBook.entry.${entry.id}.title`,
      },
      entry.icon,
    );
  }

  const response = await showForm(form, player);
  if (response.selection === undefined) return;

  const entry = TUTORIAL_ENTRIES[response.selection];
  return void showTutorialBookEntryUi(player, entry.id);
}

async function showTutorialBookEntryUi(
  player: Player,
  entryId: string,
): Promise<void> {
  const form = makeMessageUi(
    { translate: "fluffyalien_asn.ui.tutorialBook.title" },
    { translate: `fluffyalien_asn.ui.tutorialBook.entry.${entryId}.body` },
  );

  await showForm(form, player);
  return showTutorialBookUi(player);
}

world.afterEvents.playerSpawn.subscribe((e) => {
  if (
    !e.initialSpawn ||
    e.player.getDynamicProperty(NOT_FIRST_JOIN_DYNAMIC_PROPERTY_ID)
  )
    return;

  e.player.setDynamicProperty(NOT_FIRST_JOIN_DYNAMIC_PROPERTY_ID, true);

  const tutorialBook = new ItemStack("fluffyalien_asn:tutorial_book");
  e.player.dimension.spawnItem(tutorialBook, e.player.location);
});

world.afterEvents.itemUse.subscribe((e) => {
  if (e.itemStack.typeId !== "fluffyalien_asn:tutorial_book") return;

  void showTutorialBookUi(e.source);
});
