export function typeIdWithoutNamespace(typeId: string): string {
  return typeId.split(":").slice(1).join("");
}
