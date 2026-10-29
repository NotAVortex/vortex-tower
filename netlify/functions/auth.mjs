import { getStore } from "@netlify/blobs";

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
const json = (obj, status = 200) => Response.json(obj, { status });
const store = () => getStore("accounts");

async function hashPass(pass, salt) {
  const key = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" },
    key,
    256
  );
  return hex(bits);
}

async function newSession(name) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  await store().setJSON("session:" + token, { user: name, exp: Date.now() + 30 * 864e5 });
  return token;
}

async function sessionUser(req) {
  const token = (req.headers.get("authorization") || "").replace("Bearer ", "").trim();
  if (!token) return null;
  const sess = await store().get("session:" + token, { type: "json" });
  if (!sess || sess.exp < Date.now()) return null;
  return { token, name: sess.user };
}

export default async (req) => {
  const route = new URL(req.url).pathname.replace("/api/auth/", "");
  const s = store();

  if (req.method === "POST" && (route === "register" || route === "login")) {
    const { user = "", pass = "" } = await req.json();
    const name = String(user).trim();
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(name)) return json({ error: "Name must be 3-16 letters, numbers or _" }, 400);
    if (String(pass).length < 6) return json({ error: "Password must be at least 6 characters" }, 400);
    const key = "user:" + name.toLowerCase();
    const rec = await s.get(key, { type: "json" });

    if (route === "register") {
      if (rec) return json({ error: "That name is taken" }, 409);
      const salt = crypto.randomUUID();
      await s.setJSON(key, { name, salt, hash: await hashPass(pass, salt), save: null });
    } else {
      if (!rec) return json({ error: "No account with that name" }, 404);
      if ((await hashPass(pass, rec.salt)) !== rec.hash) return json({ error: "Wrong password" }, 401);
    }
    return json({ token: await newSession(name), name });
  }

  const me = await sessionUser(req);
  if (!me) return json({ error: "Not logged in" }, 401);
  const key = "user:" + me.name.toLowerCase();

  if (req.method === "GET" && route === "me") {
    const rec = await s.get(key, { type: "json" });
    return json({ name: me.name, save: rec ? rec.save : null });
  }

  if (req.method === "POST" && route === "save") {
    const { save } = await req.json();
    const text = JSON.stringify(save || null);
    if (text.length > 20000) return json({ error: "Save too large" }, 413);
    const rec = await s.get(key, { type: "json" });
    if (!rec) return json({ error: "Account missing" }, 404);
    rec.save = save || null;
    await s.setJSON(key, rec);
    return json({ ok: true });
  }

  if (req.method === "POST" && route === "logout") {
    await s.delete("session:" + me.token);
    return json({ ok: true });
  }

  return json({ error: "Not found" }, 404);
};

export const config = { path: "/api/auth/*" };
