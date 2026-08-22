import crypto from "crypto";
import * as XLSX from "xlsx";

/* =========================================================
   BANK PAYMENT IMPORT SERVICE

   Purpose:
   - Parse Excel (.xlsx/.xls) and CSV payment files.
   - Validate the complete file before persistence.
   - Produce a safe preview only.
   - Never submit payments to a bank.
   - Never create database payment records.

   Execution flow:
     FILE
       ↓
     PARSE
       ↓
     NORMALIZE
       ↓
     VALIDATE
       ↓
     DUPLICATE CHECK
       ↓
     PREVIEW
       ↓
     FINANCE APPROVAL
       ↓
     EXISTING BANK PAYMENT SERVICE

   M-Pesa is intentionally not handled here.
========================================================= */

/* =========================================================
   TYPES
========================================================= */

export type ImportedBankPaymentType =
  | "BANK_TRANSFER"
  | "PAYBILL"
  | "TILL";

export interface BankPaymentImportRecipient {
  rowNumber: number;

  beneficiaryName: string;

  paymentType: ImportedBankPaymentType;

  accountNumber?: string;

  paybillNumber?: string;

  tillNumber?: string;

  accountReference?: string;

  bankCode?: string;

  branchCode?: string;

  amount: number;

  currency: string;

  description?: string;

  paymentReference?: string;

  sourceRowHash: string;
}

export interface BankPaymentImportRowError {
  rowNumber: number;

  field?: string;

  message: string;
}

export interface BankPaymentImportSummary {
  totalRows: number;

  validRows: number;

  invalidRows: number;

  duplicateRows: number;

  totalAmount: number;

  currencyTotals: Record<string, number>;
}

export interface BankPaymentImportResult {
  success: boolean;

  filename: string;

  fileType: "XLSX" | "XLS" | "CSV";

  previewId: string;

  canSubmit: boolean;

  recipients: BankPaymentImportRecipient[];

  errors: BankPaymentImportRowError[];

  summary: BankPaymentImportSummary;
}

export interface BankPaymentImportOptions {
  /**
   * Maximum number of payment rows allowed.
   * The FOS batch limit is 1,000.
   */
  maxRecipients?: number;

  /**
   * Default currency when the spreadsheet does
   * not provide one.
   */
  defaultCurrency?: string;

  /**
   * Require payment references to be unique when
   * references are supplied.
   */
  rejectDuplicatePaymentReferences?: boolean;
}

export interface BankPaymentImportFile {
  originalname: string;

  mimetype?: string;

  buffer: Buffer;
}

/* =========================================================
   CONSTANTS
========================================================= */

const DEFAULT_MAX_RECIPIENTS = 1000;

const DEFAULT_CURRENCY = "KES";

const SUPPORTED_EXTENSIONS = new Set([
  ".xlsx",
  ".xls",
  ".csv",
]);

const SUPPORTED_PAYMENT_TYPES = new Set<
  ImportedBankPaymentType
>([
  "BANK_TRANSFER",
  "PAYBILL",
  "TILL",
]);

const MAX_FILE_SIZE_BYTES =
  10 * 1024 * 1024;

/**
 * Header aliases allow Finance to use common
 * spreadsheet naming conventions without making
 * the import fragile.
 */
const HEADER_ALIASES: Record<
  string,
  string
> = {
  "beneficiary name":
    "beneficiaryName",

  beneficiary:
    "beneficiaryName",

  name:
    "beneficiaryName",

  "recipient name":
    "beneficiaryName",

  "payment type":
    "paymentType",

  type:
    "paymentType",

  "account number":
    "accountNumber",

  account:
    "accountNumber",

  "bank account":
    "accountNumber",

  "paybill number":
    "paybillNumber",

  paybill:
    "paybillNumber",

  "till number":
    "tillNumber",

  till:
    "tillNumber",

  "account reference":
    "accountReference",

  "account ref":
    "accountReference",

  reference:
    "accountReference",

  "bank code":
    "bankCode",

  "branch code":
    "branchCode",

  amount:
    "amount",

  currency:
    "currency",

  description:
    "description",

  "payment reference":
    "paymentReference",

  "payment ref":
    "paymentReference",
};

/* =========================================================
   PUBLIC API
========================================================= */

/**
 * Parse and validate an uploaded payment file.
 *
 * IMPORTANT:
 * This function is intentionally side-effect free.
 * It does not write to Prisma, call a bank API,
 * create payment batches, or submit money.
 */
