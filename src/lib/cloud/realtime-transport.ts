/** Portable Cubics realtime contract. No provider's channel, socket or auth
 * object may escape into the canvas/domain model.
 *
 * Durable widgets, chat and permissions MUST use authenticated versioned APIs.
 * Realtime is a lossy notification plane, never an authority to change the DB.
 */
export type EphemeralRealtimeEvent =
  | { kind: "cursor"; x: number; y: number; color?: string }
  | { kind: "presence"; state: "active" | "away" };
export type CommittedRealtimeEvent = {
  kind: "workspace.commit";
  workspaceId: string;
  operationId: string;
  revision: number;
};
export interface CubicsRealtimeTransport {
  readonly provider: "supabase" | "socketio";
  connect(args: { workspaceId: string; token: string }): Promise<void>;
  publishEphemeral(event: EphemeralRealtimeEvent): Promise<void>;
  onEphemeral(callback: (event: EphemeralRealtimeEvent) => void): () => void;
  onCommitted(callback: (event: CommittedRealtimeEvent) => void): () => void;
  disconnect(): Promise<void>;
}
