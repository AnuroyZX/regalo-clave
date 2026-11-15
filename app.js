// Regalo Clave — cliente
const API = "/.netlify/functions/api";
const $ = (id) => document.getElementById(id);
const ME_KEY = "rc_me_v1";

const TASTES = [
  { icon: "🎧", label: "Tecnología" },
  { icon: "🍳", label: "Cocina" },
  { icon: "📚", label: "Libros" },
  { icon: "⚽", label: "Deportes" },
  { icon: "💄", label: "Belleza" },
  { icon: "🎲", label: "Juegos" },
  { icon: "🎵", label: "Música" },
  { icon: "🏠", label: "Hogar" },
  { icon: "🐾", label: "Mascotas" },
  { icon: "✈️", label: "Viajes" },
  { icon: "🎨", label: "Arte" },
  { icon: "💪", label: "Fitness" },
];

// Catálogo de la tienda: foto, precio, descripción y gustos que cubre.
// La imagen es ilustrativa; el botón agrega el producto a tu lista de deseos.
const PRODUCTS = [
  { id: "taza", name: "Taza navideña de cerámica", price: "$199", desc: "Taza grande con diseño festivo, ideal con chocolate caliente.", img: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400&q=80", tags: ["Cocina", "Hogar"], query: "taza navideña cerámica" },
  { id: "audifonos", name: "Audífonos inalámbricos", price: "$899", desc: "Sonido claro, batería para todo el día y estuche de carga.", img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80", tags: ["Tecnología", "Música"], query: "audífonos inalámbricos bluetooth" },
  { id: "reloj", name: "Reloj clásico de pulsera", price: "$1,299", desc: "Elegante y para todos los días, con correa de piel.", img: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80", tags: ["Tecnología", "Viajes"], query: "reloj clásico hombre mujer" },
  { id: "libro", name: "Libro sorpresa de temporada", price: "$299", desc: "Una novela ligera para leer junto al árbol.", img: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&q=80", tags: ["Libros"], query: "libros novela regalo" },
  { id: "tenis", name: "Tenis deportivos rojos", price: "$1,499", desc: "Cómodos para correr o para el día a día, color que destaca.", img: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80", tags: ["Deportes", "Fitness"], query: "tenis deportivos rojos" },
  { id: "mochila", name: "Mochila urbana resistente", price: "$749", desc: "Con compartimento para laptop y bolsillos secretos.", img: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=80", tags: ["Viajes", "Deportes"], query: "mochila urbana laptop" },
  { id: "camara", name: "Cámara instantánea", price: "$2,199", desc: "Fotos al instante para pegar en el refri y recordar el día.", img: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&q=80", tags: ["Tecnología", "Viajes", "Arte"], query: "cámara instantánea fotos" },
  { id: "perfume", name: "Perfume fresco unisex", price: "$649", desc: "Aroma suave para todos los días, frasco elegante.", img: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=400&q=80", tags: ["Belleza"], query: "perfume unisex regalo" },
  { id: "lentes", name: "Lentes de sol clásicos", price: "$499", desc: "Protección UV con estilo que combina con todo.", img: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&q=80", tags: ["Viajes", "Fitness"], query: "lentes de sol clásicos" },
  { id: "cocina", name: "Kit de cocina para principiantes", price: "$599", desc: "Utensilios esenciales para estrenar la cocina.", img: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=400&q=80", tags: ["Cocina", "Hogar"], query: "kit utensilios cocina regalo" },
  { id: "planta", name: "Planta de interior en maceta", price: "$249", desc: "Fácil de cuidar, alegra cualquier rincón de la casa.", img: "https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=400&q=80", tags: ["Hogar"], query: "planta interior maceta regalo" },
  { id: "smartwatch", name: "Reloj inteligente deportivo", price: "$1,899", desc: "Mide pasos, sueño y ritmo cardiaco, con notificaciones.", img: "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=400&q=80", tags: ["Tecnología", "Deportes", "Fitness"], query: "reloj inteligente smartwatch" },
];

let group = null;      // estado público del grupo
let me = null;         // { participantId, codeName, organizerToken?, personalCode? (legado) }
let session = null;    // { token, email, name, guest } — tu sesión persistente
let resetToken = "";   // token de restablecer contraseña (?reset=...)
let currentScreen = "screen-welcome";
let pollTimer = null;

const SESSION_KEY = "rc_session_v1";
function saveSessionToken(t) { try { localStorage.setItem(SESSION_KEY, t); } catch {} }
function loadSessionToken() { try { return localStorage.getItem(SESSION_KEY) || ""; } catch { return ""; } }
function sessionToken() { return session?.token || ""; }

// Sesión persistente: si ya tienes sesión guardada, se valida; si no,
// se crea una de invitado. Con cuenta (correo) la sesión te sigue a
// cualquier dispositivo; sin cuenta solo vale en este navegador.
async function ensureSession() {
  const stored = loadSessionToken();
  if (stored) {
    try {
      const data = await api("session", { query: { token: stored } });
      session = { token: stored, email: data.email || "", name: data.name || "", guest: !data.email };
      renderAccount();
      return;
    } catch { /* sesión inválida o expirada: se crea una de invitado */ }
  }
  try {
    const data = await api("guest", { method: "POST", body: {} });
    session = { token: data.token, email: "", name: "", guest: true };
    saveSessionToken(data.token);
  } catch { session = null; }
  renderAccount();
}
function adoptSessionToken(t) {
  if (!t || t === sessionToken()) return;
  saveSessionToken(t);
  session = { token: t, email: session?.email || "", name: session?.name || "", guest: !session?.email };
}

function getMeStore() { try { return JSON.parse(localStorage.getItem(ME_KEY) || "{}"); } catch { return {}; } }
function saveMe(code, data) { const s = getMeStore(); s[code] = { ...(s[code] || {}), ...data }; localStorage.setItem(ME_KEY, JSON.stringify(s)); }
function loadMe(code) { return getMeStore()[code] || null; }

function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2600);
}
async function api(action, opts = {}) {
  const url = opts.query ? `${API}/${action}?${new URLSearchParams(opts.query)}` : `${API}/${action}`;
  const res = await fetch(url, {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || "Algo salió mal");
  return data;
}
function copyText(text, msg) {
  const done = () => toast(msg || "Copiado 📋");
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  else fallbackCopy(text, done);
}
function fallbackCopy(text, done) {
  const ta = document.createElement("textarea");
  ta.value = text; document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); done(); } catch { toast("No se pudo copiar"); }
  ta.remove();
}

// --- Copos de nieve: caen por toda la pantalla, cada uno con su propio
// tamaño, posición, velocidad y balanceo aleatorios. ---
function makeSnow() {
  const container = $("snowfall");
  if (!container) return;
  const shapes = ["❄", "❅", "❆", "•"];
  for (let i = 0; i < 55; i++) {
    const f = document.createElement("span");
    f.className = "snowflake";
    f.textContent = shapes[Math.floor(Math.random() * shapes.length)];
    const size = 8 + Math.random() * 14;
    const fall = 9 + Math.random() * 14;
    const sway = 2 + Math.random() * 3;
    f.style.left = (Math.random() * 100).toFixed(2) + "vw";
    f.style.fontSize = size.toFixed(0) + "px";
    f.style.opacity = (0.35 + Math.random() * 0.6).toFixed(2);
    f.style.animationDuration = fall.toFixed(1) + "s, " + sway.toFixed(1) + "s";
    // Empiezan a mitad de caída para que la pantalla se vea llena desde el inicio.
    f.style.animationDelay = (-Math.random() * fall).toFixed(1) + "s, 0s";
    container.appendChild(f);
  }
}

// --- Etiquetas de gustos ---
function buildTagPicker(id) {
  const el = $(id);
  if (!el) return;
  el.innerHTML = TASTES.map((t) => `<button type="button" class="tag-chip" data-tag="${t.label}">${t.icon} ${t.label}</button>`).join("");
  el.querySelectorAll(".tag-chip").forEach((b) => b.addEventListener("click", () => b.classList.toggle("on")));
}
function selectedTags(id) {
  return [...document.querySelectorAll(`#${id} .tag-chip.on`)].map((c) => c.dataset.tag);
}
function tasteIcon(label) {
  const t = TASTES.find((x) => x.label === label);
  return t ? t.icon + " " + t.label : label;
}
const ORDER = ["screen-welcome", "screen-setup", "screen-group", "screen-wishes", "screen-draw"];
function show(id, back = false) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active", "slide-back"));
  const el = $(id);
  el.classList.add("active");
  if (back) el.classList.add("slide-back");
  currentScreen = id;
  const idx = Math.max(0, ORDER.indexOf(id));
  document.querySelectorAll("#progress i").forEach((dot, i) => dot.classList.toggle("on", i <= idx));
  window.scrollTo({ top: 0 });
  clearInterval(pollTimer);
  if (id === "screen-group" || id === "screen-draw") pollTimer = setInterval(refreshGroup, 10000);
}
function openSheet(id) { $(id).classList.add("open"); }
function closeSheets() { document.querySelectorAll(".sheet").forEach((s) => s.classList.remove("open")); }
document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeSheets));
document.querySelectorAll(".sheet").forEach((s) => s.addEventListener("click", (e) => { if (e.target === s) closeSheets(); }));

// --- Pantalla de inicio ---
$("btn-how").addEventListener("click", () => openSheet("sheet-how"));
$("btn-go-create").addEventListener("click", () => {
  $("form-create").classList.remove("hidden"); $("form-join").classList.add("hidden");
  $("setup-title").textContent = "Crea tu grupo"; show("screen-setup");
});
$("btn-go-join").addEventListener("click", () => {
  $("form-join").classList.remove("hidden"); $("form-create").classList.add("hidden");
  $("setup-title").textContent = "Únete a un grupo"; show("screen-setup");
});
$("btn-go-demo").addEventListener("click", () => { renderIdeas($("ideas-full")); openSheet("sheet-ideas"); });
$("btn-back-welcome").addEventListener("click", () => show("screen-welcome", true));

// --- Crear grupo ---
$("btn-create").addEventListener("click", async () => {
  const name = $("g-name").value.trim();
  const organizerName = $("g-organizer").value.trim();
  if (!name || !organizerName) return toast("Ponle nombre al grupo y dinos cómo te llamas");
  try {
    const data = await api("create", { method: "POST", body: {
      name, organizerName,
      date: $("g-date").value,
      budget: $("g-budget").value,
      type: $("g-type").value,
      wishlistEnabled: $("g-wishlist").checked,
      organizerTags: selectedTags("tags-create"),
      token: sessionToken(),
    }});
    group = data.group;
    me = { participantId: data.me.id, codeName: data.me.codeName, organizerToken: data.organizerToken };
    adoptSessionToken(data.sessionToken);
    saveMe(group.code, me);
    $("sheet-codename-value").textContent = me.codeName;
    setCodenameNote();
    renderGroup();
    show("screen-group");
    openSheet("sheet-codename");
  } catch (e) { toast(e.message); }
});

// --- Unirse ---
$("btn-join").addEventListener("click", async () => {
  const code = $("j-code").value.trim().toUpperCase();
  const name = $("j-name").value.trim();
  if (!code || !name) return toast("Escribe el código del grupo y tu nombre");
  try {
    const data = await api("join", { method: "POST", body: { code, name, tags: selectedTags("tags-join"), token: sessionToken() } });
    group = data.group;
    me = { participantId: data.me.id, codeName: data.me.codeName };
    adoptSessionToken(data.sessionToken);
    saveMe(group.code, me);
    $("sheet-codename-value").textContent = me.codeName;
    setCodenameNote();
    renderGroup();
    show("screen-group");
    openSheet("sheet-codename");
  } catch (e) { toast(e.message); }
});

function setCodenameNote() {
  const el = $("sheet-codename-note");
  if (!el) return;
  el.textContent = session?.email
    ? "Tu cuenta es " + session.email + ": con ella vuelves a entrar a tus grupos desde cualquier teléfono."
    : "Tu sesión quedó guardada en este navegador. Crea tu cuenta con tu correo para volver a entrar desde cualquier teléfono.";
  const btn = $("btn-sheet-account");
  if (btn) btn.classList.toggle("hidden", !!session?.email);
}

// --- Cuenta con correo ---
function renderAccount() {
  const btn = $("btn-account");
  if (!btn) return;
  btn.textContent = session?.email ? "👤 " + session.email.split("@")[0] : "👤 Entrar";
  $("account-out").classList.toggle("hidden", !!session?.email);
  $("account-in").classList.toggle("hidden", !session?.email);
  if (session?.email) {
    $("account-email").textContent = session.email;
    loadMyGroups();
  }
}
async function loadMyGroups() {
  const el = $("account-groups");
  if (!el || !session?.email) return;
  el.innerHTML = "<p class='small'>Cargando tus grupos...</p>";
  try {
    const data = await api("mygroups", { query: { token: sessionToken() } });
    el.innerHTML = data.groups.length === 0
      ? "<p class='small'>Aún no tienes grupos con esta cuenta.</p>"
      : data.groups.map((g) => `<div class="mygroup"><div><b>${escapeHtml(g.name)}</b><span>🎅 ${escapeHtml(g.codeName)} · ${g.drawn ? "sorteo hecho" : "esperando sorteo"}</span></div><button type="button" data-code="${g.code}" data-pid="${g.participantId}" data-codename="${escapeHtml(g.codeName)}">Entrar</button></div>`).join("");
    el.querySelectorAll("button[data-code]").forEach((b) => b.addEventListener("click", () => enterGroup(b.dataset.code, b.dataset.pid, b.dataset.codename)));
  } catch { el.innerHTML = "<p class='small'>No se pudieron cargar tus grupos.</p>"; }
}
async function enterGroup(code, participantId, codeName) {
  try {
    const data = await api("group", { query: { code, session: sessionToken() } });
    group = data.group;
    me = { participantId, codeName };
    saveMe(code, me);
    closeSheets();
    renderGroup();
    show("screen-group");
  } catch (e) { toast(e.message); }
}
$("btn-account").addEventListener("click", () => { renderAccount(); openSheet("sheet-account"); });
$("btn-show-register").addEventListener("click", () => { $("form-login").classList.add("hidden"); $("form-register").classList.remove("hidden"); });
$("btn-show-login").addEventListener("click", () => { $("form-register").classList.add("hidden"); $("form-login").classList.remove("hidden"); });
$("btn-login").addEventListener("click", async () => {
  const email = $("a-email").value.trim();
  const password = $("a-password").value;
  if (!email || !password) return toast("Escribe tu correo y contraseña");
  try {
    const data = await api("login", { method: "POST", body: { email, password } });
    session = { token: data.token, email: data.email, name: data.name || "", guest: false };
    saveSessionToken(data.token);
    toast("¡Bienvenido de nuevo! 👋");
    renderAccount();
  } catch (e) { toast(e.message); }
});
$("btn-register").addEventListener("click", async () => {
  const name = $("a-name").value.trim();
  const email = $("a-email-reg").value.trim();
  const password = $("a-password-reg").value;
  if (!email || !password) return toast("Escribe tu correo y una contraseña");
  try {
    const data = await api("register", { method: "POST", body: { email, password, name } });
    session = { token: data.token, email: data.email, name: data.name || "", guest: false };
    saveSessionToken(data.token);
    toast("Cuenta creada 🎄 Ya puedes volver desde cualquier teléfono");
    renderAccount();
  } catch (e) { toast(e.message); }
});
$("btn-logout").addEventListener("click", async () => {
  try { await api("logout", { method: "POST", body: { token: sessionToken() } }); } catch {}
  session = null;
  try { localStorage.removeItem(SESSION_KEY); } catch {}
  await ensureSession();
  toast("Sesión cerrada");
});
$("btn-change-password").addEventListener("click", async () => {
  const current = $("a-current").value;
  const next = $("a-new").value;
  if (!current || !next) return toast("Escribe tu contraseña actual y la nueva");
  try {
    await api("change-password", { method: "POST", body: { token: sessionToken(), currentPassword: current, newPassword: next } });
    $("a-current").value = ""; $("a-new").value = "";
    toast("Contraseña actualizada 🔑");
  } catch (e) { toast(e.message); }
});
$("btn-show-forgot").addEventListener("click", () => { $("form-login").classList.add("hidden"); $("form-register").classList.add("hidden"); $("form-forgot").classList.remove("hidden"); });
$("btn-back-login").addEventListener("click", () => { $("form-forgot").classList.add("hidden"); $("form-login").classList.remove("hidden"); });
$("btn-send-reset").addEventListener("click", async () => {
  const email = $("a-forgot-email").value.trim();
  if (!email) return toast("Escribe tu correo");
  try {
    await api("reset-request", { method: "POST", body: { email } });
    toast("Si ese correo tiene cuenta, te enviamos el enlace 📬");
  } catch (e) { toast(e.message); }
});
$("btn-do-reset").addEventListener("click", async () => {
  const next = $("r-password").value;
  if (!next) return toast("Escribe tu contraseña nueva");
  try {
    await api("reset-password", { method: "POST", body: { token: resetToken, newPassword: next } });
    closeSheets();
    toast("Contraseña actualizada 🔑 Ya puedes entrar");
    renderAccount(); openSheet("sheet-account");
  } catch (e) { toast(e.message); }
});
$("btn-sheet-account").addEventListener("click", () => { closeSheets(); renderAccount(); setTimeout(() => openSheet("sheet-account"), 150); });

// --- Grupo ---
async function refreshGroup() {
  if (!group) return;
  try {
    const data = await api("group", { query: { code: group.code, session: sessionToken() } });
    group = data.group;
    renderGroup();
    if (currentScreen === "screen-draw") renderDraw();
  } catch { /* sin conexión momentánea: se reintenta solo */ }
}
function renderGroup() {
  if (!group) return;
  $("grp-name").textContent = "🎄 " + group.name;
  const bits = [];
  if (group.date) bits.push("📅 " + group.date);
  if (group.budget) bits.push("💰 Presupuesto $" + group.budget + " MXN");
  bits.push(group.type === "cartas" ? "✉️ Solo cartas" : group.type === "regalos" ? "🎁 Solo regalos" : "🎁✉️ Regalos y cartas");
  bits.push(group.drawn ? "🎲 Sorteo hecho" : "⏳ Esperando el sorteo");
  $("grp-meta").textContent = bits.join(" · ");
  $("grp-code").textContent = group.code;
  const stored = loadMe(group.code);
  if (stored) {
    me = stored;
    $("my-codename").textContent = "🎅 " + stored.codeName;
    $("my-codename-wrap").classList.remove("hidden");
  } else {
    $("my-codename-wrap").classList.add("hidden");
  }
  const avatars = ["🎅", "🦌", "⛄", "🐱", "🦊", "🐼", "🍪", "⭐", "🎄", "🧝"];
  $("participants").innerHTML = group.participants.length === 0
    ? "<p> Aún no hay participantes. ¡Comparte el código!</p>"
    : group.participants.map((p, i) => `
      <div class="person"><div class="avatar">${avatars[i % avatars.length]}</div>
      <div><b>${p.codeName}</b><span>${p.wishlistCount > 0 ? `🎁 ${p.wishlistCount} deseo(s) en su lista` : "Sin deseos todavía"}</span>${(p.tags || []).length ? `<br>${p.tags.map((t) => `<span class="chip gold">${tasteIcon(t)}</span>`).join("")}` : ""}</div></div>`).join("");
  const isOrg = group.isOrganizer === true || !!(stored && stored.organizerToken);
  $("organizer-card").classList.toggle("hidden", !isOrg);
  if (isOrg) $("org-wishlist").checked = group.wishlistEnabled;
  $("org-guest-note").classList.toggle("hidden", !(isOrg && session?.guest));
  $("btn-draw").disabled = group.participants.length < 3 || group.drawn;
  $("btn-draw").textContent = group.drawn ? "✅ Sorteo ya realizado" : "🎲 Hacer el sorteo secreto";
}
$("btn-org-account").addEventListener("click", () => { renderAccount(); openSheet("sheet-account"); });
$("btn-copy-code").addEventListener("click", () => group && copyText(group.code, "Código copiado 📋"));
$("btn-invite").addEventListener("click", () => {
  if (!group) return;
  const url = location.origin + location.pathname;
  $("invite-text").textContent =
    `🎄 ¡Te invito a nuestro intercambio de regalos!\n\n` +
    `Grupo: ${group.name}\nCódigo: ${group.code}\n` +
    (group.date ? `Fecha: ${group.date}\n` : "") +
    (group.budget ? `Presupuesto: $${group.budget} MXN\n` : "") +
    `\nEntra aquí y únete con el código: ${url}\n¡Cada quien recibe un nombre clave secreto! 🎅`;
  openSheet("sheet-invite");
});
$("btn-copy-invite").addEventListener("click", () => copyText($("invite-text").textContent, "Invitación copiada 📋"));
$("btn-next-wishes").addEventListener("click", () => { renderWishes(); show("screen-wishes"); });
$("org-wishlist").addEventListener("change", async (e) => {
  if (!group || !me?.organizerToken) return;
  try {
    const data = await api("settings", { method: "POST", body: { code: group.code, token: sessionToken(), organizerToken: me.organizerToken, wishlistEnabled: e.target.checked } });
    group = data.group; toast(e.target.checked ? "Lista de deseos activada 🎁" : "Lista de deseos desactivada");
  } catch (err) { toast(err.message); e.target.checked = !e.target.checked; }
});
$("btn-draw").addEventListener("click", async () => {
  if (!group || !me?.organizerToken) return;
  if (!confirm("¿Hacer el sorteo secreto ahora? Ya nadie podrá unirse después.")) return;
  try {
    const data = await api("draw", { method: "POST", body: { code: group.code, token: sessionToken(), organizerToken: me.organizerToken } });
    group = data.group; renderGroup(); toast("¡Sorteo hecho! 🎲 Cada quien ya puede revelar a quién le toca");
    renderDraw(); show("screen-draw");
  } catch (e) { toast(e.message); }
});

// --- Deseos ---
async function renderWishes() {
  if (!group) return;
  $("wishes-off").classList.toggle("hidden", group.wishlistEnabled);
  $("wishes-on").classList.toggle("hidden", !group.wishlistEnabled);
  renderIdeas($("ideas"));
  if (group.wishlistEnabled && me) {
    try {
      const data = await api("mywishes", { method: "POST", body: { code: group.code, participantId: me.participantId, token: sessionToken(), personalCode: me.personalCode } });
      myWishesCache = data.wishlist || [];
      renderMyWishes(myWishesCache);
    } catch { renderMyWishes(myWishesCache); }
  }
}
function renderMyWishes(list) {
  $("my-wishes").innerHTML = list.length === 0
    ? "<p class='small'>Tu lista está vacía. Agrega tu primer deseo arriba.</p>"
    : list.map((w) => `<div class="wish"><div>🎁</div><div><b>${escapeHtml(w.text)}</b>${w.link && safeLink(w.link) ? `<br><a href="${escapeHtml(w.link)}" target="_blank" rel="noopener">Ver enlace ↗</a>` : ""}</div>${w.price ? `<span class="price">${escapeHtml(w.price)}</span>` : ""}</div>`).join("");
}
function safeLink(l) { return /^https?:\/\/\S+$/i.test(String(l || "").trim()); }
let myWishesCache = [];
$("btn-add-wish").addEventListener("click", async () => {
  const text = $("w-text").value.trim();
  if (!text) return toast("Escribe tu deseo primero");
  if (!group || !me) return toast("Primero únete a un grupo");
  try {
    const data = await api("wish", { method: "POST", body: {
      code: group.code, participantId: me.participantId, token: sessionToken(), personalCode: me.personalCode,
      text, price: $("w-price").value.trim(), link: $("w-link").value.trim(),
    }});
    myWishesCache = data.wishlist;
    renderMyWishes(myWishesCache);
    $("w-text").value = ""; $("w-price").value = ""; $("w-link").value = "";
    toast("Deseo agregado 🎁");
    await refreshGroup();
  } catch (e) { toast(e.message); }
});
$("btn-back-group").addEventListener("click", () => show("screen-group", true));
$("btn-next-draw").addEventListener("click", () => { renderDraw(); show("screen-draw"); });

// --- Sorteo / revelación ---
function renderDraw() {
  if (!group) return;
  const avatars = ["🎅", "🦌", "⛄", "🐱", "🦊", "🐼", "🍪", "⭐", "🎄", "🧝"];
  $("draw-participants").innerHTML = group.participants.map((p, i) => `
    <div class="person"><div class="avatar">${avatars[i % avatars.length]}</div>
    <div><b>${p.codeName}</b><span>${p.wishlistCount > 0 ? `🎁 ${p.wishlistCount} deseo(s)` : "Sin deseos"}</span></div></div>`).join("");
  if (group.drawn) {
    $("draw-status").textContent = "¡El sorteo ya se hizo! Toca el botón y descubre en privado a quién te toca regalar.";
    $("btn-reveal").classList.remove("hidden");
  } else {
    $("draw-status").textContent = "El organizador aún no hace el sorteo. Cuando esté listo, aquí revelarás a quién te toca regalar.";
    $("btn-reveal").classList.add("hidden");
  }
}
$("btn-back-wishes").addEventListener("click", () => { renderWishes(); show("screen-wishes", true); });
$("btn-reveal").addEventListener("click", async () => {
  if (!group || !me) return toast("Primero únete a un grupo");
  try {
    const data = await api("reveal", { method: "POST", body: { code: group.code, participantId: me.participantId, token: sessionToken(), personalCode: me.personalCode } });
    $("reveal-who").textContent = "🎅 " + data.recipient.codeName;
    $("reveal-budget").textContent = data.budget ? `Presupuesto sugerido: $${data.budget} MXN` : "";
    const w = data.recipient.wishlist || [];
    $("reveal-wishlist").innerHTML = data.recipient.wishlistEnabled
      ? (w.length === 0
        ? "<p class='small center'>Esta persona no anotó deseos. ¡Sorpréndela con algo bonito!</p>"
        : "<h3 style='margin-top:14px'>🎁 Su lista de deseos</h3>" + w.map((x) => `<div class="wish"><div>🎁</div><div><b>${escapeHtml(x.text)}</b>${x.link && safeLink(x.link) ? `<br><a href="${escapeHtml(x.link)}" target="_blank" rel="noopener">Ver enlace ↗</a>` : ""}</div>${x.price ? `<span class="price">${escapeHtml(x.price)}</span>` : ""}</div>`).join(""))
      : "<p class='small center'>La lista de deseos está desactivada en este grupo.</p>";
    const ri = $("reveal-ideas");
    const rtags = data.recipient.tags || [];
    if (rtags.length) {
      ri.innerHTML = `<h3 style="margin-top:16px">💡 ¡Mira esto! según sus gustos: ${rtags.map(tasteIcon).join(" · ")}</h3><div class="product-grid" id="reveal-grid"></div>`;
      renderIdeas($("reveal-grid"), rtags);
    } else {
      ri.innerHTML = "";
    }
    $("flip").classList.remove("flipped");
    openSheet("sheet-reveal");
  } catch (e) { toast(e.message); }
});
$("flip").addEventListener("click", () => $("flip").classList.toggle("flipped"));
$("btn-ideas-from-reveal").addEventListener("click", () => { closeSheets(); renderIdeas($("ideas-full")); setTimeout(() => openSheet("sheet-ideas"), 150); });

// Agregar un producto de ¡Mira esto! a mi lista de deseos (además de comprar).
document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".add-wish-btn");
  if (!btn) return;
  const p = PRODUCTS.find((x) => x.id === btn.dataset.id);
  if (!p) return;
  if (!group || !me) { toast("Primero crea o únete a un grupo para guardar deseos"); return; }
  if (!group.wishlistEnabled) { toast("La lista de deseos está desactivada en este grupo"); return; }
  btn.disabled = true;
  try {
    const data = await api("wish", { method: "POST", body: {
      code: group.code, participantId: me.participantId, token: sessionToken(), personalCode: me.personalCode,
      text: p.name, price: p.price, link: "",
    }});
    myWishesCache = data.wishlist;
    renderMyWishes(myWishesCache);
    toast("Agregado a tu lista 🎁");
    await refreshGroup();
  } catch (err) { toast(err.message); }
  btn.disabled = false;
});

// --- Tienda de ideas: miniatura, precio, descripción e imagen ---
function productCard(p, match) {
  return `<div class="product-card">
    <img src="${p.img}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.onerror=null;this.src='https://picsum.photos/seed/${p.id}/400/300'">
    <div class="p-body">
      ${match ? `<span class="p-match">✦ Para sus gustos</span>` : ""}
      <h4>${escapeHtml(p.name)}</h4>
      <div class="p-price">${p.price}</div>
      <p>${escapeHtml(p.desc)}</p>
      <button type="button" class="add-wish-btn" data-id="${p.id}">🎁 Agregar a mi lista</button>
    </div></div>`;
}
function renderIdeas(el, filterTags) {
  if (!el) return;
  let list = PRODUCTS.map((p) => ({ ...p, _match: false }));
  if (filterTags && filterTags.length) {
    const match = list.filter((p) => p.tags.some((t) => filterTags.includes(t)));
    const rest = list.filter((p) => !p.tags.some((t) => filterTags.includes(t)));
    match.forEach((p) => { p._match = true; });
    list = [...match, ...rest];
  }
  el.innerHTML = list.map((p) => productCard(p, p._match)).join("");
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// --- Entrada con código en la URL (?g=XXXXXX) ---
(async function init() {
  makeSnow();
  buildTagPicker("tags-create");
  buildTagPicker("tags-join");
  renderIdeas($("ideas"));
  await ensureSession();
  const params = new URLSearchParams(location.search);
  const code = (params.get("g") || "").toUpperCase();
  if (code) {
    $("form-join").classList.remove("hidden"); $("form-create").classList.add("hidden");
    $("setup-title").textContent = "Únete a un grupo";
    $("j-code").value = code;
    show("screen-setup");
  }
  const reset = params.get("reset") || "";
  if (reset) { resetToken = reset; openSheet("sheet-reset"); }
})();
