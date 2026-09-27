// EconNobel's vote counter, a Cloudflare Worker.
//
//   GET  /results   the vote totals and the five most recent votes
//   POST /vote      save or change a vote: { voter, pick, name, token }
//
// What it stores: a random ID for each browser that votes (made by the page, not linked to a person), who they
// picked, the name they gave (or "Anonymous") and the time. No IP addresses, no emails, no cookies.

const NAME_MAX = 40;                 // longest name shown on the page
const RESULTS_FOR = 20 * 1000;       // reuse the same results for 20 seconds, so busy moments don't re-read the database
const LIST_FOR = 30 * 60 * 1000;     // re-read the list of people every 30 minutes

// Names are shown publicly, so a few words aren't allowed; such names show as "Anonymous".
// The first group also catches longer words starting with them; the second only whole words, so real
// surnames like Fagan or Nazir are fine.
const BLOCKED = /\b(fuck|shit|cunt|bitch|nigg|faggot|retard|whore|slut|hitler|porn)|\b(fag|nazi|rape|rapist|pussy)\b/i;

let cachedResults = null;            // { body, at }
let cachedList = null;               // { eligible: Set of IDs, at }

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (url.pathname === "/results" && request.method === "GET") return reply(await results(env), 200, cors);
    if (url.pathname === "/vote" && request.method === "POST") return vote(request, env, cors);
    return reply({ error: "Not found." }, 404, cors);
  },
};

// ---------- results ----------

async function results(env) {
  if (cachedResults && Date.now() - cachedResults.at < RESULTS_FOR) return cachedResults.body;

  const [totals, recent] = await env.DB.batch([
    env.DB.prepare("SELECT pick, votes FROM totals WHERE votes > 0"),
    env.DB.prepare("SELECT name, pick FROM votes ORDER BY updated_at DESC LIMIT 5"),
  ]);
  const body = {
    open: isOpen(env),
    totals: Object.fromEntries(totals.results.map(row => [row.pick, row.votes])),   // { "pat6": 34, ... }
    recent: recent.results.map(row => [row.name, row.pick]),                         // [["Amara", "pat6"], ...]
  };
  cachedResults = { body, at: Date.now() };
  return body;
}

// ---------- voting ----------

async function vote(request, env, cors) {
  if (!cors["Access-Control-Allow-Origin"]) return reply({ error: "Votes can only come from the poll page." }, 403, cors);
  if (!isOpen(env)) return reply({ error: "Voting has closed." }, 403, cors);

  // At most a few votes a minute from one network. Cloudflare keeps the count; the address isn't stored.
  const network = request.headers.get("CF-Connecting-IP") || "unknown";
  const { success } = await env.VOTE_LIMIT.limit({ key: network });
  if (!success) return reply({ error: "Too many votes from your network. Try again in a minute." }, 429, cors);

  let body;
  try { body = await request.json(); } catch { return reply({ error: "Something went wrong. Try again." }, 400, cors); }
  const voter = String(body.voter || "");
  const pick = String(body.pick || "");
  if (!/^[0-9a-f-]{36}$/.test(voter)) return reply({ error: "Something went wrong. Try again." }, 400, cors);

  // Only people on the list who can still win.
  const eligible = await eligibleIds(env);
  if (eligible ? !eligible.has(pick) : !/^[a-z0-9-]{2,60}$/.test(pick)) {
    return reply({ error: "That person can't be picked." }, 400, cors);
  }

  // Turnstile: Cloudflare's check that a person, not a script, is voting.
  if (!(await isHuman(body.token, env))) {
    return reply({ error: "We couldn't confirm you're not a bot. Try again." }, 403, cors);
  }

  const name = cleanName(body.name);
  const before = await env.DB.prepare("SELECT pick FROM votes WHERE voter = ?").bind(voter).first();

  // Save the vote and update the totals together (all or nothing).
  const steps = [
    env.DB.prepare(
      "INSERT INTO votes (voter, pick, name, updated_at) VALUES (?1, ?2, ?3, ?4) " +
      "ON CONFLICT (voter) DO UPDATE SET pick = ?2, name = ?3, updated_at = ?4"
    ).bind(voter, pick, name, Date.now()),
  ];
  if (!before || before.pick !== pick) {
    steps.push(env.DB.prepare(
      "INSERT INTO totals (pick, votes) VALUES (?, 1) ON CONFLICT (pick) DO UPDATE SET votes = votes + 1"
    ).bind(pick));
    if (before) steps.push(env.DB.prepare("UPDATE totals SET votes = votes - 1 WHERE pick = ?").bind(before.pick));
  }
  await env.DB.batch(steps);

  cachedResults = null;              // so the voter sees their vote counted straight away
  return reply({ ok: true, ...(await results(env)) }, 200, cors);
}

// ---------- helpers ----------

function isOpen(env) {
  return Date.now() < Date.parse(env.CLOSES_AT);
}

// The IDs of everyone who can still be picked, read from the published list (site/candidates.js).
async function eligibleIds(env) {
  if (cachedList && Date.now() - cachedList.at < LIST_FOR) return cachedList.eligible;
  try {
    const text = await (await fetch(env.CANDIDATES_URL)).text();
    const start = text.indexOf("window.CANDIDATES = ") + "window.CANDIDATES = ".length;
    const people = JSON.parse(text.slice(start, text.indexOf(";\n", start)));
    // Each person: [id, name, institution, homepage, RePEc profile, status, ...]
    cachedList = { eligible: new Set(people.filter(p => p[5] === "eligible").map(p => p[0])), at: Date.now() };
  } catch {
    // The list couldn't be read: keep using the last copy, if there is one.
  }
  return cachedList ? cachedList.eligible : null;
}

async function isHuman(token, env) {
  if (!token) return false;
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET);
  form.append("response", String(token));
  try {
    const answer = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    return (await answer.json()).success === true;
  } catch {
    return false;
  }
}

// Names are optional and public: one line, at most 40 characters, no links or email addresses, no blocked words.
function cleanName(raw) {
  const name = String(raw || "")
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NAME_MAX);
  if (!name || /https?:|www\.|@|\.(com|net|org|io|co|ru|xyz)\b/i.test(name) || BLOCKED.test(name)) return "Anonymous";
  return name;
}

// Only the poll page (see ALLOWED_ORIGINS in wrangler.toml) may call this from a browser.
function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = env.ALLOWED_ORIGINS.split(",").map(o => o.trim());
  if (!allowed.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function reply(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
