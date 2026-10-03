#!/usr/bin/env node
/**
 * Local preview harness for the JAMS Autofill extension — lets you see the
 * popup and exercise the content script in a normal tab, without installing
 * the extension.
 *
 *   node scripts/extension-preview.mjs
 *   → http://localhost:4319/popup.html?state=in   (also: state=out, state=err)
 *   → http://localhost:4319/form.html             (sample job application form)
 *   → http://localhost:4319/nooks.html            (Ashby/Nooks-style exam form + real end-to-end run)
 *
 * popup.html?state=* injects a chrome.* shim before popup.js so the UI can be
 * reviewed and clicked without an extension context. The real extension never
 * loads this file.
 *
 * /nooks.html runs the REAL pipeline: popup.js (iframe) → background.js (own
 * iframe, so its message listener stays separate from the content script) →
 * content.js (page) → /api/v1/* proxied to the local backend on :8000.
 * /background.html bootstraps chrome.storage and signs the demo user in.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXT = path.join(root, "extension");
const PORT = 4319;

/* --- chrome.* shim: canned answers for the popup's message API ----------- */
function shim(state) {
  return `<script>
(function () {
  var state = ${JSON.stringify(state)};
  function handle(msg) {
    if (state === "err") throw new Error("Session expired — sign in again.");
    switch (msg.type) {
      case "jams:status":
        return {
          signedIn: state === "in",
          email: state === "in" ? "catalog.seed@jams.local" : "",
          apiBase: "https://backend-v0-3aeu-omega.vercel.app/api/v1",
        };
      case "jams:fill":
        return {
          filled: 6,
          flagged: 1,
          skipped: 2,
          needsReview: ["identity.work_authorization → Are you legally authorized…"],
          details: [
            { key: "identity.full_name", label: "Full Name", value: "Israel Iraoya", confidence: 0.9, method: "name" },
            { key: "identity.email", label: "Email Address", value: "israeliraoya7@gmail.com", confidence: 0.9, method: "name" },
            { key: "identity.phone", label: "Phone Number", value: "1-415-555-1234", confidence: 0.9, method: "name" },
            { key: "identity.location", label: "Location", value: "San Francisco, CA", confidence: 0.9, method: "name" },
            { key: "identity.sponsorship", label: "Require sponsorship for employment visa status?", value: "No", confidence: 0.9, method: "name" },
            { key: "identity.work_authorization", label: "Are you legally authorized to work?", value: "Yes", confidence: 0.79, method: "label" },
          ],
          skippedFields: [
            { field: "LinkedIn Profile URL", reason: "no profile data for identity.linkedin — add it in your profile" },
            { field: "Disability Status", reason: "voluntary self-identification — your answer, not ours" },
          ],
          excluded: ["Disability Status", "Gender", "Veteran Status"],
        };
      case "jams:profile":
        return { name: "Israel Iraoya", email: "catalog.seed@jams.local", saved: 12, education: 1, skills: 4 };
      case "jams:capture":
        return { application_id: "app_123", posting_id: "post_456", score: 87 };
      case "jams:login":
        return { email: msg.email };
      case "jams:logout":
        return {};
      case "jams:setApiBase":
        return { apiBase: msg.apiBase };
      default:
        throw new Error("Unknown message: " + msg.type);
    }
  }
  window.chrome = {
    runtime: {
      lastError: null,
      sendMessage: function (msg, cb) {
        setTimeout(function () {
          try { cb({ ok: true, result: handle(msg) }); }
          catch (e) { cb({ ok: false, error: e.message }); }
        }, 12);
      },
    },
    tabs: {
      // MV3 promise style, matching what popup.js uses
      query: function () {
        return Promise.resolve([{ id: 1, url: "https://boards.example.com/jobs/42" }]);
      },
      create: function (opts) {
        try { window.open(opts && opts.url, "_blank"); } catch (e) { /* popup blocker */ }
        return Promise.resolve({ id: 2 });
      },
    },
  };
})();
</script>`;
}

