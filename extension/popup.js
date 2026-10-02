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

function say(text, tone = "") {
  const el = $("result");
  el.textContent = text;
  el.className = tone;
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || /^(chrome|edge|about|chrome-extension):/i.test(tab.url || "")) {
    throw new Error("Open a normal web page (a job posting) first.");
  }
  return tab;
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

$("login").addEventListener("click", async () => {
  const email = $("email").value.trim();
  const password = $("password").value;
  if (!email || !password) return say("Enter your email and password.", "err");
  $("login").disabled = true;
  try {
    await send({ type: "jams:setApiBase", apiBase: $("api").value });
    await send({ type: "jams:login", email, password });
    localStorage.setItem("seen", "1");
    $("password").value = "";
    await refresh();
  } catch (e) {
    say(e.message, "err");
  } finally {
    $("login").disabled = false;
  }
});

$("fill").addEventListener("click", async () => {
  $("fill").disabled = true;
  say("Matching fields against your profile…");
  try {
    const tab = await activeTab();
    const r = await send({ type: "jams:fill", tabId: tab.id });
    if (r.reason) return say(r.reason, "err");
    if (!r.filled) return say(`Nothing to fill: ${r.skipped} field(s) skipped (no confident profile match).`, "err");
    const lines = [`Filled ${r.filled} field(s).`];
    if (r.flagged) lines.push(`${r.flagged} amber — lower confidence, review those.`);
    if (r.skipped) lines.push(`${r.skipped} skipped.`);
    lines.push("Review everything and press Submit yourself.");
    say(lines.join("\n"), "ok");
  } catch (e) {
    say(e.message, "err");
  } finally {
    $("fill").disabled = false;
  }
});

$("capture").addEventListener("click", async () => {
  $("capture").disabled = true;
  say("Saving this page to JAMS…");
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
    say(e.message, "err");
  } finally {
    $("capture").disabled = false;
  }
});

$("logout").addEventListener("click", async () => {
  await send({ type: "jams:logout" });
  await refresh();
});

refresh().catch((e) => say(e.message, "err"));
