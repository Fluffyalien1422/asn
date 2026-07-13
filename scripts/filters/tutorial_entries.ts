/**
 * Generates the BP/scripts/generated/tutorial_entries.js file used by
 * tutorial_book.ts based on the tutorial book entries in RP/texts/en_US.lang.
 *
 * Each entry is described entirely by the lang file:
 * - `...entry.<id>.title` / `...entry.<id>.bullet<n>` give the entry order and
 *   the number of bullets.
 * - `...entry.<id>.icon` gives the icon texture path. Icons are not strings shown
 *   in-game, so they are defined in `##` comments (the lang comment marker) to
 *   keep them out of the player-facing strings, e.g.:
 *     ## fluffyalien_asn.ui.tutorialBook.entry.storageCore.icon=textures/...
 * - `...entry.<id>.targets` optionally gives a comma-separated list of block or
 *   entity identifiers the entry documents. Like icons, these are not player-facing
 *   strings, so they are defined in `##` comments, e.g.:
 *     ## fluffyalien_asn.ui.tutorialBook.entry.storageCore.targets=fluffyalien_asn:storage_core
 *
 * Must run before the scripts are bundled so the generated file is included.
 */

import * as fs from "fs";
import * as path from "path";

const ENTRY_KEY_PREFIX = "fluffyalien_asn.ui.tutorialBook.entry.";
const LANG_FILE_PATH = "RP/texts/en_US.lang";
const OUTPUT_DIR_PATH = "BP/scripts/generated";
const OUTPUT_FILE_NAME = "tutorial_entries.js";

interface TutorialEntry {
  id: string;
  icon: string;
  bullets: number;
  targets: string[];
}

const lang = fs.readFileSync(LANG_FILE_PATH, "utf8");
const langLines = lang.split("\n");

// Entry IDs in the order they first appear in the lang file.
const entryOrder: string[] = [];
// Entry ID -> number of bullets (highest bullet index seen + 1).
const bulletCounts = new Map<string, number>();
// Entry ID -> icon texture path (parsed from `##` comments).
const icons = new Map<string, string>();
// Entry ID -> block/entity identifiers the entry documents (parsed from `##`
// comments as a comma-separated list).
const targets = new Map<string, string[]>();

function registerEntry(id: string): void {
  if (bulletCounts.has(id)) return;
  entryOrder.push(id);
  bulletCounts.set(id, 0);
}

for (const rawLine of langLines) {
  // Strip the leading comment marker (##) so icon definitions in comments are
  // parsed the same way as regular keys. Non-comment lines are left untouched.
  const line = rawLine.replace(/^\s*##\s*/, "");

  const [key, value] = line.split(/=(.*)/);
  if (!key.startsWith(ENTRY_KEY_PREFIX)) continue;

  const [id, subKey] = key.slice(ENTRY_KEY_PREFIX.length).split(".");
  registerEntry(id);

  if (subKey === "icon") {
    icons.set(id, value.trim());
    continue;
  }

  if (subKey === "targets") {
    targets.set(
      id,
      value
        .split(",")
        .map((target) => target.trim())
        .filter((target) => target.length > 0),
    );
    continue;
  }

  if (subKey === "title") continue;

  const bulletNum = Number(subKey.slice("bullet".length));
  bulletCounts.set(id, Math.max(bulletCounts.get(id) ?? 0, bulletNum + 1));
}

const entries: TutorialEntry[] = entryOrder.map((id) => {
  const icon = icons.get(id);
  if (icon === undefined) {
    console.warn(
      `No icon defined for tutorial book entry '${id}'. Add a ` +
        `'## ${ENTRY_KEY_PREFIX}${id}.icon=<texture path>' comment to ${LANG_FILE_PATH}.`,
    );
  }

  return {
    id,
    icon: icon ?? "",
    bullets: bulletCounts.get(id) ?? 0,
    targets: targets.get(id) ?? [],
  };
});

if (!fs.existsSync(OUTPUT_DIR_PATH)) {
  fs.mkdirSync(OUTPUT_DIR_PATH, { recursive: true });
}

fs.writeFileSync(
  path.join(OUTPUT_DIR_PATH, OUTPUT_FILE_NAME),
  `export default ${JSON.stringify(entries)};`,
);

console.log(`Generated ${entries.length.toString()} tutorial book entries.`);
