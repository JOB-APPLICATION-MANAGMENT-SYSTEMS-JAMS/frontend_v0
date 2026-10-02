/**
 * JAMS Autofill — content script (injected on demand, idempotent).
 *
 * describe(): the form fields on this page (name/id/label/autocomplete/
 *            placeholder/type) in one stable order — the background sends that
 *            array to POST /autofill/match and results come back keyed by the
 *            same index (§35.2 confidence tiers).
 * fill():    write values in with the native setter + input/change events so
 *            React/Vue forms notice; outline green (≥0.85) or amber (≥0.55).
 * pageMeta(): title / company guess / text excerpt for POST /capture.
 *
 * Never submits, never touches password/credit_card/ssn/cvv (§35.2 guardrails).
 */
(() => {
  if (window.__jamsAutofill) return; // injected more than once per page
  window.__jamsAutofill = true;

  const NEVER_FILL = /password|passwd|pwd|credit_?card|card_?number|cvv|cvc|ssn|social_?security/i;
  const VISIBLE = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);

  const labelFor = (el) => {
    if (el.getAttribute("aria-label")) return el.getAttribute("aria-label");
    if (el.id) {
      const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lab && lab.innerText.trim()) return lab.innerText.trim();
    }
    const wrap = el.closest("label");
    if (wrap && wrap.innerText.trim()) return wrap.innerText.trim().slice(0, 80);
    return el.getAttribute("placeholder") || "";
  };

  /** Same signature the server learns in field_history, so confirm() lines up. */
  const signatureOf = (f) => `${f.name || ""}|${f.autocomplete || ""}|${(f.label || "").toLowerCase().slice(0, 40)}`;

  /** One pass, one order: [element, field] pairs the API results can index into. */
  function describe() {
    const pairs = [];
    for (const el of document.querySelectorAll("input, textarea, select")) {
      if (el.disabled || !VISIBLE(el)) continue;
      const type = (el.type || el.tagName.toLowerCase()).toLowerCase();
      if (["hidden", "submit", "button", "file", "image", "reset"].includes(type)) continue;
      if (NEVER_FILL.test(`${el.name} ${el.id} ${el.autocomplete || ""} ${type}`)) continue;
      const field = {
        name: el.name || "",
        id: el.id || "",
        label: labelFor(el),
        autocomplete: el.getAttribute("autocomplete") || "",
        placeholder: el.getAttribute("placeholder") || "",
        type,
        section: el.form?.id || el.form?.name || "",
      };
      pairs.push({ el, field, signature: signatureOf(field) });
    }
    return pairs;
  }

  function setNativeValue(el, value) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function fillItems(items) {
    const pairs = describe();
    const out = [];
    let flagged = 0;
    const needsReview = [];

    for (const item of items) {
      const pair = pairs[item.field_index];
      if (!pair) continue;
      const { el } = pair;
      if (el.disabled || NEVER_FILL.test(`${el.name} ${el.id} ${el.type || ""}`)) continue; // guardrail, twice

      if (el.tagName === "SELECT") {
        const match = [...el.options].find((o) => o.value === item.value || o.text.trim() === item.value.trim());
        if (!match) continue;
        el.value = match.value;
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        setNativeValue(el, item.value);
      }

      el.style.outline = item.confidence >= 0.85 ? "2px solid #10b981" : "2px solid #f59e0b";
      el.style.outlineOffset = "1px";
      el.title = `Filled by JAMS · ${Math.round(item.confidence * 100)}% (${item.method}) — review before submitting`;
      el.dataset.jams = item.key;

      out.push({
        index: item.field_index,
        key: item.key,
        confidence: item.confidence,
        method: item.method,
        signature: pair.signature,
      });
      if (item.confidence < 0.85) {
        flagged += 1;
        needsReview.push(`${item.key} → ${pair.field.label || pair.field.name || "field"}`);
      }
    }
    return { items: out, flagged, needsReview };
  }

  /** Best-effort page metadata for POST /capture — the server parses the rest. */
  function pageMeta() {
    const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((s) => {
        try {
          return JSON.parse(s.textContent);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .flatMap((o) => (Array.isArray(o) ? o : o["@graph"] ?? [o]))
      .find((o) => o && String(o["@type"] ?? "").includes("JobPosting"));

    const og = (name) => document.querySelector(`meta[property="${name}"]`)?.content || "";
    const siteName = og("og:site_name");
    const host = location.hostname.replace(/^www\./, "");
    const company =
      jsonLd?.hiringOrganization?.name ||
      jsonLd?.hiringOrganization?.legalName ||
      siteName ||
      host.split(".")[0].replace(/^\w/, (c) => c.toUpperCase());

    const text = (document.body?.innerText || "").replace(/\s+/g, " ").trim();
    const salary = text.match(/(₦|\$|€|£)\s?[\d,]+(\.\d+)?\s?[kKmM]?\s*(?:\/|\sper\s)?\s*(?:year|month|hour|annum|yr)?/)?.[0] || "";

    return {
      url: location.href,
      title: document.title,
      company_guess: company,
      text_excerpt: text.slice(0, 6000),
      salary_text: salary,
      posted_text: jsonLd?.datePosted || "",
      form_fields: describe()
        .slice(0, 40)
        .map((p) => ({ name: p.field.name, label: p.field.label, type: p.field.type })),
    };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg.type !== "string" || !msg.type.startsWith("jams:")) return;
    try {
      if (msg.type === "jams:collect") sendResponse({ fields: describe().map((p) => p.field) });
      else if (msg.type === "jams:fill") sendResponse(fillItems(msg.items || []));
      else if (msg.type === "jams:pageMeta") sendResponse(pageMeta());
    } catch (e) {
      sendResponse({ error: String(e) });
    }
    return true;
  });
})();
