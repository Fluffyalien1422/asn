import * as fs from "fs";
import * as jsonc from "jsonc-parser";

export type ItemTextureData = Record<string, { textures: string }>;

export function addItemTextureData(textureData: ItemTextureData): void {
  const itemTexturePath = "RP/textures/item_texture.json";
  fs.writeFileSync(
    itemTexturePath,
    JSON.stringify({
      texture_data: {
        ...(
          jsonc.parse(fs.readFileSync(itemTexturePath, "utf8")) as {
            texture_data: ItemTextureData;
          }
        ).texture_data,
        ...textureData,
      },
    }),
  );
}
