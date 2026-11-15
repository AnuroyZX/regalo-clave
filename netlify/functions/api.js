// API del intercambio de regalos — Regalo Clave
// Grupos reales guardados en Netlify Blobs. El servidor solo revela a cada
// persona su propio amigo secreto: las parejas nunca salen en la vista pública.
// Cuentas con correo + sesiones persistentes: con cuenta vuelves a tus grupos
// desde cualquier dispositivo; sin cuenta eres invitado y solo tu sesión en
// este navegador te identifica (si la pierdes, no hay recuperación).
// Los códigos personales ya no existen: la sesión es tu identidad.
import { getStore } from "@netlify/blobs";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const CODENAMES = [
  "Papá Noel", "Gatito Mimado", "Rodolfo el Reno", "Duende Travieso",
  "Copo de Nieve", "Galleta de Jengibre", "Muñeco de Nieve", "Reno Veloz",
  "Estrella Fugaz", "Campanita Alegre", "Trineo Mágico", "Rey Mago",
  "Nochebuena", "Bastón de Caramelo", "Pino Nevado", "Ángel de la Guarda",
  "Zorro Astuto", "Búho Sabio", "Panda Perezoso", "Koala Dormilón",
  "Pingüino Elegante", "León Valiente", "Mapache Curioso", "Conejito Saltarín",
  "Osito Cariñoso", "Loro Parlanchín", "Ardilla Veloz", "Taco al Pastor",
  "Churro Dulce", "Elote Loco", "Tamal Caliente", "Pan Dulce",
  "Chocolate Abuelita", "Café de Olla", "Flan Casero", "Pozole Caliente",
  "Quesadilla Dorada", "Atole Calientito", "Rosca de Reyes", "Calcetín Sorpresa",
];

// Almacenes: en producción Netlify Blobs; en pruebas locales, memoria.
const memoryStores = new Map();
function store(name = "regalo-clave-groups") {
  if (process.env.BLOBS_TEST === "memory") {
    if (!memoryStores.has(name)) memoryStores.set(name, new Map());
    const map = memoryStores.get(name);
    return {
      get: async (k) => map.get(k) ?? null,
      setJSON: async (k, v) => { map.set(k, v); },
      delete: async (k) => { map.delete(k); },
      list: async () => ({ blobs: [...map.keys()].map((key) => ({ key })) }),
    };
  }
  return getStore(name);
}
async function getJSON(s, key) {
  const v = await s.get(key, { type: "json" }).catch(() => null);
  if (v !== null && v !== undefined) return v;
  const raw = await s.get(key).catch(() => null);
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch { return null; } }
  return raw ?? null;
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const bad = (message, status = 400) => json({ ok: false, error: message }, status);

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
function groupCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}
function pickCodename(used) {
  const free = CODENAMES.filter((c) => !used.has(c));
  if (free.length > 0) return free[Math.floor(Math.random() * free.length)];
  const base = CODENAMES[Math.floor(Math.random() * CODENAMES.length)];
  let n = 2;
  while (used.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

// --- Cuentas y sesiones ---
const SESSION_DAYS = 90;
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}
function verifyPassword(password, stored) {
  try {
    const [, salt, hash] = String(stored).split("$");
    const mine = scryptSync(String(password), salt, 64);
    const theirs = Buffer.from(hash, "hex");
    return mine.length === theirs.length && timingSafeEqual(mine, theirs);
  } catch { return false; }
}
async function createSession(sessions, email) {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  const s = {
    token,
    email: email || null,
    guestId: email ? null : uid(),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_DAYS * 864e5).toISOString(),
  };
  await sessions.setJSON(token, s);
  return s;
}
async function resolveSession(sessions, token) {
  if (!token) return null;
  const s = await getJSON(sessions, String(token));
  if (!s || !s.token) return null;
  if (s.expiresAt && Date.parse(s.expiresAt) < Date.now()) return null;
  return s;
}
// La identidad que posee a un participante: "email:correo@x.com" o "guest:<id>".
function identityOf(session) {
  return session.email ? `email:${session.email.toLowerCase()}` : `guest:${session.guestId}`;
}

