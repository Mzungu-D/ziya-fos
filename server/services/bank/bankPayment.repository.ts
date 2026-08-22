import prisma from "../../config/prisma";

/* =========================================================
   TYPES
========================================================= */

export interface CreateBankPaymentBatchInput {
  organizationId: string;
  bankAccountId: string;
  batchReference: string;
  description?: string;
  provider?: string;
  idempotencyKey?: string;
}

export type BankPaymentType =
  | "BANK_TRANSFER"
  | "PAYBILL"
  | "TILL";

export interface CreateBankPaymentBatchWithPaymentsInput {
  organizationId: string;
  bankAccountId: string;
  batchReference: string;
  description?: string;
  provider?: string;
  idempotencyKey?: string;
  payments: Array<{
    paymentReference: string;
    beneficiaryName: string;
    paymentType: BankPaymentType;

    accountNumber?: string;
    paybillNumber?: string;
    tillNumber?: string;
    accountReference?: string;

    bankCode?: string;
    branchCode?: string;
    amount: number;
    currency?: string;
    description?: string;
    provider?: string;
    idempotencyKey?: string;
  }>;
}

export interface CreateBankPaymentInput {
  organizationId: string;
  bankAccountId: string;
  batchId?: string;
  paymentReference: string;
  beneficiaryName: string;

  paymentType: BankPaymentType;

  accountNumber?: string;
  paybillNumber?: string;
  tillNumber?: string;
  accountReference?: string;

  bankCode?: string;
  branchCode?: string;
  amount: number;
  currency?: string;
  description?: string;
  provider?: string;
  idempotencyKey?: string;
}

export interface UpdateBankPaymentStatusInput {
  organizationId: string;
  paymentId: string;
  status:
    | "PENDING"
    | "PROCESSING"
    | "SUCCESS"
    | "FAILED"
    | "CANCELLED";
  providerPaymentId?: string;
  providerStatus?: string;
  failureReason?: string;
}

export interface MarkBankPaymentSubmittedInput {
  organizationId: string;
  paymentId: string;
  provider: string;
  providerPaymentId?: string;
  providerStatus?: string;
}

/* =========================================================
   DATABASE TYPES
========================================================= */

export interface BankPaymentRow {
  id: string;
  organizationId: string;
  bankAccountId: string;
  batchId: string | null;
  paymentReference: string;
  beneficiaryName: string;

  paymentType: BankPaymentType;

  accountNumber: string | null;
  paybillNumber: string | null;
  tillNumber: string | null;
  accountReference: string | null;

  bankCode: string | null;
  branchCode: string | null;
  amount: number;
  currency: string;
  description: string | null;
  status: string;
  provider: string | null;
  providerPaymentId: string | null;
  providerStatus: string | null;
  failureReason: string | null;
  idempotencyKey: string | null;
  submittedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BankPaymentBatchRow {
  id: string;
  organizationId: string;
  bankAccountId: string;
  batchReference: string;
  description: string | null;
  totalAmount: number;
  totalPayments: number;
  successful: number;
  failed: number;
  pending: number;
  status: string;
  provider: string | null;
  providerBatchId: string | null;
  idempotencyKey: string | null;
  submittedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/* =========================================================
   HELPERS
========================================================= */

function requireValue(
  value: string | undefined | null,
  field: string
): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new Error(`${field} is required.`);
  }

  return value.trim();
}

function optionalValue(
  value: string | undefined | null
): string | null {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    return null;
  }

  return value.trim();
}

function validateAmount(
  amount: number
): number {
  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error(
      "Payment amount must be greater than zero."
    );
  }

  return Math.round(amount * 100) / 100;
}

function validatePaymentDestination(
  paymentType: BankPaymentType,
  input: {
    accountNumber?: string | null;
    paybillNumber?: string | null;
    tillNumber?: string | null;
    accountReference?: string | null;
    bankCode?: string | null;
  }
): void {
  switch (paymentType) {
    case "BANK_TRANSFER":
      if (!input.accountNumber?.trim()) {
        throw new Error(
          "Account number is required for a bank transfer."
        );
      }

      if (!input.bankCode?.trim()) {
        throw new Error(
          "Bank code is required for a bank transfer."
        );
      }

      break;

    case "PAYBILL":
      if (!input.paybillNumber?.trim()) {
        throw new Error(
          "PayBill number is required for a PayBill payment."
        );
      }

      if (!input.accountReference?.trim()) {
        throw new Error(
          "Account/reference is required for a PayBill payment."
        );
      }

      break;

    case "TILL":
      if (!input.tillNumber?.trim()) {
        throw new Error(
          "Till number is required for a Till payment."
        );
      }

      break;

    default:
      throw new Error(
        `Unsupported payment type: ${paymentType}`
      );
  }
}

function generateId(): string {
  return crypto.randomUUID();
}

