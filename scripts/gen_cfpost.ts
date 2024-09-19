import * as fs from "fs";

const NAMESPACE = "fluffyalien_asn";

const CONTENT_BEGINNING = `
<p>
Advanced Storage Network finally fixes your storage problem. Build a storage network
that can hold infinite items, automate it, access it wirelessly, expand it infinitely,
and so much more.
</p>

<p><a href="https://legacy.curseforge.com/minecraft-bedrock/addons/advanced-storage-network-2/issues">Issue Tracker</a></p>

<h2>
Enable Beta APIs under Experiments in the world settings
</h2>
<h2>
Requires Minecraft 1.21.3x
</h2>
<h2>
No official realms support
</h2>

<h2>Language Support</h2>
<div class="spoiler">
  <h3>Official Language Support</h3>
  <p>These languages are built into Advanced Storage Network.</p>
  <ul>
    <li>English (United States)</li>
  </ul>

  <h3>Unofficial Language Support</h3>
  <p>
    These languages must be installed separately.
    These language packs are not official and may not be up to date.
  </p>
  <ul>
    <li>
      <strong>Português (Brasil)</strong>
      <ul>
        <li><a href="https://mcpedl.com/translation-advanced-storage-network">Translation Advanced Storage Network</a></li>
      </ul>
    </li>
    <li>
      <strong>Português (Portugal)</strong>
      <ul>
        <li><a href="https://mcpedl.com/translation-advanced-storage-network">Translation Advanced Storage Network</a></li>
      </ul>
    </li>
  </ul>
</div>

<h2>Optional Dependencies</h2>
<div class="spoiler">
  <ul>
    <li>Bedrock Energistics Core v0.2.x (<a href="https://mcpedl.com/bedrock-energistics-core/">MCPEDL</a>) (<a href="https://www.curseforge.com/minecraft-bedrock/addons/bedrock-energistics-core">CurseForge</a>) - Required for energy usage. See <strong>Energy (EXPERIMENTAL)</strong> (on this page or in the in-game tutorial book) for more information.</li>
  </ul>
</div>
`;

const CONTENT_END =
  '<p><a href="https://x.com/Fluffyalien1422">Follow me on X</a></p>';

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
  if (!key.startsWith(`${NAMESPACE}.ui.tutorialBook.entry.`)) {
    continue;
  }

  const [entryId, entrySubKey] = key
    .slice(`${NAMESPACE}.ui.tutorialBook.entry.`.length)
    .split(".");

  if (entrySubKey === "title") {
    setEntryTitle(entryId, value);
    continue;
  }

  const bulletNum = Number(entrySubKey.slice("bullet".length));
  addBulletToEntry(entryId, bulletNum, value);
}

fs.writeFileSync(
  "cfpost.html",
  CONTENT_BEGINNING +
    Object.values(entries)
      .map(
        (entry) =>
          `<h2>${htmlEscape(entry.title)}</h2><div class="spoiler"><ul><li>${entry.bullets.map(htmlEscape).join("</li><li>")}</li></ul></div>`,
      )
      .join("") +
    CONTENT_END,
);
