"use strict";
/** Supabase private Broadcast adapter (no client-side database authority).
 * Accepts a supabase-js compatible instance via dependency injection, so the
 * legacy Socket.IO client does not need to change before staging parity.
 * Supabase's Clerk JWT integration and realtime.messages RLS are mandatory.
 */
const TOPIC = /^c[a-z0-9]{10,63}$/; // workspace IDs are generated cuid strings
function topicFor(workspaceId) {
  if (typeof workspaceId !== "string" || !TOPIC.test(workspaceId)) {
    throw new Error("Invalid workspace ID");
  }
  return "cubics:room:" + workspaceId;
}
function checkedEphemeral(value) {
  if (!value || typeof value !== "object") throw Error("Invalid ephemeral event");
  if (value.kind === "cursor") {
    const { x, y } = value;
    if (!Number.isFinite(x) || !Number.isFinite(y) ||
      Math.abs(x) > 1e7 || Math.abs(y) > 1e7) throw Error("Invalid coordinates");
    return { kind: "cursor", x, y,
      ...(typeof value.color === "string" && /^#[0-9a-f]{6}$/i.test(value.color)
        ? { color: value.color } : {}) };
  }
  if (value.kind === "presence" && ["active", "away"].includes(value.state)) {
    return { kind: "presence", state: value.state };
  }
  throw Error("Only non-authoritative cursor/presence are broadcastable");
}
function createSupabaseRealtimeTransport(client) {
  if (!client || typeof client.channel !== "function" ||
    typeof client.removeChannel !== "function" ||
    typeof client.realtime?.setAuth !== "function") {
    throw new TypeError("A compatible authenticated Supabase client is required");
  }
  let channel = null;
  let currentRoom = null;
  const ephemeralHandlers = new Set();
  const committedHandlers = new Set();
  return {
    provider: "supabase",
    async connect({ workspaceId, token }) {
      const name = topicFor(workspaceId);
      if (typeof token !== "string" || token.length < 12) throw Error("Missing Clerk JWT");
      if (channel) await this.disconnect();
      await client.realtime.setAuth(token);
      const subscription = client.channel(name, {
        config: { private: true, broadcast: { self: false, ack: true } },
      });
      if (!subscription || typeof subscription.on !== "function" ||
        typeof subscription.subscribe !== "function" ||
        typeof subscription.send !== "function") throw Error("Supabase channel unavailable");
      channel = subscription;
      currentRoom = workspaceId;
      subscription.on("broadcast", { event: "ephemeral" }, message => {
        try {
          const event = checkedEphemeral(message?.payload);
          for (const callback of ephemeralHandlers) callback(event);
        } catch { /* Reject malformed or privileged payloads. */ }
      });
      // This event is a hint to fetch canonical commit from the HTTPS API.
      // It is NOT treated as an authenticated write or proof of DB commit.
      subscription.on("broadcast", { event: "commit_hint" }, message => {
        const p = message?.payload;
        if (!p || p.workspaceId !== currentRoom ||
          typeof p.operationId !== "string" || p.operationId.length > 128 ||
          !Number.isSafeInteger(p.revision) || p.revision < 0) return;
        for (const callback of committedHandlers) callback({
          kind: "workspace.commit", workspaceId: currentRoom,
          operationId: p.operationId, revision: p.revision,
        });
      });
      try {
        await new Promise((resolve, reject) => {
          subscription.subscribe((status, error) => {
            if (status === "SUBSCRIBED") resolve();
            else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" ||
              status === "CLOSED") reject(error || Error("Private room subscription denied"));
          });
        });
      } catch (error) {
        await this.disconnect();
        throw error;
      }
    },
    async publishEphemeral(event) {
      if (!channel) throw Error("Not connected to authorized private room");
      const payload = checkedEphemeral(event);
      const result = await channel.send({ type: "broadcast", event: "ephemeral", payload });
      if (result !== "ok") throw Error("Realtime Broadcast rejected");
    },
    onEphemeral(callback) {
      if (typeof callback !== "function") throw TypeError("Listener required");
      ephemeralHandlers.add(callback);
      return () => ephemeralHandlers.delete(callback);
    },
    onCommitted(callback) {
      if (typeof callback !== "function") throw TypeError("Listener required");
      committedHandlers.add(callback);
      return () => committedHandlers.delete(callback);
    },
    async disconnect() {
      const previous = channel;
      channel = null;
      currentRoom = null;
      if (previous) await client.removeChannel(previous);
    },
  };
}
module.exports = { createSupabaseRealtimeTransport, topicFor, checkedEphemeral };
