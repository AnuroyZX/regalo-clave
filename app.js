// Regalo Clave — cliente
const API = "/.netlify/functions/api";
const $ = (id) => document.getElementById(id);
const ME_KEY = "rc_me_v1";

const IDEAS = [
  { tag: "Para todos", name: "Taza navideña personalizada", price: "$199", desc: "Un clásico que siempre cae bien, con chocolate incluido.", url: "https://www.amazon.com.mx/s?k=taza+navide%C3%B1a+personalizada" },
  { tag: "Para consentir", name: "Set de velas aromáticas", price: "$349", desc: "Para una tarde tranquila en casa, huele a Navidad.", url: "https://www.amazon.com.mx/s?k=set+velas+aromaticas+regalo" },
  { tag: "Para leer", name: "Libro sorpresa de temporada", price: "$299", desc: "Elige una novela ligera: nunca falla.", url: "https://www.amazon.com.mx/s?k=libros+regalo+navidad" },
  { tag: "Para jugar", name: "Juego de mesa familiar", price: "$499", desc: "Para que el intercambio siga en la mesa después de cenar.", url: "https://www.amazon.com.mx/s?k=juego+de+mesa+familiar" },
  { tag: "Para el frío", name: "Bufanda tejida suave", price: "$279", desc: "Calientita, bonita y útil todo el invierno.", url: "https://www.amazon.com.mx/s?k=bufanda+tejida+regalo" },
  { tag: "Para cocinar", name: "Kit de chocolate caliente", price: "$259", desc: "Taza, chocolate y bombones: el combo perfecto.", url: "https://www.amazon.com.mx/s?k=kit+chocolate+caliente+regalo" },
];

let group = null;      // estado público del grupo
let me = null;         // { participantId, personalCode, codeName, organizerToken? }
let currentScreen = "screen-welcome";
let pollTimer = null;

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

// --- Navegación entre pantallas ---
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
    }});
    group = data.group;
    me = { participantId: data.me.id, personalCode: data.me.personalCode, codeName: data.me.codeName, organizerToken: data.organizerToken };
    saveMe(group.code, me);
    $("sheet-codename-value").textContent = me.codeName;
    $("sheet-personal-value").textContent = me.personalCode;
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
    const data = await api("join", { method: "POST", body: { code, name } });
    group = data.group;
    me = { participantId: data.me.id, personalCode: data.me.personalCode, codeName: data.me.codeName };
    saveMe(group.code, me);
    $("sheet-codename-value").textContent = me.codeName;
    $("sheet-personal-value").textContent = me.personalCode;
    renderGroup();
    show("screen-group");
    openSheet("sheet-codename");
  } catch (e) { toast(e.message); }
});

