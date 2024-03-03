export function isBlock(itemId: string): boolean {
  try {
    $.server.BlockPermutation.resolve(itemId);
    return true;
  } catch {
    return false;
  }
}