/* =========================================================
   BANK ACCOUNT OWNERSHIP CHECK
========================================================= */

async function verifyBankAccount(
  organizationId: string,
  bankAccountId: string
): Promise<void> {
  const result =
    await prisma.$queryRaw<
      Array<{ id: string }>
    >`
      SELECT "id"
      FROM "BankAccount"
      WHERE "id" = ${bankAccountId}
        AND "organizationId" = ${organizationId}
        AND "status" = 'ACTIVE'
      LIMIT 1
    `;

  if (result.length === 0) {
    throw new Error(
      "Active bank account not found for this organization."
    );
  }
}

/* =========================================================
   CREATE PAYMENT BATCH
========================================================= */

export async function createBankPaymentBatch(
  input: CreateBankPaymentBatchInput
): Promise<BankPaymentBatchRow[]> {
  const organizationId =
    requireValue(
      input.organizationId,
      "Organization ID"
    );

  const bankAccountId =
    requireValue(
      input.bankAccountId,
      "Bank account ID"
    );

  const batchReference =
    requireValue(
      input.batchReference,
      "Batch reference"
    );

  await verifyBankAccount(
    organizationId,
    bankAccountId
  );

  /*
   * Idempotency protection.
   */
  if (input.idempotencyKey) {
    const existing =
      await prisma.$queryRaw<
        BankPaymentBatchRow[]
      >`
        SELECT
          "id",
          "organizationId",
          "bankAccountId",
          "batchReference",
          "description",
          "totalAmount"::float8 AS "totalAmount",
          "totalPayments",
          "successful",
          "failed",
          "pending",
          "status",
          "provider",
          "providerBatchId",
          "idempotencyKey",
          "submittedAt",
          "completedAt",
          "createdAt",
          "updatedAt"
        FROM "BankPaymentBatch"
        WHERE "organizationId" = ${organizationId}
          AND "idempotencyKey" = ${input.idempotencyKey}
        LIMIT 1
      `;

    if (existing.length > 0) {
      return existing;
    }
  }

  /*
   * Duplicate reference protection.
   */
  const duplicate =
    await prisma.$queryRaw<
      Array<{ id: string }>
    >`
      SELECT "id"
      FROM "BankPaymentBatch"
      WHERE "organizationId" = ${organizationId}
        AND "batchReference" = ${batchReference}
      LIMIT 1
    `;

  if (duplicate.length > 0) {
    throw new Error(
      `Payment batch reference "${batchReference}" already exists.`
    );
  }

  return prisma.$queryRaw<BankPaymentBatchRow[]>`
    INSERT INTO "BankPaymentBatch" (
      "id",
      "organizationId",
      "bankAccountId",
      "batchReference",
      "description",
      "totalAmount",
      "totalPayments",
      "successful",
      "failed",
      "pending",
      "status",
      "provider",
      "idempotencyKey"
    )
    VALUES (
      ${generateId()},
      ${organizationId},
      ${bankAccountId},
      ${batchReference},
      ${optionalValue(input.description)},
      0,
      0,
      0,
      0,
      0,
      'PENDING',
      ${optionalValue(input.provider)},
      ${optionalValue(input.idempotencyKey)}
    )
    RETURNING
      "id",
      "organizationId",
      "bankAccountId",
      "batchReference",
      "description",
      "totalAmount"::float8 AS "totalAmount",
      "totalPayments",
      "successful",
      "failed",
      "pending",
      "status",
      "provider",
      "providerBatchId",
      "idempotencyKey",
      "submittedAt",
      "completedAt",
      "createdAt",
      "updatedAt"
  `;
}

/* =========================================================
   CREATE SINGLE BANK PAYMENT
========================================================= */

