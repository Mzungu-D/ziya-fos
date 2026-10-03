import {
  AlertCircle,
  Bot,
  CircleHelp,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { FormEvent } from "react";

import { authenticatedFetch } from "../../lib/auth";

interface FinancialInsight {
  title: string;
  message: string;
  tone: "positive" | "attention" | "neutral";
}

interface FinancialMetrics {
  revenue: number;
  expenses: number;
  netProfit: number;
  assets: number;
  liabilities: number;
  equity: number;
  operatingCashFlow: number;
  closingCash: number;
  receivablesOutstanding: number;
  payablesOutstanding: number;
  overdueReceivables: number;
  overduePayables: number;
  journalEntryCount: number;
}

interface FinancialOverview {
  success: boolean;
  organization?: {
    id: string;
    name: string;
    currency: string;
  };
  metrics?: FinancialMetrics;
  insights?: FinancialInsight[];
  message?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

interface ChatResponse {
  success: boolean;
  answer?: string;
  message?: string;
}

type InsightTone =
  | "positive"
  | "attention"
  | "neutral";

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 10;

const SUGGESTED_QUESTIONS = [
  "How is our financial position?",
  "What should management pay attention to?",
  "Explain our current cash position.",
  "What are our main financial risks?",
];

function toNumber(value: unknown): number {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(
      value.replace(/,/g, "").trim(),
    );

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  return 0;
}

function formatCurrency(
  value: number,
  currency = "KES",
): string {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactCurrency(
  value: number,
  currency = "KES",
): string {
  const absoluteValue = Math.abs(value);

  if (absoluteValue >= 1_000_000_000) {
    return `${currency} ${(value / 1_000_000_000).toFixed(1)}B`;
  }

  if (absoluteValue >= 1_000_000) {
    return `${currency} ${(value / 1_000_000).toFixed(1)}M`;
  }

  if (absoluteValue >= 1_000) {
    return `${currency} ${(value / 1_000).toFixed(1)}K`;
  }

  return formatCurrency(value, currency);
}

async function apiGet<T>(
  endpoint: string,
): Promise<T> {
  const response =
    await authenticatedFetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      credentials: "include",
    });

  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    let message =
      `Request failed with status ${response.status}.`;

    if (
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof payload.message === "string"
    ) {
      message = payload.message;
    }

    throw new Error(message);
  }

  return payload as T;
}

async function apiPost<T>(
  endpoint: string,
  body: unknown,
): Promise<T> {
  const response =
    await authenticatedFetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(body),
    });

  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    let message =
      `Request failed with status ${response.status}.`;

    if (
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof payload.message === "string"
    ) {
      message = payload.message;
    }

    throw new Error(message);
  }

  return payload as T;
}

function getToneClasses(
  tone: InsightTone,
) {
  switch (tone) {
    case "positive":
      return {
        icon:
          "bg-emerald-50 text-emerald-600 ring-emerald-100",
        badge:
          "border-emerald-200 bg-emerald-50 text-emerald-700",
        accent: "bg-emerald-500",
      };

    case "attention":
      return {
        icon:
          "bg-amber-50 text-amber-600 ring-amber-100",
        badge:
          "border-amber-200 bg-amber-50 text-amber-700",
        accent: "bg-amber-500",
      };

    default:
      return {
        icon:
          "bg-slate-50 text-slate-600 ring-slate-200",
        badge:
          "border-slate-200 bg-slate-50 text-slate-600",
        accent: "bg-slate-400",
      };
  }
}

