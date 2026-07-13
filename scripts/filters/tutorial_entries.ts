/**
 * Generates the BP/scripts/generated/tutorial_entries.js file used by
 * tutorial_book.ts based on the tutorial book entries in RP/texts/en_US.lang.
 *
 * The lang file is parsed by the shared `tutorial_book_lang` module (also used
 * by docgen.ts); see that module for the entry/key format. This filter maps the
 * parsed entries to the compact runtime shape (bullets as a count, since the
 * in-game UI reads the bullet text via translate keys) and writes the file.
 *
 * Must run before the scripts are bundled so the generated file is included.
 */

import * as fs from "fs";
import * as path from "path";
import { parseTutorialBookEntries } from "../tutorial_book_lang_parser.ts";

const NAMESPACE = "fluffyalien_asn";
const ENTRY_KEY_PREFIX = `${NAMESPACE}.ui.tutorialBook.entry.`;
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

const entries: TutorialEntry[] = parseTutorialBookEntries(lang, NAMESPACE).map(
  (entry) => {
    if (entry.icon === "") {
      console.warn(
        `No icon defined for tutorial book entry '${entry.id}'. Add a ` +
          `'## ${ENTRY_KEY_PREFIX}${entry.id}.icon=<texture path>' comment to ${LANG_FILE_PATH}.`,
      );
    }

    return {
      id: entry.id,
      icon: entry.icon,
      bullets: entry.bullets.length,
      targets: entry.targets,
      related: entry.related,
    };
  },
);

if (!fs.existsSync(OUTPUT_DIR_PATH)) {
  fs.mkdirSync(OUTPUT_DIR_PATH, { recursive: true });
}

fs.writeFileSync(
  path.join(OUTPUT_DIR_PATH, OUTPUT_FILE_NAME),
  `export default ${JSON.stringify(entries)};`,
);

console.log(`Generated ${entries.length.toString()} tutorial book entries.`);
