/**
 * JAMS Autofill — background service worker (MV3).
 *
 * Owns the network: the API token never reaches the page. Content scripts ask
 * this worker to call /autofill/schema, /autofill/match, /autofill/confirm and
 * /capture; background fetches are CORS-free thanks to host_permissions.
 *
 * Guardrails (§35.2): password / credit_card / ssn / cvv fields are never
 * filled, and nothing here ever submits a form — the human presses Send.
 */

const PROD_API = "https://backend-v0-3aeu-omega.vercel.app/api/v1";
const LOCAL_API = "http://localhost:8000/api/v1";

async function settings() {
  const s = await chrome.storage.local.get(["apiBase", "token", "email"]);
  return { apiBase: s.apiBase || PROD_API, token: s.token || "", email: s.email || "" };
}

async function api(path, { method = "GET", body } = {}) {
  const { apiBase, token } = await settings();
  const res = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const detail = data?.error?.detail || data?.message || `Request failed (${res.status})`;
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  return data?.data ?? data;
}

/* ------------------------------- content helpers ------------------------------- */

async function withContent(tabId, message) {
  // inject on demand: activeTab is granted by opening the popup, no <all_urls>
  await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  return chrome.tabs.sendMessage(tabId, message);
}

function tabUrl(tab) {
  return tab?.url || "";
}

/* --------------------------------- message API --------------------------------- */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handle(msg)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));
  return true; // async sendResponse
});

async function handle(msg) {
  switch (msg?.type) {
    case "jams:status": {
      const s = await settings();
      return { signedIn: !!s.token, email: s.email, apiBase: s.apiBase };
    }

    case "jams:login": {
      const { apiBase } = await settings();
      const res = await api("/auth/login", {
        method: "POST",
        body: { email: msg.email, password: msg.password },
      });
      const token = res?.access_token ?? res?.token;
      if (!token) throw new Error("Login failed: no token returned");
      await chrome.storage.local.set({ token, email: msg.email, apiBase });
      return { email: msg.email };
    }

    case "jams:logout":
      await chrome.storage.local.remove(["token", "email"]);
      return {};

    case "jams:setApiBase":
      await chrome.storage.local.set({ apiBase: msg.apiBase });
      return { apiBase: msg.apiBase };

    case "jams:fill": {
      const tab = await chrome.tabs.get(msg.tabId);
      const host = new URL(tabUrl(tab)).host;
      const page = await withContent(msg.tabId, { type: "jams:collect" });
      const { mappings, skipped } = await api("/autofill/match", {
        method: "POST",
        body: { host, fields: page.fields },
      });
      if (!mappings?.length) {
        return { filled: 0, flagged: 0, skipped: skipped?.length ?? 0, reason: page.fields.length ? undefined : "No form fields found on this page" };
      }
      const filled = await withContent(msg.tabId, { type: "jams:fill", items: mappings });
      // learn high-confidence fills so the next visit to this host is smarter (§35.2)
      const learns = (filled.items || [])
        .filter((f) => f.confidence >= 0.85 && f.signature && f.key)
        .slice(0, 20)
        .map((f) =>
          api("/autofill/confirm", {
            method: "POST",
            body: { host, field_signature: f.signature, profile_key: f.key },
          }).catch(() => null)
        );
      await Promise.all(learns);
      return {
        filled: filled.items?.length ?? 0,
        flagged: filled.flagged ?? 0,
        skipped: skipped?.length ?? 0,
        needsReview: filled.needsReview ?? [],
      };
    }

    case "jams:capture": {
      const tab = await chrome.tabs.get(msg.tabId);
      const meta = await withContent(msg.tabId, { type: "jams:pageMeta" });
      const saved = await api("/capture", {
        method: "POST",
        body: {
          source: "extension",
          url: meta.url || tabUrl(tab),
          action: msg.action || "create_draft",
          kind: msg.kind || "application",
          page: {
            title: meta.title,
            company_guess: meta.company_guess,
            text_excerpt: meta.text_excerpt,
            salary_text: meta.salary_text,
            posted_text: meta.posted_text,
            form_fields: meta.form_fields,
          },
        },
      });
      return saved;
    }

    default:
      throw new Error(`Unknown message: ${msg?.type}`);
  }
}
