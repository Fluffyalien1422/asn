/**
 * Shared parser for the tutorial book entries defined in the resource pack's
 * `en_US.lang` file. Used by both the `tutorial_entries` build filter (which
 * generates the in-game book data) and `docgen.ts` (which generates the online
 * book), so the two stay in sync.
 *
 * Each entry is described by lang keys under
 * `<namespace>.ui.tutorialBook.entry.<id>.*`:
 * - `.title` / `.bullet<n>` are the player-facing strings (and set entry order).
 * - `.icon` (a `##` comment) is the icon texture path.
 * - `.targets` (a `##` comment) is a comma-separated list of block/entity IDs.
 *
 * `related` is derived, not read from the lang file: the IDs of other entries
 * whose title (name) is mentioned in this entry's bullets.
 */

export interface TutorialBookEntry {
  id: string;
  title: string;
  /**
   * Icon texture path as written in the lang file, e.g.
   * `textures/fluffyalien/asn/block_renders/storage_core`. Empty if none.
   */
  icon: string;
  /** Block/entity identifiers this entry documents (from its `.targets` comment). */
  targets: string[];
  /** Bullet text in index order. Sparse if bullet indices are non-contiguous. */
  bullets: string[];
  /**
   * IDs of other entries mentioned by name in this entry's bullets, ordered by
   * where the mention first appears.
   */
  related: string[];
}

/** Parses tutorial book entries from lang file content, in first-seen order. */
export function parseTutorialBookEntries(
  lang: string,
  namespace: string,
): TutorialBookEntry[] {
  const prefix = `${namespace}.ui.tutorialBook.entry.`;

  // Entry ID -> entry, in first-seen order (Map preserves insertion order).
  const entries = new Map<string, TutorialBookEntry>();

  function getOrCreate(id: string): TutorialBookEntry {
    let entry = entries.get(id);
    if (entry === undefined) {
      entry = { id, title: id, icon: "", targets: [], bullets: [], related: [] };
      entries.set(id, entry);
    }
    return entry;
  }

  for (const rawLine of lang.split("\n")) {
    // Strip the leading comment marker (##) so icon/targets definitions in
    // comments are parsed the same way as regular keys.
    const line = rawLine.replace(/^\s*##\s*/, "");

    const [key, value] = line.split(/=(.*)/);
    if (!key.startsWith(prefix)) continue;

    const [id, subKey] = key.slice(prefix.length).split(".");
    const entry = getOrCreate(id);

    if (subKey === "icon") {
      entry.icon = value.trim();
    } else if (subKey === "targets") {
      entry.targets = value
        .split(",")
        .map((target) => target.trim())
        .filter((target) => target.length > 0);
    } else if (subKey === "title") {
      entry.title = value.trim();
    } else if (subKey.startsWith("bullet")) {
      entry.bullets[Number(subKey.slice("bullet".length))] = value;
    }
  }

  const list = [...entries.values()];
  computeRelated(list);
  return list;
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

/**
 * Fills in each entry's `related` list: the IDs of other entries whose title is
 * mentioned in its bullets, ordered by where the mention first appears.
 */
function computeRelated(entries: TutorialBookEntry[]): void {
  // Every entry paired with its mention pattern, longest title first so a longer
  // name (e.g. "Wireless Storage Interface") claims its span before a shorter
  // name nested inside it (e.g. "Storage Interface") is matched.
  const candidates = entries
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      pattern: titlePattern(entry.title),
    }))
    .sort((a, b) => b.title.length - a.title.length);

  for (const entry of entries) {
    const text = Object.values(entry.bullets).join("\n").toLowerCase();
    // Character ranges already claimed by a longer name, so a shorter name
    // nested inside one isn't counted as a separate mention.
    const claimed: [number, number][] = [];
    const mentions: { relatedId: string; start: number }[] = [];

    for (const candidate of candidates) {
      if (candidate.id === entry.id) continue;

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
    for (const mention of mentions) {
      if (seen.has(mention.relatedId)) continue;
      seen.add(mention.relatedId);
      entry.related.push(mention.relatedId);
    }
  }
}
