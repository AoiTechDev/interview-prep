// Drills - a tiny local app for interview question practice.

"use strict";

const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { buildSeedDb } = require("./seed");

const PORT = Number(process.env.PORT) || 4321;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const MAX_BACKUPS = 20;



function makeId(prefix) {
  return prefix + "_" + crypto.randomBytes(6).toString("hex");
}

function nowIso() {
  return new Date().toISOString();
}

let db = null;
let writeChain = Promise.resolve();

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function normalizeQuestion(q) {
  return {
    id: typeof q.id === "string" ? q.id : makeId("q"),
    categoryId: String(q.categoryId || ""),
    text: String(q.text || ""),
    answer: typeof q.answer === "string" ? q.answer : "",
    status: q.status === "reviewed" ? "reviewed" : "todo",
    starred: q.starred === true,
    order: Number.isFinite(q.order) ? q.order : 0,
    createdAt: q.createdAt || nowIso(),
    updatedAt: q.updatedAt || nowIso(),
    reviewedAt: q.reviewedAt || null
  };
}

function normalizeDb(raw) {
  const categories = Array.isArray(raw && raw.categories) ? raw.categories : [];
  const questions = Array.isArray(raw && raw.questions) ? raw.questions : [];
  const cats = categories.map(function (c, i) {
    return {
      id: typeof c.id === "string" ? c.id : makeId("c"),
      code: String(c.code || "??").toUpperCase().slice(0, 4),
      title: String(c.title || "Untitled"),
      order: Number.isFinite(c.order) ? c.order : i,
      createdAt: c.createdAt || nowIso()
    };
  });
  const known = new Set(cats.map(function (c) { return c.id; }));
  return {
    version: 1,
    createdAt: (raw && raw.createdAt) || nowIso(),
    categories: cats,
    questions: questions.map(normalizeQuestion).filter(function (q) {
      return known.has(q.categoryId) && q.text.trim() !== "";
    })
  };
}

function loadDb() {
  ensureDirs();
  if (!fs.existsSync(DB_FILE)) {
    const seeded = buildSeedDb(makeId);
    fs.writeFileSync(DB_FILE, JSON.stringify(seeded, null, 2) + "\n", "utf8");
    console.log("Created " + DB_FILE + " with the starter question set.");
    return seeded;
  }
  const text = fs.readFileSync(DB_FILE, "utf8");
  return normalizeDb(JSON.parse(text));
}

function persist() {
  const snapshot = JSON.stringify(db, null, 2) + "\n";
  writeChain = writeChain.then(async function () {
    const tmp = DB_FILE + "." + process.pid + ".tmp";
    await fsp.writeFile(tmp, snapshot, "utf8");
    await fsp.rename(tmp, DB_FILE);
  }).catch(function (err) {
    console.error("Failed to write db.json:", err);
  });
  return writeChain;
}

async function backup(label) {
  try {
    const stamp = nowIso().replace(/[:.]/g, "-");
    const name = "db-" + stamp + (label ? "-" + label : "") + ".json";
    await fsp.writeFile(path.join(BACKUP_DIR, name), JSON.stringify(db, null, 2) + "\n", "utf8");
    const files = (await fsp.readdir(BACKUP_DIR)).filter(function (f) { return f.endsWith(".json"); }).sort();
    for (const stale of files.slice(0, Math.max(0, files.length - MAX_BACKUPS))) {
      await fsp.unlink(path.join(BACKUP_DIR, stale)).catch(function () {});
    }
  } catch (err) {
    console.error("Backup failed:", err);
  }
}



function categoryById(id) {
  return db.categories.find(function (c) { return c.id === id; }) || null;
}

function questionById(id) {
  return db.questions.find(function (q) { return q.id === id; }) || null;
}

function uniqueCode(desired, ignoreId) {
  let base = String(desired || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  if (!base) base = "CAT";
  const taken = new Set(db.categories.filter(function (c) { return c.id !== ignoreId; })
    .map(function (c) { return c.code; }));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 100; i++) {
    const candidate = (base.slice(0, 3) + i);
    if (!taken.has(candidate)) return candidate;
  }
  return base + Date.now().toString(36).slice(-2).toUpperCase();
}



function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    let size = 0;
    const chunks = [];
    req.on("data", function (chunk) {
      size += chunk.length;
      if (size > 8 * 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", function () {
      const text = Buffer.concat(chunks).toString("utf8");
      if (!text.trim()) return resolve({});
      try { resolve(JSON.parse(text)); } catch (err) { reject(new Error("Invalid JSON body")); }
    });
    req.on("error", reject);
  });
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

async function serveStatic(req, res, pathname) {
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const target = path.resolve(PUBLIC_DIR, rel);
  if (target !== PUBLIC_DIR && !target.startsWith(PUBLIC_DIR + path.sep)) {
    return sendJson(res, 403, { error: "Forbidden" });
  }
  try {
    const data = await fsp.readFile(target);
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(target)] || "application/octet-stream",
      "Content-Length": data.length,
      "Cache-Control": "no-cache"
    });
    res.end(data);
  } catch (err) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

/* -------------------------------------------------------------------- api */

