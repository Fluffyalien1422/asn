let texts =
  "pack.name=Advanced Storage Network 2\npack.description=Advanced Storage Network 2";

// common translations
export const TRANSLATION_COMMON_UI_OK = "fluffyalien_asn.common.ui.ok";
_: _addTranslation(TRANSLATION_COMMON_UI_OK, "Ok");

export const TRANSLATION_COMMON_UI_ERROR = "fluffyalien_asn.common.ui.error";
_: _addTranslation(TRANSLATION_COMMON_UI_ERROR, "Error");

export function _addTranslation(key: string, value: string): string {
  texts += `\n${key}=${value}`;
  return key;
}

export function _addBlockName(id: string, name: string): string {
  return _addTranslation(
    `tile.${id}.name`,
    `${name} §9Advanced Storage Network`
  );
}

export function _addItemName(id: string, name: string): string {
  return _addTranslation(`item.${id}`, `${name} §9Advanced Storage Network`);
}

export function _finishTexts(): void {
  _.define.rawText(texts, { rootDir: "RP/texts", name: "en_US", ext: "lang" });
}
