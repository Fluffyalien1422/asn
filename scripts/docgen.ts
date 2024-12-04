/**
 * - Generates documentation (for CurseForge) based on the files in `docgen_config/`
 * - See the `Config` interface for the schema for `docgen_config/config.json`
 * - `docgen_config/content_start.html` and `docgen_config/content_end.html`
 * can also be used to add custom content to the generated documentation.
 * - Requires simple manifest.
 */

import * as fs from "fs";

interface SimpleManifest {
  version: [number, number, number];
  minEngineVersion: [number, number, number];
}

interface Config {
  namespace: string;
  /**
   * An HTML string. Used inside a `p` element.
   */
  briefDescription: string;
  issueTrackerUrl?: string;
  issueTrackerAllowsFeatureRequests?: boolean;
  requiresBetaApis?: boolean;
  /**
   * @default true
   */
  includeFollowX?: boolean;
  theme: {
    /**
     * Any CSS color value.
     */
    secondaryBackgroundColor: string;
    /**
     * Any CSS color value.
     */
    secondaryForegroundColor: string;
  };
}

const CONTENT_START_FILE_PATH = "docgen_config/content_start.html";
const CONTENT_END_FILE_PATH = "docgen_config/content_end.html";

const simpleManifest = JSON.parse(
  fs.readFileSync("packs/data/simple_manifest.json", "utf8"),
) as SimpleManifest;

const config = JSON.parse(
  fs.readFileSync("docgen_config/config.json", "utf8"),
) as Config;

const contentStart = fs.existsSync(CONTENT_START_FILE_PATH)
  ? fs.readFileSync(CONTENT_START_FILE_PATH, "utf8")
  : "";

const contentEnd = fs.existsSync(CONTENT_END_FILE_PATH)
  ? fs.readFileSync(CONTENT_END_FILE_PATH, "utf8")
  : "";

function createTagSpan(text: string): string {
  return `<span style="
    background-color: ${config.theme.secondaryBackgroundColor};
    color: ${config.theme.secondaryForegroundColor};
    padding: 2px 5px;
    border-radius: 4px;
  ">${text}</span>`;
}

function makeButton(url: string, content: string): string {
  return `<a href="${url}" style="
    background-color: ${config.theme.secondaryBackgroundColor};
    color: ${config.theme.secondaryForegroundColor};
    display: inline-flex;
    align-items: center;
    padding: 5px;
    border-radius: 5px;
  ">${content}</a>`;
}

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/>/g, "&gt;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

const texts = fs.readFileSync("packs/RP/texts/en_US.lang", "utf8");
const textsLines = texts.split("\n");

interface Entry {
  title: string;
  bullets: string[];
}

const entries: Record<string, Entry> = {};

function setEntryTitle(id: string, title: string): void {
  if (id in entries) {
    entries[id].title = title;
    return;
  }

  entries[id] = {
    title,
    bullets: [],
  };
}

function addBulletToEntry(
  id: string,
  bulletNum: number,
  bulletValue: string,
): void {
  if (id in entries) {
    entries[id].bullets[bulletNum] = bulletValue;
    return;
  }

  const bullets = [];
  bullets[bulletNum] = bulletValue;

  entries[id] = {
    title: "NO TITLE",
    bullets,
  };
}

for (const line of textsLines) {
  const [key, value] = line.split(/=(.*)/);
  if (!key.startsWith(`${config.namespace}.ui.tutorialBook.entry.`)) {
    continue;
  }

  const [entryId, entrySubKey] = key
    .slice(`${config.namespace}.ui.tutorialBook.entry.`.length)
    .split(".");

  if (entrySubKey === "title") {
    setEntryTitle(entryId, value);
    continue;
  }

  const bulletNum = Number(entrySubKey.slice("bullet".length));
  addBulletToEntry(entryId, bulletNum, value);
}

let generatedContentStart = `<p>${createTagSpan("NOTE")}
    The following documentation is for
    v${simpleManifest.version[0].toString()}.${simpleManifest.version[1].toString()}.x.
    It may not be updated immediately.
    Refer to the in-game tutorial book if the following documentation is outdated.
  </p>
  <p>${config.briefDescription}</p>
  <p>${createTagSpan("NOTE")}
    Requires Minecraft v${simpleManifest.minEngineVersion[0].toString()}.${simpleManifest.minEngineVersion[1].toString()}.${
      config.requiresBetaApis
        ? `${simpleManifest.minEngineVersion[2].toString().slice(0, -1)}x`
        : `${simpleManifest.minEngineVersion[2].toString()}+`
    }.
  </p>`;

if (config.requiresBetaApis) {
  generatedContentStart += `<p>${createTagSpan("NOTE")}
      Enable Beta APIs under Experiments in world settings.
    </p>
    <p>${createTagSpan("NOTE")}
      No official realms support.
    </p>`;
}

if (config.issueTrackerUrl) {
  if (config.issueTrackerAllowsFeatureRequests) {
    generatedContentStart += `<h2>Found a Bug? Have an Idea?</h2>
      <p>Report bugs or suggest ideas on the <a href="${config.issueTrackerUrl}">issue tracker</a>.</p>`;
  } else {
    generatedContentStart += `<h2>Found a Bug?</h2>
      <p>Report bugs on the <a href="${config.issueTrackerUrl}">issue tracker</a>.</p>`;
  }
}

let generatedContentEnd = "";

if (config.includeFollowX ?? true) {
  generatedContentEnd += makeButton(
    "https://x.com/Fluffyalien1422",
    `<svg style="width:27px;height:27px;margin-right:5px;padding:2px;"><g><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></g></svg>
    <span>Follow on X</span>`,
  );
}

const tutorialBookContent = Object.values(entries)
  .map(
    (entry) =>
      `<h2>${htmlEscape(entry.title)}</h2><div class="spoiler"><ul><li>${entry.bullets.map(htmlEscape).join("</li><li>")}</li></ul></div>`,
  )
  .join("");

fs.writeFileSync(
  "cfpost.html",
  generatedContentStart +
    contentStart +
    tutorialBookContent +
    contentEnd +
    generatedContentEnd,
);
