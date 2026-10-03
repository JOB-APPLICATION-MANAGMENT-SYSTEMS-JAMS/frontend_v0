/** JAMS Autofill popup — sign in once, then fill / save from any job page. */

const $ = (id) => document.getElementById(id);

function send(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (res) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!res?.ok) return reject(new Error(res?.error || "Something went wrong"));
      resolve(res.result);
    });
  });
}

/** Human-readable status: fade only runs when the text actually changes. */
let lastSaid = "";
function say(text, tone = "") {
  const el = $("result");
  const key = tone + "\n" + text;
  el.textContent = text;
  el.className = tone;
  if (text && key !== lastSaid) {
    el.classList.add("animate");
    lastSaid = key;
  } else if (!text) {
    lastSaid = "";
  }
}

/** Backend messages are already phrased for humans; pass anything else through. */
function friendly(e) {
  const m = e?.message || String(e);
  if (/failed to fetch|networkerror|load failed/i.test(m)) {
    return "Can't reach the JAMS backend. Check your connection and try again.";
  }
  if (/token expired|not authenticated|request failed \(401\)|refresh token/i.test(m)) {
    return "Session expired — sign in again.";
  }
  if (/unknown message/i.test(m)) {
    return "Extension was updated — click ⟲ (reload) on JAMS Autofill in chrome://extensions, then try again.";
  }
  if (/invalid email or password/i.test(m)) {
    return "That email and password don't match an account.";
  }
  return m;
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || /^(chrome|edge|about|chrome-extension):/i.test(tab.url || "")) {
    throw new Error("Open a normal web page (a job posting) first.");
  }
  return tab;
}

/** Buttons show a busy label while a job runs — the fade has a job to do. */
function busy(on, label) {
  for (const id of ["fill", "capture", "login", "logout", "edit"]) {
    const el = $(id);
    if (el) el.disabled = on;
  }
  const btn = $("fill");
  if (btn) btn.querySelector(".btn-label").textContent = on && label ? label : "Fill this page";
}

let apiBase = "";
/** The web app on the same backend — auth deep-links land back where you were. */
function webBase() {
  return apiBase.includes("localhost") ? "http://localhost:3000" : "https://frontend-v0-lilac.vercel.app";
}
/** Where "✎ Edit" opens: the autofill control centre (answers, Q&A, aliases). */
function profileUrl() {
  return `${webBase()}/autofill`;
}

/* password reveal — toggle the input type, keep focus and caret */
$("peek").addEventListener("click", () => {
  const input = $("password");
  const btn = $("peek");
  const showing = input.type === "password";
  input.type = showing ? "text" : "password";
  btn.classList.toggle("showing", showing);
  btn.setAttribute("aria-pressed", String(showing));
  btn.setAttribute("aria-label", showing ? "Hide password" : "Show password");
  btn.title = showing ? "Hide password" : "Show password";
  input.focus();
});

/* no account yet? open the web signup (deep-links return to the same page) */
$("signup").addEventListener("click", () => {
  chrome.tabs.create({ url: `${webBase()}/auth/signup` });
});

/** Profile card: who autofill answers as, and how much is saved. */
async function loadProfile() {
  try {
    const p = await send({ type: "jams:profile" });
    const name = p.name || "";
    $("pname").textContent = name || p.email || "Your profile";
    $("pmeta").textContent =
      name && p.email && name !== p.email ? `${p.email} · ${p.saved} detail${p.saved === 1 ? "" : "s"} saved` : `${p.saved} detail${p.saved === 1 ? "" : "s"} saved`;
    $("avatar").textContent = (name || p.email || "?").trim().charAt(0).toUpperCase() || "?";
  } catch (e) {
    // degrade gracefully: keep WHO on the card, then recover or explain
    const who = $("who").textContent || localStorage.getItem("lastEmail") || "";
    $("avatar").textContent = "?";
    $("pname").textContent = who || "Your profile";
    $("pmeta").textContent = "details not loaded";
    if (isSessionError(e)) return recoverSession();
    say(friendly(e), "err");
  }
}

/* ---- per-field breakdown: grouped into filled vs skipped ---- */
function clearBreakdown() {
  $("breakdown").hidden = true;
  $("fills").innerHTML = "";
  $("skips").innerHTML = "";
}

function addRow(ul, row) {
  const li = document.createElement("li");
  if (row.skip) li.className = "skip";
  li.innerHTML = `<span class="dot ${row.cls}"></span><span class="rlabel"></span><span class="rsub"></span>`;
  li.querySelector(".rlabel").textContent = row.label;
  li.querySelector(".rsub").textContent = row.sub;
  ul.appendChild(li);
}

function addMore(ul, n) {
  const p = document.createElement("p");
  p.className = "rmore";
  p.textContent = `+${n} more`;
  ul.appendChild(p);
}