export async function createBankPayment(
  input: CreateBankPaymentInput
): Promise<BankPaymentRow[]> {
  const organizationId =
    requireValue(
      input.organizationId,
      "Organization ID"
    );

  const bankAccountId =
    requireValue(
      input.bankAccountId,
      "Bank account ID"
    );

  const paymentReference =
    requireValue(
      input.paymentReference,
      "Payment reference"
    );

  const beneficiaryName =
    requireValue(
      input.beneficiaryName,
      "Beneficiary name"
    );

  const paymentType =
    input.paymentType;

  if (
    paymentType !== "BANK_TRANSFER" &&
    paymentType !== "PAYBILL" &&
    paymentType !== "TILL"
  ) {
    throw new Error(
      `Unsupported payment type: ${paymentType}`
    );
  }

  const accountNumber =
    optionalValue(input.accountNumber);

  const paybillNumber =
    optionalValue(input.paybillNumber);

  const tillNumber =
    optionalValue(input.tillNumber);

  const accountReference =
    optionalValue(input.accountReference);

  const bankCode =
    optionalValue(input.bankCode);

  validatePaymentDestination(
    paymentType,
    {
      accountNumber,
      paybillNumber,
      tillNumber,
      accountReference,
      bankCode,
    }
  );

  const amount =
    validateAmount(input.amount);

  const currency =
    optionalValue(input.currency) ??
    "KES";

  await verifyBankAccount(
    organizationId,
    bankAccountId
  );

  /*
   * If a batch was supplied, make absolutely sure
   * it belongs to the same tenant AND bank account.
   */
  if (input.batchId) {
    const batch =
      await prisma.$queryRaw<
        Array<{
          id: string;
          status: string;
        }>
      >`
        SELECT
          "id",
          "status"
        FROM "BankPaymentBatch"
        WHERE "id" = ${input.batchId}
          AND "organizationId" = ${organizationId}
          AND "bankAccountId" = ${bankAccountId}
        LIMIT 1
      `;

    if (batch.length === 0) {
      throw new Error(
        "Payment batch does not belong to this organization or bank account."
      );
    }

    if (
      batch[0].status === "SUCCESS" ||
      batch[0].status === "FAILED"
    ) {
      throw new Error(
        "Payment batch has already been completed."
      );
    }
  }

  /*
   * Idempotency protection.
   */
  if (input.idempotencyKey) {
    const existing =
      await prisma.$queryRaw<
        BankPaymentRow[]
      >`
        SELECT
          "id",
          "organizationId",
          "bankAccountId",
          "batchId",
          "paymentReference",
          "beneficiaryName",
          "accountNumber",
          "bankCode",
          "branchCode",
          "amount"::float8 AS "amount",
          "currency",
          "description",
          "status",
          "provider",
          "providerPaymentId",
          "providerStatus",
          "failureReason",
          "idempotencyKey",
          "submittedAt",
          "completedAt",
          "createdAt",
          "updatedAt"
        FROM "BankPayment"
        WHERE "organizationId" = ${organizationId}
          AND "idempotencyKey" = ${input.idempotencyKey}
        LIMIT 1
      `;

    if (existing.length > 0) {
      return existing;
    }
  }

  /*
   * Reference protection.
   */
  const duplicate =
    await prisma.$queryRaw<
      Array<{ id: string }>
    >`
      SELECT "id"
      FROM "BankPayment"
      WHERE "organizationId" = ${organizationId}
        AND "paymentReference" = ${paymentReference}
      LIMIT 1
    `;

  if (duplicate.length > 0) {
    throw new Error(
      `Payment reference "${paymentReference}" already exists.`
    );
  }

  /*
   * Create payment and update its batch atomically.
   */
  return prisma.$transaction(
    async (tx) => {
      const created =
        await tx.$queryRaw<BankPaymentRow[]>`
          INSERT INTO "BankPayment" (
            "id",
            "organizationId",
            "bankAccountId",
            "batchId",
            "paymentReference",
            "beneficiaryName",
            "accountNumber",
            "paymentType",
            "paybillNumber",
            "tillNumber",
            "accountReference",
            "bankCode",
            "branchCode",
            "amount",
            "currency",
            "description",
            "status",
            "provider",
            "idempotencyKey"
          )
          VALUES (
            ${generateId()},
            ${organizationId},
            ${bankAccountId},
            ${input.batchId ?? null},
            ${paymentReference},
            ${beneficiaryName},
            ${accountNumber},
            ${paymentType},
            ${paybillNumber},
            ${tillNumber},
            ${accountReference},
            ${bankCode},
            ${optionalValue(input.branchCode)},
            ${amount},
            ${currency},
            ${optionalValue(input.description)},
            'PENDING',
            ${optionalValue(input.provider)},
            ${optionalValue(input.idempotencyKey)}
          )
          RETURNING
            "id",
            "organizationId",
            "bankAccountId",
            "batchId",
            "paymentReference",
            "beneficiaryName",
            "accountNumber",
            "paymentType",
            "paybillNumber",
            "tillNumber",
            "accountReference",
            "bankCode",
            "branchCode",
            "amount"::float8 AS "amount",
            "currency",
            "description",
            "status",
            "provider",
            "providerPaymentId",
            "providerStatus",
            "failureReason",
            "idempotencyKey",
            "submittedAt",
            "completedAt",
            "createdAt",
            "updatedAt"
        `;

      /*
       * Keep batch counters synchronized with the
       * actual payment records.
       */
      if (
        input.batchId &&
        created.length > 0
      ) {
        await refreshBankPaymentBatchTx(
          tx,
          organizationId,
          input.batchId
        );
      }

      return created;
    }
  );
}

/* =========================================================
   CREATE PAYMENT BATCH WITH PAYMENTS
========================================================= */

