import * as fs from "fs";

const CONTENT_BEGINNING = `
<p>
Advanced Storage Network finally fixes your storage problem. This add-on adds
new devices that you can use to build a storage network that can hold infinite
items, including all modded items.
</p>
<br />

<h2 style="color: red">
Enable all experimental toggles under "Add-on Creators"
</h2>
<br />

<p>
The following information is all available in the Advanced Storage Network
tutorial book given to players when they spawn. It can also be crafted if you
lose it.
</p>
<br />
`;

const CONTENT_END = `
<a href="https://discord.gg/JxpJX2k">Join the Vatonage discord</a>
`;

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
  if (!key.startsWith("fluffyalien_asn.ui.tutorialBook.entry.")) {
    continue;
  }

  const [entryId, entrySubKey] = key
    .slice("fluffyalien_asn.ui.tutorialBook.entry.".length)
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
          `<h2>${htmlEscape(entry.title)}</h2><div class="spoiler"><ul><li>${entry.bullets.map((s) => htmlEscape(s)).join("</li><li>")}</li></ul></div><br/>`,
      )
      .join("") +
    CONTENT_END,
);
