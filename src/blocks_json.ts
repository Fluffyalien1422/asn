interface BlockJsonEntry {
  sound?: string;
  textures:
    | string
    | {
        up?: string;
        down?: string;
        side?: string;
        north?: string;
        east?: string;
        south?: string;
        west?: string;
      };
}

const blocksJson: Record<string, BlockJsonEntry> = {};

export function _addBlocksJsonEntry(
  blockId: string,
  data: BlockJsonEntry
): void {
  blocksJson[blockId] = data;
}

export function _finishBlocksJson(): void {
  _.define.rawText(JSON.stringify(blocksJson), {
    rootDir: "RP",
    name: "blocks",
    ext: "json",
  });
}
