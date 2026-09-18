export const ACCOUNTING_EFFECTIVE_STATUSES = [
  "POSTED",
  "APPROVED",
] as const;

export const accountingEffectiveStatusFilter = {
  in: [...ACCOUNTING_EFFECTIVE_STATUSES],
};

export const ACCOUNTING_TOLERANCE = 0.01;

export const roundAccounting = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const isAccountingBalanced = (
  debit: number,
  credit: number,
  tolerance = ACCOUNTING_TOLERANCE
): boolean =>
  Math.abs(
    roundAccounting(debit) -
    roundAccounting(credit)
  ) < tolerance;

export const normalizeAccountingAmount = (
  value: unknown
): number => {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return 0;
  }

  return roundAccounting(amount);
};
