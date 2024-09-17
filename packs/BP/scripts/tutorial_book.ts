import { ItemStack, Player, RawMessage, world } from "@minecraft/server";
import { makeMessageUi, showForm } from "./utils/ui";
import { ActionFormData } from "@minecraft/server-ui";

const NOT_FIRST_JOIN_DYNAMIC_PROPERTY_ID = "fluffyalien_asn:not_first_join";

interface TutorialEntry {
  id: string;
  icon: string;
  bullets: number;
}

const TUTORIAL_ENTRIES: TutorialEntry[] = [
  {
    id: "storageNetwork",
    icon: "textures/fluffyalien/asn/ui/tutorial_book/storage_core_icon",
    bullets: 4,
  },
  {
    id: "storageCore",
    icon: "textures/fluffyalien/asn/ui/tutorial_book/storage_core_icon",
    bullets: 3,
  },
  {
    id: "storageCable",
    icon: "textures/fluffyalien/asn/ui/tutorial_book/storage_cable_icon",
    bullets: 1,
  },
  {
    id: "storageDrive",
    icon: "textures/fluffyalien/asn/ui/tutorial_book/storage_drive_icon",
    bullets: 2,
  },
  {
    id: "storageInterface",
    icon: "textures/fluffyalien/asn/ui/tutorial_book/storage_interface_icon",
    bullets: 1,
  },
  {
    id: "importBus",
    icon: "textures/fluffyalien/asn/ui/tutorial_book/import_bus_icon",
    bullets: 2,
  },
  {
    id: "exportBus",
    icon: "textures/fluffyalien/asn/ui/tutorial_book/export_bus_icon",
    bullets: 4,
  },
  {
    id: "levelEmitter",
    icon: "textures/fluffyalien/asn/ui/tutorial_book/level_emitter_icon",
    bullets: 4,
  },
  {
    id: "relay",
    icon: "textures/fluffyalien/asn/ui/tutorial_book/storage_relay_icon",
    bullets: 4,
  },
  {
    id: "powerBank",
    icon: "textures/fluffyalien/asn/ui/tutorial_book/energy_icon",
    bullets: 2,
  },
  {
    id: "wirelessTransmitter",
    icon: "textures/fluffyalien/asn/ui/tutorial_book/wireless_transmitter_icon",
    bullets: 2,
  },
  {
    id: "wirelessInterface",
    icon: "textures/fluffyalien/asn/items/wireless_interface",
    bullets: 3,
  },
  {
    id: "portableStorageNetwork",
    icon: "textures/fluffyalien/asn/items/portable_storage_network_placer",
    bullets: 5,
  },
  {
    id: "storageDisk",
    icon: "textures/fluffyalien/asn/items/storage_disk",
    bullets: 3,
  },
  {
    id: "addonRules",
    icon: "textures/fluffyalien/asn/ui/tutorial_book/storage_core_icon",
    bullets: 3,
  },
  {
    id: "energy",
    icon: "textures/fluffyalien/asn/ui/tutorial_book/energy_icon",
    bullets: 5,
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
  return void showTutorialBookEntryUi(player, entry);
}

async function showTutorialBookEntryUi(
  player: Player,
  entry: TutorialEntry,
): Promise<void> {
  const rawtext: RawMessage[] = [
    { text: "§l§2" },
    {
      translate: `fluffyalien_asn.ui.tutorialBook.entry.${entry.id}.title`,
    },
  ];

  for (let i = 0; i < entry.bullets; i++) {
    rawtext.push({ text: "\n\n§l§2-§r " });
    rawtext.push({
      translate: `fluffyalien_asn.ui.tutorialBook.entry.${entry.id}.bullet${i.toString()}`,
    });
  }

  const form = makeMessageUi(
    { translate: "fluffyalien_asn.ui.tutorialBook.title" },
    { rawtext },
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
