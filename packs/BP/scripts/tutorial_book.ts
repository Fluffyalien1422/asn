import {
  Block,
  Entity,
  ItemStack,
  Player,
  RawMessage,
  system,
  world,
} from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import TUTORIAL_ENTRIES, { TutorialEntry } from "./generated/tutorial_entries";
import { CONFIG } from "./config_manager";

const NOT_FIRST_JOIN_DYNAMIC_PROPERTY_ID = "fluffyalien_asn:not_first_join";

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

  const response = await form.show(player);
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

  const form = new ActionFormData()
    .title({ translate: "fluffyalien_asn.ui.tutorialBook.title" })
    .body({ rawtext });

  const relatedEntries: TutorialEntry[] = [];
  for (const related of entry.related) {
    const relatedEntry = TUTORIAL_ENTRIES.find((ent) => ent.id === related);
    if (!relatedEntry) continue;
    relatedEntries.push(relatedEntry);
    form.button(
      {
        translate: `fluffyalien_asn.ui.tutorialBook.entry.${relatedEntry.id}.title`,
      },
      relatedEntry.icon,
    );
  }

  form.button({
    translate: "fluffyalien_asn.ui.common.close",
  });

  const response = await form.show(player);
  if (
    response.selection !== undefined &&
    response.selection < relatedEntries.length
  ) {
    return void showTutorialBookEntryUi(
      player,
      relatedEntries[response.selection],
    );
  }
}

world.afterEvents.playerSpawn.subscribe((e) => {
  if (
    !CONFIG.giveTutorialBookOnSpawn ||
    !e.initialSpawn ||
    e.player.getDynamicProperty(NOT_FIRST_JOIN_DYNAMIC_PROPERTY_ID)
  ) {
    return;
  }

  e.player.setDynamicProperty(NOT_FIRST_JOIN_DYNAMIC_PROPERTY_ID, true);
  e.player.dimension.spawnItem(
    new ItemStack("fluffyalien_asn:tutorial_book"),
    e.player.location,
  );
});

world.afterEvents.itemUse.subscribe((e) => {
  if (e.itemStack.typeId !== "fluffyalien_asn:tutorial_book") return;

  void showTutorialBookUi(e.source);
});

function onPlayerInteractEvent(
  player: Player,
  target: Block | Entity,
  itemStack?: ItemStack,
): boolean {
  if (
    itemStack?.typeId !== "fluffyalien_asn:tutorial_book" ||
    !target.typeId.startsWith("fluffyalien_asn:")
  ) {
    return false;
  }

  const entry = TUTORIAL_ENTRIES.find((ent) =>
    ent.targets.includes(target.typeId),
  );
  if (!entry) return false;

  system.run(() => {
    void showTutorialBookEntryUi(player, entry);
  });
  return true;
}

world.beforeEvents.playerInteractWithBlock.subscribe((e) => {
  if (onPlayerInteractEvent(e.player, e.block, e.itemStack)) {
    e.cancel = true;
  }
});

world.beforeEvents.playerInteractWithEntity.subscribe((e) => {
  if (onPlayerInteractEvent(e.player, e.target, e.itemStack)) {
    e.cancel = true;
  }
});