// Cierra todas las sesiones de una cuenta (al cambiar la contraseña).
async function revokeSessions(sessions, email) {
  try {
    const listed = await sessions.list();
    for (const item of listed.blobs || []) {
      const s = await getJSON(sessions, item.key);
      if (s?.email === email) await sessions.delete(item.key).catch(() => {});
    }
  } catch {}
}

// Límite de intentos (ventana fija en Blobs): login, registro y reset.
async function limitCheck(limits, key, max, windowMs) {
  const now = Date.now();
  const rec = await getJSON(limits, key);
  if (!rec || now - rec.start > windowMs) return { allowed: true, count: 0 };
  return { allowed: rec.count < max, count: rec.count };
}
async function limitHit(limits, key, windowMs) {
  const now = Date.now();
  let rec = await getJSON(limits, key);
  if (!rec || now - rec.start > windowMs) rec = { count: 0, start: now };
  rec.count++;
  await limits.setJSON(key, rec);
  return rec.count;
}
async function limitReset(limits, key) {
  await limits.delete(key).catch(() => {});
}

// Solo enlaces http(s): nada de javascript:, data: ni otros esquemas.
function isSafeLink(link) {
  return /^https?:\/\/\S+$/i.test(String(link || "").trim());
}

// Escritura guardada de un grupo: re-lee antes de escribir y reintenta si
// otro participante modificó el grupo entre tanto (ventana de carrera mínima).
async function withGroup(groups, code, fn) {
  const key = String(code || "").trim().toUpperCase();
  for (let attempt = 0; attempt < 5; attempt++) {
    const group = await getJSON(groups, key);
    if (!group) return { group: null };
    const readRev = group.rev || 0;
    const result = fn(group);
    if (result && result.abort) return { group, result };
    const fresh = await getJSON(groups, key);
    if (fresh && (fresh.rev || 0) !== readRev) {
      await new Promise((r) => setTimeout(r, 10 + Math.random() * 40));
      continue;
    }
    group.rev = readRev + 1;
    await groups.setJSON(key, group);
    return { group, result };
  }
  return { conflict: true };
}
// Devuelve la identidad de la sesión del cliente; si no hay sesión válida,
// crea una de invitado para que el flujo no se rompa.
async function ensureIdentity(body, sessions) {
  const s = await resolveSession(sessions, body.token);
  if (s) return { identity: identityOf(s), token: s.token, session: s };
  const g = await createSession(sessions, null);
  return { identity: identityOf(g), token: g.token, session: g, created: true };
}

function addParticipant(group, name, tags, owner) {
  const clean = String(name || "").trim().slice(0, 40);
  if (!clean) return null;
  if (group.participants.some((p) => p.name.toLowerCase() === clean.toLowerCase())) return null;
  const usedNames = new Set(group.participants.map((p) => p.codeName));
  const cleanTags = Array.isArray(tags) ? tags.filter((t) => typeof t === "string").map((t) => t.trim().slice(0, 30)).filter(Boolean).slice(0, 6) : [];
  const p = {
    id: uid(),
    name: clean,
    codeName: pickCodename(usedNames),
    personalCode: null, // legado: solo participantes viejos lo tienen
    owner: owner || null,
    tags: cleanTags,
    wishlist: [],
  };
  group.participants.push(p);
  return p;
}
function publicMe(p) {
  return { id: p.id, codeName: p.codeName, tags: p.tags || [] };
}
function findParticipant(group, participantId, identity, personalCode) {
  const p = group.participants.find((x) => x.id === participantId);
  if (!p) return null;
  if (identity && p.owner && p.owner === identity) return p;
  // Legado: participantes de antes de las cuentas se autentican con su
  // código personal y la sesión actual se vuelve su dueña.
  if (personalCode && p.personalCode && String(personalCode) === p.personalCode) {
    if (identity) p.owner = identity;
    return p;
  }
  return null;
}
function isOrganizer(group, identity, organizerToken) {
  if (organizerToken && group.organizerToken && organizerToken === group.organizerToken) return true;
  if (identity && group.organizer && group.organizer === identity) return true;
  return false;
}
function publicGroup(group, identity) {
  return {
    code: group.code,
    name: group.name,
    date: group.date,
    budget: group.budget,
    type: group.type,
    wishlistEnabled: group.wishlistEnabled,
    drawn: group.drawn,
    isOrganizer: identity ? group.organizer === identity : false,
    participants: group.participants.map((p) => ({
      id: p.id,
      codeName: p.codeName,
      tags: p.tags || [],
      wishlistCount: p.wishlist.length,
    })),
  };
}
function drawAssignments(ids) {
  // Derangement: nadie se regala a sí mismo y se evitan parejas mutuas.
  for (let attempt = 0; attempt < 500; attempt++) {
    const shuffled = [...ids].sort(() => Math.random() - 0.5);
    const map = {};
    let ok = true;
    for (let i = 0; i < ids.length; i++) {
      if (shuffled[i] === ids[i]) { ok = false; break; }
      map[ids[i]] = shuffled[i];
    }
    if (!ok) continue;
    for (let i = 0; i < ids.length; i++) {
      if (map[map[ids[i]]] === ids[i]) { ok = false; break; }
    }
    if (ok) return map;
  }
  // Respaldo: rotación simple (nunca auto-regalo, puede haber mutuos).
  const map = {};
  for (let i = 0; i < ids.length; i++) map[ids[i]] = ids[(i + 1) % ids.length];
  return map;
}

