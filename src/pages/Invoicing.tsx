import InvoiceEngine from "../components/InvoiceEngine";

/**
 * Invoice route page.
 *
 * The application route intentionally remains:
 *   /dashboard/invoicing
 *
 * This page acts as the route-level boundary while the actual
 * production invoice workspace lives in InvoiceEngine.
 *
 * Keeping the route wrapper separate from the feature engine:
 * - preserves the existing router structure
 * - avoids duplicating invoice logic
 * - keeps accounting workflows centralized
 * - allows InvoiceEngine to remain independently maintainable
 */
export default function Invoicing() {
  return <InvoiceEngine />;
}