async function handleApi(req, res, pathname) {
  const method = req.method;
  const parts = pathname.split("/").filter(Boolean); // ["api", ...]
  const seg = parts.slice(1);

  // GET /api/db
  if (method === "GET" && seg.length === 1 && seg[0] === "db") {
    return sendJson(res, 200, db);
  }

  // POST /api/categories
  if (method === "POST" && seg.length === 1 && seg[0] === "categories") {
    const body = await readBody(req);
    const title = String(body.title || "").trim();
    if (!title) return sendJson(res, 400, { error: "A title is required" });
    const cat = {
      id: makeId("c"),
      code: uniqueCode(body.code || title.replace(/[^A-Za-z0-9]/g, "").slice(0, 2), null),
      title: title,
      order: db.categories.length,
      createdAt: nowIso()
    };
    db.categories.push(cat);
    await persist();
    return sendJson(res, 201, cat);
  }

  // PATCH/DELETE /api/categories/:id
  if (seg.length === 2 && seg[0] === "categories") {
    const cat = categoryById(seg[1]);
    if (!cat) return sendJson(res, 404, { error: "Category not found" });

    if (method === "PATCH") {
      const body = await readBody(req);
      if (typeof body.title === "string" && body.title.trim()) cat.title = body.title.trim();
      if (typeof body.code === "string" && body.code.trim()) cat.code = uniqueCode(body.code, cat.id);
      if (Number.isFinite(body.order)) cat.order = body.order;
      await persist();
      return sendJson(res, 200, cat);
    }

    if (method === "DELETE") {
      await backup("before-delete-category");
      const removed = db.questions.filter(function (q) { return q.categoryId === cat.id; }).length;
      db.questions = db.questions.filter(function (q) { return q.categoryId !== cat.id; });
      db.categories = db.categories.filter(function (c) { return c.id !== cat.id; });
      await persist();
      return sendJson(res, 200, { ok: true, removedQuestions: removed });
    }
  }

  // POST /api/questions
  if (method === "POST" && seg.length === 1 && seg[0] === "questions") {
    const body = await readBody(req);
    const text = String(body.text || "").trim();
    if (!text) return sendJson(res, 400, { error: "Question text is required" });
    if (!categoryById(body.categoryId)) return sendJson(res, 400, { error: "Unknown category" });
    const siblings = db.questions.filter(function (q) { return q.categoryId === body.categoryId; });
    const q = normalizeQuestion({
      categoryId: body.categoryId,
      text: text,
      answer: typeof body.answer === "string" ? body.answer : "",
      status: body.status,
      starred: body.starred,
      order: siblings.length
    });
    db.questions.push(q);
    await persist();
    return sendJson(res, 201, q);
  }

  // PATCH/DELETE /api/questions/:id
  if (seg.length === 2 && seg[0] === "questions") {
    const q = questionById(seg[1]);
    if (!q) return sendJson(res, 404, { error: "Question not found" });

    if (method === "PATCH") {
      const body = await readBody(req);
      if (typeof body.text === "string" && body.text.trim()) q.text = body.text.trim();
      if (typeof body.answer === "string") q.answer = body.answer;
      if (body.status === "todo" || body.status === "reviewed") {
        q.status = body.status;
        q.reviewedAt = body.status === "reviewed" ? nowIso() : null;
      }
      if (typeof body.starred === "boolean") q.starred = body.starred;
      if (typeof body.categoryId === "string" && categoryById(body.categoryId)) q.categoryId = body.categoryId;
      q.updatedAt = nowIso();
      await persist();
      return sendJson(res, 200, q);
    }

    if (method === "DELETE") {
      db.questions = db.questions.filter(function (item) { return item.id !== q.id; });
      await persist();
      return sendJson(res, 200, { ok: true });
    }
  }

  // POST /api/reset-progress
  if (method === "POST" && seg.length === 1 && seg[0] === "reset-progress") {
    await backup("before-reset");
    const body = await readBody(req);
    const wipeAnswers = body.wipeAnswers === true;
    db.questions.forEach(function (q) {
      q.status = "todo";
      q.reviewedAt = null;
      if (wipeAnswers) q.answer = "";
      q.updatedAt = nowIso();
    });
    await persist();
    return sendJson(res, 200, { ok: true });
  }

  // POST /api/import  -- replace the whole database with an uploaded export
  if (method === "POST" && seg.length === 1 && seg[0] === "import") {
    const body = await readBody(req);
    let incoming;
    try {
      incoming = normalizeDb(body && body.db ? body.db : body);
    } catch (err) {
      return sendJson(res, 400, { error: "That file is not a valid export" });
    }
    if (!incoming.categories.length) return sendJson(res, 400, { error: "Export contains no categories" });
    await backup("before-import");
    db = incoming;
    await persist();
    return sendJson(res, 200, db);
  }

  return sendJson(res, 404, { error: "No such endpoint" });
}

/* ----------------------------------------------------------------- server */

db = loadDb();

const server = http.createServer(function (req, res) {
  const url = new URL(req.url, "http://localhost");
  const pathname = decodeURIComponent(url.pathname);

  if (pathname.startsWith("/api/")) {
    handleApi(req, res, pathname).catch(function (err) {
      console.error(err);
      sendJson(res, 500, { error: err.message || "Server error" });
    });
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  serveStatic(req, res, pathname);
});

// Bind to loopback only: this is a personal app, not something to expose.
server.listen(PORT, "127.0.0.1", function () {
  const counts = db.questions.length + " questions in " + db.categories.length + " categories";
  console.log("");
  console.log("  Drills is running at  http://localhost:" + PORT);
  console.log("  Database file:        " + DB_FILE);
  console.log("  Loaded:               " + counts);
  console.log("");
  console.log("  Leave this window open while you study. Ctrl+C to stop.");
  console.log("");

  // Open the browser on start. Set NO_OPEN=1 to skip.
  if (!process.env.NO_OPEN) {
    const url = "http://localhost:" + PORT;
    const opener = process.platform === "win32" ? 'start "" "' + url + '"'
                 : process.platform === "darwin" ? 'open "' + url + '"'
                 : 'xdg-open "' + url + '"';
    require("child_process").exec(opener, function () {});
  }
});

server.on("error", function (err) {
  if (err.code === "EADDRINUSE") {
    console.error("Port " + PORT + " is already in use. Try:  PORT=4322 npm start");
    process.exit(1);
  }
  throw err;
});