const FORM_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Senior Backend Engineer — Acme Corp | Greenhouse</title>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"JobPosting","title":"Senior Backend Engineer",
   "datePosted":"2026-09-20","hiringOrganization":{"@type":"Organization","name":"Acme Corp"}}
  </script>
  <style>
    body { font: 15px/1.5 system-ui, sans-serif; max-width: 560px; margin: 40px auto; color: #211812; background: #fcfbf9; }
    h1 { font-size: 24px; }
    .meta { color: #7a7068; }
    form { display: grid; gap: 12px; margin-top: 24px; }
    label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: #7a7068; display: block; margin-bottom: 4px; }
    input, select, textarea { width: 100%; padding: 8px 10px; border: 1px solid #e7e2dc; border-radius: 8px; font: inherit; background: #fff; box-sizing: border-box; }
    button { padding: 10px 14px; border-radius: 8px; border: 0; background: #ea580c; color: #fffbeb; font: inherit; font-weight: 600; cursor: pointer; }
  </style>
</head>
<body>
  <article>
    <h1>Senior Backend Engineer</h1>
    <p class="meta">Acme Corp · Lagos (Hybrid) · ₦8,000,000 – ₦12,000,000 / year · Posted 2 days ago</p>
    <p>We are hiring a senior backend engineer to build reliable APIs that power hiring teams across the world.</p>
    <form action="/apply" method="post">
      <div><label for="first">First name</label><input id="first" name="first_name" autocomplete="given-name" type="text" /></div>
      <div><label for="last">Last name</label><input id="last" name="last_name" autocomplete="family-name" type="text" /></div>
      <div><label for="email">Email address</label><input id="email" name="email" autocomplete="email" type="email" /></div>
      <div><label for="phone">Phone number</label><input id="phone" name="phone" autocomplete="tel" type="tel" /></div>
      <div><label for="city">City</label><input id="city" name="city" autocomplete="address-level2" type="text" /></div>
      <div><label for="exp">Years of experience</label>
        <select id="exp" name="experience"><option value="">Select…</option><option value="2">2 years</option><option value="5">5 years</option></select>
      </div>
      <div><label for="cover">Cover letter</label><textarea id="cover" name="cover_letter" rows="4"></textarea></div>
      <div><label for="pw">Create a password</label><input id="pw" name="password" type="password" autocomplete="new-password" /></div>
      <div><label for="cc">Card number (application fee)</label><input id="cc" name="credit_card" type="text" inputmode="numeric" /></div>
      <input type="hidden" name="csrf" value="abc123" />
      <button type="submit">Submit application</button>
    </form>
  </article>
  <script>
    // count input events so the fill test can prove React-style listeners fire
    window.__inputEvents = {};
    document.addEventListener("input", function (e) {
      if (e.target && e.target.id) window.__inputEvents[e.target.id] = (window.__inputEvents[e.target.id] || 0) + 1;
    }, true);
  </script>
</body>
</html>`;

/**
 * The "exam": a replica of the Ashby-hosted Nooks new-grad application — text
 * fields, radio groups phrased as full questions, an EEOC block that must be
 * left alone, a file upload and a submit button that must never be touched.
 */
const NOOKS_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Software Engineer, New Grad — Nooks | Ashby</title>
  <style>
    :root { color-scheme: light; }
    body { font: 15px/1.55 system-ui, sans-serif; margin: 0; background: #faf8f5; color: #2b241f; }
    main { max-width: 680px; margin: 0 auto; padding: 40px 24px 80px; }
    h1 { font-size: 26px; margin: 0 0 6px; }
    h2 { font-size: 18px; margin: 32px 0 8px; }
    h3 { font-size: 15px; margin: 24px 0 8px; }
    .meta { color: #7a7068; font-size: 13px; margin: 0 0 20px; }
    .hint { color: #7a7068; font-size: 13px; }
    form { display: grid; gap: 18px; }
    .field label, .lbl { display: block; font-size: 12px; font-weight: 650; text-transform: uppercase; letter-spacing: .05em; color: #7a7068; margin-bottom: 6px; }
    input[type="text"], input[type="email"], input[type="tel"] { width: 100%; box-sizing: border-box; padding: 9px 12px; border: 1px solid #e2dbd3; border-radius: 8px; font: inherit; background: #fff; }
    input:focus-visible { outline: 2px solid #ea580c; outline-offset: 1px; }
    .q { border: 1px solid #ebe5de; border-radius: 10px; padding: 14px 16px; background: #fff; }
    .q-text { margin: 0 0 10px; font-weight: 600; }
    fieldset { border: 1px solid #ebe5de; border-radius: 10px; padding: 12px 16px 14px; margin: 0 0 12px; background: #fff; }
    legend { font-weight: 650; padding: 0 6px; }
    .voluntary { border-left: 3px solid #d6cfc6; padding-left: 16px; }
    label.opt { display: flex; gap: 8px; align-items: flex-start; padding: 6px 0; font-weight: 450; text-transform: none; letter-spacing: 0; font-size: 14px; color: #2b241f; margin-bottom: 0; cursor: pointer; }
    input[type="radio"] { margin-top: 3px; accent-color: #ea580c; }
    input[type="file"] { font: inherit; color: #7a7068; }
    button[type="submit"] { justify-self: start; padding: 11px 20px; border: 0; border-radius: 8px; background: #ea580c; color: #fffbeb; font: inherit; font-weight: 650; cursor: pointer; }
    button[type="submit"]:hover { background: #c2410c; }
    footer { margin-top: 40px; color: #9a9088; font-size: 12px; }
    #jams-popup { position: fixed; top: 16px; right: 16px; width: 368px; height: 620px; border: 1px solid #e2dbd3; border-radius: 14px; box-shadow: 0 12px 32px rgba(43, 36, 31, .16); background: #fff; z-index: 50; }
    @media (max-width: 900px) { #jams-popup { display: none; } }
  </style>
</head>
<body>
<main>
  <h1>Software Engineer, New Grad</h1>
  <p class="meta">Nooks · San Francisco, CA · Full time · Hybrid · Early Career · $200K • Offers Equity</p>

  <h2>Overview</h2>
  <p>Thank you so much for your enthusiasm for Nooks! As we review your experience, we try to match you with roles that best reflect your skills. So, while we are eager to review your profile, we also ask our candidates to limit the application to 3 submissions within 90 days.</p>

  <h2>Application</h2>
  <form action="/apply" method="post">
    <div class="field"><span class="lbl">Resume</span><input type="file" name="resume" accept=".pdf,.doc,.docx" /><br /><span class="hint">No file chosen · or drag and drop here</span></div>

    <h3>About You</h3>
    <div class="field"><label for="li">LinkedIn Profile URL</label><input id="li" name="linkedin_url" type="text" placeholder="Type here..." /></div>
    <div class="field"><label for="fn">Full Name</label><input id="fn" name="full_name" type="text" placeholder="Type here..." /></div>
    <div class="field"><label for="em">Email Address</label><input id="em" name="email" type="email" /></div>
    <div class="field"><label for="ph">Phone Number</label><input id="ph" name="phone_number" type="tel" placeholder="1-415-555-1234..." /></div>

    <div class="q">
      <p class="q-text">It's ok to text me updates on my application.</p>
      <label class="opt"><input type="radio" name="text_updates" value="Yes" /> Yes</label>
      <label class="opt"><input type="radio" name="text_updates" value="No" /> No</label>
    </div>

    <div class="field"><label for="loc">Location</label><input id="loc" name="location" type="text" placeholder="Start typing..." /></div>

    <div class="q">
      <p class="q-text">Are you able to come in to the San Francisco office 3 days per week (Monday, Tuesday, Thursday)?</p>
      <label class="opt"><input type="radio" name="office_attendance" value="Yes, I live locally" /> Yes, I live locally</label>
      <label class="opt"><input type="radio" name="office_attendance" value="Yes, but I will need to relocate" /> Yes, but I will need to relocate</label>
      <label class="opt"><input type="radio" name="office_attendance" value="No. I do not live locally nor do I plan to relocate" /> No. I do not live locally nor do I plan to relocate</label>
    </div>

    <section class="voluntary">
      <h3>Voluntary Self Identification</h3>
      <p class="hint">For government reporting purposes, we ask candidates to respond to the below self-identification survey. Completion of the form is entirely voluntary. Whatever your decision, it will not be considered in the hiring process or thereafter.</p>
      <fieldset>
        <legend>Disability Status</legend>
        <label class="opt"><input type="radio" name="disability" value="have" /> I have a disability, or have had one in the past</label>
        <label class="opt"><input type="radio" name="disability" value="none" /> I do not have a disability and have not had one in the past</label>
        <label class="opt"><input type="radio" name="disability" value="decline" /> I do not want to answer</label>
      </fieldset>
    </section>

    <section>
      <h3>Immigration Status</h3>
      <fieldset>
        <legend>Are you legally authorized to work in the United States? (Yes/No)</legend>
        <label class="opt"><input type="radio" name="work_auth" value="Yes" /> Yes</label>
        <label class="opt"><input type="radio" name="work_auth" value="No" /> No</label>
      </fieldset>
      <fieldset>
        <legend>Will you now or in the future require sponsorship for employment visa status (e.g., H-1B, TN, etc.)?</legend>
        <label class="opt"><input type="radio" name="sponsorship" value="Yes" /> Yes</label>
        <label class="opt"><input type="radio" name="sponsorship" value="No" /> No</label>
      </fieldset>
      <div class="field"><label for="sd">If yes, please let us know what kind and the expiration date.</label><input id="sd" name="sponsor_detail" type="text" placeholder="Type here..." /></div>
    </section>

    <button type="submit">Submit Application</button>
  </form>
  <footer>Powered by Ashby · Privacy Policy · Security · Vulnerability Disclosure</footer>
</main>

<iframe id="jams-popup" src="/popup.html?live=1" title="JAMS Autofill"></iframe>
<iframe id="jams-bg" src="/background.html" style="display:none" title="JAMS background"></iframe>

<!-- content-side chrome.* shim: content.js registers its listener here -->
<script>
  window.__jamsContentListeners = [];
  window.chrome = window.chrome || {};
  window.chrome.runtime = window.chrome.runtime || {};
  window.chrome.runtime.lastError = null;
  window.chrome.runtime.onMessage = { addListener: function (fn) { window.__jamsContentListeners.push(fn); } };
</script>
<script src="/content.js"></script>
<script>
  // Message hub: popup iframe ⇄ background iframe ⇄ content script (this page).
  // The three realms stay separate exactly like a real MV3 extension.
  (function () {
    var popupFrame = document.getElementById("jams-popup");
    var bgFrame = document.getElementById("jams-bg");
    var bgReady = false;
    window.addEventListener("message", function (e) {
      var d = e.data || {};
      if (d.jamsToBg) bgFrame.contentWindow.postMessage(d, "*");
      else if (d.jamsFromBg || d.jamsBgReady) {
        if (d.jamsBgReady) bgReady = true;
        popupFrame.contentWindow.postMessage(d, "*");
      } else if (d.jamsPingReady) popupFrame.contentWindow.postMessage({ jamsBgReady: bgReady }, "*");
      else if (d.jamsToContent) respondToContent(d.jamsToContent);
    });
    function respondToContent(job) {
      var handled = false;
      var sendResponse = function (resp) {
        if (handled) return;
        handled = true;
        bgFrame.contentWindow.postMessage({ jamsContentDone: { jid: job.jid, resp: resp } }, "*");
      };
      try {
        for (var i = 0; i < window.__jamsContentListeners.length; i++) {
          window.__jamsContentListeners[i](job.msg, {}, sendResponse);
        }
      } catch (err) {
        bgFrame.contentWindow.postMessage({ jamsContentDone: { jid: job.jid, error: String(err) } }, "*");
        return;
      }
      if (!handled) bgFrame.contentWindow.postMessage({ jamsContentDone: { jid: job.jid, error: "content script did not respond" } }, "*");
    }
  })();
</script>
</body>
</html>`;

/** Background realm: real background.js + chrome.storage/​tabs shims over postMessage. */
const BACKGROUND_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><title>JAMS background</title></head><body>
<script>
  (function () {
    var listeners = [];
    var contentWaiters = {};
    var KEY = "jams.shim.storage";
    function read() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } }
    function write(s) { localStorage.setItem(KEY, JSON.stringify(s)); }

    window.chrome = {
      storage: { local: {
        get: function (keys) { var s = read(), out = {}; keys.forEach(function (k) { if (k in s) out[k] = s[k]; }); return Promise.resolve(out); },
        set: function (obj) { var s = read(); Object.assign(s, obj); write(s); return Promise.resolve(); },
        remove: function (keys) { var s = read(); keys.forEach(function (k) { delete s[k]; }); write(s); return Promise.resolve(); },
      } },
      runtime: { onMessage: { addListener: function (fn) { listeners.push(fn); } }, lastError: null },
      tabs: {
        get: function (id) { return Promise.resolve({ id: id, url: parent.location.href }); },
        sendMessage: function (tabId, msg) {
          return new Promise(function (resolve, reject) {
            var jid = "c" + Date.now() + "_" + Math.random();
            contentWaiters[jid] = { resolve: resolve, reject: reject };
            parent.postMessage({ jamsToContent: { jid: jid, msg: msg } }, "*");
            setTimeout(function () {
              if (contentWaiters[jid]) { delete contentWaiters[jid]; reject(new Error("content script did not respond")); }
            }, 8000);
          });
        },
      },
      scripting: { executeScript: function () { return Promise.resolve([]); } }, // page loads content.js itself
    };

    window.addEventListener("message", function (e) {
      var d = e.data || {};
      if (d.jamsToBg) {
        var jid = d.jamsToBg.jid, responded = false;
        var sendResponse = function (resp) {
          if (responded) return;
          responded = true;
          parent.postMessage({ jamsFromBg: { jid: jid, resp: resp } }, "*");
        };
        for (var i = 0; i < listeners.length; i++) {
          try { listeners[i](d.jamsToBg.msg, { tab: { id: 1 } }, sendResponse); }
          catch (err) { sendResponse({ ok: false, error: String(err) }); }
        }
        if (!responded && !listeners.length) sendResponse({ ok: false, error: "background not loaded" });
      }
      if (d.jamsContentDone) {
        var w = contentWaiters[d.jamsContentDone.jid];
        if (w) {
          delete contentWaiters[d.jamsContentDone.jid];
          if (d.jamsContentDone.error) w.reject(new Error(d.jamsContentDone.error));
          else w.resolve(d.jamsContentDone.resp);
        }
      }
    });

    // Bootstrap: point the worker at the harness proxy and sign the demo user in.
    (async function () {
      function tokenExpired(t) {
        try {
          var p = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
          return !p.exp || p.exp * 1000 < Date.now() + 15000;
        } catch (e) { return true; }
      }
      var s = read();
      s.apiBase = "/api/v1";
      write(s);
      if (!s.token || tokenExpired(s.token)) {
        try {
          var r = await fetch("/api/v1/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "uitest@example.com", password: "Passw0rd!123" }),
          });
          var j = await r.json();
          var t = j && j.data && j.data.access_token;
          if (t) { var cur = read(); cur.token = t; cur.email = "uitest@example.com"; cur.apiBase = "/api/v1"; write(cur); }
          else console.warn("jams preview: login returned no token", j);
        } catch (err) {
          console.warn("jams preview: login failed — is the local backend running on :8000?", err);
        }
      }
      parent.postMessage({ jamsBgReady: true }, "*");
    })();
  })();
</script>
<script src="/background.js"></script>
</body></html>`;

/** Popup bridge for ?live=1: relay chrome.runtime/tabs calls to the page hub. */
const LIVE_BRIDGE = `<script>
(function () {
  var waiters = {}, nextId = 1, bgReady = false, pendingReady = [];
  window.chrome = window.chrome || {};
  window.chrome.runtime = {
    lastError: null,
    onMessage: { addListener: function () {} },
    sendMessage: function (msg, cb) {
      var p = new Promise(function (resolve, reject) {
        var attempt = function () {
          var jid = "p" + nextId++;
          waiters[jid] = { resolve: resolve, reject: reject };
          parent.postMessage({ jamsToBg: { jid: jid, msg: msg } }, "*");
          setTimeout(function () {
            if (waiters[jid]) { delete waiters[jid]; resolve({ ok: false, error: "JAMS background did not respond" }); }
          }, 10000);
        };
        if (bgReady) attempt();
        else pendingReady.push(attempt);
      });
      setTimeout(function () { if (!bgReady) { bgReady = true; pendingReady.forEach(function (fn) { fn(); }); pendingReady = []; } }, 6000);
      if (typeof cb === "function") {
        p.then(function (r) { cb(r); }, function (e) { window.chrome.runtime.lastError = { message: String(e) }; cb({ ok: false, error: String(e) }); window.chrome.runtime.lastError = null; });
        return;
      }
      return p;
    },
  };
  window.chrome.tabs = {
    query: function () {
      var origin = new URL(location.href).origin;
      return Promise.resolve([{ id: 1, active: true, url: origin + "/nooks.html", title: "Software Engineer, New Grad — Nooks" }]);
    },
    create: function (opts) {
      try { window.open(opts && opts.url, "_blank"); } catch (e) { /* popup blocker */ }
      return Promise.resolve({ id: 2 });
    },
  };
  window.addEventListener("message", function (e) {
    var d = e.data || {};
    if (d.jamsFromBg) {
      var w = waiters[d.jamsFromBg.jid];
      if (w) { delete waiters[d.jamsFromBg.jid]; w.resolve(d.jamsFromBg.resp); }
    }
    if (d.jamsBgReady && !bgReady) {
      bgReady = true;
      pendingReady.forEach(function (fn) { fn(); });
      pendingReady = [];
    }
  });
  parent.postMessage({ jamsPingReady: 1 }, "*");
})();
</script>`;

const STATIC = {
  "/popup.js": ["popup.js", "text/javascript"],
  "/popup.css": ["popup.css", "text/css"],
  "/content.js": ["content.js", "text/javascript"],
  "/background.js": ["background.js", "text/javascript"],
  "/manifest.json": ["manifest.json", "application/json"],
  "/logo.png": ["logo.png", "image/png"],
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const send = (type, body) => {
      res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
      res.end(body);
    };

    if (url.pathname === "/popup.html") {
      const state = url.searchParams.get("state") || "in";
      const live = url.searchParams.get("live") === "1";
      if (!live && !["in", "out", "err"].includes(state)) return send("text/plain", "state must be in|out|err");
      const html = fs
        .readFileSync(path.join(EXT, "popup.html"), "utf8")
        .replace('<script src="popup.js">', `${live ? LIVE_BRIDGE : shim(state)}\n    <script src="popup.js">`);
      return send("text/html; charset=utf-8", html);
    }
    if (url.pathname === "/form.html") return send("text/html; charset=utf-8", FORM_HTML);
    if (url.pathname === "/nooks.html") return send("text/html; charset=utf-8", NOOKS_HTML);
    if (url.pathname === "/background.html") return send("text/html; charset=utf-8", BACKGROUND_HTML);

    // API proxy → local backend, so /autofill/match runs genuinely end-to-end
    if (url.pathname === "/api/v1" || url.pathname.startsWith("/api/v1/")) {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", async () => {
        const fail = (status, message) => {
          res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
          res.end(JSON.stringify({ message, error: { code: "PROXY_DOWN", detail: message } }));
        };
        try {
          const headers = {};
          if (req.headers["content-type"]) headers["content-type"] = req.headers["content-type"];
          if (req.headers.authorization) headers.authorization = req.headers.authorization;
          const r = await fetch(`http://localhost:8000${url.pathname}${url.search}`, {
            method: req.method,
            headers,
            body: chunks.length ? Buffer.concat(chunks) : undefined,
          });
          const text = await r.text();
          res.writeHead(r.status, { "Content-Type": r.headers.get("content-type") || "application/json", "Cache-Control": "no-store" });
          res.end(text);
        } catch {
          fail(502, "Local backend is not running on :8000 — start it with: cd backend && npx tsx src/main.ts");
        }
      });
      return;
    }

    const entry = STATIC[url.pathname];
    if (entry) {
      const file = path.join(EXT, entry[0]);
      if (fs.existsSync(file)) return send(entry[1], fs.readFileSync(file));
    }
    const icon = url.pathname.match(/^\/icons\/(icon(?:16|32|48|128)\.png)$/);
    if (icon) {
      const file = path.join(EXT, "icons", icon[1]);
      if (fs.existsSync(file)) return send("image/png", fs.readFileSync(file));
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
  })
  .listen(PORT, "127.0.0.1", () => {
    console.log(`extension preview: http://localhost:${PORT}/popup.html?state=in`);
    console.log(`sample form:       http://localhost:${PORT}/form.html`);
    console.log(`nooks exam form:   http://localhost:${PORT}/nooks.html (needs local backend on :8000)`);
  });
