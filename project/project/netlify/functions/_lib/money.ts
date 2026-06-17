export const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export const ceil2 = (value: number) => Math.ceil((value + Number.EPSILON) * 100) / 100;

export function toAmountString(value: number): string {
  const n = round2(value);
  return n.toFixed(2);
}
