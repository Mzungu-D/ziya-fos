import type { Response } from "express";

import prisma from "../config/prisma";
import type { AuthRequest } from "../middleware/auth.middleware";
import { ACCOUNTING_EFFECTIVE_STATUSES } from "../utils/accounting";

/* =========================================================
   CONSTANTS
========================================================= */

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 10;
const MAX_HISTORY_MESSAGE_LENGTH = 4000;
const MAX_AR_AP_RECORDS = 50;
const MAX_EXPENSE_CATEGORIES = 10;

const DEFAULT_OPENAI_MODEL =
  process.env.OPENAI_MODEL?.trim() || "gpt-6-luna";

/* =========================================================
   TYPES
========================================================= */

type TenantContext = {
  userId: string;
  organizationId: string;
};

type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

type AccountBalance = {
  accountId: string;
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
};

type FinancialInsight = {
  type: "positive" | "warning" | "neutral";
  title: string;
  message: string;
};

type FinancialContext = {
  organization: {
    id: string;
    name: string;
    currency: string;
  };

  accounting: {
    effectiveStatuses: string[];
    postedJournalEntries: number;
  };

  metrics: {
    revenue: number;
    expenses: number;
    netProfit: number;
    assets: number;
    liabilities: number;
    equity: number;
    cash: number;
    accountsReceivable: number;
    accountsPayable: number;
    overdueReceivables: number;
    overduePayables: number;
  };

  cashFlow: {
    operating: number;
    investing: number;
    financing: number;
    netIncreaseDecrease: number;
    closingCashBalance: number;
  };

  topAccounts: AccountBalance[];

  topExpenses: Array<{
    category: string;
    amount: number;
  }>;

  receivables: Array<{
    invoiceNumber: string;
    customerName: string;
    outstandingBalance: number;
    dueDate: string;
    paymentStatus: string;
    status: string;
  }>;

  payables: Array<{
    invoiceNumber: string;
    vendorName: string;
    outstandingBalance: number;
    dueDate: string;
    paymentStatus: string;
    status: string;
  }>;

  insights: FinancialInsight[];
};

/* =========================================================
   HELPERS
========================================================= */

function getTenantContext(
  req: AuthRequest
): TenantContext | null {
  const userId = req.user?.userId?.trim();
  const organizationId =
    req.user?.organizationId?.trim();

  if (!userId || !organizationId) {
    return null;
  }

  const sessionType = (
    req.user as
      | (AuthRequest["user"] & {
          sessionType?: string;
        })
      | undefined
  )?.sessionType;

  /*
   * Financial Assistant is strictly tenant-scoped.
   * Platform sessions must not access tenant financial data.
   */
  if (
    sessionType &&
    sessionType !== "TENANT"
  ) {
    return null;
  }

  return {
    userId,
    organizationId,
  };
}

