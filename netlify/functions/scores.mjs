import { getStore } from "@netlify/blobs";

export default async (req) => {
  const store = getStore("leaderboard");

  if (req.method === "POST") {
    const b = await req.json();
    const mode = b.mode === "hard" ? "hard" : "normal";
    const name = String(b.name || "Anon").slice(0, 16).replace(/[<>]/g, "");
    const score = Math.max(0, Math.min(1e9, Math.floor(Number(b.score) || 0)));
    const key = mode === "hard" ? "hard" : "top";
    const list = (await store.get(key, { type: "json" })) || [];
    list.push({ name, score, mode, wave: Number(b.wave) || 1, date: Date.now() });
    list.sort((a, c) => c.score - a.score);
    await store.setJSON(key, list.slice(0, 20));
    return Response.json({ ok: true });
  }

  const mode = new URL(req.url).searchParams.get("mode") === "hard" ? "hard" : "normal";
  const key = mode === "hard" ? "hard" : "top";
  const list = (await store.get(key, { type: "json" })) || [];
  return Response.json(list.slice(0, 10));
};

export const config = { path: "/api/scores" };
