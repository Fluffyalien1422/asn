export function abbreviateNumber(value: number): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let newValue: any = value;
  if (value >= 1000) {
    const suffixes = ["", "k", "m", "b", "t"];
    const suffixNum = Math.floor(("" + value).length / 3);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let shortValue: any = "";
    for (let precision = 2; precision >= 1; precision--) {
      shortValue = parseFloat(
        (suffixNum != 0
          ? value / Math.pow(1000, suffixNum)
          : value
        ).toPrecision(precision)
      );
      const dotLessShortValue = (shortValue + "").replace(
        /[^a-zA-Z 0-9]+/g,
        ""
      );
      if (dotLessShortValue.length <= 2) {
        break;
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    if (shortValue % 1 != 0) shortValue = shortValue.toFixed(1);
    newValue = shortValue + suffixes[suffixNum];
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return newValue;
}
