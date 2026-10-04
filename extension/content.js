/**
 * JAMS Autofill — content script (injected on demand, idempotent).
 *
 * describe(): the form fields on this page (name/id/label/autocomplete/
 *            placeholder/type) in one stable order — the background sends that
 *            array to POST /autofill/match and results come back keyed by the
 *            same index (§35.2 confidence tiers). Covers native inputs AND
 *            widget controls the site draws itself (aria-pressed buttons,
 *            role=radio/checkbox/switch), which is how Ashby/Nooks-style
 *            application forms build their Yes/No questions.
 * fill():    write values in with the native setter + input/change events so
 *            React/Vue forms notice; widget controls are clicked (never
 *            submitting — a temporary submit-blocker guards type=submit
 *            buttons); outline green (≥0.85) or amber (≥0.55).
 * pageMeta(): title / company guess / text excerpt for POST /capture.
 *
 * Never submits, never touches password/credit_card/ssn/cvv (§35.2 guardrails).
 */
(() => {
  if (window.__jamsAutofill) return; // injected more than once per page
  window.__jamsAutofill = true;

  const NEVER_FILL = /password|passwd|pwd|credit_?card|card_?number|cvv|cvc|ssn|social_?security/i;
  /**
   * EEOC / voluntary self-ID we refuse to even send (§35.2). Gender/sex is
   * deliberately NOT here: the server fills it only from an answer the
   * candidate explicitly saved in their profile — their choice, never a guess —
   * and skips it with a visible reason when they saved none.
   */
  const SELF_ID = /disabilit|veteran|race\b|racial|ethnic|hispanic|latino|latinx|sexual orientation|transgender|non.?binary|self.?identif/i;
  const VISIBLE = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);

  const labelFor = (el) => {
    if (el.getAttribute("aria-label")) return el.getAttribute("aria-label");
    if (el.id) {
      const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lab && lab.innerText.trim()) return lab.innerText.trim();
    }
    const wrap = el.closest("label");
    if (wrap && wrap.innerText.trim()) return wrap.innerText.trim().slice(0, 80);
    // a label sitting NEXT to the control — Ashby renders <label for="…"> beside
    // the input, sometimes with a dangling id — beats a placeholder like
    // "Start typing…" for matching. Walk: own siblings first, then ancestors'.
    // Only text-only siblings qualify, so a previous field's block never leaks in.
    let node = el;
    for (let depth = 0; node && depth < 3; depth++, node = node.parentElement) {
      let sib = node.previousElementSibling;
      while (sib) {
        const t = (sib.innerText || "").trim().replace(/\s+/g, " ");
        if (t && t.length <= 100 && !sib.querySelector("input, select, textarea, button")) return t;
        sib = sib.previousElementSibling;
      }
    }
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
        // never read another option's wrapper as the question: skip siblings
        // that contain any control (inputs AND widget buttons/roles)
        if (t && t.length >= 8 && t.length <= 300 && !sib.querySelector("input, select, textarea, button, [role=radio], [role=checkbox], [role=switch]")) {
          return { text: t, box: node.parentElement || node };
        }
        sib = sib.previousElementSibling;
      }
    }
    return { text: "", box: first.parentElement || first };
  }

  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  /**
   * Caption of one option. Native inputs often sit in a bare <span> while the
   * text lives on the wrapping div (Ashby: fieldset > div._option > span > input),
   * so climb up to 4 ancestors — but stop before entering a box that holds the
   * *other* options, whose text would be the whole question, not this choice.
   */
  function optionText(opt, group) {
    const others = (group || []).filter((g) => g !== opt);
    let n = opt;
    for (let i = 0; n && i < 4; i++, n = n.parentElement) {
      if (others.some((o) => n.contains(o))) break;
      const t = (n.innerText || "").trim().replace(/\s+/g, " ");
      if (t) return t;
    }
    return "";
  }

  /** Pick the radio whose value/text best answers `value` (token-safe, never a guess). */
  function pickOption(group, value) {
    const v = norm(value);
    if (!v) return null;
    for (const opt of group) {
      const text = norm(optionText(opt, group));
      const val = norm(opt.value);
      if ((val && val === v) || (text && text === v)) return opt;
    }
    for (const opt of group) {
      const text = norm(optionText(opt, group));
      const val = norm(opt.value);
      const hay = ` ${val || text} `;
      if (val && ` ${v} `.includes(hay)) return opt; // value is a superset of the option
      if (text && text.length >= 3 && ` ${v} `.includes(` ${text} `)) return opt;
    }
    return null;
  }

  /** "Yes"/"true"/"1" → true, "No"/"false"/"0" → false — anything else refuses to guess. */
  function asBool(value) {
    const v = norm(value);
    if (/^(y|yes|true|1|on)$/.test(v)) return true;
    if (/^(n|no|false|0|off)$/.test(v)) return false;
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

    // Widget controls: modern ATS forms (Ashby/Nooks) draw choices as
    // <button aria-pressed> pairs or role=radio/checkbox/switch divs — there is
    // no <input> at all, so the loop above never sees them. Same contract as
    // native radios: one pair per question, labelled by the question, EEOC
    // excluded, nothing guessed when the question can't be found.
    const WSEL = 'button[aria-pressed], [role="radio"], [role="checkbox"], [role="switch"]';
    const seenBoxes = new Set();
    for (const el of document.querySelectorAll(WSEL)) {
      if (el.matches("input, textarea, select")) continue; // native controls are owned by the loop above
      if (el.disabled || !VISIBLE(el)) continue;
      if (NEVER_FILL.test(`${el.id || ""} ${el.getAttribute("aria-label") || ""} ${el.innerText || ""}`)) continue;
      const role = el.getAttribute("role") || "";
      const isCheck = role === "checkbox" || role === "switch";
      const group = isCheck ? [el] : groupWidgets(el, WSEL);
      const box = isCheck ? null : el.closest('[role="radiogroup"]') || el.parentElement;
      if (box) {
        if (seenBoxes.has(box)) continue; // one pair per container
        seenBoxes.add(box);
      }
      if (!group.length) continue;
      const q = questionFor(group[0]);
      const own = (el.innerText || "").trim().replace(/\s+/g, " ").slice(0, 120);
      const label = isCheck ? el.getAttribute("aria-label") || own || q.text : q.text;
      if (!label) continue; // no question → don't guess at bare widgets
      if (SELF_ID.test(label) || SELF_ID.test(q.text)) {
        excluded.push(label); // EEOC rendered as widgets
        continue;
      }
      if (NEVER_FILL.test(label) || NEVER_FILL.test(q.text)) continue;
      const field = {
        name: el.id || (box && box.id) || "",
        id: el.id || "",
        label: (label || q.text).slice(0, 300),
        autocomplete: "",
        placeholder: "",
        type: isCheck ? "checkbox" : "radio",
        section: "",
      };
      pairs.push({
        el: group[0],
        field,
        group: isCheck ? null : group,
        widget: isCheck ? "check" : "group",
        box: q.box || box,
        signature: signatureOf(field),
      });
    }
    return { pairs, excluded };
  }

  /** The choice widgets sharing a container with `el` (radiogroup or shared parent). */
  function groupWidgets(el, sel) {
    const container = el.closest('[role="radiogroup"]') || el.parentElement;
    if (!container) return [el];
    return [...container.querySelectorAll(sel)].filter(
      (w) =>
        !w.disabled &&
        VISIBLE(w) &&
        !["checkbox", "switch"].includes(w.getAttribute("role") || "") &&
        (w.closest('[role="radiogroup"]') || w.parentElement) === container
    );
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

  /** aria-checked for role widgets, aria-pressed for <button> toggles. */
  const widgetAttr = (el) => (el.tagName === "BUTTON" ? "aria-pressed" : "aria-checked");

  /** true / false / null when the widget carries no state attribute at all. */
  function readWidgetState(el) {
    const a = el.getAttribute(widgetAttr(el));
    if (a === "true") return true;
    if (a === "false") return false;
    return el.type === "checkbox" ? !!el.checked : null;
  }

  /**
   * Click a widget so the site's own handlers record the choice — without ever
   * letting the page submit (§35.2 guardrail: a Yes/No button that is also
   * type=submit must not send the application).
   */
  function clickWidget(el) {
    const form = el.closest("form");
    const stop = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    if (form) form.addEventListener("submit", stop);
    try {
      el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    } finally {
      if (form) setTimeout(() => form.removeEventListener("submit", stop), 0);
    }
  }

  function fillItems(items) {
    const { pairs } = describe();
    const out = [];
    let flagged = 0;
    const needsReview = [];

    /** Outline the filled control (green ≥0.85, amber below) and record it. */
    const record = (pair, item, box) => {
      const target = box || pair.el;
      target.style.outline = item.confidence >= 0.85 ? "2px solid #10b981" : "2px solid #f59e0b";
      target.style.outlineOffset = "1px";
      target.title = `Filled by JAMS · ${Math.round(item.confidence * 100)}% (${item.method}) — review before submitting`;
      pair.el.dataset.jams = item.key;
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
    };

    for (const item of items) {
      const pair = pairs[item.field_index];
      if (!pair) continue;
      const { el } = pair;
      if (el.disabled || NEVER_FILL.test(`${el.name || ""} ${el.id || ""} ${el.type || ""}`)) continue; // guardrail, twice
      if (SELF_ID.test(pair.field.label || "")) continue; // belt + braces on EEOC

      // widget group: role=radio list or aria-pressed button pair — click the
      // choice, never write .checked (these elements have no such property)
      if (pair.widget === "group") {
        const opt = pickOption(pair.group, item.value);
        if (!opt) continue; // no confident answer → leave the question untouched
        if (readWidgetState(opt) !== true) clickWidget(opt);
        if (readWidgetState(opt) !== true) {
          // dumb widget with no JS behind it: mirror the choice in ARIA ourselves
          opt.setAttribute(widgetAttr(opt), "true");
          for (const o of pair.group) {
            if (o !== opt && readWidgetState(o) === true) o.setAttribute(widgetAttr(o), "false");
          }
        }
        record(pair, item, pair.box || el.closest("fieldset") || el.parentElement);
        continue;
      }

      // single widget toggle (role=checkbox/switch): needs a clear yes/no
      if (pair.widget === "check") {
        let want = asBool(item.value);
        if (want === null && norm(item.value) && norm(item.value) === norm(el.innerText)) want = true; // value IS the option text
        if (want === null) continue;
        if (readWidgetState(el) !== want) {
          clickWidget(el);
          if (readWidgetState(el) !== want) el.setAttribute(widgetAttr(el), String(want));
        }
        record(pair, item, pair.box || el.parentElement);
        continue;
      }

      if (pair.group) {
        const opt = pickOption(pair.group, item.value);
        if (!opt) continue; // no confident answer → leave the question untouched
        opt.checked = true;
        opt.dispatchEvent(new Event("input", { bubbles: true }));
        opt.dispatchEvent(new Event("change", { bubbles: true }));
        record(pair, item, pair.box || el.closest("fieldset") || el.parentElement);
        continue;
      }

      if (el.type === "checkbox") {
        const want = asBool(item.value);
        if (want === null) continue; // no clear yes/no → never guess a checkbox
        if (el.checked !== want) el.click(); // click so React/Vue onChange fires
        if (el.checked !== want) {
          el.checked = want;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
        record(pair, item, el.closest("label") || el);
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
      record(pair, item, el);
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
