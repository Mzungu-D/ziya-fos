import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

export interface CreateBankPaymentBatchInput {
  organizationId: string;
  bankAccountId: string;
  batchReference: string;
  description?: string;
  provider?: string;
  idempotencyKey?: string;
}

export interface CreateBankPaymentInput {
  organizationId: string;
  bankAccountId: string;
  batchId?: string;
  paymentReference: string;
  beneficiaryName: string;
  accountNumber: string;
  bankCode?: string;
  branchCode?: string;
  amount: number;
  currency?: string;
  description?: string;
  provider?: string;
  idempotencyKey?: string;
}

function cuid(): string {
  return `${Date.now().toString(36)}${crypto.randomUUID().replace(/-/g, "")}`;
}

export async function createBankPaymentBatch(
  input: CreateBankPaymentBatchInput
) {
  return prisma.$queryRaw<
    Array<{
      id: string;
      organizationId: string;
      bankAccountId: string;
      batchReference: string;
      status: string;
    }>
  >`
    INSERT INTO "BankPaymentBatch" (
      "id",
      "organizationId",
      "bankAccountId",
      "batchReference",
      "description",
      "provider",
      "idempotencyKey"
    )
    VALUES (
      ${cuid()},
      ${input.organizationId},
      ${input.bankAccountId},
      ${input.batchReference},
      ${input.description ?? null},
      ${input.provider ?? null},
      ${input.idempotencyKey ?? null}
    )
    RETURNING
      "id",
      "organizationId",
      "bankAccountId",
      "batchReference",
      "status"
  `;
}

export async function createBankPayment(
  input: CreateBankPaymentInput
) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Payment amount must be greater than zero");
  }

  return prisma.$queryRaw<
    Array<{
      id: string;
      paymentReference: string;
      status: string;
    }>
  >`
    INSERT INTO "BankPayment" (
      "id",
      "organizationId",
      "bankAccountId",
      "batchId",
      "paymentReference",
      "beneficiaryName",
      "accountNumber",
      "bankCode",
      "branchCode",
      "amount",
      "currency",
      "description",
      "provider",
      "idempotencyKey"
    )
    VALUES (
      ${cuid()},
      ${input.organizationId},
      ${input.bankAccountId},
      ${input.batchId ?? null},
      ${input.paymentReference},
      ${input.beneficiaryName},
      ${input.accountNumber},
      ${input.bankCode ?? null},
      ${input.branchCode ?? null},
      ${new Prisma.Decimal(input.amount)},
      ${input.currency ?? "KES"},
      ${input.description ?? null},
      ${input.provider ?? null},
      ${input.idempotencyKey ?? null}
    )
    RETURNING
      "id",
      "paymentReference",
      "status"
  `;
}

export async function getBankPayment(
  organizationId: string,
  paymentId: string
) {
  return prisma.$queryRaw`
    SELECT *
    FROM "BankPayment"
    WHERE "organizationId" = ${organizationId}
      AND "id" = ${paymentId}
    LIMIT 1
  `;
}

export async function getBankPaymentBatch(
  organizationId: string,
  batchId: string
) {
  return prisma.$queryRaw`
    SELECT *
    FROM "BankPaymentBatch"
    WHERE "organizationId" = ${organizationId}
      AND "id" = ${batchId}
    LIMIT 1
  `;
}

export async function listBankPayments(
  organizationId: string,
  limit = 50,
  offset = 0
) {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const safeOffset = Math.max(offset, 0);

  return prisma.$queryRaw`
    SELECT *
    FROM "BankPayment"
    WHERE "organizationId" = ${organizationId}
    ORDER BY "createdAt" DESC
    LIMIT ${safeLimit}
    OFFSET ${safeOffset}
  `;
}