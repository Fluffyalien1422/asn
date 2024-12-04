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

interface Dependency {
  name: string;
  description?: string;
  optional?: boolean;
  mcpedlUrl?: string;
  cfUrl?: string;
}

interface Config {
  namespace: string;
  /**
   * An HTML string. Used inside a `p` element.
   */
  briefDescription: string;
  /**
   * An array of HTML strings. Each one is used inside a `p` element.
   */
  notes?: string[];
  dependencies?: Dependency[];
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
    secondaryColor: string;
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

function makeTag(color: string, text: string): string {
  return `<span style="color:${color}"><strong>${text}</strong></span>`;
}

function makeThemeTag(text: string): string {
  return makeTag(config.theme.secondaryColor, text);
}

function makeButton(color: string, url: string, text: string): string {
  return `<a href="${url}" style="color:${color};"><strong>${text}</strong></a>`;
}

function makeThemeButton(url: string, text: string): string {
  return makeButton(config.theme.secondaryColor, url, text);
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

let generatedContentStart = `<p>${makeThemeTag("NOTE")}
    The following documentation is for
    v${simpleManifest.version[0].toString()}.${simpleManifest.version[1].toString()}.x.
    It may not be updated immediately.
    Refer to the in-game tutorial book if the following documentation is outdated.
  </p>
  <p>${config.briefDescription}</p>
  <p>${makeThemeTag("NOTE")}
    Requires Minecraft v${simpleManifest.minEngineVersion[0].toString()}.${simpleManifest.minEngineVersion[1].toString()}.${
      config.requiresBetaApis
        ? `${simpleManifest.minEngineVersion[2].toString().slice(0, -1)}x`
        : `${simpleManifest.minEngineVersion[2].toString()} or later` // plus signs are replaced by whitespace on MCPEDL for somer reason
    }.
  </p>`;

const notes = [];

if (config.requiresBetaApis) {
  notes.push(
    "Enable Beta APIs under Experiments in world settings.",
    "No official realms support.",
  );
}

if (config.notes) {
  notes.push(...config.notes);
}

generatedContentStart += notes
  .map((note) => `<p>${makeThemeTag("NOTE")} ${note}</p>`)
  .join("");

if (config.issueTrackerUrl) {
  if (config.issueTrackerAllowsFeatureRequests) {
    generatedContentStart += `<h2>Found a Bug? Have an Idea?</h2>
      <p>Report bugs or suggest ideas on the <a href="${config.issueTrackerUrl}">issue tracker</a>.</p>`;
  } else {
    generatedContentStart += `<h2>Found a Bug?</h2>
      <p>Report bugs on the <a href="${config.issueTrackerUrl}">issue tracker</a>.</p>`;
  }
}

if (config.dependencies) {
  generatedContentStart +=
    "<h2>Dependencies</h2>" +
    config.dependencies
      .map((dependency) => {
        let content = `<span><strong>${dependency.name}</strong> </span>`;

        if (dependency.optional) {
          content += makeTag("green", "OPTIONAL");
        } else {
          content += makeTag("red", "REQUIRED");
        }

        if (dependency.description) {
          content += `<p>${dependency.description}</p>`;
        }

        content += "<ul>";

        if (dependency.mcpedlUrl) {
          content +=
            "<li>" +
            makeButton("#2d730a", dependency.mcpedlUrl, "Download on MCPEDL") +
            "</li>";
        }

        if (dependency.cfUrl) {
          content +=
            "<li>" +
            makeButton("#f16436", dependency.cfUrl, "Download on CurseForge") +
            "</li>";
        }

        content += "</ul>";

        return content;
      })
      .join("");
}

let generatedContentEnd = "";

if (config.includeFollowX ?? true) {
  generatedContentEnd += makeThemeButton(
    "https://x.com/Fluffyalien1422",
    "Follow on X",
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
