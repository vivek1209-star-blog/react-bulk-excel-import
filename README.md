# react-bulk-excel-import

**Add "Import from Excel" to your React app in one line.** 📄→✅

A ready-made import modal with drag & drop, validation preview (green/red rows), error messages, template download and progress bar — all built in. Zero setup, zero CSS files.

```
npm install react-bulk-excel-import
```

That's it. `xlsx` is bundled — nothing else to install.

## One-line usage

```tsx
import { ExcelImporter } from "react-bulk-excel-import";

<ExcelImporter
  open={open}
  onClose={() => setOpen(false)}
  columns={[
    { header: "Name", key: "name", required: true },
    { header: "Email", key: "email", required: true },
    { header: "Age", key: "age", transform: (v) => Number(v) },
  ]}
  onImport={async (rows) => {
    await fetch("/api/users/bulk", { method: "POST", body: JSON.stringify(rows) });
  }}
/>
```

Full working example:

```tsx
import { useState } from "react";
import { ExcelImporter } from "react-bulk-excel-import";

function App() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)}>Import Users</button>

      <ExcelImporter
        open={open}
        onClose={() => setOpen(false)}
        title="Import Users"
        columns={[
          { header: "Name", key: "name", required: true },
          {
            header: "Email",
            key: "email",
            required: true,
            validate: (v) => (String(v).includes("@") ? null : "Invalid email"),
          },
          { header: "Age", key: "age", transform: (v) => Number(v) },
        ]}
        onImport={async (rows) => {
          await fetch("/api/users/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(rows),
          });
        }}
        onComplete={(count) => alert(`${count} users imported!`)}
      />
    </>
  );
}
```

## What users see

1. **Drop zone** — drag & drop or click to browse (.xlsx / .xls / .csv)
2. **Download template** button — auto-generated from your columns
3. **Preview table** — every row checked, invalid rows highlighted red with the exact error
4. **Import button** — only valid rows are sent, in batches, with a live progress bar
5. **Done screen** 🎉

## Why this instead of writing it yourself?

Hand-rolling this feature means ~300 lines: SheetJS parsing, header matching (`Email` vs `email` vs `E-mail`), per-cell validation, error UI, batching, progress. With this library you write **only your columns and your API call**.

## How much data can it handle?

- Default limit: **5,000 rows** per file (change with `maxRows: 20000`)
- 10k–20k rows parse comfortably in modern browsers
- Rows are sent to your API in **batches of 50** by default (`batchSize` to change, `Infinity` for a single call)

## ExcelImporter props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `open` | `boolean` | — | Show/hide the modal |
| `onClose` | `() => void` | — | Close handler |
| `columns` | `ColumnDef[]` | — | Your column definitions (see below) |
| `onImport` | `(rows, ctx) => Promise` | — | Your API call. Throw to show an error |
| `title` | `string` | `"Import from Excel"` | Modal heading |
| `accentColor` | `string` | `#2563eb` | Buttons & progress bar color |
| `showTemplateDownload` | `boolean` | `true` | Show the template button |
| `onComplete` | `(count) => void` | — | Called after successful import |
| `validateRow` | `(row, ctx) => errors` | — | Cross-row rules (e.g. duplicates in file) |
| `batchSize` | `number` | `50` | Rows per `onImport` call |
| `maxRows` | `number` | `5000` | Max rows per file |
| `sheet` | `number \| string` | first sheet | Which sheet to read |

### Column options

| Option | Description |
| --- | --- |
| `header` | Header text in the sheet. Aliases supported: `["Email", "E-mail"]`. Case/space-insensitive |
| `key` | Field name in your output objects |
| `required` | Error when the cell is empty |
| `transform` | Convert the value: `(v) => Number(v)` |
| `validate` | Return an error string, or `null` if valid |

## Advanced: build your own UI (headless hook)

Want full control over the design? Use the same engine without the modal:

```tsx
import { useBulkImport } from "react-bulk-excel-import";

const { status, rows, validRows, invalidRows, fileError, progress, parseFile, importRows, reset } =
  useBulkImport({ columns, onImport });
```

You get parsed rows, valid/invalid splits, errors and progress — render them however you like. See the [types](./src/types.ts) for the full API.

## Features

- ⚡ **One-line modal** — drag & drop, preview, errors, progress, all included
- 📥 **Template download** — auto-generated from your column definitions
- 🔤 **Smart header matching** — `Email` / `email` / `E_MAIL` all work
- ✅ **3 validation layers** — required → per-column → cross-row
- 📦 **Batched imports** with live progress
- 🎨 **Headless hook** for custom UIs
- 🟦 **TypeScript-first**, ESM + CJS

## License

MIT