export function importBankPaymentFile(
  file: BankPaymentImportFile,
  options: BankPaymentImportOptions = {},
): BankPaymentImportResult {
  validateUpload(file);

  const maxRecipients =
    options.maxRecipients ??
    DEFAULT_MAX_RECIPIENTS;

  if (
    !Number.isInteger(maxRecipients) ||
    maxRecipients < 1 ||
    maxRecipients > DEFAULT_MAX_RECIPIENTS
  ) {
    throw new Error(
      `maxRecipients must be between 1 and ${DEFAULT_MAX_RECIPIENTS}.`,
    );
  }

  const defaultCurrency =
    normalizeCurrency(
      options.defaultCurrency ??
        DEFAULT_CURRENCY,
    );

  const extension =
    getExtension(
      file.originalname,
    );

  const fileType =
    extension === ".xlsx"
      ? "XLSX"
      : extension === ".xls"
        ? "XLS"
        : "CSV";

  const rows =
    parseSpreadsheet(
      file.buffer,
      extension,
    );

  if (rows.length === 0) {
    return {
      success: false,
      filename:
        file.originalname,
      fileType,
      previewId:
        generatePreviewId(),
      canSubmit: false,
      recipients: [],
      errors: [
        {
          rowNumber: 1,
          message:
            "The uploaded file contains no payment rows.",
        },
      ],
      summary: {
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        duplicateRows: 0,
        totalAmount: 0,
        currencyTotals: {},
      },
    };
  }

  if (
    rows.length >
    maxRecipients
  ) {
    throw new Error(
      `The uploaded file contains ${rows.length} payment rows. The maximum allowed is ${maxRecipients}.`,
    );
  }

  const normalizedRows =
    rows.map(
      (row, index) =>
        normalizeRow(
          row,
          index + 2,
          defaultCurrency,
        ),
    );

  const errors: BankPaymentImportRowError[] =
    [];

  const recipients: BankPaymentImportRecipient[] =
    [];

  const duplicateRows =
    new Set<number>();

  const seenPaymentReferences =
    new Map<string, number>();

  const seenDestinationKeys =
    new Map<string, number>();

  for (
    const normalized of normalizedRows
  ) {
    const validation =
      validateRecipient(
        normalized,
      );

    errors.push(
      ...validation.errors,
    );

    if (
      validation.recipient
    ) {
      const recipient =
        validation.recipient;

      const destinationKey =
        buildDestinationDuplicateKey(
          recipient,
        );

      const previousDestinationRow =
        seenDestinationKeys.get(
          destinationKey,
        );

      if (
        previousDestinationRow !==
        undefined
      ) {
        duplicateRows.add(
          recipient.rowNumber,
        );

        errors.push({
          rowNumber:
            recipient.rowNumber,
          field:
            "destination",
          message:
            `Duplicate payment destination. It was already listed on row ${previousDestinationRow}.`,
        });
      } else {
        seenDestinationKeys.set(
          destinationKey,
          recipient.rowNumber,
        );
      }

      if (
        recipient.paymentReference
      ) {
        const referenceKey =
          recipient.paymentReference
            .trim()
            .toUpperCase();

        const previousReferenceRow =
          seenPaymentReferences.get(
            referenceKey,
          );

        if (
          previousReferenceRow !==
          undefined
        ) {
          duplicateRows.add(
            recipient.rowNumber,
          );

          errors.push({
            rowNumber:
              recipient.rowNumber,
            field:
              "paymentReference",
            message:
              `Duplicate payment reference. It was already used on row ${previousReferenceRow}.`,
          });
        } else {
          seenPaymentReferences.set(
            referenceKey,
            recipient.rowNumber,
          );
        }
      }

      if (
        !hasRowErrors(
          errors,
          recipient.rowNumber,
        )
      ) {
        recipients.push(
          recipient,
        );
      }
    }
  }

  if (
    options.rejectDuplicatePaymentReferences ===
      false
  ) {
    /*
     * The default behavior remains strict.
     * This option exists only for callers that
     * intentionally allow repeated references.
     */
  }

  const totalAmount =
    roundMoney(
      recipients.reduce(
        (
          total,
          recipient,
        ) =>
          total +
          recipient.amount,
        0,
      ),
    );

  const currencyTotals: Record<
    string,
    number
  > = {};

  for (
    const recipient of recipients
  ) {
    currencyTotals[
      recipient.currency
    ] =
      roundMoney(
        (
          currencyTotals[
            recipient.currency
          ] ?? 0
        ) +
          recipient.amount,
      );
  }

  const invalidRowNumbers =
    new Set(
      errors.map(
        (error) =>
          error.rowNumber,
      ),
    );

  return {
    success:
      errors.length === 0,

    filename:
      file.originalname,

    fileType,

    previewId:
      generatePreviewId(),

    canSubmit:
      errors.length === 0 &&
      recipients.length > 0,

    recipients,

    errors,

    summary: {
      totalRows:
        normalizedRows.length,

      validRows:
        recipients.length,

      invalidRows:
        invalidRowNumbers.size,

      duplicateRows:
        duplicateRows.size,

      totalAmount,

      currencyTotals,
    },
  };
}