// --- Grupo ---
async function refreshGroup() {
  if (!group) return;
  try {
    const data = await api("group", { query: { code: group.code } });
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
    $("my-personal").textContent = stored.personalCode;
    $("my-codename-wrap").classList.remove("hidden");
  } else {
    $("my-codename-wrap").classList.add("hidden");
  }
  const avatars = ["🎅", "🦌", "⛄", "🐱", "🦊", "🐼", "🍪", "⭐", "🎄", "🧝"];
  $("participants").innerHTML = group.participants.length === 0
    ? "<p> Aún no hay participantes. ¡Comparte el código!</p>"
    : group.participants.map((p, i) => `
      <div class="person"><div class="avatar">${avatars[i % avatars.length]}</div>
      <div><b>${p.codeName}</b><span>${p.wishlistCount > 0 ? `🎁 ${p.wishlistCount} deseo(s) en su lista` : "Sin deseos todavía"}</span></div></div>`).join("");
  const isOrg = !!(stored && stored.organizerToken);
  $("organizer-card").classList.toggle("hidden", !isOrg);
  if (isOrg) $("org-wishlist").checked = group.wishlistEnabled;
  $("btn-draw").disabled = group.participants.length < 3 || group.drawn;
  $("btn-draw").textContent = group.drawn ? "✅ Sorteo ya realizado" : "🎲 Hacer el sorteo secreto";
}
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
    const data = await api("settings", { method: "POST", body: { code: group.code, organizerToken: me.organizerToken, wishlistEnabled: e.target.checked } });
    group = data.group; toast(e.target.checked ? "Lista de deseos activada 🎁" : "Lista de deseos desactivada");
  } catch (err) { toast(err.message); e.target.checked = !e.target.checked; }
});
$("btn-draw").addEventListener("click", async () => {
  if (!group || !me?.organizerToken) return;
  if (!confirm("¿Hacer el sorteo secreto ahora? Ya nadie podrá unirse después.")) return;
  try {
    const data = await api("draw", { method: "POST", body: { code: group.code, organizerToken: me.organizerToken } });
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
      const data = await api("mywishes", { method: "POST", body: { code: group.code, participantId: me.participantId, personalCode: me.personalCode } });
      myWishesCache = data.wishlist || [];
      renderMyWishes(myWishesCache);
    } catch { renderMyWishes(myWishesCache); }
  }
}
function renderMyWishes(list) {
  $("my-wishes").innerHTML = list.length === 0
    ? "<p class='small'>Tu lista está vacía. Agrega tu primer deseo arriba.</p>"
    : list.map((w) => `<div class="wish"><div>🎁</div><div><b>${escapeHtml(w.text)}</b>${w.link ? `<br><a href="${escapeHtml(w.link)}" target="_blank" rel="noopener">Ver enlace ↗</a>` : ""}</div>${w.price ? `<span class="price">${escapeHtml(w.price)}</span>` : ""}</div>`).join("");
}
let myWishesCache = [];
$("btn-add-wish").addEventListener("click", async () => {
  const text = $("w-text").value.trim();
  if (!text) return toast("Escribe tu deseo primero");
  if (!group || !me) return toast("Primero únete a un grupo");
  try {
    const data = await api("wish", { method: "POST", body: {
      code: group.code, participantId: me.participantId, personalCode: me.personalCode,
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
    const data = await api("reveal", { method: "POST", body: { code: group.code, participantId: me.participantId, personalCode: me.personalCode } });
    $("reveal-who").textContent = "🎅 " + data.recipient.codeName;
    $("reveal-budget").textContent = data.budget ? `Presupuesto sugerido: $${data.budget} MXN` : "";
    const w = data.recipient.wishlist || [];
    $("reveal-wishlist").innerHTML = data.recipient.wishlistEnabled
      ? (w.length === 0
        ? "<p class='small center'>Esta persona no anotó deseos. ¡Sorpréndela con algo bonito!</p>"
        : "<h3 style='margin-top:14px'>🎁 Su lista de deseos</h3>" + w.map((x) => `<div class="wish"><div>🎁</div><div><b>${escapeHtml(x.text)}</b>${x.link ? `<br><a href="${escapeHtml(x.link)}" target="_blank" rel="noopener">Ver enlace ↗</a>` : ""}</div>${x.price ? `<span class="price">${escapeHtml(x.price)}</span>` : ""}</div>`).join(""))
      : "<p class='small center'>La lista de deseos está desactivada en este grupo.</p>";
    $("flip").classList.remove("flipped");
    openSheet("sheet-reveal");
  } catch (e) { toast(e.message); }
});
$("flip").addEventListener("click", () => $("flip").classList.toggle("flipped"));
$("btn-ideas-from-reveal").addEventListener("click", () => { closeSheets(); renderIdeas($("ideas-full")); setTimeout(() => openSheet("sheet-ideas"), 150); });

// --- Ideas de regalo ---
function renderIdeas(el) {
  if (!el) return;
  el.innerHTML = IDEAS.map((i) => `
    <div class="idea"><span class="tag">${i.tag} · ${i.price} aprox.</span>
    <h3 style="margin-top:4px">${i.name}</h3><p>${i.desc}</p>
    <a href="${i.url}" target="_blank" rel="noopener sponsored">Ver en Amazon ↗</a></div>`).join("");
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// --- Entrada con código en la URL (?g=XXXXXX) ---
(function init() {
  renderIdeas($("ideas"));
  const params = new URLSearchParams(location.search);
  const code = (params.get("g") || "").toUpperCase();
  if (code) {
    $("form-join").classList.remove("hidden"); $("form-create").classList.add("hidden");
    $("setup-title").textContent = "Únete a un grupo";
    $("j-code").value = code;
    show("screen-setup");
  }
})();
