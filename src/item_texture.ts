const textureData: Record<string, { textures: string }> = {};

export function _addItemTexture(id: string, texture: string): string {
  textureData[id] = {
    textures: texture,
  };

  return id;
}

export function _finishItemTexture(): void {
  _.define.rawText(JSON.stringify({ texture_data: textureData }), {
    rootDir: "RP/textures",
    name: "item_texture",
    ext: "json",
  });
}
