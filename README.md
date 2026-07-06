# react-bulk-excel-import

A tiny **headless React hook** that turns "upload an Excel file → validate rows → import to your API" into a few lines of code.

No UI included, no styles forced on you — you get clean parsed data, validation errors and progress. You render it however you want.

## The problem

Almost every app eventually needs a **"Bulk Upload via Excel"** feature — importing users, products, orders, contacts, anything.

Doing it by hand means writing the same 200+ lines every time:

1. Read the file with SheetJS
2. Match column headers (users type `Email`, `email`, `E-mail`…)
3. Validate every cell and collect readable errors
4. Show the user which rows are OK and which are broken **before** calling the API
5. Send data to the server in batches and show progress

This library does steps 1–5 for you. **You write ~20 lines instead of ~200.**

## Install

```bash
npm install react-bulk-excel-import xlsx
```

> `react` (>=17) and `xlsx` are peer dependencies.

## Quick start (a simple example)

Let's import a sheet of users with 3 columns: **Name, Email, Age**.

```tsx
import { useBulkImport } from "react-bulk-excel-import";

function UserImport() {
  const { status, validRows, invalidRows, fileError, progress, parseFile, importRows } =
    useBulkImport({
      // 1. Describe your columns
      columns: [
        { header: "Name", key: "name", required: true },
        {
          header: "Email",
          key: "email",
          required: true,
          validate: (v) => (String(v).includes("@") ? null : "Invalid email"),
        },
        { header: "Age", key: "age", transform: (v) => Number(v) },
      ],

      // 2. Say what "import" means for you (any API call)
      onImport: async (rows) => {
        await fetch("/api/users/bulk", {
          method: "POST",
          body: JSON.stringify(rows),
        });
      },
    });

  return (
    <div>
      {/* 3. Wire up a file input */}
      <input type="file" accept=".xlsx,.csv" onChange={(e) => parseFile(e.target.files[0])} />

      {fileError && <p style={{ color: "red" }}>{fileError}</p>}

      {status === "ready" && (
        <>
          <p>✅ {validRows.length} valid rows &nbsp; ❌ {invalidRows.length} rows with errors</p>
          <button onClick={importRows}>Import {validRows.length} rows</button>
        </>
      )}

      {status === "importing" && <p>Importing… {progress.percent}%</p>}
      {status === "done" && <p>🎉 Done! {progress.total} rows imported.</p>}
    </div>
  );
}
```

That's the whole feature. File reading, header matching, validation, error rows, batching and progress — all handled.

### Showing error details to users

Every row tells you exactly what's wrong:

```tsx
{invalidRows.map((row) => (
  <p key={row.rowNumber}>
    Row {row.rowNumber}: {row.errors.map((e) => e.message).join(", ")}
  </p>
))}
// → "Row 4: email is required"
// → "Row 7: Invalid email"
```

## How much data can I upload?

- **Default limit: 5,000 rows** per file — safe for smooth browser performance.
- Need more? Raise it: `maxRows: 20000`. Parsing happens in the browser, so 10k–20k rows works fine on modern machines; beyond ~50k rows consider splitting files.
- **Batching:** valid rows are sent to your `onImport` in chunks (default **50 rows per API call**). Change with `batchSize: 100`, or send everything in one call with `batchSize: Infinity`.

## All options

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `columns` | `ColumnDef[]` | — | Map sheet headers to your fields. Supports aliases: `header: ["Email", "E-mail"]` |
| `onImport` | `(rows, ctx) => Promise` | — | Your API call. Throw an error to stop the import |
| `validateRow` | `(row, ctx) => errors` | — | Cross-field rules, e.g. detect duplicates within the file |
| `batchSize` | `number` | `50` | Rows per `onImport` call |
| `maxRows` | `number` | `5000` | Reject files bigger than this |
| `sheet` | `number \| string` | first sheet | Which sheet to read |
| `acceptedExtensions` | `string[]` | `.xlsx .xls .csv` | Allowed file types |

### Per-column options

| Option | What it does |
| --- | --- |
| `header` | Header text in the sheet. Matching is case/space/underscore-insensitive |
| `key` | Field name in your output object |
| `required` | Adds an error when the cell is empty |
| `transform` | Convert the raw cell, e.g. `(v) => Number(v)` |
| `validate` | Return an error message string, or `null` when valid |

## What you get back

| Value | Meaning |
| --- | --- |
| `status` | `idle → parsing → ready → importing → done` (or `error`) |
| `rows` | Every parsed row: `{ rowNumber, data, errors, isValid }` |
| `validRows` / `invalidRows` | Pre-split for easy previews |
| `fileError` | File-level problems (wrong type, empty sheet, missing columns, too many rows) |
| `progress` | `{ imported, total, percent }` while importing |
| `parseFile(file)` | Call with a `File` from an input or drag-and-drop |
| `importRows()` | Sends all valid rows to your `onImport` |
| `reset()` | Start over |

## Features

- 🪶 **Tiny & headless** — no UI, no CSS, works with any design system
- 🔤 **Smart header matching** — `Email`, `email`, `E_MAIL` all match
- ✅ **3 validation layers** — required → per-column → cross-row
- 📦 **Batched imports** with live progress
- 🛡️ **Built-in file guards** — wrong extension, empty sheet, missing columns, row limit
- 🟦 **TypeScript-first** — `useBulkImport<User>()` gives you fully typed rows

## License

MIT