export async function createBankPaymentBatchWithPayments(
  input: CreateBankPaymentBatchWithPaymentsInput
): Promise<{
  batch: BankPaymentBatchRow;
  payments: BankPaymentRow[];
}> {
  const organizationId =
    requireValue(
      input.organizationId,
      "Organization ID"
    );

  const bankAccountId =
    requireValue(
      input.bankAccountId,
      "Bank account ID"
    );

  const batchReference =
    requireValue(
      input.batchReference,
      "Batch reference"
    );

  if (
    !Array.isArray(input.payments) ||
    input.payments.length === 0
  ) {
    throw new Error(
      "At least one payment is required."
    );
  }

  await verifyBankAccount(
    organizationId,
    bankAccountId
  );

  /*
   * Preserve idempotency at the batch level.
   */
  if (input.idempotencyKey) {
    const existing =
      await getBankPaymentBatchByIdempotencyKey(
        organizationId,
        input.idempotencyKey
      );

    if (existing.length > 0) {
      const existingBatch =
        existing[0];

      const existingPayments =
        await prisma.$queryRaw<BankPaymentRow[]>`
          SELECT
            "id",
            "organizationId",
            "bankAccountId",
            "batchId",
            "paymentReference",
            "beneficiaryName",
            "accountNumber",
            "paymentType",
            "paybillNumber",
            "tillNumber",
            "accountReference",
            "bankCode",
            "branchCode",
            "amount"::float8 AS "amount",
            "currency",
            "description",
            "status",
            "provider",
            "providerPaymentId",
            "providerStatus",
            "failureReason",
            "idempotencyKey",
            "submittedAt",
            "completedAt",
            "createdAt",
            "updatedAt"
          FROM "BankPayment"
          WHERE "organizationId" = ${organizationId}
            AND "batchId" = ${existingBatch.id}
          ORDER BY "createdAt" ASC
        `;

      return {
        batch: existingBatch,
        payments: existingPayments,
      };
    }
  }

  /*
   * Create the batch and all payments in one transaction.
   */
  return prisma.$transaction(
    async (tx) => {
      const duplicateBatch =
        await tx.$queryRaw<
          Array<{ id: string }>
        >`
          SELECT "id"
          FROM "BankPaymentBatch"
          WHERE "organizationId" = ${organizationId}
            AND "batchReference" = ${batchReference}
          LIMIT 1
        `;

      if (duplicateBatch.length > 0) {
        throw new Error(
          `Payment batch reference "${batchReference}" already exists.`
        );
      }

      const batchRows =
        await tx.$queryRaw<BankPaymentBatchRow[]>`
          INSERT INTO "BankPaymentBatch" (
            "id",
            "organizationId",
            "bankAccountId",
            "batchReference",
            "description",
            "totalAmount",
            "totalPayments",
            "successful",
            "failed",
            "pending",
            "status",
            "provider",
            "idempotencyKey"
          )
          VALUES (
            ${generateId()},
            ${organizationId},
            ${bankAccountId},
            ${batchReference},
            ${optionalValue(input.description)},
            0,
            0,
            0,
            0,
            0,
            'PENDING',
            ${optionalValue(input.provider)},
            ${optionalValue(input.idempotencyKey)}
          )
          RETURNING
            "id",
            "organizationId",
            "bankAccountId",
            "batchReference",
            "description",
            "totalAmount"::float8 AS "totalAmount",
            "totalPayments",
            "successful",
            "failed",
            "pending",
            "status",
            "provider",
            "providerBatchId",
            "idempotencyKey",
            "submittedAt",
            "completedAt",
            "createdAt",
            "updatedAt"
        `;

      if (batchRows.length === 0) {
        throw new Error(
          "Unable to create payment batch."
        );
      }

      const batch =
        batchRows[0];

      const payments: BankPaymentRow[] =
        [];

      for (
        const payment of input.payments
      ) {
        const paymentReference =
          requireValue(
            payment.paymentReference,
            "Payment reference"
          );

        const beneficiaryName =
          requireValue(
            payment.beneficiaryName,
            "Beneficiary name"
          );

        const paymentType =
          payment.paymentType;

        if (
          paymentType !== "BANK_TRANSFER" &&
          paymentType !== "PAYBILL" &&
          paymentType !== "TILL"
        ) {
          throw new Error(
            `Unsupported payment type: ${paymentType}`
          );
        }

        const accountNumber =
          optionalValue(
            payment.accountNumber
          );

        const paybillNumber =
          optionalValue(
            payment.paybillNumber
          );

        const tillNumber =
          optionalValue(
            payment.tillNumber
          );

        const accountReference =
          optionalValue(
            payment.accountReference
          );

        const bankCode =
          optionalValue(
            payment.bankCode
          );

        validatePaymentDestination(
          paymentType,
          {
            accountNumber,
            paybillNumber,
            tillNumber,
            accountReference,
            bankCode,
          }
        );

        const amount =
          validateAmount(
            Number(payment.amount)
          );

        const currency =
          optionalValue(
            payment.currency
          ) ?? "KES";

        const duplicatePayment =
          await tx.$queryRaw<
            Array<{ id: string }>
          >`
            SELECT "id"
            FROM "BankPayment"
            WHERE "organizationId" = ${organizationId}
              AND "paymentReference" = ${paymentReference}
            LIMIT 1
          `;

        if (
          duplicatePayment.length > 0
        ) {
          throw new Error(
            `Payment reference "${paymentReference}" already exists.`
          );
        }

        const created =
          await tx.$queryRaw<BankPaymentRow[]>`
            INSERT INTO "BankPayment" (
              "id",
              "organizationId",
              "bankAccountId",
              "batchId",
              "paymentReference",
              "beneficiaryName",
              "accountNumber",
              "paymentType",
              "paybillNumber",
              "tillNumber",
              "accountReference",
              "bankCode",
              "branchCode",
              "amount",
              "currency",
              "description",
              "status",
              "provider",
              "idempotencyKey"
            )
            VALUES (
              ${generateId()},
              ${organizationId},
              ${bankAccountId},
              ${batch.id},
              ${paymentReference},
              ${beneficiaryName},
              ${accountNumber},
              ${paymentType},
              ${paybillNumber},
              ${tillNumber},
              ${accountReference},
              ${bankCode},
              ${optionalValue(payment.branchCode)},
              ${amount},
              ${currency},
              ${optionalValue(payment.description)},
              'PENDING',
              ${optionalValue(
                payment.provider ??
                  input.provider
              )},
              ${optionalValue(
                payment.idempotencyKey
              )}
            )
            RETURNING
              "id",
              "organizationId",
              "bankAccountId",
              "batchId",
              "paymentReference",
              "beneficiaryName",
              "accountNumber",
              "paymentType",
              "paybillNumber",
              "tillNumber",
              "accountReference",
              "bankCode",
              "branchCode",
              "amount"::float8 AS "amount",
              "currency",
              "description",
              "status",
              "provider",
              "providerPaymentId",
              "providerStatus",
              "failureReason",
              "idempotencyKey",
              "submittedAt",
              "completedAt",
              "createdAt",
              "updatedAt"
          `;

        if (created.length > 0) {
          payments.push(
            created[0]
          );
        }
      }

      await refreshBankPaymentBatchTx(
        tx,
        organizationId,
        batch.id
      );

      const refreshed =
        await tx.$queryRaw<BankPaymentBatchRow[]>`
          SELECT
            "id",
            "organizationId",
            "bankAccountId",
            "batchReference",
            "description",
            "totalAmount"::float8 AS "totalAmount",
            "totalPayments",
            "successful",
            "failed",
            "pending",
            "status",
            "provider",
            "providerBatchId",
            "idempotencyKey",
            "submittedAt",
            "completedAt",
            "createdAt",
            "updatedAt"
          FROM "BankPaymentBatch"
          WHERE "id" = ${batch.id}
            AND "organizationId" = ${organizationId}
          LIMIT 1
        `;

      if (refreshed.length === 0) {
        throw new Error(
          "Unable to load created payment batch."
        );
      }

      return {
        batch: refreshed[0],
        payments,
      };
    }
  );
}

