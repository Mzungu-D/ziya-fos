import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Search,
  FileText,
  FileSpreadsheet,
  FileDown,
  Trash2,
  Loader2,
  Filter,
  Download,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  CalendarDays,
  User,
  HardDrive,
  FolderOpen,
  RefreshCw,
} from "lucide-react";

import jsPDF from "jspdf";
import * as XLSX from "xlsx";

import {
  authenticatedFetch,
} from "../lib/auth";

/* =========================================================
   TYPES
========================================================= */

type DocumentRecord = {
  id: string;
  documentCode: string;
  name: string;
  category: string;
  uploadedBy: string;
  uploader?: {
    id: string;
    name: string;
    email: string;
  } | null;
  mimeType?: string | null;
  fileSize?: number | null;
  storageKey?: string | null;
  createdAt: string;
  updatedAt: string;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

type DocumentsResponse = {
  success: boolean;
  count: number;
  documents: DocumentRecord[];
  categories?: string[];
  totals?: {
    documents: number;
    categories: number;
  };
  pagination?: Pagination;
};

type DocumentDetailResponse = {
  success: boolean;
  document: DocumentRecord;
};

/* =========================================================
   STANDARD FOS DOCUMENT CATEGORIES
========================================================= */

const DEFAULT_DOCUMENT_CATEGORIES = [
  "Invoice",
  "Bank Statement",
  "Payroll Report",
  "Receipt",
  "Expense",
  "Contract",
  "Tax Document",
  "Financial Report",
  "Budget",
  "Asset",
  "Loan",
  "Payment",
  "Purchase Order",
  "Credit Note",
  "Debit Note",
  "Audit Document",
  "Other",
];

/* =========================================================
   API
========================================================= */

const apiRequest = async (
  url: string,
  options: RequestInit = {}
) => {
  const headers = new Headers(
    options.headers
  );

  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set(
      "Content-Type",
      "application/json"
    );
  }

  const response =
    await authenticatedFetch(
      url,
      {
        ...options,
        headers,
      }
    );

  const contentType =
    response.headers.get(
      "content-type"
    );

  const data =
    contentType?.includes(
      "application/json"
    )
      ? await response.json()
      : null;

  if (!response.ok) {
    throw new Error(
      data?.message ||
        `Request failed with status ${response.status}`
    );
  }

  return data;
};

/* =========================================================
   HELPERS
========================================================= */

const formatDate = (
  value?: string
) => {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleDateString(
    "en-GB",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  );
};

