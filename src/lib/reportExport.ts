import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ExportCell {
  value: unknown;
  align?: "left" | "center" | "right";
}

export type ExportRow = ExportCell[];

export interface ReportPdfOptions {
  reportName: string;
  organizationName?: string;
  organizationSubtitle?: string;
  period?: string;
  startDate?: string;
  endDate?: string;
  asOfDate?: string;
  currency?: string;
  rows: ExportRow[];
  filename?: string;
}

const cleanText = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\uFFFD/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

const formatDate = (value?: string): string => {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const isNumeric = (value: string): boolean => {
  if (!value) return false;

  const normalized = value
    .replace(/KES/gi, "")
    .replace(/,/g, "")
    .replace(/%/g, "")
    .trim();

  return /^-?\d+(\.\d+)?$/.test(normalized);
};

const safeFilename = (value: string): string => {
  return cleanText(value)
    .replace(/[<>:"/\\|?*]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
};

export const safePdfFilename = (reportName: string): string => {
  return `${safeFilename(reportName || "financial-report")}.pdf`;
};

export const exportReportPdf = ({
  reportName,
  organizationName = "ZIYA",
  organizationSubtitle = "Financial Operating System",
  period,
  startDate,
  endDate,
  asOfDate,
  currency = "KES",
  rows,
  filename,
}: ReportPdfOptions): void => {
  const cleanedRows = rows.map((row) =>
    row.map((cell) => ({
      value: cleanText(cell.value),
      align: cell.align,
    }))
  );

  const maxColumns = cleanedRows.reduce(
    (max, row) => Math.max(max, row.length),
    0
  );

  const orientation = maxColumns >= 7 ? "landscape" : "portrait";

  const pdf = new jsPDF({
    orientation,
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const margin = 14;

  /*
   * Header
   */
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text(cleanText(organizationName), margin, 17);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text(cleanText(organizationSubtitle), margin, 22);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.text(cleanText(reportName), margin, 33);

  /*
   * Metadata
   */
  let metadataY = 40;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);

  if (period) {
    pdf.text(`Period: ${cleanText(period)}`, margin, metadataY);
    metadataY += 5;
  }

  if (asOfDate) {
    pdf.text(`As of: ${formatDate(asOfDate)}`, margin, metadataY);
    metadataY += 5;
  } else if (startDate || endDate) {
    const range = [
      startDate ? formatDate(startDate) : "",
      endDate ? formatDate(endDate) : "",
    ]
      .filter(Boolean)
    .join(" - ");

    if (range) {
      pdf.text(`Date range: ${range}`, margin, metadataY);
      metadataY += 5;
    }
  }

  if (currency) {
    pdf.text(`Currency: ${cleanText(currency)}`, margin, metadataY);
    metadataY += 5;
  }

  pdf.setDrawColor(210, 214, 220);
  pdf.line(margin, metadataY + 2, pageWidth - margin, metadataY + 2);

  /*
   * Split the export into logical blocks.
   *
   * A row containing one cell is treated as a section heading.
   */
  const blocks: Array<
    | { type: "heading"; text: string }
    | { type: "table"; rows: ExportRow[] }
  > = [];

  let tableRows: ExportRow[] = [];

  const flushTable = () => {
    if (tableRows.length > 0) {
      blocks.push({
        type: "table",
        rows: tableRows,
      });

      tableRows = [];
    }
  };

  for (const row of cleanedRows) {
    const values = row.map((cell) => cleanText(cell.value));

    const isEmpty = values.every((value) => value === "");

    if (isEmpty) {
      flushTable();
      continue;
    }

    if (values.length === 1 && values[0]) {
      flushTable();

      blocks.push({
        type: "heading",
        text: values[0],
      });

      continue;
    }

    tableRows.push(row);
  }

  flushTable();

  let cursorY = metadataY + 9;

  /*
   * Render blocks
   */
  for (const block of blocks) {
    if (block.type === "heading") {
      if (cursorY > pageHeight - 35) {
        pdf.addPage();
        cursorY = 18;
      }

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text(cleanText(block.text), margin, cursorY);

      cursorY += 6;
      continue;
    }

    if (block.type === "table") {
      if (cursorY > pageHeight - 45) {
        pdf.addPage();
        cursorY = 18;
      }

      const tableRows = block.rows;

      if (tableRows.length === 0) {
        continue;
      }

      /*
       * If the first row looks like a header, use it as the table header.
       */
      const firstRow = tableRows[0];

      const looksLikeHeader = firstRow.some((cell) => {
        const value = cleanText(cell.value);

        return (
          value &&
          !isNumeric(value) &&
          !/^KES\s*-?\d/i.test(value)
        );
      });

      const head = looksLikeHeader ? [firstRow] : undefined;
      const body = looksLikeHeader
        ? tableRows.slice(1)
        : tableRows;

      autoTable(pdf, {
        startY: cursorY,
        margin: {
          left: margin,
          right: margin,
        },

        head: head?.map((row) =>
          row.map((cell) => cleanText(cell.value))
        ),

        body: body.map((row) =>
          row.map((cell) => cleanText(cell.value))
        ),

        theme: "grid",

        styles: {
          font: "helvetica",
          fontSize: maxColumns >= 7 ? 6.5 : 7.5,
          cellPadding: 2.2,
          overflow: "linebreak",
          valign: "middle",
          lineColor: [220, 224, 230],
          lineWidth: 0.15,
        },

        headStyles: {
          fontStyle: "bold",
          fontSize: maxColumns >= 7 ? 6.5 : 7.5,
          cellPadding: 2.5,
          textColor: [35, 39, 55],
          fillColor: [241, 243, 246],
          lineColor: [210, 214, 220],
          lineWidth: 0.2,
        },

        alternateRowStyles: {
          fillColor: [249, 250, 251],
        },

        bodyStyles: {
          textColor: [55, 59, 70],
        },

        columnStyles: Object.fromEntries(
          Array.from({ length: maxColumns }, (_, index) => [
            index,
            {
              halign:
                tableRows.some((row) =>
                  isNumeric(cleanText(row[index]?.value))
                )
                  ? "right"
                  : "left",
            },
          ])
        ),

        didParseCell: (data) => {
          const raw = cleanText(data.cell.raw);

          if (
            data.section === "body" &&
            isNumeric(raw)
          ) {
            data.cell.styles.halign = "right";
          }

          if (
            data.section === "body" &&
            /^(total|net|balance|grand total|profit|loss)/i.test(raw)
          ) {
            data.cell.styles.fontStyle = "bold";
          }
        },
      });

      const lastTable = (
        pdf as unknown as {
          lastAutoTable?: {
            finalY?: number;
          };
        }
      ).lastAutoTable;

      cursorY = (lastTable?.finalY ?? cursorY) + 8;
    }
  }

  /*
   * Footer on every page
   */
  const totalPages = pdf.getNumberOfPages();

  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(120, 125, 135);

    pdf.text(
      `${cleanText(organizationName)} | Financial Operating System`,
      margin,
      pageHeight - 9
    );

    pdf.text(
      `Page ${page} of ${totalPages}`,
      pageWidth - margin,
      pageHeight - 9,
      {
        align: "right",
      }
    );

    pdf.setTextColor(0, 0, 0);
  }

  pdf.save(filename || safePdfFilename(reportName));
};
