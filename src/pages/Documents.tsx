import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Upload,
  Search,
  FileText,
  FileSpreadsheet,
  FileDown,
  Trash2,
  X,
  Loader2,
  Filter,
  Download,
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
  mimeType?: string | null;
  fileSize?: number | null;
  storageKey?: string | null;
  createdAt: string;
  updatedAt: string;
};

type DocumentsResponse = {
  success: boolean;
  count: number;
  documents: DocumentRecord[];
  categories: string[];
};

/* =========================================================
   API HELPERS
========================================================= */

const apiRequest = async (
  url: string,
  options: RequestInit = {}
) => {
  const headers = new Headers(
    options.headers
  );

  /*
   * Use the application's canonical
   * authentication flow.
   *
   * authenticatedFetch() obtains the
   * current session token and sends:
   *
   * Authorization: Bearer <token>
   *
   * This keeps Documents aligned with
   * the single authentication system
   * used by the rest of the application.
   */
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
  value: string
) => {
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
      month: "2-digit",
      day: "2-digit",
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

  if (bytes < 1024 * 1024) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(
      bytes /
      (1024 * 1024)
    ).toFixed(1)} MB`;
  }

  return `${(
    bytes /
    (1024 * 1024 * 1024)
  ).toFixed(1)} GB`;
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
   COMPONENT
========================================================= */

export default function Documents() {
  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null
    );

  const [documents, setDocuments] =
    useState<DocumentRecord[]>(
      []
    );

  const [categories, setCategories] =
    useState<string[]>(
      []
    );

  const [search, setSearch] =
    useState("");

  const [categoryFilter, setCategoryFilter] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [showUploadModal, setShowUploadModal] =
    useState(false);

  const [uploading, setUploading] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState<string | null>(
      null
    );

  const [downloadingId, setDownloadingId] =
    useState<string | null>(
      null
    );

  const [selectedFile, setSelectedFile] =
    useState<File | null>(
      null
    );

  const [uploadCategory, setUploadCategory] =
    useState("Other");

  /* =======================================================
     LOAD DOCUMENTS
  ======================================================= */

  const loadDocuments =
    async () => {
      try {
        setLoading(true);
        setError("");

        const params =
          new URLSearchParams();

        if (search.trim()) {
          params.set(
            "search",
            search.trim()
          );
        }

        if (
          categoryFilter
        ) {
          params.set(
            "category",
            categoryFilter
          );
        }

        const query =
          params.toString();

        const result =
          (await apiRequest(
            `/api/documents${
              query
                ? `?${query}`
                : ""
            }`
          )) as DocumentsResponse;

        setDocuments(
          result.documents || []
        );

        setCategories(
          result.categories || []
        );
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
      }
    };

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    loadDocuments();
  }, []);

  /* =======================================================
     SEARCH / FILTER
  ======================================================= */

  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          loadDocuments();
        },
        300
      );

    return () =>
      window.clearTimeout(
        timer
      );
  }, [
    search,
    categoryFilter,
  ]);

  /* =======================================================
     SUMMARY
  ======================================================= */

  const summary =
    useMemo(() => {
      const total =
        documents.length;

      const invoices =
        documents.filter(
          (document) =>
            document.category
              .toLowerCase() ===
            "invoice"
        ).length;

      const bankStatements =
        documents.filter(
          (document) =>
            document.category
              .toLowerCase()
              .includes(
                "bank statement"
              )
        ).length;

      const payrollReports =
        documents.filter(
          (document) =>
            document.category
              .toLowerCase()
              .includes(
                "payroll"
              )
        ).length;

      return {
        total,
        invoices,
        bankStatements,
        payrollReports,
      };
    }, [
      documents,
    ]);

  /* =======================================================
     SELECT FILE
  ======================================================= */

  const handleFileSelect = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    setError("");

    setSelectedFile(
      file
    );
  };

  /* =======================================================
     UPLOAD DOCUMENT
  ======================================================= */

  const handleUpload =
    async () => {
      if (!selectedFile) {
        setError(
          "Please select a document first."
        );
        return;
      }

      try {
        setUploading(true);
        setError("");

        const generatedCode =
          `DOC-${Date.now()}`;

        /*
         * STEP 1
         *
         * Ask the backend for a tenant-scoped
         * signed upload URL.
         *
         * The backend generates the storage key.
         * Storage credentials are never exposed
         * to the browser.
         */
        const uploadResponse =
          await apiRequest(
            "/api/documents/upload-url",
            {
              method: "POST",

              body: JSON.stringify({
                documentCode:
                  generatedCode,

                fileName:
                  selectedFile.name,

                mimeType:
                  selectedFile.type ||
                  undefined,
              }),
            }
          );

        const uploadUrl =
          uploadResponse
            ?.upload
            ?.url;

        const storageKey =
          uploadResponse
            ?.upload
            ?.storageKey;

        if (
          typeof uploadUrl !==
            "string" ||
          !uploadUrl
        ) {
          throw new Error(
            "The storage upload URL was not returned."
          );
        }

        if (
          typeof storageKey !==
            "string" ||
          !storageKey
        ) {
          throw new Error(
            "The storage key was not returned."
          );
        }

        /*
         * STEP 2
         *
         * Upload the actual binary file directly
         * to the private tenant storage bucket.
         */
        const storageResponse =
          await fetch(
            uploadUrl,
            {
              method: "PUT",

              headers:
                selectedFile.type
                  ? {
                      "Content-Type":
                        selectedFile.type,
                    }
                  : {},

              body:
                selectedFile,
            }
          );

        if (!storageResponse.ok) {
          throw new Error(
            `File upload failed with status ${storageResponse.status}.`
          );
        }

        /*
         * STEP 3
         *
         * Only after the physical file has
         * successfully reached storage do we
         * create its PostgreSQL metadata record.
         */
        await apiRequest(
          "/api/documents",
          {
            method: "POST",

            body: JSON.stringify({
              documentCode:
                generatedCode,

              name:
                selectedFile.name,

              category:
                uploadCategory,

              uploadedBy:
                "Current User",

              mimeType:
                selectedFile.type ||
                null,

              fileSize:
                selectedFile.size,

              storageKey:
                storageKey,
            }),
          }
        );

        /*
         * STEP 4
         *
         * Reset the upload form.
         */
        setSelectedFile(null);

        if (fileInputRef.current) {
          fileInputRef.current.value =
            "";
        }

        setShowUploadModal(false);

        /*
         * STEP 5
         *
         * Refresh the tenant's document register.
         */
        await loadDocuments();
      } catch (err: any) {
        console.error(
          "UPLOAD DOCUMENT ERROR:",
          err
        );

        setError(
          err?.message ||
            "Failed to upload document."
        );
      } finally {
        setUploading(false);
      }
    };

  /* =======================================================
     DOWNLOAD DOCUMENT
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

        /*
         * The backend verifies the
         * authenticated tenant before
         * generating the temporary URL.
         */

        const result =
          await apiRequest(
            `/api/documents/${documentId}/download`
          );

        const downloadUrl =
          result
            ?.download
            ?.url;

        if (
          typeof downloadUrl !==
            "string" ||
          !downloadUrl
        ) {
          throw new Error(
            "Download URL was not returned."
          );
        }

        /*
         * Use an anchor so the signed
         * URL can trigger a download.
         */

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
     DELETE DOCUMENT
  ======================================================= */

  const handleDelete =
    async (
      documentId: string
    ) => {
      const confirmed =
        window.confirm(
          "Are you sure you want to delete this document?"
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

        setDocuments(
          (current) =>
            current.filter(
              (document) =>
                document.id !==
                documentId
            )
        );

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
     EXPORT TO EXCEL
  ======================================================= */

  const exportExcel =
    () => {
      const rows =
        documents.map(
          (document) => ({
            "Document Code":
              document.documentCode,

            Document:
              document.name,

            Category:
              document.category,

            "Uploaded By":
              document.uploadedBy,

            "Upload Date":
              formatDate(
                document.createdAt
              ),

            "File Type":
              document.mimeType ||
              "",

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
     EXPORT TO PDF
  ======================================================= */

  const exportPdf =
    () => {
      const pdf =
        new jsPDF({
          orientation:
            "landscape",
          unit: "mm",
          format: "a4",
        });

      pdf.setFontSize(
        20
      );

      pdf.text(
        "Ziya Financial Operating System",
        14,
        18
      );

      pdf.setFontSize(
        14
      );

      pdf.text(
        "Documents Report",
        14,
        28
      );

      pdf.setFontSize(
        9
      );

      pdf.text(
        `Generated: ${new Date().toLocaleString()}`,
        14,
        36
      );

      const columns = [
        "Code",
        "Document",
        "Category",
        "Uploaded By",
        "Date",
      ];

      const xPositions = [
        14,
        42,
        118,
        168,
        244,
      ];

      let y =
        48;

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

      y += 8;

      documents.forEach(
        (document) => {
          if (
            y >
            190
          ) {
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

            y += 8;
          }

          const values = [
            document.documentCode,
            document.name,
            document.category,
            document.uploadedBy,
            formatDate(
              document.createdAt
            ),
          ];

          values.forEach(
            (
              value,
              index
            ) => {
              const maxWidth =
                index === 1
                  ? 70
                  : 45;

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
        `Total documents: ${documents.length}`,
        14,
        202
      );

      pdf.save(
        "Ziya-FOS-Documents.pdf"
      );
    };

  /* =======================================================
     EXPORT TO WORD
  ======================================================= */

  const exportWord =
    () => {
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
                  document.uploadedBy
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

            <title>
              Ziya FOS Documents
            </title>

            <style>
              body {
                font-family: Arial, sans-serif;
                margin: 40px;
                color: #20243A;
              }

              h1 {
                margin-bottom: 5px;
              }

              p {
                color: #666B84;
              }

              table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 25px;
              }

              th,
              td {
                border: 1px solid #dcdfe8;
                padding: 9px;
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
                  <th>Uploaded By</th>
                  <th>Upload Date</th>
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
     RENDER
  ======================================================= */

  return (
    <div className="space-y-6">

      {/* ===================================================
          HEADER
      =================================================== */}

      <div className="flex justify-between items-center gap-4">

        <div>
          <h1 className="text-3xl font-bold text-[#20243A]">
            Documents
          </h1>

          <p className="text-[#666B84] mt-2">
            Store and manage financial and operational documents.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setShowUploadModal(
              true
            )
          }
          className="flex items-center gap-2 bg-[#0D9488] hover:bg-[#0b8278] px-4 py-2 rounded-lg text-white transition"
        >
          <Upload size={18} />

          Upload Document
        </button>

      </div>

      {/* ===================================================
          ERROR
      =================================================== */}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* ===================================================
          SUMMARY CARDS
      =================================================== */}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">
            Total Documents
          </p>

          <h2 className="text-3xl font-bold text-[#20243A] mt-2">
            {summary.total}
          </h2>
        </div>

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">
            Invoices
          </p>

          <h2 className="text-3xl font-bold text-[#20243A] mt-2">
            {summary.invoices}
          </h2>
        </div>

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">
            Bank Statements
          </p>

          <h2 className="text-3xl font-bold text-green-500 mt-2">
            {summary.bankStatements}
          </h2>
        </div>

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <p className="text-[#666B84]">
            Payroll Reports
          </p>

          <h2 className="text-3xl font-bold text-yellow-500 mt-2">
            {summary.payrollReports}
          </h2>
        </div>

      </div>

      {/* ===================================================
          SEARCH / FILTER / EXPORT
      =================================================== */}

      <div className="bg-white border border-[#ECECF3] rounded-2xl p-4">

        <div className="flex flex-col xl:flex-row gap-3">

          {/* SEARCH */}

          <div className="flex items-center border border-[#ECECF3] rounded-xl px-3 flex-1">

            <Search
              size={18}
              className="text-[#666B84]"
            />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search documents..."
              className="bg-transparent outline-none px-3 py-3 text-[#20243A] flex-1"
            />

          </div>

          {/* CATEGORY FILTER */}

          <div className="relative flex items-center border border-[#ECECF3] rounded-xl px-3">

            <Filter
              size={18}
              className="text-[#666B84] shrink-0"
            />

            <select
              value={
                categoryFilter
              }
              onChange={(event) =>
                setCategoryFilter(
                  event.target.value
                )
              }
              className="bg-transparent outline-none px-3 py-3 text-[#20243A] min-w-[180px] cursor-pointer"
              aria-label="Filter documents by category"
            >
              <option value="">
                All Categories
              </option>

              {categories.map(
                (category) => (
                  <option
                    key={category}
                    value={category}
                  >
                    {category}
                  </option>
                )
              )}
            </select>


          </div>

          {/* PDF */}

          <button
            type="button"
            onClick={
              exportPdf
            }
            disabled={
              documents.length ===
              0
            }
            className="flex items-center justify-center gap-2 border border-[#ECECF3] rounded-xl px-4 py-3 text-[#20243A] hover:bg-[#F8F9FB] disabled:opacity-50"
          >
            <FileDown
              size={18}
            />

            PDF
          </button>

          {/* WORD */}

          <button
            type="button"
            onClick={
              exportWord
            }
            disabled={
              documents.length ===
              0
            }
            className="flex items-center justify-center gap-2 border border-[#ECECF3] rounded-xl px-4 py-3 text-[#20243A] hover:bg-[#F8F9FB] disabled:opacity-50"
          >
            <FileText
              size={18}
            />

            Word
          </button>

          {/* EXCEL */}

          <button
            type="button"
            onClick={
              exportExcel
            }
            disabled={
              documents.length ===
              0
            }
            className="flex items-center justify-center gap-2 border border-[#ECECF3] rounded-xl px-4 py-3 text-[#20243A] hover:bg-[#F8F9FB] disabled:opacity-50"
          >
            <FileSpreadsheet
              size={18}
            />

            Excel
          </button>

        </div>

      </div>

      {/* ===================================================
          DOCUMENT TABLE
      =================================================== */}

      <div className="bg-white border border-[#ECECF3] rounded-2xl overflow-hidden">

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#666B84]">

            <Loader2
              size={22}
              className="animate-spin mr-3"
            />

            Loading documents...

          </div>
        ) : documents.length ===
          0 ? (

          <div className="text-center py-16">

            <FileText
              size={40}
              className="mx-auto text-[#A0A4B8] mb-3"
            />

            <p className="text-[#20243A] font-medium">
              No documents found
            </p>

            <p className="text-[#666B84] mt-1">
              Upload a document or change your search criteria.
            </p>

          </div>

        ) : (

          <div className="overflow-x-auto">

            <table className="w-full">

              <thead className="bg-white text-[#666B84]">

                <tr>

                  <th className="text-left p-4">
                    Document
                  </th>

                  <th className="text-left p-4">
                    Category
                  </th>

                  <th className="text-left p-4">
                    Uploaded By
                  </th>

                  <th className="text-left p-4">
                    Upload Date
                  </th>

                  <th className="text-left p-4">
                    Size
                  </th>

                  <th className="text-right p-4">
                    Actions
                  </th>

                </tr>

              </thead>

              <tbody>

                {documents.map(
                  (doc) => (

                    <tr
                      key={doc.id}
                      className="border-t border-[#ECECF3] hover:bg-[#FAFBFC]"
                    >

                      {/* DOCUMENT */}

                      <td className="p-4">

                        <div className="flex items-center gap-3">

                          <div className="w-9 h-9 rounded-lg bg-[#F1F5F9] flex items-center justify-center">

                            <FileText
                              size={18}
                              className="text-[#0D9488]"
                            />

                          </div>

                          <div>

                            <p className="text-[#20243A] font-medium">
                              {doc.name}
                            </p>

                            <p className="text-xs text-[#8A8FA3] mt-1">
                              {doc.documentCode}
                            </p>

                          </div>

                        </div>

                      </td>

                      {/* CATEGORY */}

                      <td className="p-4 text-[#20243A]">
                        {doc.category}
                      </td>

                      {/* UPLOADED BY */}

                      <td className="p-4 text-[#666B84]">
                        {doc.uploadedBy}
                      </td>

                      {/* DATE */}

                      <td className="p-4 text-[#666B84]">
                        {formatDate(
                          doc.createdAt
                        )}
                      </td>

                      {/* SIZE */}

                      <td className="p-4 text-[#666B84]">
                        {formatFileSize(
                          doc.fileSize
                        )}
                      </td>

                      {/* ACTIONS */}

                      <td className="p-4 text-right">

                        <div className="flex items-center justify-end gap-2">

                          {/* DOWNLOAD */}

                          <button
                            type="button"
                            onClick={() =>
                              handleDownload(
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
                            className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-[#0D9488] hover:bg-[#E6FFFB] disabled:opacity-40"
                            title={
                              doc.storageKey
                                ? "Download document"
                                : "File unavailable"
                            }
                          >

                            {downloadingId ===
                            doc.id ? (

                              <Loader2
                                size={17}
                                className="animate-spin"
                              />

                            ) : (

                              <Download
                                size={17}
                              />

                            )}

                          </button>

                          {/* DELETE */}

                          <button
                            type="button"
                            onClick={() =>
                              handleDelete(
                                doc.id
                              )
                            }
                            disabled={
                              deletingId ===
                              doc.id
                            }
                            className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50"
                            title="Delete document"
                          >

                            {deletingId ===
                            doc.id ? (

                              <Loader2
                                size={17}
                                className="animate-spin"
                              />

                            ) : (

                              <Trash2
                                size={17}
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

        )}

      </div>

      {/* ===================================================
          UPLOAD MODAL
      =================================================== */}

      {showUploadModal && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">

          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">

            {/* MODAL HEADER */}

            <div className="flex items-center justify-between p-6 border-b border-[#ECECF3]">

              <div>

                <h2 className="text-xl font-semibold text-[#20243A]">
                  Upload Document
                </h2>

                <p className="text-sm text-[#666B84] mt-1">
                  Add a document to this organization's document register.
                </p>

              </div>

              <button
                type="button"
                onClick={() => {
                  if (!uploading) {
                    setShowUploadModal(
                      false
                    );
                  }
                }}
                disabled={
                  uploading
                }
                className="w-9 h-9 rounded-lg hover:bg-[#F5F6F8] flex items-center justify-center disabled:opacity-40"
              >

                <X
                  size={18}
                  className="text-[#666B84]"
                />

              </button>

            </div>

            {/* MODAL BODY */}

            <div className="p-6 space-y-5">

              {/* FILE */}

              <div>

                <label className="block text-sm font-medium text-[#20243A] mb-2">
                  Document
                </label>

                <input
                  ref={
                    fileInputRef
                  }
                  type="file"
                  onChange={
                    handleFileSelect
                  }
                  disabled={
                    uploading
                  }
                  className="w-full border border-[#ECECF3] rounded-xl px-3 py-3 text-sm disabled:opacity-50"
                />

                {selectedFile && (

                  <p className="text-sm text-[#666B84] mt-2">

                    {selectedFile.name}

                    {" · "}

                    {formatFileSize(
                      selectedFile.size
                    )}

                  </p>

                )}

              </div>

              {/* CATEGORY */}

              <div>

                <label className="block text-sm font-medium text-[#20243A] mb-2">
                  Category
                </label>

                <select
                  value={
                    uploadCategory
                  }
                  onChange={(event) =>
                    setUploadCategory(
                      event.target.value
                    )
                  }
                  disabled={
                    uploading
                  }
                  className="w-full border border-[#ECECF3] rounded-xl px-3 py-3 text-[#20243A] outline-none disabled:opacity-50"
                >

                  <option value="Invoice">
                    Invoice
                  </option>

                  <option value="Bank Statement">
                    Bank Statement
                  </option>

                  <option value="Payroll">
                    Payroll
                  </option>

                  <option value="Procurement">
                    Procurement
                  </option>

                  <option value="Tax">
                    Tax
                  </option>

                  <option value="Contract">
                    Contract
                  </option>

                  <option value="Other">
                    Other
                  </option>

                </select>

              </div>

              {/* STORAGE NOTICE */}

              <div className="bg-[#F8FAFC] border border-[#ECECF3] rounded-xl p-4 text-sm text-[#666B84]">

                Your document will be securely stored in the organization's private storage and can be downloaded later from this Documents register.

              </div>

            </div>

            {/* MODAL FOOTER */}

            <div className="flex justify-end gap-3 p-6 border-t border-[#ECECF3]">

              <button
                type="button"
                onClick={() =>
                  setShowUploadModal(
                    false
                  )
                }
                disabled={
                  uploading
                }
                className="px-4 py-2 rounded-lg border border-[#ECECF3] text-[#20243A] disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={
                  handleUpload
                }
                disabled={
                  uploading ||
                  !selectedFile
                }
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0D9488] text-white disabled:opacity-50"
              >

                {uploading && (

                  <Loader2
                    size={17}
                    className="animate-spin"
                  />

                )}

                {uploading
                  ? "Uploading..."
                  : "Upload Document"}

              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}