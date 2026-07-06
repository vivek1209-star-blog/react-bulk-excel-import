import { useCallback, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import type {
  ColumnDef,
  ImportProgress,
  ImportStatus,
  ParsedRow,
  RawRow,
  RowError,
  UseBulkImportOptions,
  UseBulkImportReturn,
} from "./types";

const DEFAULT_EXTENSIONS = [".xlsx", ".xls", ".csv"];
const DEFAULT_MAX_ROWS = 5000;
const DEFAULT_BATCH_SIZE = 50;

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_-]+/g, " ").trim();
}

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || String(v).trim() === "";
}

export function useBulkImport<T = RawRow>(
  options: UseBulkImportOptions<T>
): UseBulkImportReturn<T> {
  const {
    columns,
    validateRow,
    onImport,
    batchSize = DEFAULT_BATCH_SIZE,
    sheet,
    maxRows = DEFAULT_MAX_ROWS,
    acceptedExtensions = DEFAULT_EXTENSIONS,
  } = options;

  const [status, setStatus] = useState<ImportStatus>("idle");
  const [rows, setRows] = useState<ParsedRow<T>[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ImportProgress>({
    imported: 0,
    total: 0,
    percent: 0,
  });

  // keep latest options without re-creating callbacks
  const optionsRef = useRef({ columns, validateRow, onImport, batchSize });
  optionsRef.current = { columns, validateRow, onImport, batchSize };

  const reset = useCallback(() => {
    setStatus("idle");
    setRows([]);
    setFileError(null);
    setProgress({ imported: 0, total: 0, percent: 0 });
  }, []);

  const parseFile = useCallback(
    async (file: File) => {
      setFileError(null);
      setRows([]);
      setStatus("parsing");

      const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
      if (!acceptedExtensions.includes(ext)) {
        setFileError(
          `Unsupported file type "${ext}". Allowed: ${acceptedExtensions.join(", ")}`
        );
        setStatus("error");
        return;
      }

      let workbook: XLSX.WorkBook;
      try {
        const buffer = await file.arrayBuffer();
        workbook = XLSX.read(buffer, { type: "array" });
      } catch {
        setFileError("Could not read the file. It may be corrupted.");
        setStatus("error");
        return;
      }

      const sheetName =
        typeof sheet === "string"
          ? sheet
          : workbook.SheetNames[typeof sheet === "number" ? sheet : 0];
      const ws = sheetName ? workbook.Sheets[sheetName] : undefined;
      if (!ws) {
        setFileError(`Sheet "${String(sheet ?? 0)}" not found in the file.`);
        setStatus("error");
        return;
      }

      const rawRows = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: "" });
      if (rawRows.length === 0) {
        setFileError("The sheet is empty (no data rows found).");
        setStatus("error");
        return;
      }
      if (rawRows.length > maxRows) {
        setFileError(
          `Too many rows (${rawRows.length}). Maximum allowed is ${maxRows}.`
        );
        setStatus("error");
        return;
      }

      // Build header lookup: normalized sheet header -> actual header
      const sheetHeaders = Object.keys(rawRows[0]);
      const headerLookup = new Map<string, string>();
      for (const h of sheetHeaders) headerLookup.set(normalizeHeader(h), h);

      const { columns: cols, validateRow: rowValidator } = optionsRef.current;

      // Resolve each column def to an actual sheet header (if present)
      const resolved = cols.map((col) => {
        const aliases = Array.isArray(col.header) ? col.header : [col.header];
        const match = aliases
          .map((a) => headerLookup.get(normalizeHeader(a)))
          .find(Boolean);
        return { col, sheetHeader: match };
      });

      // File-level check: required columns missing from the sheet entirely
      const missing = resolved
        .filter((r) => r.col.required && !r.sheetHeader)
        .map((r) =>
          Array.isArray(r.col.header) ? r.col.header[0] : r.col.header
        );
      if (missing.length > 0) {
        setFileError(`Missing required column(s): ${missing.join(", ")}`);
        setStatus("error");
        return;
      }

      // Parse + validate each row
      const parsed: ParsedRow<T>[] = rawRows.map((raw, i) => {
        const errors: RowError[] = [];
        const data = {} as Record<string, unknown>;

        for (const { col, sheetHeader } of resolved) {
          const rawValue = sheetHeader ? raw[sheetHeader] : "";
          let value: unknown = rawValue;

          if (col.required && isEmpty(rawValue)) {
            errors.push({ field: col.key, message: `${col.key} is required` });
          } else if (!isEmpty(rawValue) || col.transform) {
            if (col.transform) {
              try {
                value = col.transform(rawValue, raw);
              } catch (e) {
                errors.push({
                  field: col.key,
                  message: e instanceof Error ? e.message : "Invalid value",
                });
              }
            }
            if (col.validate) {
              const msg = col.validate(value, raw);
              if (msg) errors.push({ field: col.key, message: msg });
            }
          }
          data[col.key] = value;
        }

        return {
          rowNumber: i + 1,
          raw,
          data: data as T,
          errors,
          isValid: errors.length === 0,
        };
      });

      // Row-level (cross-field / duplicate) validation on currently-valid rows
      if (rowValidator) {
        const allData = parsed.map((p) => p.data);
        for (const p of parsed) {
          if (!p.isValid) continue;
          const extra = rowValidator(p.data, {
            rowNumber: p.rowNumber,
            allRows: allData,
          });
          if (extra && extra.length > 0) {
            p.errors.push(...extra);
            p.isValid = false;
          }
        }
      }

      setRows(parsed);
      setStatus("ready");
    },
    [acceptedExtensions, maxRows, sheet]
  );

  const importRows = useCallback(async () => {
    const valid = rows.filter((r) => r.isValid).map((r) => r.data);
    if (valid.length === 0) return;

    const { onImport: importer, batchSize: size } = optionsRef.current;
    const effectiveSize =
      !size || size === Infinity ? valid.length : Math.max(1, size);
    const totalBatches = Math.ceil(valid.length / effectiveSize);

    setStatus("importing");
    setProgress({ imported: 0, total: valid.length, percent: 0 });

    try {
      for (let b = 0; b < totalBatches; b++) {
        const batch = valid.slice(b * effectiveSize, (b + 1) * effectiveSize);
        await importer(batch, { batchIndex: b, totalBatches });
        const imported = Math.min((b + 1) * effectiveSize, valid.length);
        setProgress({
          imported,
          total: valid.length,
          percent: Math.round((imported / valid.length) * 100),
        });
      }
      setStatus("done");
    } catch (e) {
      setFileError(
        e instanceof Error ? e.message : "Import failed. Please try again."
      );
      setStatus("error");
    }
  }, [rows]);

  const validRows = useMemo(() => rows.filter((r) => r.isValid), [rows]);
  const invalidRows = useMemo(() => rows.filter((r) => !r.isValid), [rows]);

  return {
    status,
    rows,
    validRows,
    invalidRows,
    fileError,
    progress,
    parseFile,
    importRows,
    reset,
  };
}
