import {
  useEffect,
  useState,
} from "react";

import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  RefreshCw,
} from "lucide-react";

import {
  authenticatedFetch,
} from "../../lib/auth";

/**
 * =========================================================
 * CONFIGURATION
 * =========================================================
 */

const API_URL =
  import.meta.env.VITE_API_URL || "";

/**
 * =========================================================
 * TYPES
 * =========================================================
 */

interface DashboardTransaction {
  id: string;
  reference: string;
  description: string;
  amount: number;
  transactionDate: string;
  createdAt: string;
  status: string;
  entryType: "JOURNAL";
}

interface TransactionsResponse {
  success: boolean;
  transactions: DashboardTransaction[];
  meta?: {
    count: number;
    limit: number;
    organizationId?: string;
  };
  message?: string;
}

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

function formatCurrency(
  amount: number
): string {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount)) {
    return "KES 0";
  }

  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(Math.abs(numericAmount));
}

function formatDate(
  date: string
): string {
  const parsed = new Date(date);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "Unknown date";
  }

  return parsed.toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function formatStatus(
  status: string
): string {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

/**
 * =========================================================
 * COMPONENT
 * =========================================================
 */

export default function RecentTransactions() {
  const [
    transactions,
    setTransactions,
  ] = useState<
    DashboardTransaction[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  /**
   * -------------------------------------------------------
   * LOAD TRANSACTIONS
   * -------------------------------------------------------
   */

  const loadTransactions = async (
    isRefresh = false
  ): Promise<void> => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      const response =
        await authenticatedFetch(
          `${API_URL}/api/dashboard/recent-transactions?limit=5`
        );

      let data:
        | TransactionsResponse
        | null = null;

      try {
        data =
          (await response.json()) as TransactionsResponse;
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "Failed to load recent transactions."
        );
      }

      if (!data?.success) {
        throw new Error(
          data?.message ||
            "Failed to load recent transactions."
        );
      }

      setTransactions(
        Array.isArray(data.transactions)
          ? data.transactions
          : []
      );
    } catch (err) {
      console.error(
        "[RecentTransactions] Failed to load:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load recent transactions."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /**
   * -------------------------------------------------------
   * INITIAL LOAD
   * -------------------------------------------------------
   */

  useEffect(() => {
    void loadTransactions();
  }, []);

  /**
   * -------------------------------------------------------
   * RENDER
   * -------------------------------------------------------
   */

  return (
    <section
      className="
        bg-white
        border
        border-[#ECECF3]
        rounded-2xl
        p-5
        sm:p-6
        shadow-sm
      "
    >
      {/* =================================================
          HEADER
      ================================================= */}

      <div
        className="
          flex
          items-start
          justify-between
          gap-4
          mb-5
        "
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BookOpen
              size={19}
              className="text-[#20243A] shrink-0"
            />

            <h2
              className="
                text-lg
                sm:text-xl
                font-bold
                text-[#20243A]
              "
            >
              Recent Transactions
            </h2>
          </div>

          <p
            className="
              text-xs
              sm:text-sm
              text-[#666B84]
              mt-1
            "
          >
            Latest posted accounting activity
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void loadTransactions(true)
          }
          disabled={
            loading ||
            refreshing
          }
          aria-label="Refresh recent transactions"
          title="Refresh transactions"
          className="
            shrink-0
            inline-flex
            items-center
            justify-center
            w-9
            h-9
            rounded-lg
            border
            border-[#E6E7EF]
            text-[#555B73]
            hover:bg-[#F7F7FA]
            hover:text-[#20243A]
            transition
            disabled:opacity-50
            disabled:cursor-not-allowed
          "
        >
          <RefreshCw
            size={16}
            className={
              refreshing
                ? "animate-spin"
                : ""
            }
          />
        </button>
      </div>

      {/* =================================================
          LOADING
      ================================================= */}

      {loading && (
        <div className="space-y-4">
          {Array.from({
            length: 5,
          }).map((_, index) => (
            <div
              key={index}
              className="
                flex
                items-center
                justify-between
                gap-4
                border-b
                border-[#ECECF3]
                pb-4
                last:border-0
                last:pb-0
              "
            >
              <div
                className="
                  flex
                  items-center
                  gap-3
                  min-w-0
                  flex-1
                "
              >
                <div
                  className="
                    w-10
                    h-10
                    rounded-xl
                    bg-[#F1F2F6]
                    animate-pulse
                    shrink-0
                  "
                />

                <div className="min-w-0 flex-1">
                  <div
                    className="
                      h-3
                      bg-[#F1F2F6]
                      rounded
                      animate-pulse
                      w-2/3
                    "
                  />

                  <div
                    className="
                      h-2.5
                      bg-[#F1F2F6]
                      rounded
                      animate-pulse
                      w-1/2
                      mt-2
                    "
                  />
                </div>
              </div>

              <div
                className="
                  h-3
                  bg-[#F1F2F6]
                  rounded
                  animate-pulse
                  w-20
                "
              />
            </div>
          ))}
        </div>
      )}

      {/* =================================================
          ERROR
      ================================================= */}

      {!loading && error && (
        <div
          className="
            rounded-xl
            border
            border-red-100
            bg-red-50
            px-4
            py-5
          "
        >
          <p
            className="
              text-sm
              font-semibold
              text-red-700
            "
          >
            Unable to load transactions
          </p>

          <p
            className="
              text-xs
              text-red-600
              mt-1
            "
          >
            {error}
          </p>

          <button
            type="button"
            onClick={() =>
              void loadTransactions()
            }
            className="
              mt-3
              inline-flex
              items-center
              gap-2
              rounded-lg
              bg-red-600
              px-3
              py-2
              text-xs
              font-semibold
              text-white
              hover:bg-red-700
              transition
            "
          >
            <RefreshCw size={14} />
            Try again
          </button>
        </div>
      )}

      {/* =================================================
          EMPTY STATE
      ================================================= */}

      {!loading &&
        !error &&
        transactions.length === 0 && (
          <div
            className="
              rounded-xl
              border
              border-dashed
              border-[#DCDDE6]
              bg-[#FAFAFC]
              px-5
              py-10
              text-center
            "
          >
            <BookOpen
              size={24}
              className="
                mx-auto
                text-[#8A8FA3]
                mb-3
              "
            />

            <p
              className="
                text-sm
                font-semibold
                text-[#20243A]
              "
            >
              No recent transactions
            </p>

            <p
              className="
                text-xs
                text-[#777C91]
                mt-1
              "
            >
              Posted accounting transactions
              will appear here.
            </p>
          </div>
        )}

      {/* =================================================
          TRANSACTIONS
      ================================================= */}

      {!loading &&
        !error &&
        transactions.length > 0 && (
          <div className="space-y-1">
            {transactions.map(
              (transaction) => (
                <button
                  key={transaction.id}
                  type="button"
                  onClick={() => {
                    window.location.href =
                      "/dashboard/general-ledger";
                  }}
                  className="
                    w-full
                    text-left
                    flex
                    items-center
                    justify-between
                    gap-3
                    sm:gap-4
                    rounded-xl
                    px-2
                    py-3
                    hover:bg-[#F8F8FB]
                    transition
                    group
                  "
                >
                  {/* -------------------------------------
                      LEFT
                  ------------------------------------- */}

                  <div
                    className="
                      flex
                      items-center
                      gap-3
                      min-w-0
                      flex-1
                    "
                  >
                    <div
                      className="
                        w-10
                        h-10
                        rounded-xl
                        bg-[#F2F3F7]
                        flex
                        items-center
                        justify-center
                        shrink-0
                        group-hover:bg-white
                        transition
                      "
                    >
                      <BookOpen
                        size={17}
                        className="text-[#555B73]"
                      />
                    </div>

                    <div
                      className="
                        min-w-0
                        flex-1
                      "
                    >
                      <div
                        className="
                          flex
                          items-center
                          gap-2
                          min-w-0
                        "
                      >
                        <p
                          className="
                            text-sm
                            font-semibold
                            text-[#20243A]
                            truncate
                          "
                        >
                          {transaction.description ||
                            "Journal transaction"}
                        </p>
                      </div>

                      <div
                        className="
                          flex
                          flex-wrap
                          items-center
                          gap-x-2
                          gap-y-1
                          mt-1
                        "
                      >
                        <span
                          className="
                            text-[11px]
                            text-[#777C91]
                            truncate
                            max-w-[160px]
                            sm:max-w-none
                          "
                        >
                          {transaction.reference}
                        </span>

                        <span
                          className="
                            text-[#C7C9D3]
                            text-[10px]
                          "
                        >
                          •
                        </span>

                        <span
                          className="
                            text-[11px]
                            text-[#777C91]
                          "
                        >
                          {formatDate(
                            transaction.transactionDate
                          )}
                        </span>

                        <span
                          className="
                            text-[#C7C9D3]
                            text-[10px]
                          "
                        >
                          •
                        </span>

                        <span
                          className="
                            text-[11px]
                            font-medium
                            text-[#667085]
                          "
                        >
                          {formatStatus(
                            transaction.status
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* -------------------------------------
                      RIGHT
                  ------------------------------------- */}

                  <div
                    className="
                      shrink-0
                      text-right
                    "
                  >
                    <p
                      className="
                        text-sm
                        font-bold
                        text-[#20243A]
                        whitespace-nowrap
                      "
                    >
                      {formatCurrency(
                        transaction.amount
                      )}
                    </p>

                    <div
                      className="
                        flex
                        items-center
                        justify-end
                        gap-1
                        mt-1
                      "
                    >
                      {Number(
                        transaction.amount
                      ) >= 0 ? (
                        <ArrowUpRight
                          size={12}
                          className="text-[#667085]"
                        />
                      ) : (
                        <ArrowDownLeft
                          size={12}
                          className="text-[#667085]"
                        />
                      )}

                      <span
                        className="
                          text-[10px]
                          font-medium
                          text-[#777C91]
                        "
                      >
                        Journal
                      </span>
                    </div>
                  </div>
                </button>
              )
            )}
          </div>
        )}

      {/* =================================================
          FOOTER
      ================================================= */}

      {!loading &&
        !error &&
        transactions.length > 0 && (
          <div
            className="
              mt-5
              pt-4
              border-t
              border-[#ECECF3]
            "
          >
            <button
              type="button"
              onClick={() => {
                window.location.href =
                  "/dashboard/general-ledger";
              }}
              className="
                text-sm
                font-semibold
                text-[#20243A]
                hover:text-[#5A4DE0]
                transition
              "
            >
              View General Ledger
            </button>
          </div>
        )}
    </section>
  );
}