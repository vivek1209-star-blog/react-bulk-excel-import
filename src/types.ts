/** A single parsed row keyed by your column names */
export type RawRow = Record<string, unknown>;

/** Validation error for one field of one row */
export interface RowError {
  /** Column/field name the error belongs to */
  field: string;
  /** Human readable message, e.g. "Email is invalid" */
  message: string;
}

/** A row after parsing + validation */
export interface ParsedRow<T = RawRow> {
  /** 1-based row number in the sheet (excluding header) */
  rowNumber: number;
  /** Raw values as read from the sheet */
  raw: RawRow;
  /** Transformed/typed data (only meaningful when valid) */
  data: T;
  /** Empty array means the row is valid */
  errors: RowError[];
  /** Convenience flag: errors.length === 0 */
  isValid: boolean;
}

/** Column definition: maps sheet headers to your data model */
export interface ColumnDef<T = RawRow> {
  /**
   * Header text(s) in the sheet that map to this column.
   * Multiple aliases supported, matching is case-insensitive and trims spaces.
   * e.g. ["Flat No", "Flat Number", "flat_no"]
   */
  header: string | string[];
  /** Key in the output object, e.g. "flatNumber" */
  key: keyof T & string;
  /** Mark the column as required (adds an error when empty) */
  required?: boolean;
  /** Transform the raw cell value into your desired type */
  transform?: (value: unknown, row: RawRow) => unknown;
  /**
   * Validate the (transformed) value.
   * Return a string to report an error, or null/undefined when valid.
   */
  validate?: (value: unknown, row: RawRow) => string | null | undefined | void;
}

export interface UseBulkImportOptions<T = RawRow> {
  /** Column mapping + per-column validation */
  columns: ColumnDef<T>[];
  /**
   * Row-level validation that runs after column validation,
   * e.g. cross-field rules or duplicate detection.
   * Return an array of errors (empty/undefined = valid).
   */
  validateRow?: (
    data: T,
    ctx: { rowNumber: number; allRows: T[] }
  ) => RowError[] | undefined | void;
  /**
   * Called in batches during import. Throw (or reject) to mark the batch failed.
   * You decide what "import" means: API call, Redux dispatch, anything.
   */
  onImport: (validRows: T[], ctx: ImportContext) => Promise<void>;
  /** How many rows per onImport call (default: 50, use Infinity for single call) */
  batchSize?: number;
  /** Sheet to read; index or name (default: first sheet) */
  sheet?: number | string;
  /** Max rows allowed per file (default: 5000) */
  maxRows?: number;
  /** Accepted file extensions (default: .xlsx, .xls, .csv) */
  acceptedExtensions?: string[];
}

export interface ImportContext {
  batchIndex: number;
  totalBatches: number;
}

export type ImportStatus =
  | "idle"
  | "parsing"
  | "ready"
  | "importing"
  | "done"
  | "error";

export interface ImportProgress {
  /** Rows successfully imported so far */
  imported: number;
  /** Total valid rows queued for import */
  total: number;
  /** 0–100 */
  percent: number;
}

export interface UseBulkImportReturn<T = RawRow> {
  status: ImportStatus;
  /** All parsed rows (valid + invalid) for preview tables */
  rows: ParsedRow<T>[];
  validRows: ParsedRow<T>[];
  invalidRows: ParsedRow<T>[];
  /** File-level error (wrong extension, empty sheet, too many rows, parse failure) */
  fileError: string | null;
  progress: ImportProgress;
  /** Parse a File (from <input type="file"> or drag-drop) */
  parseFile: (file: File) => Promise<void>;
  /** Import all valid rows via your onImport callback */
  importRows: () => Promise<void>;
  /** Reset everything back to idle */
  reset: () => void;
}