export default async (req) => {
  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const action = parts[parts.length - 1];
    const groups = store("regalo-clave-groups");
    const users = store("regalo-clave-users");
    const sessions = store("regalo-clave-sessions");
    const limits = store("regalo-clave-ratelimit");
    const loadGroup = async (code) =>
      await getJSON(groups, String(code || "").trim().toUpperCase());

    // --- Cuentas ---
    if (req.method === "POST" && action === "register") {
      const b = await req.json();
      const email = String(b.email || "").trim().toLowerCase();
      const password = String(b.password || "");
      const name = String(b.name || "").trim().slice(0, 40);
      if (!/^\S+@\S+\.\S+$/.test(email)) return bad("Escribe un correo válido.");
      if (password.length < 6) return bad("La contraseña necesita al menos 6 caracteres.");
      const limited = await limitCheck(limits, `register:${email}`, 3, 3600e3);
      if (!limited.allowed) return bad("Demasiados intentos. Espera una hora.", 429);
      await limitHit(limits, `register:${email}`, 3600e3);
      const existing = await getJSON(users, email);
      if (existing) return bad("Ese correo ya tiene cuenta. Entra con tu contraseña.", 409);
      await users.setJSON(email, { email, name, hash: hashPassword(password), createdAt: new Date().toISOString() });
      const s = await createSession(sessions, email);
      return json({ ok: true, token: s.token, email, name });
    }

    if (req.method === "POST" && action === "login") {
      const b = await req.json();
      const email = String(b.email || "").trim().toLowerCase();
      const password = String(b.password || "");
      const limited = await limitCheck(limits, `login:${email}`, 5, 15 * 60e3);
      if (!limited.allowed) return bad("Demasiados intentos fallidos. Espera 15 minutos.", 429);
      const user = await getJSON(users, email);
      if (!user || !verifyPassword(password, user.hash)) {
        await limitHit(limits, `login:${email}`, 15 * 60e3);
        return bad("Correo o contraseña incorrectos.", 401);
      }
      await limitReset(limits, `login:${email}`);
      const s = await createSession(sessions, email);
      return json({ ok: true, token: s.token, email, name: user.name || "" });
    }

    if (req.method === "POST" && action === "guest") {
      const s = await createSession(sessions, null);
      return json({ ok: true, token: s.token, guestId: s.guestId });
    }

    if (req.method === "GET" && action === "session") {
      const s = await resolveSession(sessions, url.searchParams.get("token") || "");
      if (!s) return bad("Sesión no válida.", 401);
      let name = "";
      if (s.email) {
        const user = await getJSON(users, s.email);
        name = user?.name || "";
      }
      return json({ ok: true, email: s.email, name, guestId: s.guestId });
    }

    if (req.method === "POST" && action === "logout") {
      const b = await req.json();
      if (b.token) await sessions.delete(String(b.token)).catch(() => {});
      return json({ ok: true });
    }

    if (req.method === "POST" && action === "change-password") {
      const b = await req.json();
      const s = await resolveSession(sessions, b.token);
      if (!s || !s.email) return bad("Sesión no válida.", 401);
      const user = await getJSON(users, s.email);
      if (!user || !verifyPassword(b.currentPassword || "", user.hash)) return bad("La contraseña actual no coincide.", 401);
      const next = String(b.newPassword || "");
      if (next.length < 6) return bad("La nueva contraseña necesita al menos 6 caracteres.");
      user.hash = hashPassword(next);
      await users.setJSON(s.email, user);
      await revokeSessions(sessions, s.email);
      return json({ ok: true });
    }

    // --- Restablecer contraseña por correo (Resend) ---
    async function sendResetEmail(to, link) {
      const key = process.env.RESEND_API_KEY;
      const from = process.env.RESEND_FROM || "Regalo Clave <onboarding@resend.dev>";
      if (!key) return { ok: false, error: "missing_key" };
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from,
            to,
            subject: "Restablece tu contraseña de Regalo Clave 🎄",
            html: `<p>¡Hola!</p><p>Pediste restablecer tu contraseña de Regalo Clave. Toca el botón para elegir una nueva (vale 1 hora):</p><p><a href="${link}" style="display:inline-block;background:#b91c1c;color:#fff;padding:12px 22px;border-radius:12px;text-decoration:none;font-weight:bold">Restablecer mi contraseña</a></p><p>O copia este enlace: ${link}</p><p>Si no pediste esto, ignora este correo.</p>`,
          }),
        });
        return { ok: res.ok };
      } catch { return { ok: false, error: "send_failed" }; }
    }

    if (req.method === "POST" && action === "reset-request") {
      const b = await req.json();
      const email = String(b.email || "").trim().toLowerCase();
      const resets = store("regalo-clave-resets");
      const user = /^\S+@\S+\.\S+$/.test(email) ? await getJSON(users, email) : null;
      if (user) {
        const limited = await limitCheck(limits, `reset:${email}`, 3, 3600e3);
        if (limited.allowed) {
          await limitHit(limits, `reset:${email}`, 3600e3);
          const token = randomBytes(32).toString("hex");
          await resets.setJSON(token, { email, expiresAt: new Date(Date.now() + 3600e3).toISOString() });
          const base = (process.env.URL || "https://regalo-clave.netlify.app").replace(/\/$/, "");
          await sendResetEmail(email, `${base}/?reset=${token}`);
        }
      }
      // Siempre responde igual, tenga o no cuenta el correo, para no revelar nada.
      return json({ ok: true });
    }

    if (req.method === "POST" && action === "reset-password") {
      const b = await req.json();
      const token = String(b.token || "");
      const next = String(b.newPassword || "");
      if (next.length < 6) return bad("La nueva contraseña necesita al menos 6 caracteres.");
      const resets = store("regalo-clave-resets");
      const rec = await getJSON(resets, token);
      if (!rec || !rec.email) return bad("El enlace ya no es válido. Pide uno nuevo.", 400);
      if (Date.parse(rec.expiresAt) < Date.now()) { await resets.delete(token).catch(() => {}); return bad("El enlace caducó. Pide uno nuevo.", 400); }
      const user = await getJSON(users, rec.email);
      if (!user) return bad("El enlace ya no es válido.", 400);
      user.hash = hashPassword(next);
      await users.setJSON(rec.email, user);
      await resets.delete(token).catch(() => {});
      // Cierra las sesiones de esa cuenta: hay que entrar de nuevo.
      await revokeSessions(sessions, rec.email);
      return json({ ok: true });
    }

    // Mis grupos: para volver a entrar desde otro dispositivo con mi cuenta.
    if (req.method === "GET" && action === "mygroups") {
      const s = await resolveSession(sessions, url.searchParams.get("token") || "");
      if (!s) return bad("Sesión no válida.", 401);
      const identity = identityOf(s);
      const listed = await groups.list();
      const mine = [];
      for (const item of listed.blobs || []) {
        const g = await getJSON(groups, item.key);
        if (!g) continue;
        const p = g.participants.find((x) => x.owner === identity);
        if (p) mine.push({ code: g.code, name: g.name, date: g.date, drawn: g.drawn, participantId: p.id, codeName: p.codeName });
      }
      return json({ ok: true, groups: mine });
    }

    // --- Grupos ---
    if (req.method === "POST" && action === "create") {
      const b = await req.json();
      const name = String(b.name || "").trim().slice(0, 60);
      const organizerName = String(b.organizerName || "").trim().slice(0, 40);
      if (!name || !organizerName) return bad("Falta el nombre del grupo o tu nombre.");
      const { identity, token } = await ensureIdentity(b, sessions);
      const group = {
        code: groupCode(),
        name,
        date: String(b.date || ""),
        budget: Number(b.budget) || 0,
        type: ["regalos", "cartas", "ambos"].includes(b.type) ? b.type : "ambos",
        wishlistEnabled: b.wishlistEnabled !== false,
        organizerToken: uid(),
        organizer: identity,
        participants: [],
        assignments: {},
        drawn: false,
        rev: 0,
        createdAt: new Date().toISOString(),
      };
      const me = addParticipant(group, organizerName, b.organizerTags, identity);
      await groups.setJSON(group.code, group);
      return json({ ok: true, group: publicGroup(group, identity), me: publicMe(me), organizerToken: group.organizerToken, sessionToken: token });
    }

    if (req.method === "POST" && action === "join") {
      const b = await req.json();
      const code = String(b.code || "").trim().toUpperCase();
      const group = await loadGroup(code);
      if (!group) return bad("No encontré un grupo con ese código.", 404);
      if (group.drawn) return bad("El sorteo ya se hizo, ya no se puede unir nadie.");
      const { identity, token } = await ensureIdentity(b, sessions);
      const done = await withGroup(groups, code, (group) => {
        if (group.drawn) return { abort: true, error: "El sorteo ya se hizo, ya no se puede unir nadie." };
        // Volver a entrar: si esta sesión/cuenta ya está en el grupo, devuelve
        // su participante en vez de crear uno duplicado.
        const existing = group.participants.find((p) => p.owner === identity);
        if (existing) return { me: publicMe(existing), rejoined: true };
        const me = addParticipant(group, b.name, b.tags, identity);
        if (!me) return { abort: true, error: "Ese nombre ya está en el grupo o está vacío." };
        return { me: publicMe(me) };
      });
      if (done.conflict) return bad("El grupo cambió justo ahora. Inténtalo de nuevo.", 409);
      if (!done.group) return bad("No encontré un grupo con ese código.", 404);
      if (done.result?.abort) return bad(done.result.error, 400);
      return json({ ok: true, group: publicGroup(done.group, identity), me: done.result.me, sessionToken: token, rejoined: !!done.result.rejoined });
    }

    if (req.method === "GET" && action === "group") {
      const group = await loadGroup(url.searchParams.get("code") || "");
      if (!group) return bad("No encontré un grupo con ese código.", 404);
      const s = await resolveSession(sessions, url.searchParams.get("session") || "");
      const identity = s ? identityOf(s) : null;
      return json({ ok: true, group: publicGroup(group, identity) });
    }

    if (req.method === "GET" && action === "organizer") {
      const code = (url.searchParams.get("code") || "").toUpperCase();
      const group = await loadGroup(code);
      if (!group) return bad("No encontré un grupo con ese código.", 404);
      const s = await resolveSession(sessions, url.searchParams.get("session") || "");
      const identity = s ? identityOf(s) : null;
      if (!isOrganizer(group, identity, url.searchParams.get("token") || "")) return bad("No autorizado.", 403);
      return json({ ok: true, group: { ...publicGroup(group, identity), names: group.participants.map((p) => ({ id: p.id, name: p.name, codeName: p.codeName })) } });
    }

    if (req.method === "POST" && action === "wish") {
      const b = await req.json();
      const text = String(b.text || "").trim().slice(0, 120);
      if (!text) return bad("Escribe tu deseo.");
      const link = String(b.link || "").trim().slice(0, 300);
      if (link && !isSafeLink(link)) return bad("El enlace debe empezar por http:// o https://.", 400);
      const s = await resolveSession(sessions, b.token);
      const identity = s ? identityOf(s) : null;
      const done = await withGroup(groups, b.code, (group) => {
        if (!group.wishlistEnabled) return { abort: true, error: "La lista de deseos está desactivada en este grupo." };
        const p = findParticipant(group, b.participantId, identity, b.personalCode);
        if (!p) return { abort: true, error: "Sesión no válida. Vuelve a entrar al grupo.", status: 403 };
        p.wishlist.push({
          id: uid(),
          text,
          link,
          price: String(b.price || "").trim().slice(0, 30),
        });
        return { wishlist: p.wishlist };
      });
      if (done.conflict) return bad("El grupo cambió justo ahora. Inténtalo de nuevo.", 409);
      if (!done.group) return bad("Grupo no encontrado.", 404);
      if (done.result?.abort) return bad(done.result.error, done.result.status || 400);
      return json({ ok: true, group: publicGroup(done.group, identity), wishlist: done.result.wishlist });
    }

    if (req.method === "POST" && action === "mywishes") {
      const b = await req.json();
      const group = await loadGroup(b.code);
      if (!group) return bad("Grupo no encontrado.", 404);
      const s = await resolveSession(sessions, b.token);
      const p = findParticipant(group, b.participantId, s ? identityOf(s) : null, b.personalCode);
      if (!p) return bad("Sesión no válida. Vuelve a entrar al grupo.", 403);
      await groups.setJSON(group.code, group); // guarda la adopción de legado
      return json({ ok: true, wishlist: p.wishlist });
    }

    if (req.method === "POST" && action === "draw") {
      const b = await req.json();
      const group = await loadGroup(b.code);
      if (!group) return bad("Grupo no encontrado.", 404);
      const s = await resolveSession(sessions, b.token);
      const identity = s ? identityOf(s) : null;
      if (!isOrganizer(group, identity, b.organizerToken)) return bad("No autorizado.", 403);
      if (group.drawn) return bad("El sorteo ya se hizo.", 400);
      if (group.participants.length < 3) return bad("Se necesitan al menos 3 participantes.");
      const done = await withGroup(groups, b.code, (g) => {
        if (g.drawn) return { abort: true, error: "El sorteo ya se hizo." };
        g.assignments = drawAssignments(g.participants.map((p) => p.id));
        g.drawn = true;
        return {};
      });
      if (done.conflict) return bad("El grupo cambió justo ahora. Inténtalo de nuevo.", 409);
      if (done.result?.abort) return bad(done.result.error, 400);
      return json({ ok: true, group: publicGroup(done.group, identity) });
    }

    if (req.method === "POST" && action === "reveal") {
      const b = await req.json();
      const group = await loadGroup(b.code);
      if (!group) return bad("Grupo no encontrado.", 404);
      if (!group.drawn) return bad("El sorteo aún no se hace.");
      const s = await resolveSession(sessions, b.token);
      const me = findParticipant(group, b.participantId, s ? identityOf(s) : null, b.personalCode);
      if (!me) return bad("Sesión no válida. Vuelve a entrar al grupo.", 403);
      await groups.setJSON(group.code, group); // guarda la adopción de legado
      const recipient = group.participants.find((x) => x.id === group.assignments[me.id]);
      if (!recipient) return bad("No tienes asignación.", 404);
      return json({
        ok: true,
        recipient: {
          codeName: recipient.codeName,
          tags: recipient.tags || [],
          wishlist: recipient.wishlist,
          wishlistEnabled: group.wishlistEnabled,
        },
        budget: group.budget,
        date: group.date,
        type: group.type,
      });
    }

    if (req.method === "POST" && action === "settings") {
      const b = await req.json();
      const group = await loadGroup(b.code);
      if (!group) return bad("Grupo no encontrado.", 404);
      const s = await resolveSession(sessions, b.token);
      const identity = s ? identityOf(s) : null;
      if (!isOrganizer(group, identity, b.organizerToken)) return bad("No autorizado.", 403);
      const done = await withGroup(groups, b.code, (g) => {
        if (typeof b.wishlistEnabled === "boolean") g.wishlistEnabled = b.wishlistEnabled;
        return {};
      });
      if (done.conflict) return bad("El grupo cambió justo ahora. Inténtalo de nuevo.", 409);
      return json({ ok: true, group: publicGroup(done.group, identity) });
    }

    return bad("Acción no válida.", 404);
  } catch (e) {
    return bad("Error del servidor: " + (e?.message || "desconocido"), 500);
  }
};
