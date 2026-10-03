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
  /** EEOC / voluntary self-ID: never asked or answered — that choice is the candidate's. */
  const SELF_ID = /disabilit|veteran|race\b|racial|ethnic|hispanic|latino|latinx|gender|\bsex\b|sexual orientation|transgender|non.?binary|self.?identif/i;
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

  /**
   * The question above a radio group: a fieldset legend, an aria label, or — as on
   * Ashby/Nooks-style exam forms — the nearest preceding text block ("Will you now
   * or in the future require sponsorship …?"). Bounded walk: 3 ancestor levels.
   * Returns { text, box } — box is the element to outline when filled.
   */
  function questionFor(first) {
    const fs = first.closest("fieldset");
    if (fs) {
      const legend = fs.querySelector("legend");
      if (legend && legend.innerText.trim()) return { text: legend.innerText.trim().slice(0, 300), box: fs };
      if (fs.getAttribute("aria-label")) return { text: fs.getAttribute("aria-label"), box: fs };
    }
    if (first.getAttribute("aria-label")) return { text: first.getAttribute("aria-label"), box: first.parentElement || first };
    const byId = first.getAttribute("aria-labelledby");
    if (byId) {
      const t = byId
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.innerText || "")
        .join(" ")
        .trim()
        .replace(/\s+/g, " ");
      if (t) return { text: t.slice(0, 300), box: first.parentElement || first };
    }
    let node = first.parentElement;
    for (let depth = 0; node && depth < 3; depth++, node = node.parentElement) {
      let sib = node.previousElementSibling;
      while (sib) {
        const t = (sib.innerText || "").trim().replace(/\s+/g, " ");
        if (t && t.length >= 8 && t.length <= 300 && !sib.querySelector("input, select, textarea")) {
          return { text: t, box: node.parentElement || node };
        }
        sib = sib.previousElementSibling;
      }
    }
    return { text: "", box: first.parentElement || first };
  }

  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  /** Pick the radio whose value/text best answers `value` (token-safe, never a guess). */
  function pickOption(group, value) {
    const v = norm(value);
    if (!v) return null;
    for (const opt of group) {
      const text = norm(opt.closest("label")?.innerText || opt.parentElement?.innerText || "");
      const val = norm(opt.value);
      if ((val && val === v) || (text && text === v)) return opt;
    }
    for (const opt of group) {
      const text = norm(opt.closest("label")?.innerText || opt.parentElement?.innerText || "");
      const val = norm(opt.value);
      const hay = ` ${val || text} `;
      if (val && ` ${v} `.includes(hay)) return opt; // value is a superset of the option
      if (text && text.length >= 3 && ` ${v} `.includes(` ${text} `)) return opt;
    }
    return null;
  }

  /** One pass, one order: [element, field] pairs the API results can index into. */
  function describe() {
    const pairs = [];
    const excluded = []; // voluntary/EEOC questions we refuse to even send
    const seenGroups = new Set();
    for (const el of document.querySelectorAll("input, textarea, select")) {
      if (el.disabled || !VISIBLE(el)) continue;
      const type = (el.type || el.tagName.toLowerCase()).toLowerCase();
      if (["hidden", "submit", "button", "file", "image", "reset"].includes(type)) continue;
      if (NEVER_FILL.test(`${el.name} ${el.id} ${el.autocomplete || ""} ${type}`)) continue;

      // radio buttons: one pair per group, labelled by the *question*, not the option
      if (type === "radio") {
        const gkey = el.name ? `${el.form ? 1 : 0}:${el.name}` : `#${el.id || pairs.length}`;
        if (seenGroups.has(gkey)) continue;
        seenGroups.add(gkey);
        const group = el.name
          ? [...document.querySelectorAll('input[type="radio"]')].filter((r) => r.name === el.name && r.form === el.form)
          : [el];
        const q = questionFor(group[0]);
        if (!q.text) continue; // no question found — don't guess at bare radios
        if (SELF_ID.test(q.text)) {
          excluded.push(q.text); // EEOC: not ours to answer
          continue;
        }
        const field = {
          name: el.name || "",
          id: el.name ? "" : el.id || "",
          label: q.text,
          autocomplete: "",
          placeholder: "",
          type: "radio",
          section: el.form?.id || el.form?.name || "",
        };
        pairs.push({ el: group[0], field, group, box: q.box, signature: signatureOf(field) });
        continue;
      }
      const label = labelFor(el);
      if (SELF_ID.test(label)) {
        excluded.push(label); // checkbox/select EEOC inputs
        continue;
      }

      const field = {
        name: el.name || "",
        id: el.id || "",
        label,
        autocomplete: el.getAttribute("autocomplete") || "",
        placeholder: el.getAttribute("placeholder") || "",
        type,
        section: el.form?.id || el.form?.name || "",
      };
      pairs.push({ el, field, signature: signatureOf(field) });
    }
    return { pairs, excluded };
  }

  function setNativeValue(el, value) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /**
   * Choose a <select> option for a profile value: exact → token containment →
   * family (degree/country phrasings), so "B.S." can still find "Bachelor of
   * Science". Never picks when nothing confidently answers the value.
   */
  function pickSelectOption(sel, value) {
    const v = norm(value);
    if (!v) return null;
    const opts = [...sel.options].filter((o) => o.text.trim() || o.value);
    for (const o of opts) if (norm(o.value) === v || norm(o.text) === v) return o;
    const family = (s) => {
      if (/bachelor|\bb s c?\b|\bbs\b|\bba\b|btech|undergrad/.test(s)) return "f:bachelor";
      if (/master|\bms\b|\bmsc\b|mtech|mba/.test(s)) return "f:master";
      if (/phd|doctor/.test(s)) return "f:doctor";
      if (/united states|\bu s a\b|\bu s\b|america/.test(s)) return "f:us";
      return s;
    };
    const fv = family(v);
    for (const o of opts) {
      const t = norm(o.text);
      const hay = norm(o.value) || t;
      if (!hay) continue;
      if (` ${v} `.includes(` ${hay} `)) return o; // value is a superset of the option
      if (t && ` ${v} `.includes(` ${t} `)) return o;
      if (t && v.length >= 3 && ` ${t} `.includes(` ${v} `)) return o; // option is a superset
      if (fv !== v && family(hay) === fv) return o; // same family (degree, country)
    }
    return null;
  }

  function fillItems(items) {
    const { pairs } = describe();
    const out = [];
    let flagged = 0;
    const needsReview = [];

    for (const item of items) {
      const pair = pairs[item.field_index];
      if (!pair) continue;
      const { el } = pair;
      if (el.disabled || NEVER_FILL.test(`${el.name} ${el.id} ${el.type || ""}`)) continue; // guardrail, twice
      if (SELF_ID.test(pair.field.label || "")) continue; // belt + braces on EEOC

      if (pair.group) {
        const opt = pickOption(pair.group, item.value);
        if (!opt) continue; // no confident answer → leave the question untouched
        opt.checked = true;
        opt.dispatchEvent(new Event("input", { bubbles: true }));
        opt.dispatchEvent(new Event("change", { bubbles: true }));
        const box = pair.box || el.closest("fieldset") || el.parentElement;
        if (box) {
          box.style.outline = item.confidence >= 0.85 ? "2px solid #10b981" : "2px solid #f59e0b";
          box.style.outlineOffset = "1px";
          box.title = `Filled by JAMS · ${Math.round(item.confidence * 100)}% (${item.method}) — review before submitting`;
        }
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
          needsReview.push(`${item.key} → ${pair.field.label || pair.field.name || "radio group"}`);
        }
        continue;
      }

      if (el.tagName === "SELECT") {
        const match = pickSelectOption(el, item.value);
        if (!match) continue; // no option answers it → leave the select untouched
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
        .pairs.slice(0, 40)
        .map((p) => ({ name: p.field.name, label: p.field.label, type: p.field.type })),
    };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg.type !== "string" || !msg.type.startsWith("jams:")) return;
    try {
      if (msg.type === "jams:collect") {
        const d = describe();
        sendResponse({ fields: d.pairs.map((p) => p.field), excluded: d.excluded });
      } else if (msg.type === "jams:fill") sendResponse(fillItems(msg.items || []));
      else if (msg.type === "jams:pageMeta") sendResponse(pageMeta());
    } catch (e) {
      sendResponse({ error: String(e) });
    }
    return true;
  });
})();
