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
 * Each entry also gets a `related` array: the IDs of other entries whose title
 * (name) is mentioned in this entry's bullets, ordered by where the mention
 * first appears. This is derived from the bullet text, not defined in the lang
 * file.
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
  related: string[];
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
// Entry ID -> title (display name), used to detect one entry being mentioned in
// another entry's bullets.
const titles = new Map<string, string>();
// Entry ID -> its bullet text, searched for mentions of other entries.
const bulletTexts = new Map<string, string[]>();

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

  if (subKey === "title") {
    titles.set(id, value.trim());
    continue;
  }

  const bulletNum = Number(subKey.slice("bullet".length));
  bulletCounts.set(id, Math.max(bulletCounts.get(id) ?? 0, bulletNum + 1));

  const bullets = bulletTexts.get(id) ?? [];
  bullets.push(value);
  bulletTexts.set(id, bullets);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Matches an entry title as a whole word/phrase, case-insensitively, tolerating
// a trailing plural "s" on either side (so the "Storage Drive" entry is found in
// "storage drives", and the "Storage Disks" entry is found in "storage disk").
function titlePattern(title: string): RegExp {
  const base = escapeRegExp(title.toLowerCase().replace(/s$/, ""));
  return new RegExp(`\\b${base}s?\\b`, "g");
}

// Every entry that has a title, paired with its mention pattern, longest title
// first so a longer name (e.g. "Wireless Storage Interface") claims its span
// before a shorter name nested inside it (e.g. "Storage Interface") is matched.
const namedEntries = entryOrder
  .filter((id) => titles.has(id))
  .map((id) => ({
    id,
    title: titles.get(id)!,
    pattern: titlePattern(titles.get(id)!),
  }))
  .sort((a, b) => b.title.length - a.title.length);

// Entry ID -> IDs of other entries mentioned by name in its bullets.
const related = new Map<string, string[]>();

for (const id of entryOrder) {
  const text = (bulletTexts.get(id) ?? []).join("\n").toLowerCase();
  // Character ranges already claimed by a longer name, so a shorter name nested
  // inside one isn't counted as a separate mention.
  const claimed: [number, number][] = [];
  const mentions: { relatedId: string; start: number }[] = [];

  for (const candidate of namedEntries) {
    if (candidate.id === id) continue;

    candidate.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = candidate.pattern.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (claimed.some(([s, e]) => start >= s && end <= e)) continue;
      claimed.push([start, end]);
      mentions.push({ relatedId: candidate.id, start });
    }
  }

  // Unique related IDs, ordered by where each is first mentioned.
  mentions.sort((a, b) => a.start - b.start);
  const seen = new Set<string>();
  const relatedIds: string[] = [];
  for (const mention of mentions) {
    if (seen.has(mention.relatedId)) continue;
    seen.add(mention.relatedId);
    relatedIds.push(mention.relatedId);
  }
  related.set(id, relatedIds);
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
    related: related.get(id) ?? [],
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
