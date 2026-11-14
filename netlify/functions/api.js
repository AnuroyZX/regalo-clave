// API del intercambio de regalos — Regalo Clave
// Grupos reales guardados en Netlify Blobs. El servidor solo revela a cada
// persona su propio amigo secreto: las parejas nunca salen en la vista pública.
import { getStore } from "@netlify/blobs";

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

// Almacén: en producción Netlify Blobs; en pruebas locales, memoria.
const memoryStores = new Map();
function store() {
  if (process.env.BLOBS_TEST === "memory") {
    if (!memoryStores.has("groups")) memoryStores.set("groups", new Map());
    const map = memoryStores.get("groups");
    return {
      get: async (k) => map.get(k) ?? null,
      setJSON: async (k, v) => { map.set(k, v); },
    };
  }
  return getStore("regalo-clave-groups");
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
function personalCode(used) {
  let code;
  do { code = String(Math.floor(1000 + Math.random() * 9000)); } while (used.has(code));
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
function addParticipant(group, name, tags) {
  const clean = String(name || "").trim().slice(0, 40);
  if (!clean) return null;
  if (group.participants.some((p) => p.name.toLowerCase() === clean.toLowerCase())) return null;
  const usedNames = new Set(group.participants.map((p) => p.codeName));
  const usedCodes = new Set(group.participants.map((p) => p.personalCode));
  const cleanTags = Array.isArray(tags) ? tags.filter((t) => typeof t === "string").map((t) => t.trim().slice(0, 30)).filter(Boolean).slice(0, 6) : [];
  const p = {
    id: uid(),
    name: clean,
    codeName: pickCodename(usedNames),
    personalCode: personalCode(usedCodes),
    tags: cleanTags,
    wishlist: [],
  };
  group.participants.push(p);
  return p;
}
function publicGroup(group) {
  return {
    code: group.code,
    name: group.name,
    date: group.date,
    budget: group.budget,
    type: group.type,
    wishlistEnabled: group.wishlistEnabled,
    drawn: group.drawn,
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
    const s = store();

    if (req.method === "POST" && action === "create") {
      const b = await req.json();
      const name = String(b.name || "").trim().slice(0, 60);
      const organizerName = String(b.organizerName || "").trim().slice(0, 40);
      if (!name || !organizerName) return bad("Falta el nombre del grupo o tu nombre.");
      const group = {
        code: groupCode(),
        name,
        date: String(b.date || ""),
        budget: Number(b.budget) || 0,
        type: ["regalos", "cartas", "ambos"].includes(b.type) ? b.type : "ambos",
        wishlistEnabled: b.wishlistEnabled !== false,
        organizerToken: uid(),
        participants: [],
        assignments: {},
        drawn: false,
        createdAt: new Date().toISOString(),
      };
      const me = addParticipant(group, organizerName, b.organizerTags);
      await s.setJSON(group.code, group);
      return json({ ok: true, group: publicGroup(group), me, organizerToken: group.organizerToken });
    }

    if (req.method === "POST" && action === "join") {
      const b = await req.json();
      const code = String(b.code || "").trim().toUpperCase();
      const group = await s.get(code, { type: "json" }).catch(() => null) ?? (await s.get(code));
      if (!group) return bad("No encontré un grupo con ese código.", 404);
      if (group.drawn) return bad("El sorteo ya se hizo, ya no se puede unir nadie.");
      const me = addParticipant(group, b.name, b.tags);
      if (!me) return bad("Ese nombre ya está en el grupo o está vacío.");
      await s.setJSON(group.code, group);
      return json({ ok: true, group: publicGroup(group), me });
    }

    if (req.method === "GET" && action === "group") {
      const code = (url.searchParams.get("code") || "").toUpperCase();
      const group = await s.get(code, { type: "json" }).catch(() => null) ?? (await s.get(code));
      if (!group) return bad("No encontré un grupo con ese código.", 404);
      return json({ ok: true, group: publicGroup(group) });
    }

    if (req.method === "GET" && action === "organizer") {
      const code = (url.searchParams.get("code") || "").toUpperCase();
      const token = url.searchParams.get("token") || "";
      const group = await s.get(code, { type: "json" }).catch(() => null) ?? (await s.get(code));
      if (!group || group.organizerToken !== token) return bad("No autorizado.", 403);
      return json({ ok: true, group: { ...publicGroup(group), names: group.participants.map((p) => ({ id: p.id, name: p.name, codeName: p.codeName })) } });
    }

    if (req.method === "POST" && action === "wish") {
      const b = await req.json();
      const code = String(b.code || "").trim().toUpperCase();
      const group = await s.get(code, { type: "json" }).catch(() => null) ?? (await s.get(code));
      if (!group) return bad("Grupo no encontrado.", 404);
      if (!group.wishlistEnabled) return bad("La lista de deseos está desactivada en este grupo.");
      const p = group.participants.find((x) => x.id === b.participantId && x.personalCode === String(b.personalCode || ""));
      if (!p) return bad("Código personal incorrecto.", 403);
      const text = String(b.text || "").trim().slice(0, 120);
      if (!text) return bad("Escribe tu deseo.");
      p.wishlist.push({
        id: uid(),
        text,
        link: String(b.link || "").trim().slice(0, 300),
        price: String(b.price || "").trim().slice(0, 30),
      });
      await s.setJSON(group.code, group);
      return json({ ok: true, group: publicGroup(group), wishlist: p.wishlist });
    }

    if (req.method === "POST" && action === "mywishes") {
      const b = await req.json();
      const code = String(b.code || "").trim().toUpperCase();
      const group = await s.get(code, { type: "json" }).catch(() => null) ?? (await s.get(code));
      if (!group) return bad("Grupo no encontrado.", 404);
      const p = group.participants.find((x) => x.id === b.participantId && x.personalCode === String(b.personalCode || ""));
      if (!p) return bad("Código personal incorrecto.", 403);
      return json({ ok: true, wishlist: p.wishlist });
    }

    if (req.method === "POST" && action === "draw") {
      const b = await req.json();
      const code = String(b.code || "").trim().toUpperCase();
      const group = await s.get(code, { type: "json" }).catch(() => null) ?? (await s.get(code));
      if (!group || group.organizerToken !== b.organizerToken) return bad("No autorizado.", 403);
      if (group.participants.length < 3) return bad("Se necesitan al menos 3 participantes.");
      group.assignments = drawAssignments(group.participants.map((p) => p.id));
      group.drawn = true;
      await s.setJSON(group.code, group);
      return json({ ok: true, group: publicGroup(group) });
    }

    if (req.method === "POST" && action === "reveal") {
      const b = await req.json();
      const code = String(b.code || "").trim().toUpperCase();
      const group = await s.get(code, { type: "json" }).catch(() => null) ?? (await s.get(code));
      if (!group) return bad("Grupo no encontrado.", 404);
      if (!group.drawn) return bad("El sorteo aún no se hace.");
      const me = group.participants.find((x) => x.id === b.participantId && x.personalCode === String(b.personalCode || ""));
      if (!me) return bad("Código personal incorrecto.", 403);
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
      const code = String(b.code || "").trim().toUpperCase();
      const group = await s.get(code, { type: "json" }).catch(() => null) ?? (await s.get(code));
      if (!group || group.organizerToken !== b.organizerToken) return bad("No autorizado.", 403);
      if (typeof b.wishlistEnabled === "boolean") group.wishlistEnabled = b.wishlistEnabled;
      await s.setJSON(group.code, group);
      return json({ ok: true, group: publicGroup(group) });
    }

    return bad("Acción no válida.", 404);
  } catch (e) {
    return bad("Error del servidor: " + (e?.message || "desconocido"), 500);
  }
};
