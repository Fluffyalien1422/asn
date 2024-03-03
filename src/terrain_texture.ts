const textureData: Record<string, { textures: string }> = {};

export function _addTerrainTexture(id: string, texture: string): string {
  textureData[id] = {
    textures: texture,
  };

  return id;
}

export function _finishTerrainTexture(): void {
  _.define.rawText(JSON.stringify({ texture_data: textureData }), {
    rootDir: "RP/textures",
    name: "terrain_texture",
    ext: "json",
  });
}