function renderBreakdown(r) {
  const details = r.details ?? [];
  const skipped = r.skippedFields ?? [];
  const excluded = r.excluded ?? [];
  if (!details.length && !skipped.length && !excluded.length) {
    clearBreakdown();
    return;
  }
  const fillUl = $("fills");
  fillUl.innerHTML = "";
  const skipUl = $("skips");
  skipUl.innerHTML = "";

  details.slice(0, 12).forEach((d) =>
    addRow(fillUl, {
      cls: d.confidence >= 0.85 ? "green" : "amber",
      label: d.label,
      sub: `${d.value || "—"} · ${Math.round(d.confidence * 100)}% · ${d.method}`,
    })
  );
  if (details.length > 12) addMore(fillUl, details.length - 12);

  skipped.slice(0, 8).forEach((s) => addRow(skipUl, { cls: "none", skip: true, label: s.field, sub: s.reason || "skipped" }));
  if (skipped.length > 8) addMore(skipUl, skipped.length - 8);

  $("group-filled").hidden = !details.length;
  $("filled-title").textContent = `Filled ${details.length}`;
  $("group-skipped").hidden = !skipped.length;
  $("skipped-title").textContent = `Skipped ${skipped.length}`;
  const notes = [];
  if (excluded.length) notes.push(`${excluded.length} voluntary (EEOC) question${excluded.length === 1 ? "" : "s"} left to you.`);
  notes.push("Review everything and press Submit yourself.");
  $("bnote").textContent = notes.join(" ");
  $("breakdown").hidden = false;
}

/* ---- session recovery: a dead token returns to sign-in, not a dead card ---- */
function isSessionError(e) {
  return /session expired|request failed \(401\)|refresh token|not authenticated|token expired/i.test(e?.message || "");
}

async function recoverSession() {
  const remembered = $("who").textContent || $("email").value || localStorage.getItem("lastEmail") || "";
  try {
    await send({ type: "jams:logout" });
  } catch {
    /* already out */
  }
  clearBreakdown();
  await refresh(); // sign-in pane, backend + email prefilled
  if (remembered && !$("email").value) $("email").value = remembered;
  say("Session expired — sign in again.", "err");
}

async function refresh() {
  const s = await send({ type: "jams:status" });
  apiBase = s.apiBase || "";
  $("signin").hidden = s.signedIn;
  $("app").hidden = !s.signedIn;
  $("who").textContent = s.signedIn ? s.email : "";
  $("where").textContent = s.apiBase.includes("localhost") ? "local backend" : "production";
  if (!s.signedIn) {
    $("api").value = s.apiBase;
    clearBreakdown();
    // prefill who was signed in before, so an expired session is one field to type
    if (!$("email").value) $("email").value = s.email || localStorage.getItem("lastEmail") || "";
    if (!localStorage.getItem("seen")) {
      say("Sign in with your JAMS account to fill forms.");
    }
  } else {
    loadProfile();
  }
}

$("signin").addEventListener("submit", async (e) => {
  e.preventDefault(); // Enter in any field signs in
  const email = $("email").value.trim();
  const password = $("password").value;
  if (!email || !password) return say("Enter your email and password.", "err");
  busy(true);
  say("Signing in…", "busy");
  try {
    await send({ type: "jams:setApiBase", apiBase: $("api").value });
    await send({ type: "jams:login", email, password });
    localStorage.setItem("seen", "1");
    localStorage.setItem("lastEmail", email);
    $("password").value = "";
    say("");
    await refresh();
  } catch (e2) {
    say(friendly(e2), "err");
  } finally {
    busy(false);
  }
});

$("edit").addEventListener("click", () => {
  // the profile master form is the single place details are added
  chrome.tabs.create({ url: profileUrl() });
});

$("fill").addEventListener("click", async () => {
  busy(true, "Filling…");
  say("Matching fields against your profile…", "busy");
  clearBreakdown();
  try {
    const tab = await activeTab();
    const r = await send({ type: "jams:fill", tabId: tab.id });
    renderBreakdown(r);
    if (r.reason) {
      say(r.reason, "err");
      return;
    }
    if (!r.filled) {
      say(
        r.skipped
          ? "Nothing filled — the profile has no matching details yet. Press ✎ Edit to add them."
          : "No form fields found on this page.",
        "err"
      );
      return;
    }
    const lines = [`Filled ${r.filled} field(s).`];
    if (r.flagged) lines.push(`${r.flagged} amber — lower confidence, review those.`);
    if (r.skipped) lines.push(`${r.skipped} skipped.`);
    say(lines.join("\n"), "ok");
  } catch (e) {
    if (isSessionError(e)) await recoverSession();
    else say(friendly(e), "err");
  } finally {
    busy(false);
  }
});

$("capture").addEventListener("click", async () => {
  busy(true, "Saving…");
  say("Saving this page to JAMS…", "busy");
  try {
    const tab = await activeTab();
    const action = $("draft").checked ? "create_draft" : "log_only";
    const r = await send({ type: "jams:capture", tabId: tab.id, action });
    const what = r?.application_id
      ? `Draft application created (${r?.posting_id ?? "posting"}).`
      : r?.posting_id
        ? `Posting saved (${r.posting_id}).`
        : "Saved to JAMS.";
    say(`${what}${typeof r?.score === "number" ? ` Match score ${r.score}.` : ""}`, "ok");
  } catch (e) {
    if (isSessionError(e)) await recoverSession();
    else say(friendly(e), "err");
  } finally {
    busy(false);
  }
});

$("logout").addEventListener("click", async () => {
  await send({ type: "jams:logout" });
  say("");
  clearBreakdown();
  await refresh();
});

refresh().catch((e) => say(friendly(e), "err"));
