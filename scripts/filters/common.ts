import * as fs from "fs";
import * as jsonc from "jsonc-parser";

/**
 * The namespace of this pack, used to build the ID of everything the filters generate.
 * @remarks
 * Change this to reuse the filters in another pack.
 */
export const NAMESPACE = "fluffyalien_asn";

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