const formatDateTime = (
  value?: string
) => {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleString(
    "en-GB",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
};

const formatFileSize = (
  bytes?: number | null
) => {
  if (
    bytes === undefined ||
    bytes === null ||
    bytes <= 0
  ) {
    return "—";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  if (
    bytes <
    1024 *
      1024 *
      1024
  ) {
    return `${(
      bytes /
      (1024 * 1024)
    ).toFixed(1)} MB`;
  }

  return `${(
    bytes /
    (1024 *
      1024 *
      1024)
  ).toFixed(1)} GB`;
};

const getFileExtension = (
  name?: string
) => {
  if (!name) {
    return "FILE";
  }

  const parts =
    name.split(".");

  if (parts.length < 2) {
    return "FILE";
  }

  return (
    parts[
      parts.length - 1
    ] || "FILE"
  )
    .toUpperCase()
    .slice(0, 5);
};

const getUploaderName = (
  document: DocumentRecord
) => {
  return (
    document.uploader?.name ||
    document.uploadedBy ||
    "System"
  );
};

const getUploaderEmail = (
  document: DocumentRecord
) => {
  return (
    document.uploader?.email ||
    "—"
  );
};

const escapeHtml = (
  value: string
) => {
  return value
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
};

/* =========================================================
   DOCUMENT ICON
========================================================= */

function DocumentIcon({
  document,
}: {
  document: DocumentRecord;
}) {
  const extension =
    getFileExtension(
      document.name
    );

  const isPdf =
    extension === "PDF";

  const isExcel =
    [
      "XLS",
      "XLSX",
      "CSV",
    ].includes(extension);

  return (
    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F4F5F8]">
      {isExcel ? (
        <FileSpreadsheet
          size={20}
          className="text-[#16805C]"
        />
      ) : (
        <FileText
          size={20}
          className={
            isPdf
              ? "text-[#D14B4B]"
              : "text-[#5E647A]"
          }
        />
      )}

      <span className="absolute -bottom-1 -right-1 rounded bg-white px-1 text-[8px] font-bold text-[#7B8094] shadow-sm ring-1 ring-[#ECEEF3]">
        {extension}
      </span>
    </div>
  );
}

/* =========================================================
   COMPONENT
========================================================= */

export default function Documents() {
  const [
    documents,
    setDocuments,
  ] = useState<
    DocumentRecord[]
  >([]);

  const [
    categories,
    setCategories,
  ] = useState<string[]>(
    []
  );

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    categoryFilter,
    setCategoryFilter,
  ] = useState("");

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    pageSize,
    setPageSize,
  ] = useState<
    25 | 50 | 100
  >(25);

  const [
    pagination,
    setPagination,
  ] = useState<Pagination>({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  });

  const [
    totals,
    setTotals,
  ] = useState({
    documents: 0,
    categories: 0,
  });

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    deletingId,
    setDeletingId,
  ] = useState<
    string | null
  >(null);

  const [
    downloadingId,
    setDownloadingId,
  ] = useState<
    string | null
  >(null);

  const [
    selectedDocument,
    setSelectedDocument,
  ] = useState<
    DocumentRecord | null
  >(null);

  const [
    detailLoading,
    setDetailLoading,
  ] = useState(false);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  /* =======================================================
     AVAILABLE CATEGORIES
  ======================================================= */

  const availableCategories =
    useMemo(() => {
      return Array.from(
        new Set([
          ...DEFAULT_DOCUMENT_CATEGORIES,
          ...categories,
        ])
      )
        .map(
          (item) =>
            String(item).trim()
        )
        .filter(Boolean)
        .sort(
          (a, b) =>
            a.localeCompare(b)
        );
    }, [
      categories,
    ]);

  /* =======================================================
     LOAD DOCUMENTS
  ======================================================= */

  const loadDocuments =
    async (
      showRefresh = false
    ) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const params =
          new URLSearchParams();

        if (search.trim()) {
          params.set(
            "search",
            search.trim()
          );
        }

        if (categoryFilter) {
          params.set(
            "category",
            categoryFilter
          );
        }

        params.set(
          "page",
          String(page)
        );

        params.set(
          "pageSize",
          String(pageSize)
        );

        const result =
          (await apiRequest(
            `/api/documents?${params.toString()}`
          )) as DocumentsResponse;

        setDocuments(
          Array.isArray(
            result?.documents
          )
            ? result.documents
            : []
        );

        setCategories(
          Array.isArray(
            result?.categories
          )
            ? result.categories
            : []
        );

        if (result?.pagination) {
          setPagination(
            result.pagination
          );
        }

        if (result?.totals) {
          setTotals(
            result.totals
          );
        }
      } catch (err: any) {
        console.error(
          "LOAD DOCUMENTS ERROR:",
          err
        );

        setError(
          err?.message ||
            "Failed to load documents."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };

  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          void loadDocuments();
        },
        search.trim() ||
        categoryFilter
          ? 300
          : 0
      );

    return () =>
      window.clearTimeout(
        timer
      );
  }, [
    search,
    categoryFilter,
    page,
    pageSize,
  ]);

  /* =======================================================
     RESET PAGE WHEN FILTER CHANGES
  ======================================================= */

  useEffect(() => {
    setPage(1);
  }, [
    search,
    categoryFilter,
    pageSize,
  ]);

  /* =======================================================
     SUMMARY
  ======================================================= */

  const summary =
    useMemo(() => {
      const invoiceCount =
        documents.filter(
          (document) =>
            document.category
              .toLowerCase() ===
            "invoice"
        ).length;

      const bankStatementCount =
        documents.filter(
          (document) =>
            document.category
              .toLowerCase()
              .includes(
                "bank statement"
              )
        ).length;

      const payrollCount =
        documents.filter(
          (document) =>
            document.category
              .toLowerCase()
              .includes(
                "payroll"
              )
        ).length;

      return {
        total:
          totals.documents ||
          pagination.total ||
          0,

        categories:
          totals.categories,

        invoices:
          invoiceCount,

        bankStatements:
          bankStatementCount,

        payrollReports:
          payrollCount,
      };
    }, [
      documents,
      totals,
      pagination.total,
    ]);

  /* =======================================================
     VIEW DOCUMENT
  ======================================================= */

  const handleView =
    async (
      documentId: string
    ) => {
      try {
        setError("");
        setDetailLoading(true);

        const result =
          (await apiRequest(
            `/api/documents/${documentId}`
          )) as DocumentDetailResponse;

        if (
          result?.document
        ) {
          setSelectedDocument(
            result.document
          );
        }
      } catch (err: any) {
        console.error(
          "VIEW DOCUMENT ERROR:",
          err
        );

        setError(
          err?.message ||
            "Failed to load document."
        );
      } finally {
        setDetailLoading(false);
      }
    };

  /* =======================================================
     OPEN FILE
  ======================================================= */

  const handleOpenFile =
    async (
      documentId: string
    ) => {
      try {
        setError("");

        const result =
          await apiRequest(
            `/api/documents/${documentId}/download?view=1`
          );

        const viewUrl =
          result?.download?.url;

        if (
          typeof viewUrl !==
            "string" ||
          !viewUrl
        ) {
          throw new Error(
            "Document view URL was not returned."
          );
        }

        const opened =
          window.open(
            viewUrl,
            "_blank",
            "noopener,noreferrer"
          );

        if (!opened) {
          throw new Error(
            "The document could not be opened. Please allow pop-ups for this site."
          );
        }
      } catch (err: any) {
        console.error(
          "OPEN DOCUMENT ERROR:",
          err
        );

        setError(
          err?.message ||
            "Failed to open document."
        );
      }
    };

  /* =======================================================
     DOWNLOAD
  ======================================================= */

  const handleDownload =
    async (
      documentId: string,
      fileName: string
    ) => {
      try {
        setDownloadingId(
          documentId
        );

        setError("");

        const result =
          await apiRequest(
            `/api/documents/${documentId}/download`
          );

        const downloadUrl =
          result?.download?.url;

        if (
          typeof downloadUrl !==
            "string" ||
          !downloadUrl
        ) {
          throw new Error(
            "Download URL was not returned."
          );
        }

        const anchor =
          document.createElement(
            "a"
          );

        anchor.href =
          downloadUrl;

        anchor.download =
          fileName;

        anchor.target =
          "_blank";

        anchor.rel =
          "noopener noreferrer";

        document.body.appendChild(
          anchor
        );

        anchor.click();

        document.body.removeChild(
          anchor
        );
      } catch (err: any) {
        console.error(
          "DOWNLOAD DOCUMENT ERROR:",
          err
        );

        setError(
          err?.message ||
            "Failed to download document."
        );
      } finally {
        setDownloadingId(
          null
        );
      }
    };

  /* =======================================================
     DELETE
  ======================================================= */

  const handleDelete =
    async (
      documentId: string
    ) => {
      const target =
        documents.find(
          (document) =>
            document.id ===
            documentId
        );

      const confirmed =
        window.confirm(
          `Delete "${target?.name || "this document"}"? This action cannot be undone.`
        );

      if (!confirmed) {
        return;
      }

      try {
        setDeletingId(
          documentId
        );

        setError("");

        await apiRequest(
          `/api/documents/${documentId}`,
          {
            method: "DELETE",
          }
        );

        if (
          selectedDocument?.id ===
          documentId
        ) {
          setSelectedDocument(
            null
          );
        }

        if (
          documents.length ===
            1 &&
          page > 1
        ) {
          setPage(
            page - 1
          );
        } else {
          await loadDocuments(
            true
          );
        }
      } catch (err: any) {
        console.error(
          "DELETE DOCUMENT ERROR:",
          err
        );

        setError(
          err?.message ||
            "Failed to delete document."
        );
      } finally {
        setDeletingId(
          null
        );
      }
    };

  /* =======================================================
     EXPORT EXCEL
  ======================================================= */

  const exportExcel =
    () => {
      if (
        documents.length ===
        0
      ) {
        return;
      }

      const rows =
        documents.map(
          (document) => ({
            "Document Code":
              document.documentCode,

            Document:
              document.name,

            Category:
              document.category,

            "Added By":
              getUploaderName(
                document
              ),

            Email:
              getUploaderEmail(
                document
              ),

            "Date Added":
              formatDate(
                document.createdAt
              ),

            "File Type":
              document.mimeType ||
              getFileExtension(
                document.name
              ),

            "File Size":
              formatFileSize(
                document.fileSize
              ),
          })
        );

      const worksheet =
        XLSX.utils.json_to_sheet(
          rows
        );

      const workbook =
        XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Documents"
      );

      XLSX.writeFile(
        workbook,
        "Ziya-FOS-Documents.xlsx"
      );
    };

  /* =======================================================
     EXPORT PDF
  ======================================================= */

  const exportPdf =
    () => {
      if (
        documents.length ===
        0
      ) {
        return;
      }

      const pdf =
        new jsPDF({
          orientation:
            "landscape",
          unit: "mm",
          format: "a4",
        });

      pdf.setFontSize(
        18
      );

      pdf.text(
        "Ziya Financial Operating System",
        14,
        16
      );

      pdf.setFontSize(
        13
      );

      pdf.text(
        "Documents Report",
        14,
        25
      );

      pdf.setFontSize(
        8
      );

      pdf.text(
        `Generated: ${new Date().toLocaleString()}`,
        14,
        32
      );

      const columns = [
        "Code",
        "Document",
        "Category",
        "Added By",
        "Date Added",
        "Size",
      ];

      const xPositions = [
        14,
        43,
        116,
        166,
        229,
        264,
      ];

      let y = 44;

      pdf.setFont(
        "helvetica",
        "bold"
      );

      columns.forEach(
        (
          column,
          index
        ) => {
          pdf.text(
            column,
            xPositions[index],
            y
          );
        }
      );

      pdf.setFont(
        "helvetica",
        "normal"
      );

      y += 7;

      documents.forEach(
        (document) => {
          if (y > 190) {
            pdf.addPage();

            y = 20;

            pdf.setFont(
              "helvetica",
              "bold"
            );

            columns.forEach(
              (
                column,
                index
              ) => {
                pdf.text(
                  column,
                  xPositions[index],
                  y
                );
              }
            );

            pdf.setFont(
              "helvetica",
              "normal"
            );

            y += 7;
          }

          const values = [
            document.documentCode,
            document.name,
            document.category,
            getUploaderName(
              document
            ),
            formatDate(
              document.createdAt
            ),
            formatFileSize(
              document.fileSize
            ),
          ];

          values.forEach(
            (
              value,
              index
            ) => {
              const maxWidth =
                index === 1
                  ? 68
                  : 42;

              const lines =
                pdf.splitTextToSize(
                  String(value),
                  maxWidth
                );

              pdf.text(
                lines[0] ||
                  "",
                xPositions[index],
                y
              );
            }
          );

          y += 7;
        }
      );

      pdf.setFontSize(
        8
      );

      pdf.text(
        `Documents on current page: ${documents.length}`,
        14,
        202
      );

      pdf.save(
        "Ziya-FOS-Documents.pdf"
      );
    };

  /* =======================================================
     EXPORT WORD
  ======================================================= */

  const exportWord =
    () => {
      if (
        documents.length ===
        0
      ) {
        return;
      }

      const rows =
        documents
          .map(
            (document) => `
              <tr>
                <td>${escapeHtml(
                  document.documentCode
                )}</td>
                <td>${escapeHtml(
                  document.name
                )}</td>
                <td>${escapeHtml(
                  document.category
                )}</td>
                <td>${escapeHtml(
                  getUploaderName(
                    document
                  )
                )}</td>
                <td>${escapeHtml(
                  getUploaderEmail(
                    document
                  )
                )}</td>
                <td>${escapeHtml(
                  formatDate(
                    document.createdAt
                  )
                )}</td>
              </tr>
            `
          )
          .join("");

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8" />
            <title>Ziya FOS Documents</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                margin: 40px;
                color: #20243A;
              }

              h1 {
                margin-bottom: 4px;
              }

              p {
                color: #666B84;
              }

              table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 24px;
              }

              th,
              td {
                border: 1px solid #dcdfe8;
                padding: 8px;
                text-align: left;
              }

              th {
                background: #f4f5f8;
              }
            </style>
          </head>

          <body>
            <h1>
              Ziya Financial Operating System
            </h1>

            <p>
              Documents Report
            </p>

            <p>
              Generated:
              ${escapeHtml(
                new Date().toLocaleString()
              )}
            </p>

            <table>
              <thead>
                <tr>
                  <th>Document Code</th>
                  <th>Document</th>
                  <th>Category</th>
                  <th>Added By</th>
                  <th>Email</th>
                  <th>Date Added</th>
                </tr>
              </thead>

              <tbody>
                ${rows}
              </tbody>
            </table>
          </body>
        </html>
      `;

      const blob =
        new Blob(
          [html],
          {
            type:
              "application/msword",
          }
        );

      const url =
        URL.createObjectURL(
          blob
        );

      const anchor =
        document.createElement(
          "a"
        );

      anchor.href =
        url;

      anchor.download =
        "Ziya-FOS-Documents.doc";

      document.body.appendChild(
        anchor
      );

      anchor.click();

      document.body.removeChild(
        anchor
      );

      URL.revokeObjectURL(
        url
      );
    };

  /* =======================================================
     PAGINATION
  ======================================================= */

  const startItem =
    pagination.total ===
    0
      ? 0
      : (page - 1) *
          pageSize +
        1;

  const endItem =
    Math.min(
      page *
        pageSize,
      pagination.total
    );

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="space-y-6 pb-8">

      {/* ===================================================
          HEADER
      =================================================== */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">

        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#8A8FA3]">
            <FolderOpen
              size={14}
            />
            Organization Library
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-[#20243A]">
            Documents
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#666B84]">
            Your organization's central library for financial and operational documents.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void loadDocuments(
              true
            )
          }
          disabled={
            refreshing ||
            loading
          }
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#E3E5EC] bg-white px-4 text-sm font-semibold text-[#20243A] shadow-sm transition hover:border-[#D0D3DD] hover:bg-[#F8F9FB] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            size={16}
            className={
              refreshing
                ? "animate-spin"
                : ""
            }
          />

          Refresh
        </button>

      </div>

      {/* ===================================================
          ERROR
      =================================================== */}

      {error && (
        <div className="flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>
            {error}
          </span>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
            className="shrink-0 rounded-lg p-1 hover:bg-red-100"
            aria-label="Dismiss error"
          >
            <X
              size={16}
            />
          </button>
        </div>
      )}

      {/* ===================================================
          SUMMARY
      =================================================== */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <div className="rounded-2xl border border-[#E9EAF0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8FA3]">
                Total Documents
              </p>

              <p className="mt-2 text-3xl font-bold text-[#20243A]">
                {summary.total.toLocaleString()}
              </p>

              <p className="mt-1 text-xs text-[#8A8FA3]">
                Organization-wide library
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F2F4F8]">
              <FileText
                size={19}
                className="text-[#596077]"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E9EAF0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8FA3]">
                Categories
              </p>

              <p className="mt-2 text-3xl font-bold text-[#20243A]">
                {summary.categories.toLocaleString()}
              </p>

              <p className="mt-1 text-xs text-[#8A8FA3]">
                Document classifications
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3F1FB]">
              <FolderOpen
                size={19}
                className="text-[#6D5BC7]"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E9EAF0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8FA3]">
                Invoices
              </p>

              <p className="mt-2 text-3xl font-bold text-[#20243A]">
                {summary.invoices}
              </p>

              <p className="mt-1 text-xs text-[#8A8FA3]">
                On current page
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF5E9]">
              <FileText
                size={19}
                className="text-[#C47A20]"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E9EAF0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8FA3]">
                Payroll Reports
              </p>

              <p className="mt-2 text-3xl font-bold text-[#20243A]">
                {summary.payrollReports}
              </p>

              <p className="mt-1 text-xs text-[#8A8FA3]">
                On current page
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF7F3]">
              <FileSpreadsheet
                size={19}
                className="text-[#16805C]"
              />
            </div>
          </div>
        </div>

      </div>

      {/* ===================================================
          TOOLBAR
      =================================================== */}

      <div className="rounded-2xl border border-[#E9EAF0] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">

        <div className="flex flex-col gap-3 xl:flex-row">

          <div className="flex min-w-0 flex-1 items-center rounded-xl border border-[#E1E3EA] bg-white px-3 transition focus-within:border-[#B9BDC9] focus-within:ring-2 focus-within:ring-[#20243A]/5">

            <Search
              size={18}
              className="shrink-0 text-[#8A8FA3]"
            />

            <input
              type="text"
              value={search}
              onChange={(
                event
              ) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search by document name, code, category or uploader..."
              className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-[#20243A] outline-none placeholder:text-[#A1A5B5]"
              aria-label="Search documents"
            />

            {search && (
              <button
                type="button"
                onClick={() =>
                  setSearch("")
                }
                className="rounded-md p-1 text-[#8A8FA3] hover:bg-[#F4F5F7]"
                aria-label="Clear search"
              >
                <X
                  size={15}
                />
              </button>
            )}

          </div>

          <div className="flex items-center rounded-xl border border-[#E1E3EA] bg-white px-3">

            <Filter
              size={17}
              className="shrink-0 text-[#8A8FA3]"
            />

            <select
              value={
                categoryFilter
              }
              onChange={(
                event
              ) =>
                setCategoryFilter(
                  event.target.value
                )
              }
              className="min-w-[210px] cursor-pointer bg-transparent px-3 py-3 text-sm font-medium text-[#20243A] outline-none"
              aria-label="Filter documents by category"
            >
              <option value="">
                All Categories
              </option>

              {availableCategories.map(
                (
                  category
                ) => (
                  <option
                    key={
                      category
                    }
                    value={
                      category
                    }
                  >
                    {category}
                  </option>
                )
              )}
            </select>

          </div>

          <div className="flex flex-wrap gap-2">

            <button
              type="button"
              onClick={
                exportPdf
              }
              disabled={
                documents.length ===
                0
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#E1E3EA] bg-white px-4 text-sm font-semibold text-[#20243A] transition hover:bg-[#F7F8FA] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FileDown
                size={16}
              />
              PDF
            </button>

            <button
              type="button"
              onClick={
                exportWord
              }
              disabled={
                documents.length ===
                0
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#E1E3EA] bg-white px-4 text-sm font-semibold text-[#20243A] transition hover:bg-[#F7F8FA] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FileText
                size={16}
              />
              Word
            </button>

            <button
              type="button"
              onClick={
                exportExcel
              }
              disabled={
                documents.length ===
                0
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#E1E3EA] bg-white px-4 text-sm font-semibold text-[#20243A] transition hover:bg-[#F7F8FA] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FileSpreadsheet
                size={16}
              />
              Excel
            </button>

          </div>

        </div>

      </div>

      {/* ===================================================
          DOCUMENT TABLE
      =================================================== */}

      <div className="overflow-hidden rounded-2xl border border-[#E9EAF0] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.03)]">

        <div className="flex flex-col gap-2 border-b border-[#ECEEF3] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

          <div>
            <h2 className="text-sm font-bold text-[#20243A]">
              Document Library
            </h2>

            <p className="mt-1 text-xs text-[#8A8FA3]">
              {pagination.total.toLocaleString()} documents matching your current view
            </p>
          </div>

          {categoryFilter && (
            <div className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#F4F5F8] px-3 py-1.5 text-xs font-semibold text-[#596077]">
              <Filter
                size={13}
              />
              {categoryFilter}

              <button
                type="button"
                onClick={() =>
                  setCategoryFilter("")
                }
                className="ml-1 rounded p-0.5 hover:bg-white"
                aria-label="Clear category filter"
              >
                <X
                  size={12}
                />
              </button>
            </div>
          )}

        </div>

        {loading ? (

          <div className="flex min-h-[360px] items-center justify-center">

            <div className="flex flex-col items-center">

              <Loader2
                size={28}
                className="animate-spin text-[#596077]"
              />

              <p className="mt-3 text-sm font-medium text-[#666B84]">
                Loading documents...
              </p>

            </div>

          </div>

        ) : documents.length ===
          0 ? (

          <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">

            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F4F5F8]">
              <FolderOpen
                size={28}
                className="text-[#8A8FA3]"
              />
            </div>

            <h3 className="mt-5 text-base font-bold text-[#20243A]">
              No documents found
            </h3>

            <p className="mt-2 max-w-md text-sm leading-6 text-[#8A8FA3]">
              {search ||
              categoryFilter
                ? "Try changing your search or category filter."
                : "Documents generated or added through the FOS will appear here."}
            </p>

            {(search ||
              categoryFilter) && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCategoryFilter("");
                }}
                className="mt-5 rounded-xl border border-[#E1E3EA] bg-white px-4 py-2.5 text-sm font-semibold text-[#20243A] shadow-sm hover:bg-[#F7F8FA]"
              >
                Clear filters
              </button>
            )}

          </div>

        ) : (

          <>

            <div className="overflow-x-auto">

              <table className="w-full min-w-[1000px]">

                <thead className="bg-[#FAFBFC]">

                  <tr className="border-b border-[#ECEEF3]">

                    <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[#8A8FA3]">
                      Document
                    </th>

                    <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[#8A8FA3]">
                      Category
                    </th>

                    <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[#8A8FA3]">
                      Added By
                    </th>

                    <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[#8A8FA3]">
                      Date Added
                    </th>

                    <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[#8A8FA3]">
                      Size
                    </th>

                    <th className="px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-[0.08em] text-[#8A8FA3]">
                      Actions
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {documents.map(
                    (
                      doc
                    ) => (

                      <tr
                        key={
                          doc.id
                        }
                        className="group border-b border-[#F0F1F4] transition last:border-b-0 hover:bg-[#FBFCFD]"
                      >

                        {/* DOCUMENT */}

                        <td className="px-5 py-4">

                          <div className="flex items-center gap-3">

                            <DocumentIcon
                              document={
                                doc
                              }
                            />

                            <div className="min-w-0">

                              <p className="max-w-[340px] truncate text-sm font-semibold text-[#20243A]">
                                {
                                  doc.name
                                }
                              </p>

                              <div className="mt-1 flex items-center gap-2">

                                <span className="text-xs font-medium text-[#8A8FA3]">
                                  {
                                    doc.documentCode
                                  }
                                </span>

                                {doc.mimeType && (
                                  <>
                                    <span className="text-[#D5D7DE]">
                                      •
                                    </span>

                                    <span className="max-w-[180px] truncate text-xs text-[#A0A4B4]">
                                      {
                                        doc.mimeType
                                      }
                                    </span>
                                  </>
                                )}

                              </div>

                            </div>

                          </div>

                        </td>

                        {/* CATEGORY */}

                        <td className="px-4 py-4">

                          <span className="inline-flex items-center rounded-lg bg-[#F4F5F8] px-2.5 py-1.5 text-xs font-semibold text-[#596077]">
                            {
                              doc.category
                            }
                          </span>

                        </td>

                        {/* ADDED BY */}

                        <td className="px-4 py-4">

                          <div className="flex items-center gap-2.5">

                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EEF0F5] text-xs font-bold text-[#596077]">
                              {getUploaderName(
                                doc
                              )
                                .charAt(
                                  0
                                )
                                .toUpperCase()}
                            </div>

                            <div className="min-w-0">

                              <p className="max-w-[180px] truncate text-sm font-medium text-[#20243A]">
                                {getUploaderName(
                                  doc
                                )}
                              </p>

                              <p className="max-w-[180px] truncate text-xs text-[#8A8FA3]">
                                {getUploaderEmail(
                                  doc
                                )}
                              </p>

                            </div>

                          </div>

                        </td>

                        {/* DATE */}

                        <td className="px-4 py-4">

                          <div className="flex items-center gap-2 text-sm text-[#666B84]">

                            <CalendarDays
                              size={15}
                              className="text-[#A0A4B4]"
                            />

                            {formatDate(
                              doc.createdAt
                            )}

                          </div>

                        </td>

                        {/* SIZE */}

                        <td className="px-4 py-4">

                          <div className="flex items-center gap-2 text-sm text-[#666B84]">

                            <HardDrive
                              size={15}
                              className="text-[#A0A4B4]"
                            />

                            {formatFileSize(
                              doc.fileSize
                            )}

                          </div>

                        </td>

                        {/* ACTIONS */}

                        <td className="px-5 py-4">

                          <div className="flex items-center justify-end gap-1.5">

                            <button
                              type="button"
                              onClick={() =>
                                void handleView(
                                  doc.id
                                )
                              }
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#596077] transition hover:bg-[#F1F3F6] hover:text-[#20243A] disabled:opacity-40"
                              title="View details"
                              aria-label={`View details for ${doc.name}`}
                              disabled={
                                detailLoading
                              }
                            >
                              <Eye
                                size={
                                  17
                                }
                              />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void handleOpenFile(
                                  doc.id
                                )
                              }
                              disabled={
                                !doc.storageKey
                              }
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#596077] transition hover:bg-[#F1F3F6] hover:text-[#20243A] disabled:cursor-not-allowed disabled:opacity-30"
                              title={
                                doc.storageKey
                                  ? "Open document"
                                  : "File unavailable"
                              }
                              aria-label={`Open ${doc.name}`}
                            >
                              <FileText
                                size={
                                  17
                                }
                              />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void handleDownload(
                                  doc.id,
                                  doc.name
                                )
                              }
                              disabled={
                                !doc.storageKey ||
                                downloadingId ===
                                  doc.id ||
                                deletingId ===
                                  doc.id
                              }
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#0D8B79] transition hover:bg-[#EAF9F6] disabled:cursor-not-allowed disabled:opacity-30"
                              title={
                                doc.storageKey
                                  ? "Download document"
                                  : "File unavailable"
                              }
                              aria-label={`Download ${doc.name}`}
                            >
                              {downloadingId ===
                              doc.id ? (
                                <Loader2
                                  size={
                                    17
                                  }
                                  className="animate-spin"
                                />
                              ) : (
                                <Download
                                  size={
                                    17
                                  }
                                />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void handleDelete(
                                  doc.id
                                )
                              }
                              disabled={
                                deletingId ===
                                doc.id
                              }
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#C84E55] transition hover:bg-[#FFF1F2] disabled:cursor-not-allowed disabled:opacity-40"
                              title="Delete document"
                              aria-label={`Delete ${doc.name}`}
                            >
                              {deletingId ===
                              doc.id ? (
                                <Loader2
                                  size={
                                    17
                                  }
                                  className="animate-spin"
                                />
                              ) : (
                                <Trash2
                                  size={
                                    17
                                  }
                                />
                              )}
                            </button>

                          </div>

                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>

            {/* =================================================
                PAGINATION
            ================================================= */}

            <div className="flex flex-col gap-3 border-t border-[#ECEEF3] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

              <div className="flex items-center gap-3 text-xs text-[#8A8FA3]">

                <span>
                  Showing{" "}
                  <span className="font-semibold text-[#596077]">
                    {startItem}
                  </span>
                  {" "}–{" "}
                  <span className="font-semibold text-[#596077]">
                    {endItem}
                  </span>
                  {" "}of{" "}
                  <span className="font-semibold text-[#596077]">
                    {pagination.total.toLocaleString()}
                  </span>
                </span>

                <span className="hidden h-4 w-px bg-[#E3E5EA] sm:block" />

                <label className="flex items-center gap-2">
                  Rows

                  <select
                    value={
                      pageSize
                    }
                    onChange={(
                      event
                    ) =>
                      setPageSize(
                        Number(
                          event
                            .target
                            .value
                        ) as
                          | 25
                          | 50
                          | 100
                      )
                    }
                    className="rounded-lg border border-[#E1E3EA] bg-white px-2 py-1.5 text-xs font-semibold text-[#596077] outline-none"
                  >
                    <option value={25}>
                      25
                    </option>

                    <option value={50}>
                      50
                    </option>

                    <option value={100}>
                      100
                    </option>
                  </select>
                </label>

              </div>

              <div className="flex items-center gap-2">

                <button
                  type="button"
                  onClick={() =>
                    setPage(
                      (current) =>
                        Math.max(
                          1,
                          current -
                            1
                        )
                    )
                  }
                  disabled={
                    !pagination.hasPreviousPage
                  }
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E1E3EA] bg-white px-3 text-xs font-semibold text-[#596077] transition hover:bg-[#F7F8FA] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft
                    size={15}
                  />
                  Previous
                </button>

                <div className="flex h-9 min-w-[72px] items-center justify-center rounded-lg bg-[#F4F5F8] px-3 text-xs font-bold text-[#596077]">
                  Page {page}
                  {pagination.totalPages >
                    0 && (
                    <>
                      {" "}
                      of{" "}
                      {
                        pagination.totalPages
                      }
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setPage(
                      (current) =>
                        current +
                        1
                    )
                  }
                  disabled={
                    !pagination.hasNextPage
                  }
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E1E3EA] bg-white px-3 text-xs font-semibold text-[#596077] transition hover:bg-[#F7F8FA] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <ChevronRight
                    size={15}
                  />
                </button>

              </div>

            </div>

          </>

        )}

      </div>

      {/* ===================================================
          DETAIL DRAWER
      =================================================== */}

      {selectedDocument && (
        <div className="fixed inset-0 z-50">

          <button
            type="button"
            aria-label="Close document details"
            onClick={() =>
              setSelectedDocument(
                null
              )
            }
            className="absolute inset-0 bg-[#151827]/35 backdrop-blur-[2px]"
          />

          <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b border-[#ECEEF3] px-6 py-5">

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#8A8FA3]">
                  Document Details
                </p>

                <h2 className="mt-1 max-w-[340px] truncate text-lg font-bold text-[#20243A]">
                  {
                    selectedDocument.name
                  }
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedDocument(
                    null
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#666B84] transition hover:bg-[#F3F4F6] hover:text-[#20243A]"
                aria-label="Close"
              >
                <X
                  size={18}
                />
              </button>

            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">

              <div className="flex items-center gap-4 rounded-2xl border border-[#E9EAF0] bg-[#FAFBFC] p-4">

                <DocumentIcon
                  document={
                    selectedDocument
                  }
                />

                <div className="min-w-0">

                  <p className="truncate text-sm font-bold text-[#20243A]">
                    {
                      selectedDocument.name
                    }
                  </p>

                  <p className="mt-1 text-xs font-medium text-[#8A8FA3]">
                    {
                      selectedDocument.documentCode
                    }
                  </p>

                </div>

              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">

                <div className="rounded-xl border border-[#E9EAF0] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8FA3]">
                    Category
                  </p>

                  <p className="mt-2 text-sm font-semibold text-[#20243A]">
                    {
                      selectedDocument.category
                    }
                  </p>
                </div>

                <div className="rounded-xl border border-[#E9EAF0] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8FA3]">
                    File Size
                  </p>

                  <p className="mt-2 text-sm font-semibold text-[#20243A]">
                    {formatFileSize(
                      selectedDocument.fileSize
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-[#E9EAF0] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8FA3]">
                    File Type
                  </p>

                  <p className="mt-2 break-all text-sm font-semibold text-[#20243A]">
                    {
                      selectedDocument.mimeType ||
                      getFileExtension(
                        selectedDocument.name
                      )
                    }
                  </p>
                </div>

                <div className="rounded-xl border border-[#E9EAF0] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8FA3]">
                    Date Added
                  </p>

                  <p className="mt-2 text-sm font-semibold text-[#20243A]">
                    {formatDate(
                      selectedDocument.createdAt
                    )}
                  </p>
                </div>

              </div>

              <div className="mt-6">

                <h3 className="text-sm font-bold text-[#20243A]">
                  Uploaded By
                </h3>

                <div className="mt-3 flex items-center gap-3 rounded-xl border border-[#E9EAF0] p-4">

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EEF0F5] text-sm font-bold text-[#596077]">
                    {getUploaderName(
                      selectedDocument
                    )
                      .charAt(
                        0
                      )
                      .toUpperCase()}
                  </div>

                  <div className="min-w-0">

                    <div className="flex items-center gap-2">

                      <User
                        size={14}
                        className="text-[#8A8FA3]"
                      />

                      <p className="truncate text-sm font-semibold text-[#20243A]">
                        {getUploaderName(
                          selectedDocument
                        )}
                      </p>

                    </div>

                    <p className="mt-1 truncate text-xs text-[#8A8FA3]">
                      {getUploaderEmail(
                        selectedDocument
                      )}
                    </p>

                  </div>

                </div>

              </div>

              <div className="mt-6">

                <h3 className="text-sm font-bold text-[#20243A]">
                  Timeline
                </h3>

                <div className="mt-3 space-y-3">

                  <div className="flex gap-3 rounded-xl border border-[#E9EAF0] p-4">

                    <CalendarDays
                      size={17}
                      className="mt-0.5 shrink-0 text-[#8A8FA3]"
                    />

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8FA3]">
                        Created
                      </p>

                      <p className="mt-1 text-sm font-medium text-[#20243A]">
                        {formatDateTime(
                          selectedDocument.createdAt
                        )}
                      </p>
                    </div>

                  </div>

                  <div className="flex gap-3 rounded-xl border border-[#E9EAF0] p-4">

                    <RefreshCw
                      size={17}
                      className="mt-0.5 shrink-0 text-[#8A8FA3]"
                    />

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8FA3]">
                        Last Updated
                      </p>

                      <p className="mt-1 text-sm font-medium text-[#20243A]">
                        {formatDateTime(
                          selectedDocument.updatedAt
                        )}
                      </p>
                    </div>

                  </div>

                </div>

              </div>

            </div>

            <div className="border-t border-[#ECEEF3] bg-white px-6 py-4">

              <div className="flex flex-col gap-2 sm:flex-row">

                <button
                  type="button"
                  onClick={() =>
                    void handleOpenFile(
                      selectedDocument.id
                    )
                  }
                  disabled={
                    !selectedDocument.storageKey
                  }
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#20243A] px-4 text-sm font-semibold text-white transition hover:bg-[#171A2B] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Eye
                    size={16}
                  />
                  Open Document
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void handleDownload(
                      selectedDocument.id,
                      selectedDocument.name
                    )
                  }
                  disabled={
                    !selectedDocument.storageKey ||
                    downloadingId ===
                      selectedDocument.id
                  }
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#E1E3EA] bg-white px-4 text-sm font-semibold text-[#20243A] transition hover:bg-[#F7F8FA] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {downloadingId ===
                  selectedDocument.id ? (
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <Download
                      size={16}
                    />
                  )}

                  Download
                </button>

              </div>

            </div>

          </aside>

        </div>
      )}

    </div>
  );
}