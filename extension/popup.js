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
  if (/token expired|not authenticated/i.test(m)) {
    return "Session expired — sign in again.";
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
  for (const id of ["fill", "capture", "login", "logout"]) {
    const el = $(id);
    if (el) el.disabled = on;
  }
  const btn = $("fill");
  if (btn) btn.querySelector(".btn-label").textContent = on && label ? label : "Fill this page";
}

async function refresh() {
  const s = await send({ type: "jams:status" });
  $("signin").hidden = s.signedIn;
  $("app").hidden = !s.signedIn;
  $("who").textContent = s.signedIn ? s.email : "";
  $("where").textContent = s.apiBase.includes("localhost") ? "local backend" : "production";
  if (!s.signedIn) {
    $("api").value = s.apiBase;
    if (!localStorage.getItem("seen")) {
      say("Sign in with your JAMS account to fill forms.");
    }
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
    $("password").value = "";
    say("");
    await refresh();
  } catch (e2) {
    say(friendly(e2), "err");
  } finally {
    busy(false);
  }
});

$("fill").addEventListener("click", async () => {
  busy(true, "Filling…");
  say("Matching fields against your profile…", "busy");
  try {
    const tab = await activeTab();
    const r = await send({ type: "jams:fill", tabId: tab.id });
    if (r.reason) return say(r.reason, "err");
    if (!r.filled) {
      return say(
        r.skipped
          ? `Nothing to fill: ${r.skipped} field(s) had no confident profile match.`
          : "No form fields found on this page.",
        "err"
      );
    }
    const lines = [`Filled ${r.filled} field(s).`];
    if (r.flagged) lines.push(`${r.flagged} amber — lower confidence, review those.`);
    if (r.skipped) lines.push(`${r.skipped} skipped.`);
    lines.push("Review everything and press Submit yourself.");
    say(lines.join("\n"), "ok");
  } catch (e) {
    say(friendly(e), "err");
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
    say(friendly(e), "err");
  } finally {
    busy(false);
  }
});

$("logout").addEventListener("click", async () => {
  await send({ type: "jams:logout" });
  say("");
  await refresh();
});

refresh().catch((e) => say(friendly(e), "err"));