/* =========================================================
   REFRESH BATCH TOTALS
========================================================= */

async function refreshBankPaymentBatchTx(
  tx: Parameters<
    Parameters<
      typeof prisma.$transaction
    >[0]
  >[0],
  organizationId: string,
  batchId: string
): Promise<void> {
  await tx.$executeRaw`
    UPDATE "BankPaymentBatch" AS batch
    SET
      "totalAmount" = stats.total_amount,
      "totalPayments" = stats.total_payments,
      "successful" = stats.successful,
      "failed" = stats.failed,
      "pending" = stats.pending,
      "status" = stats.batch_status,
      "completedAt" =
        CASE
          WHEN stats.batch_status IN (
            'SUCCESS',
            'FAILED',
            'PARTIAL'
          )
          AND stats.pending = 0
          THEN COALESCE(
            batch."completedAt",
            CURRENT_TIMESTAMP
          )
          ELSE batch."completedAt"
        END,
      "updatedAt" = CURRENT_TIMESTAMP
    FROM (
      SELECT
        COALESCE(
          SUM("amount"),
          0
        )::NUMERIC(18,2) AS total_amount,

        COUNT(*)::INTEGER AS total_payments,

        COUNT(*) FILTER (
          WHERE "status" = 'SUCCESS'
        )::INTEGER AS successful,

        COUNT(*) FILTER (
          WHERE "status" = 'FAILED'
        )::INTEGER AS failed,

        COUNT(*) FILTER (
          WHERE "status" IN (
            'PENDING',
            'PROCESSING'
          )
        )::INTEGER AS pending,

        CASE
          WHEN COUNT(*) = 0
            THEN 'PENDING'

          WHEN COUNT(*) FILTER (
            WHERE "status" IN (
              'PENDING',
              'PROCESSING'
            )
          ) > 0
            THEN 'PROCESSING'

          WHEN COUNT(*) FILTER (
            WHERE "status" = 'SUCCESS'
          ) = COUNT(*)
            THEN 'SUCCESS'

          WHEN COUNT(*) FILTER (
            WHERE "status" = 'FAILED'
          ) = COUNT(*)
            THEN 'FAILED'

          ELSE 'PARTIAL'
        END AS batch_status

      FROM "BankPayment"

      WHERE "organizationId" = ${organizationId}
        AND "batchId" = ${batchId}
    ) AS stats

    WHERE batch."id" = ${batchId}
      AND batch."organizationId" = ${organizationId}
  `;
}

