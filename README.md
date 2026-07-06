# react-bulk-excel-import

Headless React hook for **bulk Excel/CSV imports** with row-level validation, error preview and batched import progress. Bring your own UI — the hook gives you parsed rows, valid/invalid splits and progress; you render the table however you like.

Built from patterns used in production admin dashboards (bulk resident/flat uploads in a multi-tenant SaaS).

## Why?

Every admin panel eventually needs "Upload Excel to bulk-add records". The messy parts are always the same:

- Mapping messy sheet headers ("Flat No", "flat_no", "Flat Number") to your data model
- Per-cell validation with clear row/field error messages
- Showing users a green/red preview **before** anything hits the API
- Importing in batches with progress

This hook handles all of that. Zero UI opinions.

## Install

```bash
npm install react-bulk-excel-import xlsx
```

`react` (>=17) and `xlsx` (SheetJS) are peer dependencies.

## Quick start

```tsx
import { useBulkImport } from "react-bulk-excel-import";

type Resident = { name: string; email: string; flatNumber: string };

function BulkResidentUpload() {
  const {
    status, rows, validRows, invalidRows,
    fileError, progress, parseFile, importRows, reset,
  } = useBulkImport<Resident>({
    columns: [
      { header: ["Name", "Full Name"], key: "name", required: true },
      {
        header: "Email",
        key: "email",
        required: true,
        transform: (v) => String(v).trim().toLowerCase(),
        validate: (v) =>
          /^\S+@\S+\.\S+$/.test(String(v)) ? null : "Invalid email",
      },
      {
        header: ["Flat No", "Flat Number", "flat_no"],
        key: "flatNumber",
        required: true,
        transform: (v) => String(v).trim().toUpperCase(),
      },
    ],
    validateRow: (row, { allRows }) => {
      const dupes = allRows.filter((r) => r.email === row.email);
      if (dupes.length > 1)
        return [{ field: "email", message: "Duplicate email in file" }];
    },
    onImport: async (batch) => {
      await api.post("/residents/bulk", { residents: batch });
    },
    batchSize: 50,
  });

  return (
    <div>
      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])}
      />

      {fileError && <p className="error">{fileError}</p>}

      {status === "ready" && (
        <>
          <p>{validRows.length} valid · {invalidRows.length} with errors</p>
          <table>
            <tbody>
              {rows.map((r) => (
                <tr key={r.rowNumber} className={r.isValid ? "ok" : "bad"}>
                  <td>{r.rowNumber}</td>
                  <td>{String(r.data.name)}</td>
                  <td>{String(r.data.email)}</td>
                  <td>{r.errors.map((e) => e.message).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={importRows} disabled={validRows.length === 0}>
            Import {validRows.length} rows
          </button>
        </>
      )}

      {status === "importing" && <progress value={progress.percent} max={100} />}
      {status === "done" && <p>Imported {progress.total} rows 🎉 <button onClick={reset}>Start over</button></p>}
    </div>
  );
}
```

## API

### `useBulkImport<T>(options)`

| Option | Type | Description |
| --- | --- | --- |
| `columns` | `ColumnDef<T>[]` | Header aliases, required flag, `transform`, `validate` per column |
| `validateRow` | `(data, ctx) => RowError[] \| void` | Cross-field / duplicate checks, runs after column validation |
| `onImport` | `(batch, ctx) => Promise<void>` | Your import logic (API call, dispatch, etc.). Throw to fail. |
| `batchSize` | `number` | Rows per `onImport` call. Default `50`. `Infinity` = one call |
| `sheet` | `number \| string` | Sheet index or name. Default: first sheet |
| `maxRows` | `number` | File-level row cap. Default `5000` |
| `acceptedExtensions` | `string[]` | Default `[".xlsx", ".xls", ".csv"]` |

### Returns

| Field | Description |
| --- | --- |
| `status` | `idle → parsing → ready → importing → done` (or `error`) |
| `rows` / `validRows` / `invalidRows` | Parsed rows with `rowNumber`, `data`, `errors`, `isValid` |
| `fileError` | File-level error (bad extension, missing columns, empty sheet…) |
| `progress` | `{ imported, total, percent }` during import |
| `parseFile(file)` | Parse a `File` from input or drag-drop |
| `importRows()` | Import all valid rows in batches |
| `reset()` | Back to idle |

## Features

- 🎯 **Headless** — works with any UI library or design system
- 🔤 **Header aliasing** — case/space/underscore-insensitive header matching
- ✅ **Three validation layers** — required, per-column `validate`, cross-row `validateRow`
- 📦 **Batched imports** with progress
- 🛡️ **File guards** — extension, empty sheet, missing columns, max rows
- 🟦 **TypeScript-first** — fully typed rows via generics

## License

MIT
