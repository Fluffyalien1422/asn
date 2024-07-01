/**
 * Generates the page number items & textures based on the image at packs/data/ui/page_numbers.png
 */

import * as imgManip from "imagescript";
import * as fs from "fs";
import * as path from "path";
import { TMP_DIR } from "./common";

const CHARACTER_WIDTH = 3;
const CHARACTER_HEIGHT = 5;
const WIDTH_PADDING = 1;
const CHARACTER_TOTAL_WIDTH = CHARACTER_WIDTH + WIDTH_PADDING;
const CHARACTER_COUNT = 11; // 0-9 and +

const pageNumbers = (await imgManip.decode(
  fs.readFileSync("packs/data/ui/page_numbers.png"),
)) as imgManip.Image;

const itemTexturePath = path.join(TMP_DIR, "RP/textures/item_texture.json");

const itemTexture = JSON.parse(fs.readFileSync(itemTexturePath, "utf8")) as {
  texture_data: Record<string, { textures: string }>;
};

function createUiItem(itemId: string): string {
  return JSON.stringify({
    format_version: "1.20.80",
    "minecraft:item": {
      description: {
        identifier: itemId,
        menu_category: {
          category: "none",
        },
      },
      components: {
        "minecraft:tags": {
          tags: ["fluffyalien_asn:ui_item"],
        },
        "minecraft:icon": {
          textures: {
            default: itemId,
          },
        },
      },
    },
  });
}

for (let i = 0; i < CHARACTER_COUNT; i++) {
  const shortId = `ui_page_number${i.toString()}`;
  const itemId = `fluffyalien_asn:${shortId}`;

  fs.writeFileSync(
    path.join(TMP_DIR, `BP/items/${shortId}.json`),
    createUiItem(itemId),
  );

  const texturePath = `textures/fluffyalien/asn/${shortId}`;
  itemTexture.texture_data[itemId] = { textures: texturePath };

  let img = pageNumbers.clone();
  if (i === CHARACTER_COUNT - 1) {
    img.crop(
      CHARACTER_TOTAL_WIDTH * (i - 1),
      0,
      CHARACTER_TOTAL_WIDTH + CHARACTER_WIDTH,
      CHARACTER_HEIGHT,
    );
  } else {
    img.crop(CHARACTER_TOTAL_WIDTH * i, 0, CHARACTER_WIDTH, CHARACTER_HEIGHT);
  }

  img = new imgManip.Image(16, 16).composite(img, 0, 0);

  fs.writeFileSync(
    path.join(TMP_DIR, `RP/${texturePath}.png`),
    await img.encode(),
  );
}

fs.writeFileSync(itemTexturePath, JSON.stringify(itemTexture));
