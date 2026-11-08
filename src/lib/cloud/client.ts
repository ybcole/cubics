import { CUBICS_API_VERSION } from "./contracts";
import type { ApiPage, OperationEnvelope, WidgetSummary, WorkspaceOperation, WorkspaceSummary } from "./contracts";

export class CubicsCloudError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CubicsCloudError";
  }
}

export type TokenProvider = () => Promise<string | null>;
export interface CloudClientOptions {
  apiOrigin: string;
  getSessionToken: TokenProvider;
  fetchImpl?: typeof fetch;
}

/** Only an explicit, trusted HTTPS API origin is valid in production.
 * Localhost HTTP is allowed for development and local staging only.
 * Credentials must be supplied at request time, never encoded into URLs.
 */
export function validateCloudApiOrigin(origin: string): string {
  const parsed = new URL(origin);
  const localhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  const localHttp = parsed.protocol === "http:" && localhost && process.env.NODE_ENV !== "production";
  if (parsed.protocol !== "https:" && !localHttp) {
    throw new Error("Cubics Cloud API requires HTTPS (localhost development excepted)");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash ||
    (parsed.pathname !== "/" && parsed.pathname !== "")) {
    throw new Error("Cubics Cloud API origin must not contain credentials, paths or queries");
  }
  return parsed.origin;
}

export function createCubicsCloudClient({ apiOrigin, getSessionToken, fetchImpl = fetch }: CloudClientOptions) {
  const origin = validateCloudApiOrigin(apiOrigin);
  async function request<T>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, payload?: unknown, signal?: AbortSignal): Promise<T> {
    // Callers may only select paths under the versioned API namespace.
    if (!path.startsWith("/v1/") || path.includes("..") || /[?#]/.test(path)) {
      throw new Error("Invalid Cubics API path");
    }
    const token = await getSessionToken();
    if (!token) throw new CubicsCloudError(401, "UNAUTHORIZED", "Please sign in to continue");
    const result = await fetchImpl(new URL(path, origin), {
      method, signal, credentials: "omit", redirect: "error",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-Cubics-Protocol-Version": String(CUBICS_API_VERSION),
        ...(payload === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    });
    if (!result.ok) {
      const response = await result.json().catch(() => null) as
        { error?: { code?: string; message?: string } } | null;
      throw new CubicsCloudError(
        result.status,
        typeof response?.error?.code === "string" ? response.error.code : "REQUEST_FAILED",
        typeof response?.error?.message === "string" ? response.error.message : "Cloud request failed",
      );
    }
    return result.json() as Promise<T>;
  }
  return {
    listWorkspaces: (signal?: AbortSignal) => request<ApiPage<WorkspaceSummary>>("GET", "/v1/workspaces", undefined, signal),
    getWorkspace: (id: string, signal?: AbortSignal) =>
      request<WorkspaceSummary>("GET", `/v1/workspaces/${encodeURIComponent(id)}`, undefined, signal),
    listWidgets: (id: string, signal?: AbortSignal) =>
      request<ApiPage<WidgetSummary>>("GET", `/v1/workspaces/${encodeURIComponent(id)}/widgets`, undefined, signal),
    submitOperation: (id: string, operation: OperationEnvelope<WorkspaceOperation>, signal?: AbortSignal) =>
      request<{ revision: number; operationId: string }>(
        "POST", `/v1/workspaces/${encodeURIComponent(id)}/operations`, operation, signal,
      ),
  };
}