/* =========================================================
   FILE VALIDATION
========================================================= */

function validateUpload(
  file: BankPaymentImportFile,
): void {
  if (
    !file ||
    !Buffer.isBuffer(
      file.buffer,
    )
  ) {
    throw new Error(
      "A valid payment file is required.",
    );
  }

  if (
    file.buffer.length === 0
  ) {
    throw new Error(
      "The uploaded payment file is empty.",
    );
  }

  if (
    file.buffer.length >
    MAX_FILE_SIZE_BYTES
  ) {
    throw new Error(
      "The payment file exceeds the maximum allowed size of 10 MB.",
    );
  }

  const extension =
    getExtension(
      file.originalname,
    );

  if (
    !SUPPORTED_EXTENSIONS.has(
      extension,
    )
  ) {
    throw new Error(
      "Unsupported payment file. Upload an Excel (.xlsx/.xls) or CSV (.csv) file.",
    );
  }
}

/* =========================================================
   FILE PARSING
========================================================= */

function parseSpreadsheet(
  buffer: Buffer,
  extension: string,
): Record<
  string,
  unknown
>[] {
  let workbook: XLSX.WorkBook;

  try {
    workbook =
      XLSX.read(
        buffer,
        {
          type: "buffer",
          raw: false,
          cellDates: false,
          dense: true,
        },
      );
  } catch {
    throw new Error(
      "The payment file could not be read. Ensure it is a valid Excel or CSV file.",
    );
  }

  const firstSheet =
    workbook.SheetNames[0];

  if (
    !firstSheet
  ) {
    throw new Error(
      "The payment file does not contain a worksheet.",
    );
  }

  const worksheet =
    workbook.Sheets[
      firstSheet
    ];

  if (
    !worksheet
  ) {
    throw new Error(
      "The first worksheet could not be read.",
    );
  }

  const rows =
    XLSX.utils.sheet_to_json<
      Record<string, unknown>
    >(
      worksheet,
      {
        defval: "",
        raw: false,
        blankrows: false,
      },
    );

  if (
    !Array.isArray(rows)
  ) {
    throw new Error(
      `Unable to parse ${extension.toUpperCase()} payment file.`,
    );
  }

  return rows;
}

/* =========================================================
   ROW NORMALIZATION
========================================================= */

function normalizeRow(
  rawRow: Record<
    string,
    unknown
  >,
  rowNumber: number,
  defaultCurrency: string,
): Record<
  string,
  unknown
> & {
  rowNumber: number;
} {
  const normalized: Record<
    string,
    unknown
  > = {};

  for (
    const [
      rawHeader,
      value,
    ] of Object.entries(
      rawRow,
    )
  ) {
    const key =
      normalizeHeader(
        rawHeader,
      );

    if (!key) {
      continue;
    }

    normalized[key] =
      normalizeCellValue(
        value,
      );
  }

  if (
    !normalized.currency
  ) {
    normalized.currency =
      defaultCurrency;
  }

  return {
    ...normalized,
    rowNumber,
  };
}

function normalizeHeader(
  value: string,
): string {
  const normalized =
    String(value)
      .trim()
      .toLowerCase()
      .replace(
        /[_-]+/g,
        " ",
      )
      .replace(
        /\s+/g,
        " ",
      );

  if (
    HEADER_ALIASES[
      normalized
    ]
  ) {
    return HEADER_ALIASES[
      normalized
    ];
  }

  return camelCaseHeader(
    normalized,
  );
}

function camelCaseHeader(
  value: string,
): string {
  const words =
    value
      .split(" ")
      .filter(Boolean);

  if (
    words.length === 0
  ) {
    return "";
  }

  return (
    words[0] +
    words
      .slice(1)
      .map(
        (word) =>
          word
            .charAt(0)
            .toUpperCase() +
          word.slice(1),
      )
      .join("")
  );
}

function normalizeCellValue(
  value: unknown,
): string {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return "";
  }

  if (
    typeof value ===
    "number"
  ) {
    return String(value);
  }

  return String(value)
    .trim();
}

/* =========================================================
   RECIPIENT VALIDATION
========================================================= */