/* =========================================================
   REFRESH BATCH
========================================================= */

export async function refreshBankPaymentBatch(
  organizationId: string,
  batchId: string
): Promise<BankPaymentBatchRow[]> {
  const tenantId =
    requireValue(
      organizationId,
      "Organization ID"
    );

  const id =
    requireValue(
      batchId,
      "Batch ID"
    );

  await prisma.$transaction(
    async (tx) => {
      await refreshBankPaymentBatchTx(
        tx,
        tenantId,
        id
      );
    }
  );

  return getBankPaymentBatch(
    tenantId,
    id
  );
}

/* =========================================================
   GET PAYMENT
========================================================= */

export async function getBankPayment(
  organizationId: string,
  paymentId: string
): Promise<BankPaymentRow[]> {
  const tenantId =
    requireValue(
      organizationId,
      "Organization ID"
    );

  const id =
    requireValue(
      paymentId,
      "Payment ID"
    );

  return prisma.$queryRaw<BankPaymentRow[]>`
    SELECT
      "id",
      "organizationId",
      "bankAccountId",
      "batchId",
      "paymentReference",
      "beneficiaryName",
      "accountNumber",
      "paymentType",
      "paybillNumber",
      "tillNumber",
      "accountReference",
      "bankCode",
      "branchCode",
      "amount"::float8 AS "amount",
      "currency",
      "description",
      "status",
      "provider",
      "providerPaymentId",
      "providerStatus",
      "failureReason",
      "idempotencyKey",
      "submittedAt",
      "completedAt",
      "createdAt",
      "updatedAt"
    FROM "BankPayment"
    WHERE "id" = ${id}
      AND "organizationId" = ${tenantId}
    LIMIT 1
  `;
}

/* =========================================================
   GET PAYMENT BATCH
========================================================= */

export async function getBankPaymentBatch(
  organizationId: string,
  batchId: string
): Promise<BankPaymentBatchRow[]> {
  const tenantId =
    requireValue(
      organizationId,
      "Organization ID"
    );

  const id =
    requireValue(
      batchId,
      "Batch ID"
    );

  return prisma.$queryRaw<BankPaymentBatchRow[]>`
    SELECT
      "id",
      "organizationId",
      "bankAccountId",
      "batchReference",
      "description",
      "totalAmount"::float8 AS "totalAmount",
      "totalPayments",
      "successful",
      "failed",
      "pending",
      "status",
      "provider",
      "providerBatchId",
      "idempotencyKey",
      "submittedAt",
      "completedAt",
      "createdAt",
      "updatedAt"
    FROM "BankPaymentBatch"
    WHERE "id" = ${id}
      AND "organizationId" = ${tenantId}
    LIMIT 1
  `;
}

/* =========================================================
   LIST PAYMENT BATCHES
========================================================= */

export async function listBankPaymentBatches(
  organizationId: string,
  limit = 50,
  offset = 0
): Promise<BankPaymentBatchRow[]> {
  const tenantId =
    requireValue(
      organizationId,
      "Organization ID"
    );

  const safeLimit =
    Math.min(
      Math.max(
        Number.isFinite(limit)
          ? Math.trunc(limit)
          : 50,
        1
      ),
      100
    );

  const safeOffset =
    Math.max(
      Number.isFinite(offset)
        ? Math.trunc(offset)
        : 0,
      0
    );

  return prisma.$queryRaw<BankPaymentBatchRow[]>`
    SELECT
      "id",
      "organizationId",
      "bankAccountId",
      "batchReference",
      "description",
      "totalAmount"::float8 AS "totalAmount",
      "totalPayments",
      "successful",
      "failed",
      "pending",
      "status",
      "provider",
      "providerBatchId",
      "idempotencyKey",
      "submittedAt",
      "completedAt",
      "createdAt",
      "updatedAt"
    FROM "BankPaymentBatch"
    WHERE "organizationId" = ${tenantId}
    ORDER BY "createdAt" DESC
    LIMIT ${safeLimit}
    OFFSET ${safeOffset}
  `;
}

/* =========================================================
   LIST PAYMENTS
========================================================= */