function createFallbackInsight(
  metrics: FinancialMetrics,
  currency: string,
): FinancialInsight {
  const hasActivity =
    metrics.revenue !== 0 ||
    metrics.expenses !== 0 ||
    metrics.assets !== 0 ||
    metrics.liabilities !== 0 ||
    metrics.journalEntryCount !== 0;

  if (!hasActivity) {
    return {
      title:
        "Your financial data is being established",
      message:
        "There is not yet enough posted accounting activity to generate a meaningful financial insight.",
      tone: "neutral",
    };
  }

  if (
    metrics.revenue > 0 &&
    metrics.netProfit < 0
  ) {
    return {
      title:
        "Profitability requires attention",
      message:
        `Recorded revenue is ${formatCompactCurrency(
          metrics.revenue,
          currency,
        )}, while the recorded net result is a loss of ${formatCompactCurrency(
          Math.abs(metrics.netProfit),
          currency,
        )}.`,
      tone: "attention",
    };
  }

  if (
    metrics.overduePayables > 0 ||
    metrics.overdueReceivables > 0
  ) {
    return {
      title:
        "Outstanding balances require review",
      message:
        "There are overdue receivables or payables in the recorded financial data. Review the underlying balances and due dates.",
      tone: "attention",
    };
  }

  if (metrics.closingCash < 0) {
    return {
      title:
        "Cash position requires attention",
      message:
        `The recorded closing cash position is ${formatCompactCurrency(
          Math.abs(metrics.closingCash),
          currency,
        )} below zero.`,
      tone: "attention",
    };
  }

  if (
    metrics.revenue > 0 &&
    metrics.netProfit > 0
  ) {
    const margin =
      (metrics.netProfit / metrics.revenue) * 100;

    return {
      title:
        "Profitability is positive",
      message:
        `Recorded revenue is ${formatCompactCurrency(
          metrics.revenue,
          currency,
        )}, with net profit of ${formatCompactCurrency(
          metrics.netProfit,
          currency,
        )} and a recorded net margin of ${margin.toFixed(
          1,
        )}%.`,
      tone: "positive",
    };
  }

  if (metrics.operatingCashFlow > 0) {
    return {
      title:
        "Operating cash generation is positive",
      message:
        `Recorded operating activities generated ${formatCompactCurrency(
          metrics.operatingCashFlow,
          currency,
        )}.`,
      tone: "positive",
    };
  }

  return {
    title:
      "Financial activity is available",
    message:
      "Posted financial data is available for management review.",
    tone: "neutral",
  };
}