function validateRecipient(
  row: Record<
    string,
    unknown
  > & {
    rowNumber: number;
  },
): {
  recipient?:
    | BankPaymentImportRecipient;

  errors:
    BankPaymentImportRowError[];
} {
  const errors: BankPaymentImportRowError[] =
    [];

  const rowNumber =
    row.rowNumber;

  const beneficiaryName =
    getString(
      row.beneficiaryName,
    );

  if (
    !beneficiaryName
  ) {
    errors.push({
      rowNumber,
      field:
        "beneficiaryName",
      message:
        "Beneficiary name is required.",
    });
  }

  const paymentType =
    normalizePaymentType(
      row.paymentType,
    );

  if (
    !paymentType
  ) {
    errors.push({
      rowNumber,
      field:
        "paymentType",
      message:
        "Payment Type must be BANK_TRANSFER, PAYBILL, or TILL.",
    });
  }

  const amount =
    parseAmount(
      row.amount,
    );

  if (
    amount ===
      undefined
  ) {
    errors.push({
      rowNumber,
      field:
        "amount",
      message:
        "Amount is required and must be a valid positive number.",
    });
  }

  const currency =
    normalizeCurrency(
      getString(
        row.currency,
      ),
    );

  if (
    !currency
  ) {
    errors.push({
      rowNumber,
      field:
        "currency",
      message:
        "Currency must be a valid three-letter ISO currency code.",
    });
  }

  const accountNumber =
    getOptionalString(
      row.accountNumber,
    );

  const paybillNumber =
    getOptionalString(
      row.paybillNumber,
    );

  const tillNumber =
    getOptionalString(
      row.tillNumber,
    );

  const accountReference =
    getOptionalString(
      row.accountReference,
    );

  const bankCode =
    getOptionalString(
      row.bankCode,
    );

  const branchCode =
    getOptionalString(
      row.branchCode,
    );

  const description =
    getOptionalString(
      row.description,
    );

  const paymentReference =
    getOptionalString(
      row.paymentReference,
    );

  if (
    paymentType ===
    "BANK_TRANSFER"
  ) {
    if (
      !accountNumber
    ) {
      errors.push({
        rowNumber,
        field:
          "accountNumber",
        message:
          "Account Number is required for BANK_TRANSFER.",
      });
    }
  }

  if (
    paymentType ===
    "PAYBILL"
  ) {
    if (
      !paybillNumber
    ) {
      errors.push({
        rowNumber,
        field:
          "paybillNumber",
        message:
          "PayBill Number is required for PAYBILL.",
      });
    }

    if (
      !accountReference
    ) {
      errors.push({
        rowNumber,
        field:
          "accountReference",
        message:
          "Account Reference is required for PAYBILL.",
      });
    }
  }

  if (
    paymentType ===
    "TILL" &&
    !tillNumber
  ) {
    errors.push({
      rowNumber,
      field:
        "tillNumber",
      message:
        "Till Number is required for TILL.",
    });
  }

  if (
    accountNumber &&
    !/^[A-Za-z0-9][A-Za-z0-9 .\-\/]*$/.test(
      accountNumber,
    )
  ) {
    errors.push({
      rowNumber,
      field:
        "accountNumber",
      message:
        "Account Number contains unsupported characters.",
    });
  }

  if (
    paybillNumber &&
    !/^[0-9A-Za-z][0-9A-Za-z .\-\/]*$/.test(
      paybillNumber,
    )
  ) {
    errors.push({
      rowNumber,
      field:
        "paybillNumber",
      message:
        "PayBill Number contains unsupported characters.",
    });
  }

  if (
    tillNumber &&
    !/^[0-9A-Za-z][0-9A-Za-z .\-\/]*$/.test(
      tillNumber,
    )
  ) {
    errors.push({
      rowNumber,
      field:
        "tillNumber",
      message:
        "Till Number contains unsupported characters.",
    });
  }

  if (
    accountReference &&
    accountReference.length >
      100
  ) {
    errors.push({
      rowNumber,
      field:
        "accountReference",
      message:
        "Account Reference cannot exceed 100 characters.",
    });
  }

  if (
    paymentReference &&
    paymentReference.length >
      100
  ) {
    errors.push({
      rowNumber,
      field:
        "paymentReference",
      message:
        "Payment Reference cannot exceed 100 characters.",
    });
  }

  if (
    description &&
    description.length >
      500
  ) {
    errors.push({
      rowNumber,
      field:
        "description",
      message:
        "Description cannot exceed 500 characters.",
    });
  }

  if (
    errors.length > 0 ||
    !paymentType ||
    amount ===
      undefined ||
    !currency ||
    !beneficiaryName
  ) {
    return {
      errors,
    };
  }

  const sourceRowHash =
    hashRow({
      beneficiaryName,
      paymentType,
      accountNumber,
      paybillNumber,
      tillNumber,
      accountReference,
      bankCode,
      branchCode,
      amount,
      currency,
      description,
      paymentReference,
    });

  return {
    recipient: {
      rowNumber,

      beneficiaryName,

      paymentType,

      accountNumber,

      paybillNumber,

      tillNumber,

      accountReference,

      bankCode,

      branchCode,

      amount,

      currency,

      description,

      paymentReference,

      sourceRowHash,
    },

    errors: [],
  };
}

