import { ItemStack, Player, RawMessage, world } from "@minecraft/server";
import { createMessageForm, showForm } from "./utils/ui";
import { ActionFormData } from "@minecraft/server-ui";
import TUTORIAL_ENTRIES, { TutorialEntry } from "./generated/tutorial_entries";

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

  const form = createMessageForm(
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
