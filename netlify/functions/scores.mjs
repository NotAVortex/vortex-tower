import { getStore } from "@netlify/blobs";

const KEYS = { normal: "top", hard: "hard", endless: "endless" };

export default async (req) => {
  const store = getStore("leaderboard");

  if (req.method === "POST") {
    const b = await req.json();
    const mode = KEYS[b.mode] ? b.mode : "normal";
    const key = KEYS[mode];
    const name = String(b.name || "Anon").slice(0, 16).replace(/[<>]/g, "");
    const score = Math.max(0, Math.min(1e9, Math.floor(Number(b.score) || 0)));
    const list = (await store.get(key, { type: "json" })) || [];
    const entry = { name, score, mode, wave: Number(b.wave) || 1, date: Date.now() };
    const i = list.findIndex((t) => String(t.name).toLowerCase() === name.toLowerCase());
    if (i >= 0) {
      // one entry per name: only replace it if the new score is better
      if (score > list[i].score) list[i] = entry;
    } else {
      list.push(entry);
    }
    list.sort((a, c) => c.score - a.score);
    await store.setJSON(key, list.slice(0, 50));
    return Response.json({ ok: true });
  }

  const requested = new URL(req.url).searchParams.get("mode");
  const mode = KEYS[requested] ? requested : "normal";
  const list = (await store.get(KEYS[mode], { type: "json" })) || [];

  // show each name once with its best score (this also cleans up old duplicates)
  const best = new Map();
  for (const t of list) {
    const k = String(t.name).toLowerCase();
    if (!best.has(k) || t.score > best.get(k).score) best.set(k, t);
  }
  return Response.json([...best.values()].sort((a, c) => c.score - a.score).slice(0, 10));
};

export const config = { path: "/api/scores" };