/* =========================================================
   NORMALIZATION HELPERS
========================================================= */

function normalizePaymentType(
  value: unknown,
):
  | ImportedBankPaymentType
  | undefined {
  const normalized =
    String(
      value ?? "",
    )
      .trim()
      .toUpperCase()
      .replace(
        /[\s-]+/g,
        "_",
      );

  if (
    !SUPPORTED_PAYMENT_TYPES.has(
      normalized as ImportedBankPaymentType,
    )
  ) {
    return undefined;
  }

  return normalized as ImportedBankPaymentType;
}

function normalizeCurrency(
  value: string,
): string {
  const normalized =
    String(
      value ?? "",
    )
      .trim()
      .toUpperCase();

  if (
    !/^[A-Z]{3}$/.test(
      normalized,
    )
  ) {
    return "";
  }

  return normalized;
}

function parseAmount(
  value: unknown,
): number | undefined {
  const raw =
    String(
      value ?? "",
    )
      .trim()
      .replace(
        /,/g,
        "",
      );

  if (
    !raw
  ) {
    return undefined;
  }

  const amount =
    Number(raw);

  if (
    !Number.isFinite(
      amount,
    ) ||
    amount <= 0
  ) {
    return undefined;
  }

  return roundMoney(
    amount,
  );
}

function getString(
  value: unknown,
): string {
  return String(
    value ?? "",
  ).trim();
}

function getOptionalString(
  value: unknown,
): string | undefined {
  const normalized =
    getString(value);

  return normalized
    ? normalized
    : undefined;
}

/* =========================================================
   DUPLICATE DETECTION
========================================================= */

function buildDestinationDuplicateKey(
  recipient: BankPaymentImportRecipient,
): string {
  switch (
    recipient.paymentType
  ) {
    case "BANK_TRANSFER":
      return [
        recipient.paymentType,
        normalizeKey(
          recipient.accountNumber,
        ),
        normalizeKey(
          recipient.bankCode,
        ),
        normalizeKey(
          recipient.branchCode,
        ),
      ].join("|");

    case "PAYBILL":
      return [
        recipient.paymentType,
        normalizeKey(
          recipient.paybillNumber,
        ),
        normalizeKey(
          recipient.accountReference,
        ),
      ].join("|");

    case "TILL":
      return [
        recipient.paymentType,
        normalizeKey(
          recipient.tillNumber,
        ),
      ].join("|");

    default:
      return recipient.sourceRowHash;
  }
}

function normalizeKey(
  value:
    | string
    | undefined,
): string {
  return String(
    value ?? "",
  )
    .trim()
    .toUpperCase();
}

/* =========================================================
   GENERAL HELPERS
========================================================= */

function hasRowErrors(
  errors: BankPaymentImportRowError[],
  rowNumber: number,
): boolean {
  return errors.some(
    (error) =>
      error.rowNumber ===
      rowNumber,
  );
}

function hashRow(
  row: Record<
    string,
    unknown
  >,
): string {
  const canonical =
    Object.keys(row)
      .sort()
      .map(
        (key) =>
          `${key}=${String(
            row[key] ?? "",
          )
            .trim()
            .toUpperCase()}`,
      )
      .join("|");

  return crypto
    .createHash(
      "sha256",
    )
    .update(canonical)
    .digest("hex");
}

function generatePreviewId(): string {
  return `BANK-IMPORT-${Date.now()}-${crypto
    .randomBytes(8)
    .toString("hex")
    .toUpperCase()}`;
}

function roundMoney(
  value: number,
): number {
  return Math.round(
    (value + Number.EPSILON) *
      100,
  ) / 100;
}

function getExtension(
  filename: string,
): string {
  const normalized =
    String(
      filename ?? "",
    )
      .trim()
      .toLowerCase();

  const lastDot =
    normalized.lastIndexOf(
      ".",
    );

  if (
    lastDot === -1
  ) {
    return "";
  }

  return normalized.slice(
    lastDot,
  );
}