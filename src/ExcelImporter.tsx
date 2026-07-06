import React, { useCallback, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useBulkImport } from "./useBulkImport";
import type { UseBulkImportOptions, RawRow } from "./types";

export interface ExcelImporterProps<T = RawRow>
  extends UseBulkImportOptions<T> {
  /** Show/hide the modal */
  open: boolean;
  /** Called when user closes the modal */
  onClose: () => void;
  /** Modal heading (default: "Import from Excel") */
  title?: string;
  /** Accent color for buttons/highlights (default: #2563eb) */
  accentColor?: string;
  /** Show a "Download template" button generated from your columns (default: true) */
  showTemplateDownload?: boolean;
  /** Called after a successful import */
  onComplete?: (importedCount: number) => void;
}

const S = {
  overlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(15,23,42,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: 16,
  },
  modal: {
    background: "#fff",
    borderRadius: 14,
    width: "100%",
    maxWidth: 720,
    maxHeight: "85vh",
    display: "flex",
    flexDirection: "column" as const,
    fontFamily:
      "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: "1px solid #e2e8f0",
  },
  title: { margin: 0, fontSize: 17, fontWeight: 700, color: "#0f172a" },
  close: {
    border: "none",
    background: "transparent",
    fontSize: 22,
    lineHeight: 1,
    cursor: "pointer",
    color: "#64748b",
    padding: 4,
  },
  body: { padding: 20, overflowY: "auto" as const, flex: 1 },
  drop: (active: boolean, accent: string) => ({
    border: `2px dashed ${active ? accent : "#cbd5e1"}`,
    background: active ? `${accent}0d` : "#f8fafc",
    borderRadius: 12,
    padding: "42px 20px",
    textAlign: "center" as const,
    cursor: "pointer",
    transition: "all .15s ease",
  }),
  btn: (accent: string, disabled = false) => ({
    background: disabled ? "#94a3b8" : accent,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "10px 18px",
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
  }),
  ghostBtn: {
    background: "transparent",
    color: "#475569",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    padding: "10px 18px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    padding: "14px 20px",
    borderTop: "1px solid #e2e8f0",
    background: "#f8fafc",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: 13,
    marginTop: 12,
  },
  th: {
    textAlign: "left" as const,
    padding: "8px 10px",
    background: "#f1f5f9",
    color: "#334155",
    fontWeight: 600,
    borderBottom: "1px solid #e2e8f0",
    position: "sticky" as const,
    top: 0,
  },
  td: { padding: "7px 10px", borderBottom: "1px solid #f1f5f9", color: "#334155" },
  badge: (ok: boolean) => ({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    background: ok ? "#dcfce7" : "#fee2e2",
    color: ok ? "#166534" : "#b91c1c",
  }),
  error: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    marginBottom: 12,
  },
  progressOuter: {
    height: 10,
    background: "#e2e8f0",
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 14,
  },
};