export async function listBankPayments(
  organizationId: string,
  limit = 50,
  offset = 0
): Promise<BankPaymentRow[]> {
  const tenantId =
    requireValue(
      organizationId,
      "Organization ID"
    );

  const safeLimit =
    Math.min(
      Math.max(
        Number.isFinite(limit)
          ? Math.trunc(limit)
          : 50,
        1
      ),
      100
    );

  const safeOffset =
    Math.max(
      Number.isFinite(offset)
        ? Math.trunc(offset)
        : 0,
      0
    );

  return prisma.$queryRaw<BankPaymentRow[]>`
    SELECT
      "id",
      "organizationId",
      "bankAccountId",
      "batchId",
      "paymentReference",
      "beneficiaryName",
      "accountNumber",
      "paymentType",
      "paybillNumber",
      "tillNumber",
      "accountReference",
      "bankCode",
      "branchCode",
      "amount"::float8 AS "amount",
      "currency",
      "description",
      "status",
      "provider",
      "providerPaymentId",
      "providerStatus",
      "failureReason",
      "idempotencyKey",
      "submittedAt",
      "completedAt",
      "createdAt",
      "updatedAt"
    FROM "BankPayment"
    WHERE "organizationId" = ${tenantId}
    ORDER BY "createdAt" DESC
    LIMIT ${safeLimit}
    OFFSET ${safeOffset}
  `;
}

/* =========================================================
   SUBMIT PAYMENT
========================================================= */

export async function markBankPaymentSubmitted(
  input: MarkBankPaymentSubmittedInput
): Promise<BankPaymentRow[]> {
  const organizationId =
    requireValue(
      input.organizationId,
      "Organization ID"
    );

  const paymentId =
    requireValue(
      input.paymentId,
      "Payment ID"
    );

  const provider =
    requireValue(
      input.provider,
      "Provider"
    );

  const result =
    await prisma.$queryRaw<BankPaymentRow[]>`
      UPDATE "BankPayment"
      SET
        "status" = 'PROCESSING',

        "provider" = ${provider},

        "providerPaymentId" =
          COALESCE(
            ${optionalValue(
              input.providerPaymentId
            )},
            "providerPaymentId"
          ),

        "providerStatus" =
          COALESCE(
            ${optionalValue(
              input.providerStatus
            )},
            "providerStatus"
          ),

        "submittedAt" =
          COALESCE(
            "submittedAt",
            CURRENT_TIMESTAMP
          ),

        "updatedAt" =
          CURRENT_TIMESTAMP

      WHERE "id" = ${paymentId}
        AND "organizationId" = ${organizationId}
        AND "status" = 'PENDING'

      RETURNING
        "id",
        "organizationId",
        "bankAccountId",
        "batchId",
        "paymentReference",
        "beneficiaryName",
        "accountNumber",
        "bankCode",
        "branchCode",
        "amount"::float8 AS "amount",
        "currency",
        "description",
        "status",
        "provider",
        "providerPaymentId",
        "providerStatus",
        "failureReason",
        "idempotencyKey",
        "submittedAt",
        "completedAt",
        "createdAt",
        "updatedAt"
    `;

  if (
    result.length === 0
  ) {
    throw new Error(
      "Payment could not be submitted. It may already be processing or completed."
    );
  }

  return result;
}

/* =========================================================
   UPDATE PAYMENT STATUS
========================================================= */

export async function updateBankPaymentStatus(
  input: UpdateBankPaymentStatusInput
): Promise<BankPaymentRow[]> {
  const organizationId =
    requireValue(
      input.organizationId,
      "Organization ID"
    );

  const paymentId =
    requireValue(
      input.paymentId,
      "Payment ID"
    );

  const result =
    await prisma.$transaction(
      async (tx) => {
        const updated =
          await tx.$queryRaw<BankPaymentRow[]>`
            UPDATE "BankPayment"
            SET
              "status" =
                ${input.status},

              "providerPaymentId" =
                COALESCE(
                  ${optionalValue(
                    input.providerPaymentId
                  )},
                  "providerPaymentId"
                ),

              "providerStatus" =
                COALESCE(
                  ${optionalValue(
                    input.providerStatus
                  )},
                  "providerStatus"
                ),

              "failureReason" =
                CASE
                  WHEN ${input.status} = 'FAILED'
                    THEN ${optionalValue(
                      input.failureReason
                    )}

                  WHEN ${input.status} = 'SUCCESS'
                    THEN NULL

                  ELSE "failureReason"
                END,

              "completedAt" =
                CASE
                  WHEN ${input.status} IN (
                    'SUCCESS',
                    'FAILED',
                    'CANCELLED'
                  )
                    THEN COALESCE(
                      "completedAt",
                      CURRENT_TIMESTAMP
                    )

                  ELSE "completedAt"
                END,

              "updatedAt" =
                CURRENT_TIMESTAMP

            WHERE "id" = ${paymentId}
              AND "organizationId" = ${organizationId}

            RETURNING
              "id",
              "organizationId",
              "bankAccountId",
              "batchId",
              "paymentReference",
              "beneficiaryName",
              "accountNumber",
              "paymentType",
              "paybillNumber",
              "tillNumber",
              "accountReference",
              "bankCode",
              "branchCode",
              "amount"::float8 AS "amount",
              "currency",
              "description",
              "status",
              "provider",
              "providerPaymentId",
              "providerStatus",
              "failureReason",
              "idempotencyKey",
              "submittedAt",
              "completedAt",
              "createdAt",
              "updatedAt"
          `;

        if (
          updated.length === 0
        ) {
          throw new Error(
            "Bank payment not found."
          );
        }

        const payment =
          updated[0];

        if (
          payment.batchId
        ) {
          await refreshBankPaymentBatchTx(
            tx,
            organizationId,
            payment.batchId
          );
        }

        return updated;
      }
    );

  return result;
}

