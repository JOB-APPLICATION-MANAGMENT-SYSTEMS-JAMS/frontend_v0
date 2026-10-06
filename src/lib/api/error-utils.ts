/**
 * Error normalisation (§12.2), every backend failure dialect collapses into one
 * APIRequestError(message, status, data) with a machine-readable `code`.
 * Bodies arrive as `unknown` JSON — nothing is trusted until narrowed.
 */

export type ErrorShape = {
  code: string;
  detail: string | null;
  retry_after: number | null;
  fields: unknown;
  fieldErrors?: Record<string, string>;
};

/** Narrow anything from the network to a readable object (JSON bodies only). */
function asObject(data: unknown): Record<string, unknown> | null {
  return data !== null && typeof data === "object" ? (data as Record<string, unknown>) : null;
}

const asString = (v: unknown): string | null => (typeof v === "string" ? v : null);
const asNumber = (v: unknown): number | null => (typeof v === "number" ? v : null);

export class APIRequestError extends Error {
  status: number;
  data: unknown;
  code: string;
  detail: string | null;
  retryAfter: number | null;
  fields: unknown;
  fieldErrors: Record<string, string>;

  constructor(message: string, status: number, data?: unknown, shape?: Partial<ErrorShape>) {
    super(message);
    this.name = "APIRequestError";
    this.status = status;
    this.data = data;
    this.code = shape?.code ?? "ERROR";
    this.detail = shape?.detail ?? null;
    this.retryAfter = shape?.retry_after ?? null;
    this.fields = shape?.fields ?? null;
    this.fieldErrors = shape?.fieldErrors ?? {};
  }

  get isAuth() {
    return this.status === 401 || this.code === "UNAUTHENTICATED" || this.code === "TOKEN_EXPIRED";
  }
  get isVerification() {
    return this.code === "REQUIRES_VERIFICATION";
  }
  get isRateLimited() {
    return this.status === 429 || this.code === "RATE_LIMITED";
  }
}

/** Flatten FastAPI validation arrays: [{loc,msg}] → { email: "value is not a valid email" } */
function flattenValidation(detail: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(detail)) {
    for (const issue of detail) {
      const d = asObject(issue);
      const loc = d?.loc;
      const field = Array.isArray(loc) && loc.length ? String(loc[loc.length - 1]) : "_";
      out[field] = asString(d?.msg) ?? "invalid value";
    }
  }
  return out;
}

export function parseError(status: number, data: unknown): ErrorShape {
  const body = asObject(data);
  // JAMS envelope failure: { status:"failure", error: { code, detail, retry_after, fields } }
  if (body && body.status === "failure" && body.error) {
    const err = asObject(body.error) ?? {};
    return {
      code: asString(err.code) ?? "ERROR",
      detail: asString(err.detail),
      retry_after: asNumber(err.retry_after),
      fields: err.fields ?? null,
      fieldErrors: flattenValidation(err.fields),
      // surface the human message
    };
  }
  // FastAPI validation (shape A)
  if (body && Array.isArray(body.detail)) {
    return { code: "VALIDATION_ERROR", detail: null, retry_after: null, fields: body.detail, fieldErrors: flattenValidation(body.detail) };
  }
  // FastAPI simple (shape B) / nested (shape C)
  const nested = asObject(body?.detail);
  const detail = asString(body?.detail) ?? asString(nested?.message) ?? asString(body?.message) ?? null;
  const codeByStatus: Record<number, string> = {
    400: "VALIDATION_ERROR",
    401: "UNAUTHENTICATED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "ALREADY_EXISTS",
    422: "VALIDATION_ERROR",
    429: "RATE_LIMITED",
    502: "SOURCE_DOWN",
  };
  return { code: codeByStatus[status] ?? "ERROR", detail, retry_after: null, fields: null, fieldErrors: {} };
}

export function throwApiError(status: number, data: unknown, fallback = "API request failed"): never {
  const shape = parseError(status, data);
  const body = asObject(data);
  const joinedDetail = Array.isArray(body?.detail)
    ? body.detail
        .map((d) => asString(asObject(d)?.msg) ?? "")
        .filter(Boolean)
        .join("; ")
    : "";
  const message =
    asString(body?.message) ||
    joinedDetail ||
    shape.detail ||
    (typeof data === "string" && data.length < 300 ? data : null) ||
    fallback;
  throw new APIRequestError(message, status, data, shape);
}

/** One toast policy for mutations (§9.2). Used centrally by the MutationCache. */
export function handleMutationError(err: unknown, fallback = "Something went wrong"): string {
  if (err instanceof APIRequestError) {
    if (err.isRateLimited && err.retryAfter) return `Rate limited, retry in ${err.retryAfter}s`;
    if (err.code === "QUOTA_EXCEEDED") return err.message;
    // detail carries the actionable guidance when the backend supplies one
    // ("…paste the app password from myaccount.google.com/…"); message is the short headline
    return err.detail || err.message || fallback;
  }
  // fetch() failures surface as TypeError — say what to do, never "Something went wrong"
  if (err instanceof TypeError) return "Network error — check your connection and try again";
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}
