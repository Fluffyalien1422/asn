/**
 * Generates a static site for the online tutorial book.
 *
 * The site recreates the in-game tutorial book:
 * - A "book" window with a list of entries, each with its icon and title.
 * - Selecting an entry shows its content (green title, white bullets), exactly
 *   like the in-game `ActionFormData` message form.
 * - Each entry also links to its related entries (as icon + title buttons),
 *   like the in-game book.
 *
 * View switching is driven by a small script: entry links use `?entry=<id>`
 * query strings updated via `history.pushState`, so following a link shows the
 * matching entry without ever scrolling the page. Each entry is deep-linkable
 * at `?entry=<id>`, and the browser's back/forward buttons work.
 *
 * Content comes from the same sources as the in-game book:
 * - `RP/texts/en_US.lang`, parsed by the shared `tutorial_book_lang` module (the
 *   same one the `tutorial_entries` filter uses), including the `##`-comment icon
 *   and targets definitions and the derived related entries.
 * - Icon textures are copied out of `RP/textures/` into `site/icons/`.
 *
 * Config lives in `docgen.json` (see the `SiteConfig` interface).
 *
 * Run with `npm run docgen`.
 */

import * as fs from "fs";
import * as path from "path";
import {
  parseTutorialBookEntries,
  type TutorialBookEntry,
} from "./tutorial_book_lang_parser.ts";

interface SimpleManifest {
  version: [number, number, number];
  minEngineVersion: [number, number, number];
}

interface OnlineEntry {
  /** Unique id; used for the deep-link hash and the copied icon filename. */
  id: string;
  title: string;
  /**
   * Icon texture path relative to the resource pack (same convention as the
   * in-game entries), e.g. `textures/fluffyalien/asn/block_renders/storage_core`.
   * Omit for no icon.
   */
  icon?: string;
  bullets: string[];
}

interface DownloadLink {
  /** Display name for the button, e.g. "Download from CurseForge". */
  name: string;
  /** URL the button links to. */
  url: string;
}

interface Dependency {
  /** Display name, including version, e.g. "Bedrock Energistics Core v0.12.0". */
  name: string;
  /** URL to download the dependency. */
  url: string;
}

interface SiteConfig {
  /** Add-on namespace, used to find the tutorial book keys in the lang file. */
  namespace: string;
  /** Browser tab title and footer heading. */
  siteTitle: string;
  /** Plain-text blurb shown in the footer. */
  description: string;
  /** Link/browser theme color (any CSS color). Used for footer links and `theme-color`. */
  themeColor: string;
  /** Color of the entry titles and bullet markers (any CSS color). */
  accentColor: string;
  /** Optional link to the source repository. */
  repoUrl?: string;
  /** Optional link to the issue tracker. */
  issueTrackerUrl?: string;
  /**
   * Optional dependencies, each with a display name (including version) and a
   * download link. Shown above the add-on download links.
   */
  dependencies?: Dependency[];
  /**
   * Optional download links, each with its own display name. Shown as buttons
   * in the footer in the order listed.
   */
  downloadLinks?: DownloadLink[];
  /** Optional link to all changelogs. */
  changelogsUrl?: string;
  /**
   * Extra entries shown only on the online tutorial book (not in-game).
   * Appended after the in-game entries in the order listed.
   */
  onlineEntries?: OnlineEntry[];
}

const CONFIG_FILE_PATH = "docgen.json";
const MANIFEST_FILE_PATH = "packs/data/simple_manifest.json";
const LANG_FILE_PATH = "packs/RP/texts/en_US.lang";
const RP_DIR_PATH = "packs/RP";
const OUTPUT_DIR_PATH = "site";
const ICONS_OUTPUT_DIR_NAME = "icons";

const config = JSON.parse(
  fs.readFileSync(CONFIG_FILE_PATH, "utf8"),
) as SiteConfig;
const manifest = JSON.parse(
  fs.readFileSync(MANIFEST_FILE_PATH, "utf8"),
) as SimpleManifest;

/** Builds the online-only entries defined in the config. */
function buildOnlineEntries(
  inGameEntries: TutorialBookEntry[],
): TutorialBookEntry[] {
  const usedIds = new Set(inGameEntries.map((entry) => entry.id));
  const entries: TutorialBookEntry[] = [];

  for (const online of config.onlineEntries ?? []) {
    if (usedIds.has(online.id)) {
      console.warn(
        `Online entry '${online.id}' shares an id with another entry; skipping.`,
      );
      continue;
    }
    usedIds.add(online.id);

    entries.push({
      id: online.id,
      title: online.title,
      icon: online.icon ?? "",
      targets: [],
      bullets: online.bullets,
      related: [],
    });
  }

  return entries;
}

