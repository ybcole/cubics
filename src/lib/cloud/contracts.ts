/** Cubics Cloud API v1 — target wire contracts (M02).
 * These shapes are additive foundation work; legacy Next routes remain active
 * until the hosted service is deployed, authorized and tested end-to-end.
 */
export const CUBICS_API_VERSION = 1 as const;

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";
export type WidgetMode = "personal" | "live" | "shared";
export interface WorkspaceSummary {
  id: string;
  name: string;
  ownerId: string;
  role: WorkspaceRole;
  revision: number | null; // null until server operations have durable revisions
}
export interface WidgetGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}
export interface WidgetSummary {
  id: string;
  workspaceId: string;
  kind: WidgetMode;
  title: string;
  geometry: WidgetGeometry;
  version: number | null; // null for unversioned legacy widgets
  // Sensitive personal browser URLs never travel implicitly in this DTO.
  safeUrl?: string;
}
export interface OperationEnvelope<T> {
  protocolVersion: typeof CUBICS_API_VERSION;
  operationId: string;
  workspaceId: string;
  baseRevision: number;
  payload: T;
}
export interface ApiPage<T> {
  items: T[];
  cursor: string | null;
}
export interface ApiFailure {
  error: {
    code: "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" |
      "INVALID_REQUEST" | "RATE_LIMITED" | "UNAVAILABLE";
    message: string;
    requestId?: string;
  };
}
export type WorkspaceOperation =
  | { type: "widget.create"; widget: WidgetSummary }
  | { type: "widget.geometry"; widgetId: string; geometry: WidgetGeometry }
  | { type: "widget.delete"; widgetId: string }
  | { type: "workspace.rename"; name: string };

/** Sharing and read-only compatibility sync v1. Durable revisions and
 * idempotent operation replay will be introduced under M13–M15. */
export interface WorkspaceMemberSummary {
  userId: string;
  displayName: string;
  avatar: string | null;
  role: WorkspaceRole;
  joinedAt: string;
}
export interface WorkspaceSnapshot {
  workspaceId: string;
  revision: number | null;
  synchronization: "legacy-unversioned" | "revisioned";
  operations: WorkspaceOperation[];
  widgets: WidgetSummary[];
}