function toNumber(
  value: unknown
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function roundMoney(
  value: number
): number {
  return (
    Math.round(
      (value + Number.EPSILON) * 100
    ) / 100
  );
}

function normalizeMoney(
  value: unknown
): number {
  return roundMoney(
    toNumber(value)
  );
}

function cleanText(
  value: unknown,
  maxLength: number
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .slice(0, maxLength);
}

function getOpenAIKey(): string | null {
  const key =
    process.env.OPENAI_API_KEY?.trim();

  return key || null;
}

/* =========================================================
   BUILD FINANCIAL CONTEXT
========================================================= */

async function buildFinancialContext(
  organizationId: string
): Promise<FinancialContext> {
  /*
   * Everything below is scoped by organizationId.
   *
   * The browser never supplies organizationId.
   * It is taken exclusively from the authenticated
   * tenant session.
   */

  const organization =
    await prisma.organization.findUnique({
      where: {
        id: organizationId,
      },

      select: {
        id: true,
        name: true,
        currency: true,
      },
    });

  if (!organization) {
    throw new Error(
      "ORGANIZATION_NOT_FOUND"
    );
  }

  /* =======================================================
     POSTED / APPROVED JOURNAL ENTRIES
  ======================================================= */

  const postedJournalEntries =
    await prisma.journalEntry.count({
      where: {
        organizationId,

        status: {
          in: [
            ...ACCOUNTING_EFFECTIVE_STATUSES,
          ],
        },
      },
    });

  /* =======================================================
     ACCOUNTING LEDGER BALANCES

     JournalEntryLine is the authoritative
     double-entry accounting source.
  ======================================================= */

  const accountAggregates =
    await prisma.journalEntryLine.groupBy({
      by: ["accountId"],

      where: {
        journalEntry: {
          organizationId,

          status: {
            in: [
              ...ACCOUNTING_EFFECTIVE_STATUSES,
            ],
          },
        },
      },

      _sum: {
        debit: true,
        credit: true,
      },
    });

  const accounts =
    await prisma.account.findMany({
      where: {
        organizationId,
      },

      select: {
        id: true,
        code: true,
        name: true,
        type: true,
      },

      orderBy: [
        {
          code: "asc",
        },
        {
          id: "asc",
        },
      ],
    });

  const aggregateMap =
    new Map(
      accountAggregates.map(
        (aggregate) => [
          aggregate.accountId,
          aggregate,
        ]
      )
    );

  const accountBalances: AccountBalance[] =
    accounts.map((account) => {
      const aggregate =
        aggregateMap.get(account.id);

      const debit =
        normalizeMoney(
          aggregate?._sum.debit
        );

      const credit =
        normalizeMoney(
          aggregate?._sum.credit
        );

      /*
       * Debit-normal account types:
       * ASSET and EXPENSE
       *
       * Credit-normal account types:
       * LIABILITY, EQUITY and INCOME
       */
      const isDebitNormal =
        account.type === "ASSET" ||
        account.type === "EXPENSE";

      const balance =
        isDebitNormal
          ? debit - credit
          : credit - debit;

      return {
        accountId: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        debit,
        credit,
        balance: roundMoney(balance),
      };
    });

  /* =======================================================
     FINANCIAL STATEMENT TOTALS
  ======================================================= */

  const revenue =
    roundMoney(
      accountBalances
        .filter(
          (account) =>
            account.type === "INCOME"
        )
        .reduce(
          (total, account) =>
            total + account.balance,
          0
        )
    );

  const expenses =
    roundMoney(
      accountBalances
        .filter(
          (account) =>
            account.type === "EXPENSE"
        )
        .reduce(
          (total, account) =>
            total + account.balance,
          0
        )
    );

  const assets =
    roundMoney(
      accountBalances
        .filter(
          (account) =>
            account.type === "ASSET"
        )
        .reduce(
          (total, account) =>
            total + account.balance,
          0
        )
    );

  const liabilities =
    roundMoney(
      accountBalances
        .filter(
          (account) =>
            account.type ===
            "LIABILITY"
        )
        .reduce(
          (total, account) =>
            total + account.balance,
          0
        )
    );

  const equity =
    roundMoney(
      accountBalances
        .filter(
          (account) =>
            account.type === "EQUITY"
        )
        .reduce(
          (total, account) =>
            total + account.balance,
          0
        )
    );

  const netProfit =
    roundMoney(
      revenue - expenses
    );

  /* =======================================================
     CASH ACCOUNTS
  ======================================================= */

  const cashAccounts =
    accountBalances.filter(
      (account) => {
        const name =
          account.name.toLowerCase();

        const code =
          account.code.toLowerCase();

        return (
          account.type === "ASSET" &&
          (
            code.startsWith("11") ||
            name.includes("cash") ||
            name.includes("bank") ||
            name.includes("m-pesa") ||
            name.includes("mpesa") ||
            name.includes("mobile money")
          )
        );
      }
    );

  const cash =
    roundMoney(
      cashAccounts.reduce(
        (total, account) =>
          total + account.balance,
        0
      )
    );

  /* =======================================================
     ACCOUNTS RECEIVABLE
  ======================================================= */

  const receivables =
    await prisma.accountsReceivable.findMany({
      where: {
        organizationId,

        outstandingBalance: {
          gt: 0,
        },
      },

      select: {
        invoiceNumber: true,
        customerName: true,
        outstandingBalance: true,
        dueDate: true,
        paymentStatus: true,
        status: true,
      },

      orderBy: [
        {
          dueDate: "asc",
        },
        {
          outstandingBalance: "desc",
        },
      ],

      take: MAX_AR_AP_RECORDS,
    });

  /* =======================================================
     ACCOUNTS PAYABLE
  ======================================================= */

  const payables =
    await prisma.accountsPayable.findMany({
      where: {
        organizationId,

        outstandingBalance: {
          gt: 0,
        },
      },

      select: {
        invoiceNumber: true,
        outstandingBalance: true,
        dueDate: true,
        paymentStatus: true,
        status: true,

        vendor: {
          select: {
            name: true,
          },
        },
      },

      orderBy: [
        {
          dueDate: "asc",
        },
        {
          outstandingBalance: "desc",
        },
      ],

      take: MAX_AR_AP_RECORDS,
    });

  const now =
    new Date();

  const totalAccountsReceivable =
    roundMoney(
      receivables.reduce(
        (total, item) =>
          total +
          toNumber(
            item.outstandingBalance
          ),
        0
      )
    );

  const totalAccountsPayable =
    roundMoney(
      payables.reduce(
        (total, item) =>
          total +
          toNumber(
            item.outstandingBalance
          ),
        0
      )
    );

  const overdueReceivables =
    roundMoney(
      receivables
        .filter(
          (item) =>
            item.dueDate < now &&
            toNumber(
              item.outstandingBalance
            ) > 0
        )
        .reduce(
          (total, item) =>
            total +
            toNumber(
              item.outstandingBalance
            ),
          0
        )
    );

  const overduePayables =
    roundMoney(
      payables
        .filter(
          (item) =>
            item.dueDate < now &&
            toNumber(
              item.outstandingBalance
            ) > 0
        )
        .reduce(
          (total, item) =>
            total +
            toNumber(
              item.outstandingBalance
            ),
          0
        )
    );

  /* =======================================================
     EXPENSE ANALYSIS
  ======================================================= */

  const expenseGroups =
    await prisma.expense.groupBy({
      by: ["category"],

      where: {
        organizationId,

        status: "POSTED",
      },

      _sum: {
        amount: true,
      },

      orderBy: {
        _sum: {
          amount: "desc",
        },
      },

      take: MAX_EXPENSE_CATEGORIES,
    });

  const topExpenses =
    expenseGroups.map(
      (group) => ({
        category:
          group.category,

        amount:
          normalizeMoney(
            group._sum.amount
          ),
      })
    );

  /* =======================================================
     TOP ACCOUNT BALANCES
  ======================================================= */

  const topAccounts =
    [...accountBalances]
      .filter(
        (account) =>
          Math.abs(
            account.balance
          ) > 0.005
      )
      .sort(
        (a, b) =>
          Math.abs(b.balance) -
          Math.abs(a.balance)
      )
      .slice(0, 20);

  /* =======================================================
     CASH FLOW

     Use the authoritative cash ledger directly rather
     than relying on generic Transaction records.
  ======================================================= */

  let operatingCashFlow = 0;
  let investingCashFlow = 0;
  let financingCashFlow = 0;

  if (cashAccounts.length > 0) {
    const cashAccountIds =
      cashAccounts.map(
        (account) =>
          account.accountId
      );

    const cashJournalLines =
      await prisma.journalEntryLine.findMany({
        where: {
          accountId: {
            in: cashAccountIds,
          },

          journalEntry: {
            organizationId,

            status: {
              in: [
                ...ACCOUNTING_EFFECTIVE_STATUSES,
              ],
            },
          },
        },

        select: {
          debit: true,
          credit: true,

          accountId: true,

          journalEntry: {
            select: {
              debitAccountId: true,
              creditAccountId: true,
              transactionDate: true,

              lines: {
                select: {
                  accountId: true,
                  debit: true,
                  credit: true,

                  account: {
                    select: {
                      code: true,
                      name: true,
                      type: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

    for (
      const cashLine of cashJournalLines
    ) {
      const journal =
        cashLine.journalEntry;

      const cashMovement =
        toNumber(
          cashLine.debit
        ) -
        toNumber(
          cashLine.credit
        );

      if (
        Math.abs(cashMovement) <
        0.005
      ) {
        continue;
      }

      const counterpartLines =
        journal.lines.filter(
          (line) =>
            !cashAccountIds.includes(
              line.accountId
            )
        );

      /*
       * Classification is intentionally conservative.
       *
       * Asset purchases/disposals are investing.
       * Equity/debt financing is financing.
       * Other cash activity is operating.
       */

      const counterpartTypes =
        counterpartLines.map(
          (line) =>
            line.account.type
        );

      const counterpartCodes =
        counterpartLines.map(
          (line) =>
            line.account.code
        );

      const isInvesting =
        counterpartTypes.some(
          (type) =>
            type === "ASSET"
        ) &&
        counterpartCodes.some(
          (code) =>
            code.startsWith("15") ||
            code.startsWith("16") ||
            code.startsWith("17")
        );

      const isFinancing =
        counterpartTypes.some(
          (type) =>
            type === "LIABILITY" ||
            type === "EQUITY"
        );

      if (isInvesting) {
        investingCashFlow +=
          cashMovement;
      } else if (isFinancing) {
        financingCashFlow +=
          cashMovement;
      } else {
        operatingCashFlow +=
          cashMovement;
      }
    }
  }

  operatingCashFlow =
    roundMoney(
      operatingCashFlow
    );

  investingCashFlow =
    roundMoney(
      investingCashFlow
    );

  financingCashFlow =
    roundMoney(
      financingCashFlow
    );

  const netIncreaseDecrease =
    roundMoney(
      operatingCashFlow +
        investingCashFlow +
        financingCashFlow
    );

  const closingCashBalance =
    roundMoney(cash);

  /* =======================================================
     INSIGHTS
  ======================================================= */

  const insights: FinancialInsight[] =
    [];

  if (
    postedJournalEntries === 0
  ) {
    insights.push({
      type: "neutral",
      title:
        "Financial data is being established",
      message:
        "There are currently no posted or approved journal entries available for analysis.",
    });
  } else {
    if (
      netProfit > 0 &&
      revenue > 0
    ) {
      const margin =
        roundMoney(
          (netProfit /
            revenue) *
            100
        );

      insights.push({
        type: "positive",
        title:
          "Profitability is positive",
        message:
          `Recorded revenue is ${revenue.toFixed(
            2
          )} ${organization.currency}, with net profit of ${netProfit.toFixed(
            2
          )} ${organization.currency}, representing approximately ${margin.toFixed(
            1
          )}% of revenue.`,
      });
    } else if (
      netProfit < 0 &&
      revenue > 0
    ) {
      insights.push({
        type: "warning",
        title:
          "Profitability requires attention",
        message:
          `Recorded expenses currently exceed revenue by ${Math.abs(
            netProfit
          ).toFixed(
            2
          )} ${organization.currency}.`,
      });
    }

    if (
      overdueReceivables > 0
    ) {
      insights.push({
        type: "warning",
        title:
          "Overdue receivables are present",
        message:
          `${overdueReceivables.toFixed(
            2
          )} ${organization.currency} of outstanding receivables are currently past their due dates.`,
      });
    }

    if (
      overduePayables > 0
    ) {
      insights.push({
        type: "warning",
        title:
          "Overdue payables are present",
        message:
          `${overduePayables.toFixed(
            2
          )} ${organization.currency} of outstanding supplier obligations are currently past their due dates.`,
      });
    }

    if (
      closingCashBalance < 0
    ) {
      insights.push({
        type: "warning",
        title:
          "Cash position requires attention",
        message:
          "The calculated cash-account balance is negative based on effective journal entries.",
      });
    } else if (
      operatingCashFlow > 0
    ) {
      insights.push({
        type: "positive",
        title:
          "Operating cash generation is positive",
        message:
          `Operating activities currently contribute approximately ${operatingCashFlow.toFixed(
            2
          )} ${organization.currency} of net cash movement.`,
      });
    }
  }

  if (
    liabilities > assets &&
    assets > 0
  ) {
    insights.push({
      type: "warning",
      title:
        "Liability exposure requires review",
      message:
        `Recorded liabilities of ${liabilities.toFixed(
          2
        )} ${organization.currency} exceed recorded assets of ${assets.toFixed(
          2
        )} ${organization.currency}.`,
    });
  }

  if (
    insights.length === 0
  ) {
    insights.push({
      type: "neutral",
      title:
        "Financial activity is available",
      message:
        "The assistant has access to the tenant's effective accounting data and can answer questions using the available financial records.",
    });
  }

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      currency:
        organization.currency ||
        "KES",
    },

    accounting: {
      effectiveStatuses:
        [
          ...ACCOUNTING_EFFECTIVE_STATUSES,
        ],

      postedJournalEntries,
    },

    metrics: {
      revenue,
      expenses,
      netProfit,
      assets,
      liabilities,
      equity,
      cash: closingCashBalance,

      accountsReceivable:
        totalAccountsReceivable,

      accountsPayable:
        totalAccountsPayable,

      overdueReceivables,
      overduePayables,
    },

    cashFlow: {
      operating:
        operatingCashFlow,

      investing:
        investingCashFlow,

      financing:
        financingCashFlow,

      netIncreaseDecrease,

      closingCashBalance,
    },

    topAccounts,

    topExpenses,

    receivables:
      receivables.map(
        (item) => ({
          invoiceNumber:
            item.invoiceNumber,

          customerName:
            item.customerName,

          outstandingBalance:
            normalizeMoney(
              item.outstandingBalance
            ),

          dueDate:
            item.dueDate.toISOString(),

          paymentStatus:
            item.paymentStatus,

          status:
            item.status,
        })
      ),

    payables:
      payables.map(
        (item) => ({
          invoiceNumber:
            item.invoiceNumber,

          vendorName:
            item.vendor.name,

          outstandingBalance:
            normalizeMoney(
              item.outstandingBalance
            ),

          dueDate:
            item.dueDate.toISOString(),

          paymentStatus:
            item.paymentStatus,

          status:
            item.status,
        })
      ),

    insights,
  };
}

/* =========================================================
   OPENAI SYSTEM INSTRUCTIONS
========================================================= */

function buildSystemInstructions(
  context: FinancialContext
): string {
  return `
You are the Financial Assistant inside Ziya FOS.

You are assisting the authenticated user of the following organization:

Organization: ${context.organization.name}
Currency: ${context.organization.currency}

IMPORTANT ACCOUNTING RULES:

1. Use ONLY the financial information supplied in the context.
2. Do not invent transactions, balances, invoices, customers, suppliers,
   accounting entries, tax amounts, or financial results.
3. Treat POSTED and APPROVED journal entries as the effective accounting
   source.
4. JournalEntryLine is the authoritative double-entry ledger source.
5. Do not use generic transaction records as a substitute for accounting data.
6. If the supplied information is insufficient to answer a question,
   clearly say that the available accounting data is insufficient.
7. Never claim that an action was performed unless an actual backend action
   endpoint exists and has confirmed it.
8. This assistant is read-only. It must not modify accounting records.
9. Do not expose internal database IDs, organization IDs, authentication
   tokens, API keys, or implementation secrets.
10. Do not provide fabricated legal, tax, audit, investment, or regulatory
    conclusions.
11. For tax questions, distinguish accounting information from formal tax
    advice.
12. When discussing financial results, distinguish recorded facts from
    recommendations or observations.
13. Use the organization's configured currency.
14. Keep answers professional, concise, and useful for finance teams.
15. When calculations are required, calculate only from supplied values.
16. Never refer to the organization as a "tenant" when speaking to the user.

CURRENT FINANCIAL CONTEXT:

${JSON.stringify(
  context,
  null,
  2
)}
`.trim();
}

/* =========================================================
   OPENAI RESPONSE API
========================================================= */

async function requestOpenAIResponse(
  context: FinancialContext,
  message: string,
  history: ChatHistoryMessage[]
): Promise<string> {
  const apiKey =
    getOpenAIKey();

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY_NOT_CONFIGURED"
    );
  }

  const instructions =
    buildSystemInstructions(
      context
    );

  const inputMessages = [
    ...history.slice(
      -MAX_HISTORY_MESSAGES
    ),
    {
      role: "user" as const,
      content: message,
    },
  ];

  const response =
    await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${apiKey}`,

          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          model:
            DEFAULT_OPENAI_MODEL,

          instructions,

          input:
            inputMessages.map(
              (item) => ({
                role:
                  item.role,

                content:
                  item.content,
              })
            ),

          max_output_tokens: 900,
        }),
      }
    );

  if (!response.ok) {
    let providerMessage =
      "The financial assistant service is temporarily unavailable.";

    try {
      const errorBody =
        (await response.json()) as {
          error?: {
            message?: string;
          };
        };

      if (
        errorBody?.error?.message
      ) {
        console.error(
          "OPENAI PROVIDER ERROR:",
          errorBody.error.message
        );
      }
    } catch {
      /*
       * Do not allow provider response parsing
       * failures to replace the main error.
       */
    }

    throw new Error(
      providerMessage
    );
  }

  const data =
    (await response.json()) as {
      output_text?: string;

      output?: Array<{
        type?: string;
        content?: Array<{
          type?: string;
          text?: string;
        }>;
      }>;
    };

  if (
    typeof data.output_text ===
      "string" &&
    data.output_text.trim()
  ) {
    return data.output_text.trim();
  }

  /*
   * Defensive fallback in case output_text is not
   * returned by a future/alternate Responses API shape.
   */

  const outputText =
    data.output
      ?.flatMap(
        (item) =>
          item.content ?? []
      )
      .filter(
        (content) =>
          content.type ===
            "output_text" &&
          typeof content.text ===
            "string"
      )
      .map(
        (content) =>
          content.text as string
      )
      .join("\n")
      .trim();

  if (outputText) {
    return outputText;
  }

  throw new Error(
    "OPENAI_EMPTY_RESPONSE"
  );
}

/* =========================================================
   GET FINANCIAL ASSISTANT OVERVIEW
========================================================= */

export const getFinancialAssistantOverview =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const context =
        getTenantContext(req);

      if (!context) {
        return res.status(403).json({
          success: false,
          code:
            "TENANT_SESSION_REQUIRED",
          message:
            "A valid tenant session is required.",
        });
      }

      const financialContext =
        await buildFinancialContext(
          context.organizationId
        );

      return res.status(200).json({
        success: true,

        data: {
          organization:
            financialContext.organization,

          metrics:
            financialContext.metrics,

          cashFlow:
            financialContext.cashFlow,

          insights:
            financialContext.insights,

          accounting:
            financialContext.accounting,

          generatedAt:
            new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error(
        "FINANCIAL ASSISTANT OVERVIEW ERROR:",
        error
      );

      if (
        error instanceof Error &&
        error.message ===
          "ORGANIZATION_NOT_FOUND"
      ) {
        return res.status(404).json({
          success: false,
          code:
            "ORGANIZATION_NOT_FOUND",
          message:
            "Organization could not be found.",
        });
      }

      return res.status(500).json({
        success: false,
        code:
          "FINANCIAL_ASSISTANT_OVERVIEW_ERROR",
        message:
          "Failed to load financial assistant data.",
      });
    }
  };

/* =========================================================
   CHAT WITH FINANCIAL ASSISTANT
========================================================= */

export const chatWithFinancialAssistant =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const context =
        getTenantContext(req);

      if (!context) {
        return res.status(403).json({
          success: false,
          code:
            "TENANT_SESSION_REQUIRED",
          message:
            "A valid tenant session is required.",
        });
      }

      const message =
        cleanText(
          req.body?.message,
          MAX_MESSAGE_LENGTH
        );

      if (!message) {
        return res.status(400).json({
          success: false,
          code:
            "MESSAGE_REQUIRED",
          message:
            "A message is required.",
        });
      }

      let history:
        ChatHistoryMessage[] =
        [];

      if (
        Array.isArray(
          req.body?.history
        )
      ) {
        history =
          req.body.history
            .slice(
              -MAX_HISTORY_MESSAGES
            )
            .filter(
              (
                item: unknown
              ): item is {
                role: string;
                content: unknown;
              } =>
                typeof item ===
                  "object" &&
                item !== null &&
                typeof (
                  item as {
                    role?: unknown;
                  }
                ).role ===
                  "string"
            )
            .map(
              (
                item
              ) => ({
                role:
                  item.role ===
                  "assistant"
                    ? ("assistant" as const)
                    : ("user" as const),

                content:
                  cleanText(
                    item.content,
                    MAX_HISTORY_MESSAGE_LENGTH
                  ),
              })
            )
            .filter(
              (item) =>
                item.content.length >
                0
            );
      }

      /*
       * Rebuild the financial context on EVERY request.
       *
       * This prevents stale financial information from being
       * retained in the browser or supplied from another
       * organization.
       */

      const financialContext =
        await buildFinancialContext(
          context.organizationId
        );

      const answer =
        await requestOpenAIResponse(
          financialContext,
          message,
          history
        );

      return res.status(200).json({
        success: true,

        data: {
          answer,

          generatedAt:
            new Date().toISOString(),

          organization:
            financialContext.organization.name,
        },
      });
    } catch (error) {
      console.error(
        "FINANCIAL ASSISTANT CHAT ERROR:",
        error
      );

      if (
        error instanceof Error &&
        error.message ===
          "OPENAI_API_KEY_NOT_CONFIGURED"
      ) {
        return res.status(503).json({
          success: false,
          code:
            "AI_SERVICE_NOT_CONFIGURED",
          message:
            "The financial assistant service has not been configured.",
        });
      }

      if (
        error instanceof Error &&
        error.message ===
          "OPENAI_EMPTY_RESPONSE"
      ) {
        return res.status(502).json({
          success: false,
          code:
            "AI_EMPTY_RESPONSE",
          message:
            "The financial assistant did not return a response.",
        });
      }

      if (
        error instanceof Error &&
        error.message ===
          "ORGANIZATION_NOT_FOUND"
      ) {
        return res.status(404).json({
          success: false,
          code:
            "ORGANIZATION_NOT_FOUND",
          message:
            "Organization could not be found.",
        });
      }

      return res.status(500).json({
        success: false,
        code:
          "FINANCIAL_ASSISTANT_ERROR",
        message:
          "Failed to process the financial assistant request.",
      });
    }
  };