export function ExcelImporter<T = RawRow>(props: ExcelImporterProps<T>) {
  const {
    open,
    onClose,
    title = "Import from Excel",
    accentColor = "#2563eb",
    showTemplateDownload = true,
    onComplete,
    ...hookOptions
  } = props;

  const {
    status,
    rows,
    validRows,
    invalidRows,
    fileError,
    progress,
    parseFile,
    importRows,
    reset,
  } = useBulkImport<T>(hookOptions);

  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = useCallback(
    (file?: File | null) => {
      if (file) void parseFile(file);
    },
    [parseFile]
  );

  const downloadTemplate = useCallback(() => {
    const headers = hookOptions.columns.map((c) =>
      Array.isArray(c.header) ? c.header[0] : c.header
    );
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "import-template.xlsx");
  }, [hookOptions.columns]);

  const handleImport = useCallback(async () => {
    await importRows();
  }, [importRows]);

  const closeAndReset = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  if (!open) return null;

  const columnKeys = hookOptions.columns.map((c) => c.key);

  return (
    <div style={S.overlay} onMouseDown={(e) => e.target === e.currentTarget && closeAndReset()}>
      <div style={S.modal} role="dialog" aria-modal="true" aria-label={title}>
        <div style={S.header}>
          <h3 style={S.title}>{title}</h3>
          <button style={S.close} onClick={closeAndReset} aria-label="Close">
            ×
          </button>
        </div>

        <div style={S.body}>
          {fileError && <div style={S.error}>⚠️ {fileError}</div>}

          {(status === "idle" || status === "error" || status === "parsing") && (
            <>
              <div
                style={S.drop(dragActive, accentColor)}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  handleFile(e.dataTransfer.files?.[0]);
                }}
              >
                <div style={{ fontSize: 34, marginBottom: 8 }}>📄</div>
                <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 15 }}>
                  {status === "parsing"
                    ? "Reading file…"
                    : "Drop your Excel/CSV file here"}
                </div>
                <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                  or click to browse — .xlsx, .xls, .csv
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  style={{ display: "none" }}
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </div>
              {showTemplateDownload && (
                <div style={{ textAlign: "center", marginTop: 14 }}>
                  <button style={S.ghostBtn} onClick={downloadTemplate}>
                    ⬇ Download template
                  </button>
                </div>
              )}
            </>
          )}

          {status === "ready" && (
            <>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={S.badge(true)}>✓ {validRows.length} valid</span>
                {invalidRows.length > 0 && (
                  <span style={S.badge(false)}>
                    ✕ {invalidRows.length} with errors
                  </span>
                )}
              </div>
              <div style={{ maxHeight: 320, overflowY: "auto", marginTop: 4 }}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>#</th>
                      {columnKeys.map((k) => (
                        <th key={k} style={S.th}>
                          {k}
                        </th>
                      ))}
                      <th style={S.th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr
                        key={r.rowNumber}
                        style={{ background: r.isValid ? undefined : "#fff1f2" }}
                      >
                        <td style={S.td}>{r.rowNumber}</td>
                        {columnKeys.map((k) => (
                          <td key={k} style={S.td}>
                            {String(
                              (r.data as Record<string, unknown>)[k] ?? ""
                            )}
                          </td>
                        ))}
                        <td style={S.td}>
                          {r.isValid ? (
                            <span style={S.badge(true)}>OK</span>
                          ) : (
                            <span
                              style={{ ...S.badge(false), whiteSpace: "nowrap" }}
                              title={r.errors.map((e) => e.message).join(", ")}
                            >
                              {r.errors[0]?.message}
                              {r.errors.length > 1
                                ? ` +${r.errors.length - 1}`
                                : ""}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {status === "importing" && (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <div style={{ fontWeight: 600, color: "#0f172a" }}>
                Importing {progress.total} rows…
              </div>
              <div style={S.progressOuter}>
                <div
                  style={{
                    width: `${progress.percent}%`,
                    height: "100%",
                    background: accentColor,
                    transition: "width .2s ease",
                  }}
                />
              </div>
              <div style={{ color: "#64748b", fontSize: 13, marginTop: 8 }}>
                {progress.imported} / {progress.total} ({progress.percent}%)
              </div>
            </div>
          )}

          {status === "done" && (
            <div style={{ textAlign: "center", padding: "36px 0" }}>
              <div style={{ fontSize: 40 }}>🎉</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#0f172a" }}>
                {progress.total} rows imported successfully
              </div>
            </div>
          )}
        </div>

        <div style={S.footer}>
          {status === "ready" && (
            <>
              <button style={S.ghostBtn} onClick={reset}>
                Choose another file
              </button>
              <button
                style={S.btn(accentColor, validRows.length === 0)}
                disabled={validRows.length === 0}
                onClick={handleImport}
              >
                Import {validRows.length} rows
              </button>
            </>
          )}
          {status === "done" && (
            <button
              style={S.btn(accentColor)}
              onClick={() => {
                onComplete?.(progress.total);
                closeAndReset();
              }}
            >
              Done
            </button>
          )}
          {(status === "idle" || status === "error") && (
            <button style={S.ghostBtn} onClick={closeAndReset}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
