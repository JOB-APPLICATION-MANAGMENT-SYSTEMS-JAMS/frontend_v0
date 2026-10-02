#!/usr/bin/env node
/**
 * Local preview harness for the JAMS Autofill extension — lets you see the
 * popup and exercise the content script in a normal tab, without installing
 * the extension.
 *
 *   node scripts/extension-preview.mjs
 *   → http://localhost:4319/popup.html?state=in   (also: state=out, state=err)
 *   → http://localhost:4319/form.html             (sample job application form)
 *
 * popup.html?state=* injects a chrome.* shim before popup.js so the UI can be
 * reviewed and clicked without an extension context. The real extension never
 * loads this file.
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
        return { filled: 6, flagged: 1, skipped: 2, needsReview: ["identity.website → Portfolio"] };
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
      if (!["in", "out", "err"].includes(state)) return send("text/plain", "state must be in|out|err");
      const html = fs
        .readFileSync(path.join(EXT, "popup.html"), "utf8")
        .replace('<script src="popup.js">', `${shim(state)}\n    <script src="popup.js">`);
      return send("text/html; charset=utf-8", html);
    }
    if (url.pathname === "/form.html") return send("text/html; charset=utf-8", FORM_HTML);

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
  });