function generateMessageId(): string {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export default function FinancialAssistant() {
  const [overview, setOverview] =
    useState<FinancialOverview | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [chatOpen, setChatOpen] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [sending, setSending] =
    useState(false);

  const [chatError, setChatError] =
    useState<string | null>(null);

  const [messages, setMessages] =
    useState<ChatMessage[]>([]);

  const messagesEndRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const loadOverview =
    useCallback(async () => {
      try {
        setLoading(true);
        setError(null);

        /*
         * Company identity is determined by the
         * authenticated server session.
         *
         * No organization identifier is accepted
         * from the browser.
         */
        const result =
          await apiGet<FinancialOverview>(
            "/api/financial-assistant/overview",
          );

        if (!result.success) {
          throw new Error(
            result.message ||
              "Financial information could not be loaded.",
          );
        }

        setOverview(result);
      } catch (err) {
        setOverview(null);

        setError(
          err instanceof Error
            ? err.message
            : "Financial information could not be loaded.",
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, sending]);

  const currency =
    overview?.organization?.currency ||
    "KES";

  const metrics =
    overview?.metrics || {
      revenue: 0,
      expenses: 0,
      netProfit: 0,
      assets: 0,
      liabilities: 0,
      equity: 0,
      operatingCashFlow: 0,
      closingCash: 0,
      receivablesOutstanding: 0,
      payablesOutstanding: 0,
      overdueReceivables: 0,
      overduePayables: 0,
      journalEntryCount: 0,
    };

  const insight =
    overview?.insights?.[0] ||
    createFallbackInsight(
      {
        revenue: toNumber(
          metrics.revenue,
        ),
        expenses: toNumber(
          metrics.expenses,
        ),
        netProfit: toNumber(
          metrics.netProfit,
        ),
        assets: toNumber(
          metrics.assets,
        ),
        liabilities: toNumber(
          metrics.liabilities,
        ),
        equity: toNumber(
          metrics.equity,
        ),
        operatingCashFlow: toNumber(
          metrics.operatingCashFlow,
        ),
        closingCash: toNumber(
          metrics.closingCash,
        ),
        receivablesOutstanding:
          toNumber(
            metrics.receivablesOutstanding,
          ),
        payablesOutstanding:
          toNumber(
            metrics.payablesOutstanding,
          ),
        overdueReceivables:
          toNumber(
            metrics.overdueReceivables,
          ),
        overduePayables:
          toNumber(
            metrics.overduePayables,
          ),
        journalEntryCount:
          toNumber(
            metrics.journalEntryCount,
          ),
      },
      currency,
    );

  const tone = getToneClasses(
    insight?.tone || "neutral",
  );

  const sendMessage = async (
    event?: FormEvent<HTMLFormElement>,
  ) => {
    event?.preventDefault();

    const trimmedMessage =
      message.trim();

    if (
      !trimmedMessage ||
      sending
    ) {
      return;
    }

    if (
      trimmedMessage.length >
      MAX_MESSAGE_LENGTH
    ) {
      setChatError(
        `Please keep your question below ${MAX_MESSAGE_LENGTH.toLocaleString()} characters.`,
      );
      return;
    }

    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: "user",
      content: trimmedMessage,
      createdAt: Date.now(),
    };

    const history = messages
      .slice(-MAX_HISTORY_MESSAGES)
      .map((item) => ({
        role: item.role,
        content: item.content,
      }));

    setMessages((current) => [
      ...current,
      userMessage,
    ]);

    setMessage("");
    setChatError(null);
    setSending(true);

    try {
      const result =
        await apiPost<ChatResponse>(
          "/api/financial-assistant/chat",
          {
            message: trimmedMessage,
            history,
          },
        );

      if (
        !result.success ||
        !result.answer?.trim()
      ) {
        throw new Error(
          result.message ||
            "The financial assistant did not return an answer.",
        );
      }

      const assistantMessage: ChatMessage = {
        id: generateMessageId(),
        role: "assistant",
        content:
          result.answer.trim(),
        createdAt: Date.now(),
      };

      setMessages((current) => [
        ...current,
        assistantMessage,
      ]);
    } catch (err) {
      setChatError(
        err instanceof Error
          ? err.message
          : "The financial assistant is temporarily unavailable.",
      );
    } finally {
      setSending(false);
    }
  };

  const useSuggestedQuestion = (
    question: string,
  ) => {
    setMessage(question);
    setChatError(null);
  };

  const companyName =
    overview?.organization?.name ||
    "Your company";

  return (
    <>
      <section className="w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_18px_rgba(15,23,42,0.05)]">
        <header className="flex min-w-0 items-center justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 ring-1 ring-cyan-100">
              <Bot
                size={22}
                strokeWidth={2}
                className="text-cyan-700"
              />
            </div>

            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="truncate text-base font-bold tracking-[-0.01em] text-slate-900 sm:text-lg">
                  AI Financial Assistant
                </h2>

                <span className="shrink-0 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-violet-700">
                  AI
                </span>
              </div>

              <p className="mt-0.5 truncate text-xs text-slate-500 sm:text-sm">
                Personalised financial intelligence for{" "}
                <span className="font-medium text-slate-700">
                  {companyName}
                </span>
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void loadOverview();
              }}
              disabled={loading}
              aria-label="Refresh financial insight"
              title="Refresh financial insight"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <Loader2
                  size={16}
                  className="animate-spin"
                />
              ) : (
                <RefreshCw size={16} />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setChatOpen(true);
                setChatError(null);
              }}
              className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
            >
              <MessageCircle size={15} />

              <span className="hidden sm:inline">
                Ask AI
              </span>
            </button>
          </div>
        </header>

        <div className="px-5 py-5 sm:px-6 sm:py-6">
          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
            <div
              className={`absolute inset-y-0 left-0 w-1 ${tone.accent}`}
              aria-hidden="true"
            />

            <div className="flex min-w-0 items-start gap-3.5">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ${tone.icon}`}
              >
                <Sparkles
                  size={18}
                  strokeWidth={2}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.11em] text-slate-400">
                    Today's Insight
                  </span>

                  {!loading &&
                    !error &&
                    overview && (
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] ${tone.badge}`}
                      >
                        Based on posted data
                      </span>
                    )}
                </div>

                {loading ? (
                  <div
                    className="mt-4 space-y-2.5"
                    aria-label="Loading financial insight"
                  >
                    <div className="h-5 w-52 max-w-full animate-pulse rounded bg-slate-200" />

                    <div className="h-3 w-full animate-pulse rounded bg-slate-200" />

                    <div className="h-3 w-5/6 max-w-full animate-pulse rounded bg-slate-200" />
                  </div>
                ) : error ? (
                  <div className="mt-4">
                    <div className="flex items-start gap-2.5 text-sm text-slate-600">
                      <AlertCircle
                        size={17}
                        className="mt-0.5 shrink-0 text-amber-500"
                      />

                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800">
                          Financial insight is temporarily unavailable.
                        </p>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {error}
                        </p>

                        <button
                          type="button"
                          onClick={() => {
                            void loadOverview();
                          }}
                          className="mt-2 text-xs font-semibold text-cyan-700 hover:text-cyan-800 hover:underline"
                        >
                          Try again
                        </button>
                      </div>
                    </div>
                  </div>
                ) : insight ? (
                  <>
                    <h3 className="mt-2 text-base font-bold leading-6 text-slate-900 sm:text-lg">
                      {insight.title}
                    </h3>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-[15px]">
                      {insight.message}
                    </p>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-3 flex min-w-0 items-start gap-2 text-[10px] leading-5 text-slate-400">
            <CircleHelp
              size={13}
              className="mt-0.5 shrink-0"
            />

            <span className="min-w-0">
              Insights are generated from{" "}
              {companyName}'s authenticated
              posted accounting data.
            </span>
          </div>
        </div>
      </section>

      {chatOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="AI Financial Assistant"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setChatOpen(false);
            }
          }}
        >
          <div className="flex h-[min(720px,100dvh)] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:h-[min(720px,calc(100dvh-32px))] sm:rounded-2xl">
            <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
                  <Bot size={20} />
                </div>

                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold text-slate-900 sm:text-base">
                    AI Financial Assistant
                  </h2>

                  <p className="truncate text-[11px] text-slate-500 sm:text-xs">
                    Financial guidance for{" "}
                    {companyName}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setChatOpen(false)
                }
                aria-label="Close financial assistant"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              >
                <X size={18} />
              </button>
            </header>

            <div className="flex min-h-0 flex-1 flex-col">
              {messages.length === 0 ? (
                <div className="flex flex-1 flex-col justify-center overflow-y-auto px-5 py-6 sm:px-8">
                  <div className="mx-auto w-full max-w-xl text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
                      <Sparkles size={24} />
                    </div>

                    <h3 className="mt-4 text-lg font-bold text-slate-900">
                      How can I help?
                    </h3>

                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                      Ask about profitability,
                      cash flow, receivables,
                      payables, financial
                      position, or other
                      information in your
                      accounting records.
                    </p>

                    <div className="mt-6 grid gap-2 sm:grid-cols-2">
                      {SUGGESTED_QUESTIONS.map(
                        (question) => (
                          <button
                            key={question}
                            type="button"
                            onClick={() =>
                              useSuggestedQuestion(
                                question,
                              )
                            }
                            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-xs font-medium leading-5 text-slate-700 transition-colors hover:border-cyan-200 hover:bg-cyan-50/50 hover:text-slate-900"
                          >
                            {question}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
                  <div className="mx-auto max-w-xl space-y-4">
                    {messages.map(
                      (item) => (
                        <div
                          key={item.id}
                          className={`flex ${
                            item.role ===
                            "user"
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >
                          <div
                            className={
                              item.role ===
                              "user"
                                ? "max-w-[88%] rounded-2xl rounded-br-md bg-slate-900 px-4 py-3 text-sm leading-6 text-white"
                                : "max-w-[92%] rounded-2xl rounded-bl-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700"
                            }
                          >
                            <p className="whitespace-pre-wrap break-words">
                              {item.content}
                            </p>
                          </div>
                        </div>
                      ),
                    )}

                    {sending && (
                      <div className="flex justify-start">
                        <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                          <Loader2
                            size={15}
                            className="animate-spin"
                          />
                          Analyzing your financial data...
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                </div>
              )}

              {chatError && (
                <div className="mx-4 mb-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 sm:mx-6">
                  <AlertCircle
                    size={15}
                    className="mt-0.5 shrink-0 text-amber-600"
                  />

                  <span className="min-w-0">
                    {chatError}
                  </span>
                </div>
              )}

              <form
                onSubmit={sendMessage}
                className="shrink-0 border-t border-slate-200 bg-white p-4 sm:p-5"
              >
                <div className="mx-auto flex max-w-xl items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 focus-within:border-cyan-300 focus-within:ring-2 focus-within:ring-cyan-500/10">
                  <textarea
                    value={message}
                    onChange={(event) => {
                      setMessage(
                        event.target.value.slice(
                          0,
                          MAX_MESSAGE_LENGTH,
                        ),
                      );
                      setChatError(null);
                    }}
                    onKeyDown={(event) => {
                      if (
                        event.key ===
                          "Enter" &&
                        !event.shiftKey
                      ) {
                        event.preventDefault();

                        if (
                          message.trim() &&
                          !sending
                        ) {
                          void sendMessage();
                        }
                      }
                    }}
                    placeholder="Ask a financial question..."
                    rows={1}
                    disabled={sending}
                    aria-label="Financial assistant question"
                    className="max-h-32 min-h-[42px] flex-1 resize-none border-0 bg-transparent px-2 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                  />

                  <button
                    type="submit"
                    disabled={
                      sending ||
                      !message.trim()
                    }
                    aria-label="Send question"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {sending ? (
                      <Loader2
                        size={17}
                        className="animate-spin"
                      />
                    ) : (
                      <Send size={17} />
                    )}
                  </button>
                </div>

                <div className="mx-auto mt-2 flex max-w-xl justify-between gap-3 px-1 text-[10px] text-slate-400">
                  <span>
                    Responses are based on posted accounting data.
                  </span>

                  <span className="shrink-0">
                    {message.length}/
                    {MAX_MESSAGE_LENGTH}
                  </span>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}