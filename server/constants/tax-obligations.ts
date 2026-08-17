export const TAX_OBLIGATIONS = [
  {
    code: "INCOME_TAX_COMPANY",
    name: "Income Tax - Company",
    taxType: "Income Tax",
    filingFrequency: "Annual",
  },
  {
    code: "INCOME_TAX_INDIVIDUAL",
    name: "Income Tax - Individual",
    taxType: "Income Tax",
    filingFrequency: "Annual",
  },
  {
    code: "VAT",
    name: "VAT",
    taxType: "VAT",
    filingFrequency: "Monthly",
  },
  {
    code: "PAYE",
    name: "PAYE",
    taxType: "PAYE",
    filingFrequency: "Monthly",
  },
  {
    code: "WITHHOLDING_TAX",
    name: "Withholding Tax",
    taxType: "Withholding Tax",
    filingFrequency: "As applicable",
  },
  {
    code: "TURNOVER_TAX",
    name: "Turnover Tax",
    taxType: "Turnover Tax",
    filingFrequency: "Monthly",
  },
  {
    code: "RESIDENTIAL_RENTAL_INCOME_TAX",
    name: "Residential Rental Income Tax",
    taxType: "Rental Income Tax",
    filingFrequency: "Monthly",
  },
  {
    code: "CAPITAL_GAINS_TAX",
    name: "Capital Gains Tax",
    taxType: "Capital Gains Tax",
    filingFrequency: "Transaction based",
  },
  {
    code: "ADVANCE_TAX",
    name: "Advance Tax",
    taxType: "Advance Tax",
    filingFrequency: "As applicable",
  },
  {
    code: "INSTALLMENT_TAX",
    name: "Installment Tax",
    taxType: "Installment Tax",
    filingFrequency: "Quarterly",
  },
  {
    code: "EXCISE_DUTY",
    name: "Excise Duty",
    taxType: "Excise Duty",
    filingFrequency: "Monthly",
  },
  {
    code: "MINIMUM_TAX",
    name: "Minimum Tax",
    taxType: "Minimum Tax",
    filingFrequency: "As applicable",
  },
] as const;

export type TaxObligationCode =
  (typeof TAX_OBLIGATIONS)[number]["code"];

export function getTaxObligation(
  code: string
) {
  return TAX_OBLIGATIONS.find(
    (obligation) =>
      obligation.code === code
  );
}