function copyIcons(entries: TutorialBookEntry[]): void {
  const iconsDir = path.join(OUTPUT_DIR_PATH, ICONS_OUTPUT_DIR_NAME);
  fs.mkdirSync(iconsDir, { recursive: true });

  for (const entry of entries) {
    // An empty icon path means the entry has no icon (allowed for online entries).
    if (entry.icon === "") continue;

    const source = path.join(RP_DIR_PATH, `${entry.icon}.png`);
    if (!fs.existsSync(source)) {
      console.warn(`Icon '${source}' for entry '${entry.id}' does not exist.`);
      continue;
    }

    fs.copyFileSync(source, path.join(iconsDir, `${entry.id}.png`));
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function iconSrc(entry: TutorialBookEntry): string {
  return `${ICONS_OUTPUT_DIR_NAME}/${entry.id}.png`;
}

function renderListRow(entry: TutorialBookEntry): string {
  const icon =
    entry.icon !== "" ? `<img src="${esc(iconSrc(entry))}" alt="" />` : "";
  return `<a class="row" href="?entry=${esc(encodeURIComponent(entry.id))}" data-entry="${esc(entry.id)}">
        <span class="icon-cell">${icon}</span>
        <span class="btn">${esc(entry.title)}</span>
      </a>`;
}

function renderBullet(text: string): string {
  return `<p class="bullet"><span class="dash">-</span><span class="text">${esc(text)}</span></p>`;
}

function renderEntry(
  entry: TutorialBookEntry,
  relatedEntries: TutorialBookEntry[],
): string {
  // `Object.values` drops any holes from non-contiguous bullet indices.
  const bullets = Object.values(entry.bullets)
    .map(renderBullet)
    .join("\n        ");

  // Related entries appear as icon + title buttons, like the in-game book.
  const related =
    relatedEntries.length > 0
      ? `<div class="related">
          <h2 class="related-heading">Related</h2>
          ${relatedEntries.map(renderListRow).join("\n          ")}
        </div>`
      : "";

  return `<article class="entry" id="entry-${esc(entry.id)}">
        <h1>${esc(entry.title)}</h1>
        ${bullets}
        ${related}
        <a class="close-btn" href="?" data-entry="">Close</a>
      </article>`;
}

const CSS = `
:root {
  color-scheme: light;
  --theme: ${config.themeColor};
  --panel: #c6c6c6;
  --panel-hover: #d8d8d8;
  --bevel-light: #ffffff;
  --bevel-dark: #5a5a5a;
  --outline: #000000;
  --body-bg: #0d0d0d;
  --label: #3c3c3c;
  --accent: ${config.accentColor};
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 24px 16px;
  background: #e6e6e6;
  font-family: Arial, Helvetica, sans-serif;
}

img {
  image-rendering: pixelated;
}

/* --- The book window --- */

.window {
  width: min(460px, 100%);
  background: var(--panel);
  border: 2px solid var(--outline);
  box-shadow:
    inset 2px 2px 0 var(--bevel-light),
    inset -2px -2px 0 var(--bevel-dark),
    0 12px 40px rgba(0, 0, 0, 0.35);
  padding: 6px;
}

.titlebar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 30px;
  color: var(--label);
  font-weight: 700;
  font-size: 17px;
  letter-spacing: 0.5px;
}

.titlebar .close-x {
  position: absolute;
  right: 2px;
  top: 50%;
  transform: translateY(-50%);
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--label);
  text-decoration: none;
  font-weight: 700;
  font-size: 16px;
}

.titlebar .close-x:hover {
  color: #111;
}

/* --- Scrollable body (holds the list and the entries) --- */

.body {
  position: relative;
  height: min(64vh, 460px);
  background: var(--body-bg);
  border: 2px solid var(--outline);
  box-shadow: inset 1px 1px 0 #2a2a2a;
  overflow: hidden;
  scrollbar-color: #8b8b8b #2b2b2b;
  scrollbar-width: thin;
}

.body ::-webkit-scrollbar {
  width: 12px;
}

.body ::-webkit-scrollbar-track {
  background: #2b2b2b;
}

.body ::-webkit-scrollbar-thumb {
  background: #8b8b8b;
  border: 2px solid #2b2b2b;
}

/* --- Entry list --- */

#list {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.row {
  display: flex;
  gap: 4px;
  min-height: 48px;
  text-decoration: none;
}

.row .icon-cell {
  flex: 0 0 auto;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(#1c1c1c, #0b0b0b);
  border: 2px solid var(--outline);
  box-shadow: inset 1px 1px 0 #343434;
}

.row .icon-cell img {
  width: 36px;
  height: 36px;
  object-fit: contain;
}

.row .btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  text-align: center;
  color: var(--label);
  font-size: 15px;
  background: var(--panel);
  border: 2px solid var(--outline);
  box-shadow:
    inset 1px 1px 0 var(--bevel-light),
    inset -2px -2px 0 var(--bevel-dark);
}

.row:hover .btn,
.row:focus-visible .btn {
  background: var(--panel-hover);
  box-shadow:
    inset 0 0 0 2px #ffffff,
    inset -2px -2px 0 var(--bevel-dark);
}

.row:focus-visible {
  outline: none;
}

/* --- Entry view --- */

.entry {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  display: none;
  padding: 14px;
  color: #fff;
}

.entry.active {
  display: block;
}

/* Hide the list while an entry is open (modal, like in-game). */
.body.entry-open #list {
  display: none;
}

.entry h1 {
  margin: 0 0 16px;
  font-size: 21px;
  font-weight: 700;
  color: var(--accent);
}

.entry .bullet {
  display: flex;
  gap: 8px;
  margin: 0 0 14px;
  font-size: 15px;
  line-height: 1.4;
}

.entry .bullet .dash {
  flex: 0 0 auto;
  font-weight: 700;
  color: var(--accent);
}

.entry .bullet .text {
  color: #fff;
}

/* --- Related entries (icon + title buttons, like the in-game book) --- */

.related {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 22px;
}

.related-heading {
  margin: 0 0 2px;
  font-size: 15px;
  font-weight: 700;
  color: var(--accent);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 20px;
  padding: 10px;
  color: var(--label);
  font-size: 15px;
  text-decoration: none;
  background: var(--panel);
  border: 2px solid var(--outline);
  box-shadow:
    inset 1px 1px 0 var(--bevel-light),
    inset -2px -2px 0 var(--bevel-dark);
}

.close-btn:hover {
  background: var(--panel-hover);
  box-shadow:
    inset 0 0 0 2px #ffffff,
    inset -2px -2px 0 var(--bevel-dark);
}

/* --- Notes above and below the book --- */

.topnote,
footer {
  width: min(460px, 100%);
  color: #555;
  font-size: 13px;
  line-height: 1.5;
  text-align: center;
}

.topnote p,
footer p {
  margin: 6px 0;
}

footer a {
  color: var(--theme);
}

/* Requirements block: grouped between thin lines to stand out. */
.requirements {
  margin: 15px 0;
  padding: 12px 0;
  border-top: 1px solid #bbb;
  border-bottom: 1px solid #bbb;
}

.requirements p {
  margin: 4px 0;
}

.download-links {
  margin: 15px 0;
}
`;

function buildHtml(entries: TutorialBookEntry[]): string {
  const version = `v${manifest.version[0].toString()}.${manifest.version[1].toString()}.x`;
  const faviconEntry = entries.find((entry) => entry.icon !== "");

  const entriesById = new Map<string, TutorialBookEntry>(
    entries.map((entry) => [entry.id, entry]),
  );
  const relatedEntriesFor = (entry: TutorialBookEntry): TutorialBookEntry[] =>
    entry.related
      .map((id) => entriesById.get(id))
      .filter((related): related is TutorialBookEntry => related !== undefined);

  // Drop the leading number; it's internal-only and Mojang never shows it
  // publicly (e.g. `1.26.30` is displayed as `26.30`).
  const minecraftVersion = manifest.minEngineVersion.slice(1).join(".");

  const dependencyLinks = (config.dependencies ?? []).map(
    (dep) => `<a href="${esc(dep.url)}">${esc(dep.name)}</a>`,
  );

  const downloadLinks = (config.downloadLinks ?? []).map(
    (link) => `<a href="${esc(link.url)}">${esc(link.name)}</a>`,
  );

  const links: string[] = [];
  if (config.repoUrl !== undefined) {
    links.push(`<a href="${esc(config.repoUrl)}">GitHub</a>`);
  }
  if (config.issueTrackerUrl !== undefined) {
    links.push(`<a href="${esc(config.issueTrackerUrl)}">Report an issue</a>`);
  }
  if (config.changelogsUrl !== undefined) {
    links.push(`<a href="${esc(config.changelogsUrl)}">Changelogs</a>`);
  }

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="${esc(config.themeColor)}" />
    <title>${esc(config.siteTitle)}</title>${
      faviconEntry
        ? `\n    <link rel="icon" href="${esc(iconSrc(faviconEntry))}" />`
        : ""
    }
    <style>${CSS}</style>
  </head>
  <body>
    <header class="topnote">
      <p>
        Tutorial book for <strong>${esc(config.siteTitle)} ${version}</strong>. Refer to the
        in-game tutorial book if this is not the version you're looking for.
      </p>
    </header>
    <main class="window">
      <div class="titlebar">
        Tutorial Book
        <a class="close-x" href="?" data-entry="" aria-label="Back to entry list">&times;</a>
      </div>
      <div class="body">
        ${entries
          .map((entry) => renderEntry(entry, relatedEntriesFor(entry)))
          .join("\n        ")}
        <div id="list">
          ${entries.map(renderListRow).join("\n          ")}
        </div>
      </div>
    </main>
    <footer>
      <p>${esc(config.description)}</p>
      <div class="requirements">
        <p><strong>Requires Minecraft ${esc(minecraftVersion)} or later.</strong></p>${
          dependencyLinks.length > 0
            ? `\n<p><strong>Required Dependencies:</strong> ${dependencyLinks.join(" &middot; ")}</p>`
            : ""
        }
      </div>
      ${downloadLinks.length > 0 ? `<p class="download-links">${downloadLinks.join(" &middot; ")}</p>` : ""}
      ${links.length > 0 ? `<p>${links.join(" &middot; ")}</p>` : ""}
    </footer>
    <script>
      // View switching. Entry links carry \`data-entry="<id>"\` (empty means the
      // list); we intercept them, update the URL to \`?entry=<id>\` via
      // \`history.pushState\`, and show the matching entry. Using a query string
      // updated with pushState — rather than a \`#entry-<id>\` fragment — means
      // following a link never scrolls the page. Deep links (\`?entry=<id>\` on
      // load) and the browser's back/forward buttons are handled too.
      (function () {
        var book = document.querySelector(".body");

        function show(id) {
          var open = document.querySelector(".entry.active");
          if (open) open.classList.remove("active");
          var entry = id ? document.getElementById("entry-" + id) : null;
          if (entry) {
            entry.classList.add("active");
            entry.scrollTop = 0;
            book.classList.add("entry-open");
          } else {
            book.classList.remove("entry-open");
          }
        }

        function currentEntry() {
          return new URLSearchParams(window.location.search).get("entry");
        }

        document.addEventListener("click", function (event) {
          // Let the browser handle modified or non-primary clicks natively, so
          // "open in new tab/window" on an entry link still works.
          if (
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey ||
            event.button !== 0
          ) {
            return;
          }
          var link = event.target.closest("a[data-entry]");
          if (!link) return;
          event.preventDefault();
          var id = link.getAttribute("data-entry") || null;
          if (id === currentEntry()) return;
          var url = id
            ? "?entry=" + encodeURIComponent(id)
            : window.location.pathname;
          window.history.pushState(null, "", url);
          show(id);
        });

        window.addEventListener("popstate", function () {
          show(currentEntry());
        });

        show(currentEntry());
      })();
    </script>
  </body>
</html>
`;
}

// --- Generate ---

fs.rmSync(OUTPUT_DIR_PATH, { recursive: true, force: true });
fs.mkdirSync(OUTPUT_DIR_PATH, { recursive: true });

const inGameEntries = parseTutorialBookEntries(
  fs.readFileSync(LANG_FILE_PATH, "utf8"),
  config.namespace,
);
const entries = [...inGameEntries, ...buildOnlineEntries(inGameEntries)];
copyIcons(entries);

fs.writeFileSync(path.join(OUTPUT_DIR_PATH, "index.html"), buildHtml(entries));
// Tell GitHub Pages not to run the output through Jekyll.
fs.writeFileSync(path.join(OUTPUT_DIR_PATH, ".nojekyll"), "");

console.log(
  `Generated static site with ${entries.length.toString()} tutorial book entries in '${OUTPUT_DIR_PATH}/'.`,
);
