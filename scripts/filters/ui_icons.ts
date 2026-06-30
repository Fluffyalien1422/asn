import * as fs from "fs";
import * as path from "path";
import { addItemTextureData, type ItemTextureData } from "./common.ts";

interface UiItem {
  id: string;
  /**
   * Use the 'fluffyalien_energisticscore:ui_item' tag
   * @default false
   */
  useEcTag?: boolean;
  /**
   * item states and their corresponding texture paths
   * @remarks
   * id of each state will be ${id}_${state}
   * if state is '_default' then it will just be 'id'
   */
  states: Record<string, string>;
}

const bpDir = "BP";
const itemsDir = path.join(bpDir, "items");
if (!fs.existsSync(itemsDir)) fs.mkdirSync(itemsDir);
const uiItemsDir = "data/ui_icons";
const textureData: ItemTextureData = {};

for (const fileName of fs.readdirSync(uiItemsDir, {
  recursive: true,
  encoding: "utf8",
})) {
  const content = JSON.parse(
    fs.readFileSync(path.join(uiItemsDir, fileName), "utf8"),
  ) as UiItem;

  for (const [state, texture] of Object.entries(content.states)) {
    const fullId = state === "_default" ? content.id : `${content.id}_${state}`;

    textureData[fullId] = { textures: texture };

    const tags = ["fluffyalien_asn:ui_item"];
    if (content.useEcTag) tags.push("fluffyalien_energisticscore:ui_item");

    fs.writeFileSync(
      path.join(
        itemsDir,
        `ui_${path.basename(fileName, path.extname(fileName))}.${state}.json`,
      ),
      JSON.stringify({
        format_version: "1.26.0",
        "minecraft:item": {
          description: {
            identifier: fullId,
            menu_category: {
              category: "none",
              is_hidden_in_commands: true,
            },
          },
          components: {
            "minecraft:tags": {
              tags,
            },
            "minecraft:icon": fullId,
          },
        },
      }),
    );
  }
}

addItemTextureData(textureData);