/* =========================================================
   GET PAYMENT BY PROVIDER ID
========================================================= */

export async function getBankPaymentByProviderId(
  providerPaymentId: string
): Promise<BankPaymentRow[]> {
  const providerId =
    requireValue(
      providerPaymentId,
      "Provider payment ID"
    );

  return prisma.$queryRaw<BankPaymentRow[]>`
    SELECT
      "id",
      "organizationId",
      "bankAccountId",
      "batchId",
      "paymentReference",
      "beneficiaryName",
      "accountNumber",
      "paymentType",
      "paybillNumber",
      "tillNumber",
      "accountReference",
      "bankCode",
      "branchCode",
      "amount"::float8 AS "amount",
      "currency",
      "description",
      "status",
      "provider",
      "providerPaymentId",
      "providerStatus",
      "failureReason",
      "idempotencyKey",
      "submittedAt",
      "completedAt",
      "createdAt",
      "updatedAt"
    FROM "BankPayment"
    WHERE "providerPaymentId" = ${providerId}
    LIMIT 1
  `;
}

/* =========================================================
   GET PAYMENT BY IDEMPOTENCY KEY
========================================================= */

export async function getBankPaymentByIdempotencyKey(
  organizationId: string,
  idempotencyKey: string
): Promise<BankPaymentRow[]> {
  const tenantId =
    requireValue(
      organizationId,
      "Organization ID"
    );

  const key =
    requireValue(
      idempotencyKey,
      "Idempotency key"
    );

  return prisma.$queryRaw<BankPaymentRow[]>`
    SELECT
      "id",
      "organizationId",
      "bankAccountId",
      "batchId",
      "paymentReference",
      "beneficiaryName",
      "accountNumber",
      "paymentType",
      "paybillNumber",
      "tillNumber",
      "accountReference",
      "bankCode",
      "branchCode",
      "amount"::float8 AS "amount",
      "currency",
      "description",
      "status",
      "provider",
      "providerPaymentId",
      "providerStatus",
      "failureReason",
      "idempotencyKey",
      "submittedAt",
      "completedAt",
      "createdAt",
      "updatedAt"
    FROM "BankPayment"
    WHERE "organizationId" = ${tenantId}
      AND "idempotencyKey" = ${key}
    LIMIT 1
  `;
}

/* =========================================================
   GET BATCH BY IDEMPOTENCY KEY
========================================================= */

export async function getBankPaymentBatchByIdempotencyKey(
  organizationId: string,
  idempotencyKey: string
): Promise<BankPaymentBatchRow[]> {
  const tenantId =
    requireValue(
      organizationId,
      "Organization ID"
    );

  const key =
    requireValue(
      idempotencyKey,
      "Idempotency key"
    );

  return prisma.$queryRaw<BankPaymentBatchRow[]>`
    SELECT
      "id",
      "organizationId",
      "bankAccountId",
      "batchReference",
      "description",
      "totalAmount"::float8 AS "totalAmount",
      "totalPayments",
      "successful",
      "failed",
      "pending",
      "status",
      "provider",
      "providerBatchId",
      "idempotencyKey",
      "submittedAt",
      "completedAt",
      "createdAt",
      "updatedAt"
    FROM "BankPaymentBatch"
    WHERE "organizationId" = ${tenantId}
      AND "idempotencyKey" = ${key}
    LIMIT 1
  `;
}

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  createBankPaymentBatch,
  createBankPaymentBatchWithPayments,
  createBankPayment,
  getBankPayment,
  getBankPaymentBatch,
  listBankPaymentBatches,
  listBankPayments,
  refreshBankPaymentBatch,
  markBankPaymentSubmitted,
  updateBankPaymentStatus,
  getBankPaymentByProviderId,
  getBankPaymentByIdempotencyKey,
  getBankPaymentBatchByIdempotencyKey,
};