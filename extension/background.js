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
  const s = await chrome.storage.local.get(["apiBase", "token", "refreshToken", "email"]);
  return { apiBase: s.apiBase || PROD_API, token: s.token || "", refreshToken: s.refreshToken || "", email: s.email || "" };
}

/* Access tokens live 15 minutes; the 30-day refresh token keeps the session
 * alive silently so the popup never dies mid-fill with "session expired". */
let refreshing = null;
async function refreshSession() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const { apiBase, refreshToken } = await settings();
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${apiBase}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      const token = data?.data?.access_token ?? data?.access_token;
      const next = data?.data?.refresh_token ?? data?.refresh_token;
      if (!token) return false;
      await chrome.storage.local.set({ token, ...(next ? { refreshToken: next } : {}) });
      return true;
    } catch {
      return false; // network down — surface the original 401 instead
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function api(path, { method = "GET", body, _retried } = {}) {
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
  if (res.status === 401 && !_retried && !path.startsWith("/auth/")) {
    const { refreshToken } = await settings();
    if (refreshToken && (await refreshSession())) return api(path, { method, body, _retried: true });
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
      await chrome.storage.local.set({ token, refreshToken: res?.refresh_token || "", email: msg.email, apiBase });
      return { email: msg.email };
    }

    case "jams:profile": {
      const prof = await api("/profile");
      const id = prof?.identity || {};
      const links = id.links || {};
      const filled = [id.name || id.full_name, id.email, id.phone, id.location, id.headline, id.work_authorization, id.sponsorship, id.relocation, id.middle_name, id.graduation_year, id.heard_about, links.linkedin, links.github, links.website].filter(
        (v) => v && String(v).trim()
      ).length;
      return {
        name: id.name || id.full_name || [id.first_name, id.last_name].filter(Boolean).join(" ") || "",
        email: id.email || "",
        saved: filled + (prof?.education?.filter((e) => e.school).length || 0) + (prof?.skills?.length || 0),
        education: prof?.education?.length || 0,
        skills: prof?.skills?.length || 0,
      };
    }

    case "jams:logout":
      await chrome.storage.local.remove(["token", "refreshToken", "email"]);
      return {};

    case "jams:setApiBase":
      await chrome.storage.local.set({ apiBase: msg.apiBase });
      return { apiBase: msg.apiBase };

    case "jams:fill": {
      const tab = await chrome.tabs.get(msg.tabId);
      const host = new URL(tabUrl(tab)).host;
      const page = await withContent(msg.tabId, { type: "jams:collect" });
      const { mappings, skipped, skip_reasons } = await api("/autofill/match", {
        method: "POST",
        body: { host, fields: page.fields },
      });
      // per-field detail so the popup can show *what* was filled and *why* not
      const skippedFields = (skipped || []).map((s, i) => ({ field: s, reason: skip_reasons?.[i]?.reason || "" }));
      const details = (mappings || []).map((m) => {
        const f = page.fields[m.field_index] || {};
        return { index: m.field_index, key: m.key, label: f.label || f.name || `Field ${m.field_index + 1}`, value: String(m.value ?? "").slice(0, 80), confidence: m.confidence, method: m.method };
      });
      if (!mappings?.length) {
        return {
          filled: 0,
          flagged: 0,
          skipped: skippedFields.length,
          skippedFields,
          excluded: page.excluded || [],
          details: [],
          reason: page.fields.length ? undefined : "No form fields found on this page",
        };
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
      // the content script can still decline (e.g. no select option answers the
      // value) — those move from details to skippedFields so the counts stay honest
      const filledIdx = new Set((filled.items || []).map((it) => it.index));
      const shown = details.filter((d) => filledIdx.has(d.index));
      const declined = details
        .filter((d) => !filledIdx.has(d.index))
        .map((d) => ({ field: d.label, reason: "no option in that field answered your value — pick one yourself" }));
      const allSkipped = [...skippedFields, ...declined];
      return {
        filled: filled.items?.length ?? 0,
        flagged: filled.flagged ?? 0,
        skipped: allSkipped.length,
        needsReview: filled.needsReview ?? [],
        details: shown,
        skippedFields: allSkipped,
        excluded: page.excluded || [],
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
