/**
 * Error normalisation (§12.2), every backend failure dialect collapses into one
 * APIRequestError(message, status, data) with a machine-readable `code`.
 */

export type ErrorShape = {
  code: string;
  detail: string | null;
  retry_after: number | null;
  fields: any;
  fieldErrors?: Record<string, string>;
};

export class APIRequestError extends Error {
  status: number;
  data: any;
  code: string;
  detail: string | null;
  retryAfter: number | null;
  fields: any;
  fieldErrors: Record<string, string>;

  constructor(message: string, status: number, data?: any, shape?: Partial<ErrorShape>) {
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
function flattenValidation(detail: any): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(detail)) {
    for (const issue of detail) {
      const field = Array.isArray(issue?.loc) ? String(issue.loc[issue.loc.length - 1]) : "_";
      out[field] = issue?.msg ?? "invalid value";
    }
  }
  return out;
}

export function parseError(status: number, data: any): ErrorShape {
  // JAMS envelope failure: { status:"failure", error: { code, detail, retry_after, fields } }
  if (data && typeof data === "object" && data.status === "failure" && data.error) {
    return {
      code: data.error.code ?? "ERROR",
      detail: data.error.detail ?? null,
      retry_after: data.error.retry_after ?? null,
      fields: data.error.fields ?? null,
      fieldErrors: flattenValidation(data.error.fields),
      // surface the human message
    };
  }
  // FastAPI validation (shape A)
  if (data && Array.isArray((data as any).detail)) {
    return { code: "VALIDATION_ERROR", detail: null, retry_after: null, fields: data.detail, fieldErrors: flattenValidation(data.detail) };
  }
  // FastAPI simple (shape B) / nested (shape C)
  const detail = typeof data?.detail === "string" ? data.detail : data?.detail?.message ?? data?.message ?? null;
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

export function throwApiError(status: number, data: any, fallback = "API request failed"): never {
  const shape = parseError(status, data);
  const message =
    (typeof data === "object" && data?.message) ||
    (Array.isArray(data?.detail) ? data.detail.map((d: any) => d.msg).join("; ") : null) ||
    shape.detail ||
    (typeof data === "string" && data.length < 300 ? data : null) ||
    fallback;
  throw new APIRequestError(message, status, data, shape);
}

/** One toast policy for mutations (§9.2). */
export function handleMutationError(err: unknown, fallback = "Something went wrong"): string {
  if (err instanceof APIRequestError) {
    if (err.isRateLimited && err.retryAfter) return `Rate limited, retry in ${err.retryAfter}s`;
    if (err.code === "QUOTA_EXCEEDED") return err.message;
    if (err.code === "INVALID_TRANSITION") return err.detail ?? err.message;
    return err.message || fallback;
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}
