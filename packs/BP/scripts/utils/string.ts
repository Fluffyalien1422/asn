export function truncateNumber(num: number, decPlaces: number): string {
  const [beforeDec, afterDec] = num.toString().split(".");

  if (afterDec) {
    return `${beforeDec}.${afterDec.slice(0, decPlaces)}`;
  }

  return beforeDec;
}

export function abbreviateNumber(num: number): string {
  if (num === 1_000_000) {
    return "1M";
  }

  if (num > 1_000_000) {
    return "1M+";
  }

  if (num >= 1000) {
    return truncateNumber(num / 1000, 1) + "k";
  }

  return num.toString();
}

export function typeIdWithoutNamespace(typeId: string): string {
  return typeId.split(":").slice(1).join("");
}
