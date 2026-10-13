/**
 * View-state reporting: keyed sandbox state → `POST …/dil/view_state`.
 *
 * Rapid changes (typing, dragging a slider) collapse into one request carrying the
 * latest full state. The server dedupes by `client_update_id` and counts only real
 * changes; the next turn replays the snapshot to the model.
 */

export function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** One id per page load, like the captured `client_session_id`. */
export const CLIENT_SESSION_ID = uuid();

/**
 * @param {object} o
 * @param {() => ({conversationId, messageId} | null)} o.target  null until ids are known
 * @param {number} [o.delayMs]
 * @param {(body, response) => void} [o.onReport]
 * @param {(error) => void} [o.onError]
 */
export function createStateReporter({ target, delayMs = 600, onReport, onError }) {
  let pending = null;
  let cancelled = false;
  let timer = null;
  let inFlight = false;

  async function flush() {
    clearTimeout(timer); timer = null;
    if (inFlight || cancelled) return null;
    const ids = target();
    if (!pending || !ids) return null; // retried by the caller once ids are known
    const { scope, state, reason } = pending;
    inFlight = true;
    pending = null;
    const body = { call_id: (globalThis.__GENUI_CALL_ID__ || null), conversation_id: ids.conversationId, message_id: ids.messageId, client_session_id: CLIENT_SESSION_ID, updates: [{ scope, state, reason, client_update_id: uuid() }] };
    const url = '/genui/view_state';
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { const e = new Error(json.error || `state report ${res.status}`); e.status = res.status; throw e; }
      onReport?.(body, json);
      return json;
    } catch (err) {
      if (!cancelled && !pending && (!err.status || err.status === 409 || err.status >= 500)) { pending = { scope, state, reason }; timer = setTimeout(flush, 1000); }
      if (err.status !== 409) onError?.(err);
      return null;
    } finally {
      inFlight = false;
      if (!cancelled && pending && !timer) timer = setTimeout(flush, delayMs);
    }
  }

  return {
    queue(state, scope = 'root', reason = 'event') {
      pending = { scope, state, reason };
      if (!timer) timer = setTimeout(flush, delayMs);
    },
    flush,
    get hasPending() {
      return !!pending;
    },
    cancel() {
      cancelled = true;
      clearTimeout(timer);
      timer = null;
      pending = null;
    },
  };
}
