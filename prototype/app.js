"use strict";

// ---------- Données (persistées dans le navigateur pour le prototype) ----------

const STORAGE_KEY = "mbd-proto-v5";
const DAY = 86400000;

function seedState() {
  // Auteur et date d'ajout fictifs pour que « qui a ajouté quoi » ne soit pas vide à la démo.
  const team = ["Camille Martin", "Hugo Leroy", "Inès Dubois"];
  const notices = structuredClone(SEED_NOTICES).map((n, i, all) => ({
    ...n,
    addedBy: team[n.id % 3],
    addedAt: new Date(Date.now() - (all.length - i) * 2.3 * DAY).toISOString(),
  }));
  return { notices, users: structuredClone(SEED_USERS), userId: 1, queue: [] };
}

const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || seedState();
const saveState = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
const nextId = () => Math.max(0, ...state.notices.map((x) => x.id)) + 1;
const ROLES = ["Admin", "Gestionnaire", "Public"];
const ROLE_INFO = { Admin: "Tout, y compris les comptes", Gestionnaire: "Ajoute, corrige et supprime les notices", Public: "Recherche et consulte seulement" };
const AUTHOR_ROLES = ["Scénario", "Dessin", "Couleurs", "Scénario et dessin"];
// Sans connexion, on consulte en Public depuis n'importe quel poste du réseau local.
const me = () => state.users.find((u) => u.id === state.userId) || { id: 0, name: "Visiteur", role: "Public" };
const role = () => me().role;
const canEdit = () => role() !== "Public";
const isAdmin = () => role() === "Admin";

// ---------- Utilitaires ----------

const root = document.getElementById("root");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fold = (s) => String(s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/’/g, "'").toLowerCase();
const year = (n) => (n.date ? Number(n.date.slice(0, 4)) : null);
const authorNames = (n) => n.authors.map((a) => a.name).join(", ");
const initials = (name) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
const qs = (params) => new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null)).toString();
const DATE_FMT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const formatDate = (d) => (!d ? "" : d.endsWith("-01-01") ? d.slice(0, 4) : DATE_FMT.format(new Date(d.slice(0, 10) + "T12:00:00")));
const formatPrice = (p) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(p);
const displayTitle = (n) => (n.type === "revue" ? `${n.title} n°${n.number}` : n.title);
const seriesLabel = (n) => (!n.series ? "" : n.volume ? `${n.series}, tome ${n.volume}` : n.series);
const subLine = (n) => (n.type === "revue" ? `Revue · ${formatDate(n.date)}` : seriesLabel(n) || authorNames(n));
const thisWeek = (n) => n.addedAt && Date.now() - new Date(n.addedAt) < 7 * DAY;

function ago(iso) {
  if (!iso) return "";
  const d = new Date(iso), diff = Date.now() - d;
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (diff < 60000) return "à l'instant";
  if (diff < 3600000) return `il y a ${Math.round(diff / 60000)} min`;
  if (new Date().toDateString() === d.toDateString()) return `aujourd'hui à ${time}`;
  if (new Date(Date.now() - DAY).toDateString() === d.toDateString()) return `hier à ${time}`;
  return `le ${DATE_FMT.format(d)}`;
}

// Ce qui manque à une notice pour être complète (clé = nom du champ du formulaire).
const MISSING_LABEL = { titre: "titre", auteurs: "auteurs", roles: "rôles des auteurs", pages: "pages", motscles: "mots-clés", sommaire: "sommaire" };
function missing(n) {
  const out = [];
  if (!n.title) out.push("titre");
  if (n.type === "album" && !n.authors.length) out.push("auteurs");
  if (n.type === "album" && n.authors.some((a) => !AUTHOR_ROLES.includes(a.role))) out.push("roles");
  if (!n.pages) out.push("pages");
  if (!(n.keywords || []).length) out.push("motscles");
  if (n.type === "revue" && !(n.contents || []).length) out.push("sommaire");
  return out;
}
const missingText = (n) => missing(n).map((k) => MISSING_LABEL[k]).join(", ");

// Mots-clés regroupés en thèmes pour parcourir le fonds en images.
const THEMES = [
  { key: "humour", label: "Humour", kw: ["humour", "gag"], bg: "#fce9c4", ink: "#94600a", ic: "smiley" },
  { key: "aventure", label: "Aventure", kw: ["aventure", "jeunesse"], bg: "#d5f0ea", ink: "#1f7565", ic: "compass" },
  { key: "sf", label: "Science-fiction", kw: ["science-fiction", "fantastique"], syn: "sf scifi science fiction anticipation", bg: "#e4e0f4", ink: "#52448e", ic: "rocket-launch" },
  { key: "fantasy", label: "Fantasy et légendes", kw: ["fantasy", "vikings"], bg: "#dcebf7", ink: "#2d6493", ic: "sword" },
  { key: "thriller", label: "Thriller", kw: ["thriller", "finance"], syn: "policier polar", bg: "#efe5d8", ink: "#4a3a36", ic: "detective" },
  { key: "western", label: "Western", kw: ["western"], syn: "cowboy", bg: "#fbe0d6", ink: "#a2462a", ic: "horse" },
  { key: "revues", label: "Revues", type: "revue", bg: "#fbdde6", ink: "#9e3459", ic: "newspaper-clipping" },
];
const inTheme = (n, t) => (t.type ? n.type === t.type : (n.keywords || []).some((k) => t.kw.includes(k)));

const GEN_COLORS = ["#3f5d8a", "#b04a36", "#3c7357", "#6a5591", "#9a6c2c", "#2f6f7c"];
const genColor = (s) => GEN_COLORS[[...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % GEN_COLORS.length];
const AV_COLORS = ["#2f5bb7", "#b04a36", "#23845a", "#7a4fb0", "#a86a00", "#2f6f7c"];
const avColor = (s) => AV_COLORS[[...s].reduce((h, c) => h + c.charCodeAt(0), 0) % AV_COLORS.length];

function coverHtml(n, size = "M") {
  const fallback = `<span class="cg"><small>${esc(n.type === "revue" ? "Revue" : n.publisher || "")}</small>${n.type === "revue" ? `<i>${esc(n.number)}</i>` : ""}<b>${esc(n.title || "Sans titre")}</b></span>`;
  const img = n.isbn ? `<img src="https://covers.openlibrary.org/b/isbn/${n.isbn}-M.jpg?default=false" alt="" loading="lazy" onload="this.classList.add('loaded')" onerror="this.remove()">` : "";
  return `<span class="cover" style="--cg:${genColor(n.title || "?")}">${fallback}${img}</span>`;
}

const art = (name, cls = "art-ic") => `<img class="${cls}" src="assets/${name}.webp" alt="" aria-hidden="true">`;
const I = (name, style = "duotone") => `<i class="icon ph-${style} ph-${name}" aria-hidden="true"></i>`;
const icon = {
  search: I("magnifying-glass", "bold"),
  back: I("arrow-left", "bold"),
  arrow: I("arrow-right", "bold"),
  scan: I("barcode"),
  pencil: I("pencil-simple-line"),
  sun: I("sun"),
  moon: I("moon-stars"),
  plus: I("plus", "bold"),
  users: I("users-three"),
  close: I("x", "bold"),
  check: I("check-circle"),
  trash: I("trash"),
  book: I("book-open-text"),
  news: I("newspaper-clipping"),
  todo: I("list-checks"),
  sort: I("sort-ascending", "bold"),
};


let toastTimer;
function toast(message, undo) {
  const el = document.getElementById("toast");
  el.innerHTML = `${icon.check}<span>${esc(message)}</span>${undo ? `<button type="button">Annuler</button>` : ""}`;
  if (undo) el.querySelector("button").onclick = () => { el.classList.remove("show"); undo(); };
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), undo ? 6000 : 2600);
}

function openModal(html, onReady) {
  const wrap = document.createElement("div");
  wrap.className = "modal-backdrop";
  wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  const close = () => { wrap.remove(); document.removeEventListener("keydown", onKey, true); };
  const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); onReady.cancel?.(); } };
  wrap.addEventListener("mousedown", (e) => { if (e.target === wrap) { close(); onReady.cancel?.(); } });
  document.addEventListener("keydown", onKey, true);
  document.body.append(wrap);
  onReady.ready(wrap.querySelector(".modal"), close);
}

function confirmDialog({ title, body, confirmLabel, danger = true }) {
  return new Promise((resolve) => openModal(
    `<h2>${esc(title)}</h2><p>${esc(body)}</p><div class="modal-actions"><button class="btn" data-r="0">Annuler</button><button class="btn ${danger ? "primary" : "dark"}" data-r="1">${esc(confirmLabel)}</button></div>`,
    {
      cancel: () => resolve(false),
      ready: (modal, close) => {
        modal.addEventListener("click", (e) => { const r = e.target.closest("[data-r]"); if (r) { close(); resolve(r.dataset.r === "1"); } });
        modal.querySelector('[data-r="1"]').focus();
      },
    }));
}

// Petit bip au scan, comme une caisse : aigu si trouvé, grave sinon.
let audio;
function beep(ok) {
  try {
    audio ||= new AudioContext();
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = ok ? 1320 : 220;
    g.gain.setValueAtTime(0.08, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + (ok ? 0.12 : 0.3));
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + 0.3);
  } catch { /* son indisponible : pas bloquant */ }
}

// ---------- Recherche multicritère, tolérante aux fautes et aux phrases ----------

const STOP = new Set("a au aux avec ce ces cet cette d de des du en et il ils l la le les qu que qui sur tout tous toute toutes un une y ya article articles album albums bd tome tomes t numero n no".split(" "));

// « un Gaston des années 70 » devient le mot gaston et les années 1970 à 1979.
function parseQuery(q) {
  let text = fold(q), ymin = null, ymax = null;
  text = text.replace(/\bannees?\s+((?:19|20)?\d0)\b|\b((?:19)?\d0)s\b/g, (_, a, b) => {
    const d = Number(a ?? b);
    ymin = d < 100 ? 1900 + d : d;
    ymax = ymin + 9;
    return " ";
  });
  const terms = [], nums = [];
  for (const w of text.split(/[^a-z0-9-]+/).filter(Boolean)) {
    if (STOP.has(w)) continue;
    if (/^\d{1,3}$/.test(w)) nums.push(Number(w));
    else if (/^(19|20)\d\d$/.test(w)) { ymin = ymax = Number(w); }
    else terms.push(w);
  }
  return { terms, nums, ymin, ymax };
}

function haystack(n) {
  const themes = THEMES.filter((t) => inTheme(n, t)).map((t) => `${t.label} ${t.syn || ""}`).join(" ");
  return fold([n.title, n.series, n.publisher, n.isbn, n.issn, authorNames(n), (n.keywords || []).join(" "), themes,
    (n.contents || []).map((c) => `${c.title} ${c.authors}`).join(" ")].join(" "));
}

function distance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

function termMatches(hay, words, term) {
  if (term.length < 3) return words.some((w) => w.startsWith(term));
  if (hay.includes(term)) return true;
  if (term.length < 4) return false;
  const tolerance = term.length >= 7 ? 2 : 1;
  return words.some((w) => distance(w, term) <= tolerance);
}

function matchNotice(n, { terms, nums }) {
  if (nums.length && !nums.every((x) => n.volume === x || n.number === x)) return false;
  if (!terms.length) return true;
  const hay = haystack(n);
  const words = hay.split(/[^a-z0-9-]+/).filter(Boolean);
  return terms.every((t) => termMatches(hay, words, t));
}

function searchNotices(p) {
  const parsed = parseQuery(p.q || "");
  const ymin = Number(p.de) || parsed.ymin, ymax = Number(p.a) || parsed.ymax;
  const theme = THEMES.find((t) => t.key === p.theme);
  const base = state.notices.filter((n) => {
    if (p.type && n.type !== p.type) return false;
    if (theme && !inTheme(n, theme)) return false;
    if (p.editeur && n.publisher !== p.editeur) return false;
    if (p.serie && n.series !== p.serie) return false;
    if (p.auteur && !n.authors.some((a) => a.name === p.auteur)) return false;
    if (ymin && year(n) < ymin) return false;
    if (ymax && year(n) > ymax) return false;
    if (p.etat === "incomplet" && !missing(n).length) return false;
    return true;
  });
  let results = base.filter((n) => matchNotice(n, parsed));
  let approx = results.length > 0 && parsed.terms.some((t) => t.length >= 4 && !results.some((n) => haystack(n).includes(t)));
  // « tor gal » : on retente avec les mots collés.
  if (!results.length && parsed.terms.length > 1) {
    const joined = { ...parsed, terms: [parsed.terms.join("")] };
    results = base.filter((n) => matchNotice(n, joined));
    if (results.length) { parsed.terms = joined.terms; approx = true; }
  }
  results.sort((a, b) => fold(a.series || a.title).localeCompare(fold(b.series || b.title)) || (a.volume ?? a.number ?? 0) - (b.volume ?? b.number ?? 0));
  return { results, terms: parsed.terms, approx, ymin, ymax, meaningful: parsed.terms.length + parsed.nums.length > 0 || !!parsed.ymin };
}

function highlight(text, terms) {
  if (!terms.length) return esc(text);
  const folded = fold(text);
  const ranges = [];
  for (const t of terms) for (let i = folded.indexOf(t); i !== -1; i = folded.indexOf(t, i + t.length)) ranges.push([i, i + t.length]);
  ranges.sort((a, b) => a[0] - b[0]);
  let out = "", pos = 0;
  for (const [s, e] of ranges) {
    if (s < pos) continue;
    out += esc(text.slice(pos, s)) + "<mark>" + esc(text.slice(s, e)) + "</mark>";
    pos = e;
  }
  return out + esc(text.slice(pos));
}

function seriesList() {
  const map = new Map();
  for (const n of state.notices) if (n.series) map.set(n.series, [...(map.get(n.series) || []), n]);
  return [...map.entries()].map(([name, items]) => ({ name, items: items.sort((a, b) => (a.volume ?? 0) - (b.volume ?? 0)) }));
}
const allAuthors = () => [...new Set(state.notices.flatMap((n) => n.authors.map((a) => a.name)))];
const allPublishers = () => [...new Set(state.notices.map((n) => n.publisher).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
const wordStart = (text, fq) => fold(text).startsWith(fq) || fold(text).split(/\s+/).some((w) => w.startsWith(fq));

// Barre de recherche avec suggestions (notices, séries, auteurs), navigable au clavier.
function mountSearch(container, { hero = false, value = "" } = {}) {
  container.className = `search ${hero ? "hero" : ""}`;
  container.innerHTML = `
    <form class="search-box" role="search">
      ${icon.search}
      <input type="search" placeholder="Titre, auteur, série, éditeur, année, mot-clé…" value="${esc(value)}" autocomplete="off" aria-label="Rechercher dans le fonds">
      ${hero ? `<button class="btn primary">Rechercher</button>` : ""}
    </form>
    <div class="suggest" role="listbox"></div>`;
  const input = container.querySelector("input");
  const box = container.querySelector(".suggest");
  let items = [], active = -1;

  const go = (q) => { box.classList.remove("open"); location.hash = `#/recherche?${qs({ q })}`; };
  const render = () => {
    const q = input.value.trim();
    if (!q) { box.classList.remove("open"); return; }
    const { results, terms, meaningful } = searchNotices({ q });
    const fq = fold(q);
    const series = seriesList().filter((s) => wordStart(s.name, fq)).slice(0, 3);
    const authors = allAuthors().filter((a) => wordStart(a, fq)).slice(0, 3);
    items = [];
    let html = "";
    if (meaningful && results.length) {
      html += `<div class="suggest-label">Albums et revues</div>`;
      for (const n of results.slice(0, 5)) {
        items.push(() => (location.hash = `#/notice/${n.id}?${qs({ q })}`));
        html += `<div class="suggest-item" data-i="${items.length - 1}">${coverHtml(n)}<div><b>${highlight(displayTitle(n), terms)}</b><span>${highlight(subLine(n), terms)}</span></div></div>`;
      }
    }
    if (series.length) {
      html += `<div class="suggest-label">Séries</div>`;
      for (const s of series) {
        items.push(() => (location.hash = `#/recherche?${qs({ serie: s.name })}`));
        html += `<div class="suggest-item" data-i="${items.length - 1}">${coverHtml(s.items[0])}<div><b>${highlight(s.name, [fq])}</b><span>${plural(s.items.length, "album", "albums")} dans le fonds</span></div></div>`;
      }
    }
    if (authors.length) {
      html += `<div class="suggest-label">Auteurs</div>`;
      for (const a of authors) {
        items.push(() => (location.hash = `#/recherche?${qs({ auteur: a })}`));
        html += `<div class="suggest-item" data-i="${items.length - 1}"><span class="round" style="background:${avColor(a)};color:#fff">${esc(initials(a))}</span><div><b>${highlight(a, [fq])}</b><span>${plural(state.notices.filter((n) => n.authors.some((x) => x.name === a)).length, "album", "albums")}</span></div></div>`;
      }
    }
    items.push(() => go(q));
    html += `<div class="suggest-all" data-i="${items.length - 1}">${results.length && meaningful ? `Voir les ${plural(results.length, "résultat", "résultats")} pour « ${esc(q)} »` : `Rechercher « ${esc(q)} »`} ${icon.arrow}</div>`;
    box.innerHTML = html;
    active = -1;
    box.classList.add("open");
  };
  const setActive = (i) => {
    active = (i + items.length) % items.length;
    box.querySelectorAll("[data-i]").forEach((el) => el.classList.toggle("active", Number(el.dataset.i) === active));
  };

  input.addEventListener("input", render);
  input.addEventListener("focus", render);
  input.addEventListener("keydown", (e) => {
    if (!box.classList.contains("open")) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(active + 1); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
    if (e.key === "Escape") box.classList.remove("open");
  });
  container.querySelector("form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (active >= 0) items[active]();
    else if (input.value.trim()) go(input.value.trim());
  });
  box.addEventListener("mousedown", (e) => {
    const el = e.target.closest("[data-i]");
    if (el) { e.preventDefault(); items[Number(el.dataset.i)](); }
  });
  input.addEventListener("blur", () => setTimeout(() => box.classList.remove("open"), 120));
  return input;
}

// ---------- Cadre commun ----------

const dark = () => document.documentElement.dataset.theme === "dark";
function toggleTheme() {
  const next = dark() ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("mbd-theme", next);
  router();
}

function shell(active, { search = true, q = "" } = {}) {
  const todo = state.notices.filter((n) => missing(n).length).length;
  const tab = (href, key, ic, label, extra = "", title = "") => `<a href="${href}" class="${active === key ? "on" : ""}" ${title ? `title="${esc(title)}"` : ""}>${ic}${label}${extra}</a>`;
  const user = me();
  root.innerHTML = `
    <header class="top team-top" id="top"><div class="wrap top-inner">
      <a class="logo" href="#/"><img class="logo-mark" src="assets/logo.svg" alt="">Maison de la BD</a>
      <nav class="team-nav">
        ${tab("#/", "home", I("magnifying-glass"), "Rechercher")}
        ${canEdit() ? tab("#/scan", "scan", icon.scan, "Scanner", state.queue.length ? ` <span class="count light">${state.queue.length}</span>` : "", state.queue.length ? `${plural(state.queue.length, "album en attente", "albums en attente")} dans le carton` : "") : ""}
        ${canEdit() ? tab("#/completer", "todo", icon.todo, "À compléter", todo ? ` <span class="count">${todo}</span>` : "") : ""}
        ${isAdmin() ? tab("#/comptes", "users", icon.users, "Équipe") : ""}
      </nav>
      ${search ? `<div id="top-search"></div>` : `<div class="spacer"></div>`}
      <button class="btn theme-toggle" id="theme" title="${dark() ? "Passer en thème clair" : "Passer en thème sombre"}" aria-label="Changer de thème">${dark() ? icon.sun : icon.moon}</button>
      ${user.id ? `<div class="me"><span class="av" style="background:${avColor(user.name)}">${esc(initials(user.name))}</span>
        <span class="who"><b>${esc(user.name)}</b><small>${esc(user.role)}</small></span>
        <button class="btn small on-dark" id="logout">Se déconnecter</button></div>`
      : `<button class="btn small on-dark" id="login">Se connecter</button>`}
    </div></header>
    <main id="page"></main>`;
  document.getElementById("login")?.addEventListener("click", loginDialog);
  document.getElementById("theme").addEventListener("click", toggleTheme);
  document.getElementById("logout")?.addEventListener("click", () => { state.userId = null; saveState(); toast("Déconnecté"); location.hash = "#/"; router(); });
  if (search) mountSearch(document.getElementById("top-search"), { value: q });
  return document.getElementById("page");
}

const bookCard = (n, terms = [], q = "") => {
  const why = terms.length && n.contents?.find((c) => terms.some((t) => fold(`${c.title} ${c.authors}`).includes(t)));
  const todo = canEdit() && missing(n).length;
  return `<a class="book" href="#/notice/${n.id}${q ? `?${qs({ q })}` : ""}">${coverHtml(n)}<b>${highlight(displayTitle(n), terms)}</b><span>${highlight(subLine(n), terms)}</span>
    ${why ? `<span class="why">Au sommaire : ${highlight(why.title, terms)}, p. ${why.page}</span>` : ""}
    ${todo ? `<span class="pill warn small-pill"><span class="dot"></span>À compléter</span>` : ""}</a>`;
};

const themesHtml = () => `<div class="themes">${THEMES.map((t) => {
  const items = state.notices.filter((n) => inTheme(n, t));
  return `<a class="theme tint" href="#/recherche?${qs({ theme: t.key })}" style="--tbg:${t.bg};--tink:${t.ink}">
    <span class="tx"><b>${t.label}</b><span>${plural(items.length, "titre", "titres")}</span></span>
    <img class="art" src="assets/theme-${t.key}.webp" alt="" loading="lazy"></a>`;
}).join("")}</div>`;

// ---------- Accueil : la recherche, et le travail du jour pour l'équipe ----------

function renderHome() {
  const page = shell("home", { search: false });
  const recent = [...state.notices].sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt)).slice(0, 6);
  const series = seriesList().filter((s) => s.items.length > 1).sort((a, b) => b.items.length - a.items.length);
  const todo = state.notices.filter((n) => missing(n).length);
  const week = state.notices.filter(thisWeek);
  page.innerHTML = `
    <div class="wrap">
      <section class="welcome">
        <div id="hero-search"></div>
        ${canEdit() ? `
        <nav class="quick">
          <a class="tint" href="#/scan" style="--tbg:#fbe0d6;--tink:#a2462a"><span class="tile">${art("ic-scan")}</span><span class="tx"><b>Scanner un carton</b><span>Bipez les albums à la suite</span></span></a>
          <a class="tint" href="#/completer" style="--tbg:#fce9c4;--tink:#94600a"><span class="tile">${art("ic-todo")}</span><span class="tx"><b>Compléter les notices</b><span>${todo.length ? plural(todo.length, "notice attend", "notices attendent") : "Tout est complet"}</span></span></a>
          <a class="tint" href="#/notice/nouvelle?type=album" style="--tbg:#dcebf7;--tink:#2d6493"><span class="tile">${art("ic-album")}</span><span class="tx"><b>Saisir un album</b><span>Sans code-barres</span></span></a>
          <a class="tint" href="#/notice/nouvelle?type=revue" style="--tbg:#fbdde6;--tink:#9e3459"><span class="tile">${art("ic-revue")}</span><span class="tx"><b>Saisir une revue</b><span>Avec son sommaire</span></span></a>
        </nav>` : `
        <div class="try">Par exemple ${["Gaston des années 70", "Van Hamme", "Thorgal 5", "ligne claire"].map((s) => `<button data-q="${esc(s)}">${esc(s)}</button>`).join("")}</div>`}
      </section>
      ${canEdit() ? `
      <dl class="figures wide">
        <div class="figure"><span class="fig-ic">${art("ic-books")}</span><dt>Notices</dt><dd>${state.notices.length}</dd></div>
        <a class="figure" href="#/recherche?etat=incomplet"><span class="fig-ic">${art("ic-todo")}</span><dt>À compléter</dt><dd class="amber">${todo.length}</dd></a>
        <div class="figure"><span class="fig-ic">${art("ic-week")}</span><dt>Cette semaine</dt><dd>+${week.length}</dd></div>
        <div class="figure"><span class="fig-ic">${art("ic-authors")}</span><dt>Auteurs</dt><dd>${allAuthors().length}</dd></div>
      </dl>` : ""}
      <section class="section">
        <div class="section-head"><div><h2>Ajoutés récemment</h2></div><a class="more" href="#/recherche">Tout le fonds ${icon.arrow}</a></div>
        <div class="grid">${recent.map((n) => bookCard(n).replace("</a>", `${canEdit() ? `<span class="by">${esc(n.addedBy)}, ${ago(n.addedAt)}</span>` : ""}</a>`)).join("")}</div>
      </section>
      <section class="section">
        <div class="section-head"><div><h2>Parcourir par thème</h2></div></div>
        ${themesHtml()}
      </section>
      <section class="section">
        <div class="section-head"><div><h2>Les séries</h2></div></div>
        <div class="series-row">${series.map((s) => `
          <a class="series-card" href="#/recherche?${qs({ serie: s.name })}"><div class="stack">${s.items.slice(0, 2).map((n) => coverHtml(n)).join("")}</div>
          <div><b>${esc(s.name)}</b><span>${plural(s.items.length, "tome", "tomes")} · ${esc([...new Set(s.items.flatMap((n) => n.authors.map((a) => a.name.split(" ").slice(-1)[0])))].join(" et "))}</span></div></a>`).join("")}</div>
      </section>
    </div>`;
  const input = mountSearch(page.querySelector("#hero-search"), { hero: true });
  page.querySelectorAll("[data-q]").forEach((b) => b.addEventListener("click", () => (location.hash = `#/recherche?${qs({ q: b.dataset.q })}`)));
  setTimeout(() => input.focus({ preventScroll: true }), 50);
}

// ---------- Résultats ----------

const SORTS = [
  ["serie", "Série, puis tome"],
  ["titre", "Titre, de A à Z"],
  ["recent", "Parution, plus récentes"],
  ["ancien", "Parution, plus anciennes"],
  ["ajout", "Derniers ajouts"],
];
const sortNotices = (list, key) => {
  const byTitle = (a, b) => fold(displayTitle(a)).localeCompare(fold(displayTitle(b)));
  const cmp = {
    titre: byTitle,
    recent: (a, b) => (b.date || "").localeCompare(a.date || ""),
    ancien: (a, b) => (a.date || "9999").localeCompare(b.date || "9999"),
    ajout: (a, b) => new Date(b.addedAt) - new Date(a.addedAt),
  }[key];
  return cmp ? [...list].sort(cmp) : list;
};
const PERIODS = [
  ["Avant 1970", "", "1969"],
  ["Années 70", "1970", "1979"],
  ["Années 80", "1980", "1989"],
  ["Années 90", "1990", "1999"],
  ["Années 2000", "2000", "2009"],
  ["Depuis 2010", "2010", ""],
];
const PUBLISHERS_SHOWN = 5;

function renderResults(p) {
  const page = shell("home", { q: p.q || "" });
  const found = searchNotices(p);
  const { terms, approx, ymin, ymax } = found;
  const results = sortNotices(found.results, p.tri);
  const theme = THEMES.find((t) => t.key === p.theme);
  const link = (changes) => `#/recherche?${qs({ ...p, ...changes })}`;
  // Chaque compteur tient compte des autres critères, pour ne jamais promettre une liste vide.
  const countWith = (changes) => searchNotices({ ...p, ...changes }).results;
  const byType = countWith({ type: "" });
  const byPub = countWith({ editeur: "" });
  const byTheme = countWith({ theme: "" });
  const byYear = countWith({ de: "", a: "", q: (p.q || "").replace(/ann[ée]es?\s+\d+|\b\d{2,4}s\b|\b(19|20)\d\d\b/gi, "").trim() });
  const author = p.auteur || (terms.length && allAuthors().find((a) => terms.every((t) => fold(a).includes(t)) && results.every((n) => n.authors.some((x) => x.name === a))));

  const title = author ? esc(author) : p.serie ? esc(p.serie) : theme ? theme.label : p.etat ? "Notices à compléter" : p.q ? `« ${esc(p.q)} »` : "Tout le fonds";
  const sub = !results.length ? "Aucune notice"
    : approx ? `Vous avez tapé « ${esc(p.q)} » : voici les titres les plus proches.`
    : author ? `${plural(results.length, "album", "albums")} de cet auteur dans le fonds` : plural(results.length, "notice trouvée", "notices trouvées");
  const active = [
    p.type && [p.type === "revue" ? "Revues" : "Albums", { type: "" }],
    theme && [theme.label, { theme: "" }],
    (ymin || ymax) && [ymin === ymax ? `En ${ymin}` : `De ${ymin || "…"} à ${ymax || "…"}`, { de: "", a: "", q: p.q && (p.de || p.a) ? p.q : p.q?.replace(/ann[ée]es?\s+\d+|\b\d{2,4}s\b|\b(19|20)\d\d\b/gi, "").trim() }],
    p.editeur && [p.editeur, { editeur: "" }],
    p.serie && [`Série ${p.serie}`, { serie: "" }],
    p.auteur && [p.auteur, { auteur: "" }],
    p.etat && ["À compléter", { etat: "" }],
  ].filter(Boolean);

  page.innerHTML = `
    <div class="wrap results">
      <aside class="filters" aria-label="Affiner la recherche">
        <div class="filters-head"><h2>Affiner</h2>${active.length ? `<a class="clear-all" href="#/recherche${p.q ? `?${qs({ q: p.q })}` : ""}">Tout effacer</a>` : ""}</div>
        <div class="fgroup"><h3>Thème</h3><div class="theme-picks">${THEMES.filter((t) => !t.type).map((t) => {
          const n = byTheme.filter((x) => inTheme(x, t)).length;
          const on = p.theme === t.key;
          return n || on ? `<a class="theme-pick ${on ? "on" : ""}" href="${link({ theme: on ? "" : t.key })}" style="--tbg:${t.bg};--tink:${t.ink}"><img src="assets/theme-${t.key}.webp" alt=""><span>${t.label}</span><span class="n">${n}</span></a>` : "";
        }).join("")}</div></div>
        <div class="fgroup"><h3>Période</h3><div class="chips">${PERIODS.map(([l, de, a]) => {
          const n = byYear.filter((x) => (!de || year(x) >= +de) && (!a || year(x) <= +a)).length;
          const on = String(ymin || "") === de && String(ymax || "") === a;
          return n || on ? `<a class="chip ${on ? "on" : ""}" href="${link(on ? { de: "", a: "" } : { de, a })}">${l} <span class="n">${n}</span></a>` : "";
        }).join("")}</div>
          <details class="more-years" ${(ymin || ymax) && !PERIODS.some(([, de, a]) => String(ymin || "") === de && String(ymax || "") === a) ? "open" : ""}><summary>Années précises</summary>
            <form class="yrange" id="years"><input class="input" name="de" inputmode="numeric" placeholder="De" value="${esc(ymin || "")}" aria-label="Année de début"><span>à</span><input class="input" name="a" inputmode="numeric" placeholder="À" value="${esc(ymax || "")}" aria-label="Année de fin"><button class="btn small">OK</button></form>
          </details>
        </div>
        <div class="fgroup"><h3>Éditeur</h3>${(() => {
          const pubs = allPublishers().map((x) => [x, byPub.filter((y) => y.publisher === x).length]).filter(([x, n]) => n || p.editeur === x).sort((a, b) => b[1] - a[1]);
          const row = ([x, n]) => `<label class="check"><input type="checkbox" data-editeur="${esc(x)}" ${p.editeur === x ? "checked" : ""}>${esc(x)}<span class="n">${n}</span></label>`;
          const rest = pubs.slice(PUBLISHERS_SHOWN);
          return pubs.slice(0, PUBLISHERS_SHOWN).map(row).join("") + (rest.length ? `<details class="more-pubs" ${rest.some(([x]) => x === p.editeur) ? "open" : ""}><summary>Voir ${plural(rest.length, "autre éditeur", "autres éditeurs")}</summary>${rest.map(row).join("")}</details>` : "");
        })()}</div>
        ${canEdit() ? `<div class="fgroup"><h3>État</h3><label class="switch"><input type="checkbox" id="etat" ${p.etat ? "checked" : ""}><span class="track"></span>À compléter seulement</label></div>` : ""}
      </aside>
      <section>
        <div class="results-head">${p.theme && THEMES.some((t) => t.key === p.theme) ? `<img class="head-art" src="assets/theme-${p.theme}.webp" alt="">` : ""}<div><h1>${title}</h1><p>${sub}</p></div></div>
        <div class="toolbar">
          <div class="segmented" role="group" aria-label="Type">${[["", "Tout"], ["album", "Albums"], ["revue", "Revues"]].map(([v, l]) => {
            const n = v ? byType.filter((x) => x.type === v).length : byType.length;
            return `<a class="${(p.type || "") === v ? "on" : ""} ${!n ? "off" : ""}" href="${link({ type: v })}">${l} <span class="n">${n}</span></a>`;
          }).join("")}</div>
          <label class="sort">${icon.sort}<span class="sr">Trier par</span><select id="sort">${SORTS.map(([v, l]) => `<option value="${v}" ${(p.tri || "serie") === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        </div>
        ${active.length ? `<div class="active-filters">${active.map(([l, c]) => `<button data-clear='${esc(JSON.stringify(c))}'>${esc(l)} ${icon.close}</button>`).join("")}</div>` : ""}
        ${results.length ? `<div class="grid">${results.map((n) => bookCard(n, terms, p.q)).join("")}</div>` : `
          <div class="empty"><img class="empty-art" src="assets/vide-recherche.webp" alt=""><b>Rien trouvé${p.q ? ` pour « ${esc(p.q)} »` : ""}</b>
            <p>Essayez un seul mot, juste le nom de l'auteur, ou retirez un filtre.</p>
            <a class="btn" href="#/recherche">Voir tout le fonds</a></div>
          <div class="section"><div class="section-head"><div><h2>Ou parcourez par thème</h2></div></div>${themesHtml()}</div>`}
      </section>
    </div>`;

  page.querySelector("#sort").addEventListener("change", (e) => (location.hash = link({ tri: e.target.value === "serie" ? "" : e.target.value })));
  page.querySelectorAll("[data-editeur]").forEach((c) => c.addEventListener("change", () => (location.hash = link({ editeur: c.checked ? c.dataset.editeur : "" }))));
  page.querySelectorAll("[data-clear]").forEach((b) => b.addEventListener("click", () => (location.hash = link(JSON.parse(b.dataset.clear)))));
  page.querySelector("#etat")?.addEventListener("change", (e) => (location.hash = link({ etat: e.target.checked ? "incomplet" : "" })));
  page.querySelector("#years").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    location.hash = link({ de: f.get("de").trim(), a: f.get("a").trim() });
  });
}

// ---------- Notice (lecture) ----------

function renderNotice(id, p) {
  const n = state.notices.find((x) => x.id === id);
  const page = shell("home");
  if (!n) return renderMissing(page);
  const isRevue = n.type === "revue";
  const terms = parseQuery(p.q || "").terms;
  const related = isRevue ? state.notices.filter((x) => x.type === "revue" && x.title === n.title)
    : n.series ? state.notices.filter((x) => x.series === n.series)
    : state.notices.filter((x) => x.authors.some((a) => n.authors.some((b) => b.name === a.name)));
  related.sort((a, b) => (a.volume ?? a.number ?? 0) - (b.volume ?? b.number ?? 0));
  const others = related.filter((x) => x.id !== n.id);
  const facts = isRevue
    ? [["Numéro", n.number], ["Parution", formatDate(n.date)], ["Prix", n.price ? formatPrice(n.price) : "Non renseigné"], ["Pages", n.pages || "Non renseigné"], ["Éditeur", esc(n.publisher)], ["ISSN", `<span class="mono">${esc(n.issn || "Non renseigné")}</span>`]]
    : [["Éditeur", esc(n.publisher)], ["Parution", formatDate(n.date)], ["Pages", n.pages || "Non renseigné"], ["ISBN", `<span class="mono">${esc(n.isbn || "Non renseigné")}</span>`]];
  const m = missing(n);

  page.innerHTML = `
    <div class="ambient" style="--cg:${genColor(n.title || "?")};${n.isbn ? `--amb:url(https://covers.openlibrary.org/b/isbn/${n.isbn}-M.jpg)` : ""}"></div>
    <div class="wrap">
      <button class="back" id="back">${icon.back}Retour</button>
      <article class="album">
        ${coverHtml(n, "L")}
        <div>
          <span class="pill ${isRevue ? "info" : ""}">${isRevue ? "Revue" : "Album"}</span>
          <h1>${esc(displayTitle(n))}</h1>
          <div class="series-line">${n.series ? `<a href="#/recherche?${qs({ serie: n.series })}">${esc(n.series)}</a>${n.volume ? `, tome ${n.volume}` : ""}` : isRevue ? esc(n.publisher) : ""}</div>
          ${n.authors.length ? `<div class="people">${n.authors.map((a) => `<a class="person" href="#/recherche?${qs({ auteur: a.name })}" title="Toutes les notices de ${esc(a.name)}"><span class="av" style="background:${avColor(a.name)}">${esc(initials(a.name))}</span><span><b>${esc(a.name)}</b><span>${esc(AUTHOR_ROLES.includes(a.role) ? a.role : "Rôle non précisé")}</span></span></a>`).join("")}</div>` : ""}
          <dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
          ${(n.keywords || []).length ? `<div class="tags">${n.keywords.map((k) => `<a href="#/recherche?${qs({ q: k })}">${esc(k)}</a>`).join("")}</div>` : ""}
          ${canEdit() ? `
            ${m.length ? `<div class="notice-todo">${icon.pencil}<span>Il manque : <b>${esc(missingText(n))}</b></span></div>` : ""}
            <div class="notice-actions"><a class="btn dark" href="#/notice/${n.id}/modifier">${icon.pencil}Modifier</a><button class="btn danger" id="delete">${icon.trash}Supprimer</button>
            <span class="by">Ajoutée par ${esc(n.addedBy || "?")} ${ago(n.addedAt)}${n.editedBy ? ` · modifiée par ${esc(n.editedBy)} ${ago(n.editedAt)}` : ""}</span></div>` : ""}
        </div>
      </article>
      ${isRevue ? `<section class="section"><div class="section-head"><div><h2>Sommaire</h2><p>${plural((n.contents || []).length, "article ou BD", "articles et BD")} dans ce numéro.</p></div></div>
        ${(n.contents || []).length ? `<ol class="toc">${n.contents.map((c) => `<li><span class="p">p. ${c.page}</span><div>${highlight(c.title, terms)}<small>${highlight(c.authors, terms)}</small></div><span class="pill ${c.kind === "BD" ? "info" : ""}">${esc(c.kind)}</span></li>`).join("")}</ol>` : `<div class="empty"><b>Sommaire pas encore saisi</b></div>`}</section>` : ""}
      ${others.length ? `<section class="section"><div class="section-head"><div><h2>${isRevue ? "Les autres numéros" : n.series ? "Dans la même série" : "Du même auteur"}</h2></div></div>
        <div class="grid">${others.map((x) => bookCard(x)).join("")}</div></section>` : ""}
    </div>`;
  page.querySelector("#back").addEventListener("click", () => (history.length > 1 ? history.back() : (location.hash = "#/")));
  page.querySelector("#delete")?.addEventListener("click", () => deleteNotice(n));
}

async function deleteNotice(n) {
  if (!(await confirmDialog({ title: "Supprimer cette notice ?", body: `« ${displayTitle(n)} » sera retirée du fonds pour tout le monde.`, confirmLabel: "Supprimer" }))) return;
  const index = state.notices.indexOf(n);
  state.notices.splice(index, 1);
  saveState();
  location.hash = "#/recherche";
  toast("Notice supprimée", () => { state.notices.splice(index, 0, n); saveState(); location.hash = `#/notice/${n.id}`; });
}

function renderMissing(page) {
  page.innerHTML = `<div class="wrap" style="padding:60px 0"><div class="empty"><img class="empty-art" src="assets/page-perdue.webp" alt=""><b>Cette page n'existe pas</b><p>La notice a peut-être été supprimée.</p><a class="btn" href="#/">Retour à la recherche</a></div></div>`;
}

function renderForbidden(page) {
  page.innerHTML = `<div class="wrap" style="padding:60px 0"><div class="empty"><img class="empty-art" src="assets/acces-equipe.webp" alt=""><b>Réservé à l'équipe</b><p>Sans connexion, on peut rechercher et consulter, pas modifier le fonds.</p><div class="row"><a class="btn" href="#/">Retour à la recherche</a>${role() === "Public" ? `<button class="btn primary" onclick="loginDialog()">Se connecter</button>` : ""}</div></div></div>`;
}

// ---------- Formulaire de notice (partagé : modification, saisie, scan) ----------

let dirty = false;

const authorRow = (a = { name: "", role: "" }) => `
  <div class="arow"><input class="input" name="a-name" value="${esc(a.name)}" placeholder="Prénom Nom" list="author-list" aria-label="Nom de l'auteur">
    <select class="input ${a.name && !AUTHOR_ROLES.includes(a.role) ? "missing" : ""}" name="a-role" aria-label="Rôle"><option value="">Rôle…</option>${AUTHOR_ROLES.map((r) => `<option ${r === a.role ? "selected" : ""}>${r}</option>`).join("")}</select>
    <button type="button" class="btn small ghost" data-arm title="Retirer cet auteur">${icon.close}</button></div>`;

const contentRow = (c = { page: "", title: "", authors: "", kind: "BD" }) => `
  <div class="crow"><input class="input" name="c-page" type="number" min="1" value="${esc(c.page)}" placeholder="Page" aria-label="Page">
    <input class="input" name="c-title" value="${esc(c.title)}" placeholder="Titre de l'article ou de la BD" aria-label="Titre">
    <input class="input" name="c-authors" value="${esc(c.authors)}" placeholder="Auteurs" aria-label="Auteurs">
    <select class="input" name="c-kind" aria-label="Type">${["BD", "Article", "Entretien"].map((k) => `<option ${k === c.kind ? "selected" : ""}>${k}</option>`).join("")}</select>
    <button type="button" class="btn small ghost" data-crm title="Retirer cette ligne">${icon.close}</button></div>`;

function noticeFields(n) {
  const m = missing(n);
  const miss = (k) => (m.includes(k) ? "missing" : "");
  const f = (name, label, value, cls, extra = "") => `<div class="field ${cls}"><label for="f-${name}">${label}</label><input class="input ${miss(name)}" id="f-${name}" name="${name}" value="${esc(value ?? "")}" ${extra}></div>`;
  const isRevue = n.type === "revue";
  return `
    ${f("titre", "Titre", n.title, "c4", "required")}
    ${isRevue ? f("numero", "Numéro", n.number, "c2", 'type="number" min="1" required') : f("tome", "Tome", n.volume, "c2", 'type="number" min="1"')}
    ${isRevue ? "" : f("serie", "Série", n.series, "c3", 'list="series-list"') + f("isbn", "ISBN (code-barres)", n.isbn, "c3", 'inputmode="numeric"')}
    ${isRevue ? "" : `<div class="field c6"><label>Auteurs et rôles</label><div class="authors ${miss("auteurs")}">${(n.authors.length ? n.authors : [undefined]).map(authorRow).join("")}
      <button type="button" class="btn small ghost add" data-aadd>${icon.plus}Ajouter un auteur</button></div></div>`}
    ${f("editeur", "Éditeur", n.publisher, isRevue ? "c3" : "c2", 'list="publisher-list"')}
    ${f("date", "Parution", n.date, isRevue ? "c3" : "c2", 'type="date"')}
    ${f("pages", "Pages", n.pages, "c2", 'type="number" min="1"')}
    ${isRevue ? f("prix", "Prix (€)", n.price, "c2", 'type="number" step="0.01" min="0"') + f("issn", "ISSN", n.issn, "c2", 'placeholder="1234-5678"') : ""}
    ${isRevue ? `<div class="field c6"><label>Sommaire</label><div class="contents ${miss("sommaire")}">${(n.contents || []).map(contentRow).join("")}
      <button type="button" class="btn small ghost add" data-cadd>${icon.plus}Ajouter une ligne au sommaire</button></div></div>` : ""}
    ${f("motscles", "Mots-clés", (n.keywords || []).join(", "), "c6", 'placeholder="humour, aventure, science-fiction…"')}
    <div class="field c6"><div class="chips">${THEMES.filter((t) => !t.type).map((t) => `<button type="button" class="chip" data-kw="${t.kw[0]}">${icon.plus}${t.kw[0]}</button>`).join("")}</div></div>
    <datalist id="series-list">${seriesList().map((s) => `<option value="${esc(s.name)}">`).join("")}</datalist>
    <datalist id="publisher-list">${allPublishers().map((x) => `<option value="${esc(x)}">`).join("")}</datalist>
    <datalist id="author-list">${allAuthors().map((x) => `<option value="${esc(x)}">`).join("")}</datalist>`;
}

function bindFields(form) {
  form.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.matches("[data-aadd]")) { t.insertAdjacentHTML("beforebegin", authorRow()); t.previousElementSibling.querySelector("input").focus(); }
    if (t.matches("[data-cadd]")) { t.insertAdjacentHTML("beforebegin", contentRow()); t.previousElementSibling.querySelector("input").focus(); }
    if (t.matches("[data-arm]")) t.closest(".arow").remove();
    if (t.matches("[data-crm]")) t.closest(".crow").remove();
    if (t.matches("[data-kw]")) {
      const field = form.querySelector('[name="motscles"]');
      const list = field.value.split(",").map((s) => s.trim()).filter(Boolean);
      if (!list.includes(t.dataset.kw)) list.push(t.dataset.kw);
      field.value = list.join(", ");
      field.classList.remove("missing");
    }
    if (t.matches("[data-aadd],[data-cadd],[data-arm],[data-crm],[data-kw]")) dirty = true;
  });
  form.addEventListener("input", (e) => { dirty = true; e.target.classList.remove("missing"); });
  form.addEventListener("change", (e) => { if (e.target.value) e.target.classList.remove("missing"); });
}

function readForm(form, n) {
  const v = (name) => form.querySelector(`[name="${name}"]`)?.value.trim() ?? "";
  n.title = v("titre");
  n.publisher = v("editeur");
  n.date = v("date");
  n.pages = Number(v("pages")) || null;
  n.keywords = v("motscles").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (n.type === "revue") {
    n.number = Number(v("numero")) || n.number;
    n.price = Number(v("prix")) || null;
    n.issn = v("issn");
    n.contents = [...form.querySelectorAll(".crow")].map((r) => ({
      page: Number(r.querySelector('[name="c-page"]').value) || null, title: r.querySelector('[name="c-title"]').value.trim(),
      authors: r.querySelector('[name="c-authors"]').value.trim(), kind: r.querySelector('[name="c-kind"]').value,
    })).filter((c) => c.title).sort((a, b) => (a.page ?? 0) - (b.page ?? 0));
  } else {
    n.volume = Number(v("tome")) || null;
    n.series = v("serie") || null;
    n.isbn = cleanIsbn(v("isbn"));
    n.authors = [...form.querySelectorAll(".arow")].map((r) => ({ name: r.querySelector('[name="a-name"]').value.trim(), role: r.querySelector('[name="a-role"]').value || "Auteur" })).filter((a) => a.name);
  }
}

function focusFirstGap(form) {
  (form.querySelector(".input.missing") || form.querySelector(".missing .input") || form.querySelector('[name="titre"]'))?.focus();
}

function editorPage(n, { title, subtitle, primary, secondary = "", onSave }) {
  return `
    <div class="wrap">
      <button class="back" data-leave>${icon.back}Retour</button>
      <div class="page-head" style="padding-top:4px"><div><h1>${title}</h1><p>${subtitle}</p></div></div>
      <div class="editor">
        ${coverHtml(n, "L")}
        <form class="form" id="editor" novalidate>${noticeFields(n)}
          <div class="savebar">${secondary}<span class="spacer"></span><button class="btn primary big">${icon.check}${primary}</button></div>
        </form>
      </div>
    </div>`;
}

function bindEditorPage(page, n, onSave) {
  const form = page.querySelector("#editor");
  bindFields(form);
  focusFirstGap(form);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!form.querySelector('[name="titre"]').value.trim()) { form.querySelector('[name="titre"]').focus(); return toast("Le titre est obligatoire"); }
    readForm(form, n);
    n.editedBy = me().name;
    n.editedAt = new Date().toISOString();
    dirty = false;
    onSave();
  });
}

function renderEdit(id) {
  const page = shell("home");
  if (!canEdit()) return renderForbidden(page);
  const original = state.notices.find((x) => x.id === id);
  if (!original) return renderMissing(page);
  const n = structuredClone(original);
  page.innerHTML = editorPage(n, { title: `Modifier « ${esc(displayTitle(n))} »`, subtitle: esc(subLine(n)), primary: "Enregistrer" });
  bindEditorPage(page, n, () => {
    Object.assign(original, n);
    saveState();
    toast("Notice enregistrée");
    location.hash = `#/notice/${n.id}`;
  });
}

function renderNew(p) {
  const page = shell("home");
  if (!canEdit()) return renderForbidden(page);
  const type = p.type === "revue" ? "revue" : "album";
  const n = type === "revue"
    ? { type, title: "", number: null, publisher: "", date: "", pages: null, price: null, issn: "", authors: [], keywords: ["revue"], contents: [] }
    : { type, title: "", series: null, volume: null, isbn: "", publisher: "", date: "", pages: null, authors: [], keywords: [] };
  page.innerHTML = editorPage(n, { title: type === "revue" ? "Nouvelle revue" : "Nouvel album", subtitle: type === "revue" ? "Le sommaire peut se compléter plus tard." : "S'il a un code-barres, le scan remplit tout seul : <a href=\"#/scan\">scanner plutôt</a>.", primary: "Ajouter au fonds" });
  bindEditorPage(page, n, () => {
    const id = nextId();
    state.notices.push({ ...n, id, addedBy: me().name, addedAt: new Date().toISOString(), editedBy: null, editedAt: null });
    saveState();
    toast("Notice ajoutée au fonds");
    location.hash = `#/notice/${id}`;
  });
}

// ---------- Scanner un carton ----------

const cleanIsbn = (raw) => raw.replace(/[^0-9Xx]/g, "").toUpperCase();
function isValidIsbn(isbn) {
  if (/^\d{13}$/.test(isbn)) return [...isbn].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0) % 10 === 0;
  if (/^\d{9}[\dX]$/.test(isbn)) return [...isbn].reduce((s, d, i) => s + (d === "X" ? 10 : Number(d)) * (10 - i), 0) % 11 === 0;
  return false;
}
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status);
  return res.json();
}
function toIsoDate(raw) {
  if (!raw) return "";
  const d = new Date(raw);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);
  const y = String(raw).match(/\d{4}/);
  return y ? `${y[0]}-01-01` : "";
}
// « Aldebaran, tome 5 » + « La Créature » devient série Aldebaran, tome 5, titre La Créature.
function splitSeries(rawTitle, subtitle, seriesHint) {
  const title = (rawTitle || "").trim();
  const fromTitle = title.match(/^(.+?),?\s+(?:tome|t\.?)\s*(\d+)\s*[-:]?\s*(.*)$/i);
  if (fromTitle) return { series: fromTitle[1].trim(), volume: Number(fromTitle[2]), title: (fromTitle[3] || subtitle || title).trim() };
  const fromHint = seriesHint?.match(/^(.+?)\s*\((\d+)\)$/);
  return { series: fromHint ? fromHint[1].trim() : seriesHint || "", volume: fromHint ? Number(fromHint[2]) : null, title: subtitle ? `${title} - ${subtitle.trim()}` : title };
}
// Open Library en priorité, Google Books en secours.
async function lookupIsbn(isbn) {
  try {
    const ed = await fetchJson(`https://openlibrary.org/isbn/${isbn}.json`);
    let keys = (ed.authors || []).map((a) => a.key);
    if (!keys.length && ed.works?.[0]) keys = ((await fetchJson(`https://openlibrary.org${ed.works[0].key}.json`)).authors || []).map((a) => a.author.key);
    const names = await Promise.all(keys.map((k) => fetchJson(`https://openlibrary.org${k}.json`).then((a) => a.name).catch(() => null)));
    return { ...splitSeries(ed.title, ed.subtitle, ed.series?.[0]), authors: names.filter(Boolean), publisher: ed.publishers?.[0] || "", date: toIsoDate(ed.publish_date), pages: ed.number_of_pages || null };
  } catch {
    const v = (await fetchJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`)).items?.[0]?.volumeInfo;
    if (!v) throw new Error("introuvable");
    return { ...splitSeries(v.title, v.subtitle, null), authors: v.authors || [], publisher: v.publisher || "", date: toIsoDate(v.publishedDate), pages: v.pageCount || null };
  }
}

function queueStatus(item) {
  if (item.status === "loading") return ["", "Recherche en ligne…"];
  if (item.status === "duplicate") return ["err", "Déjà dans le fonds : ne sera pas ajouté"];
  if (!item.notice.title) return ["warn", "Pas trouvé en ligne : saisissez le titre"];
  const m = missingText(item.notice);
  return m ? ["warn", `Il manque : ${m}`] : ["ok", "Prêt"];
}

let openCard = null; // ISBN de la carte ouverte

function renderScan() {
  const page = shell("scan");
  if (!canEdit()) return renderForbidden(page);
  page.innerHTML = `
    <div class="wrap">
      <div class="page-head"><div><h1>Scanner un carton</h1><p>Bipez chaque album. Rien n'entre dans le fonds tant que vous n'avez pas cliqué sur « Enregistrer ».</p></div>
        <button class="btn ghost" id="empty-queue" hidden>${icon.trash}Vider le carton</button></div>
      <div class="scanner" id="scanner"><span class="beam">${icon.scan}</span>
        <input id="scan-input" inputmode="numeric" placeholder="Bipez le code-barres, ou tapez-le puis Entrée" autocomplete="off" aria-label="Code-barres">
        <button type="button" class="pause">Scan en pause. Cliquez ici pour reprendre.</button></div>
      <p class="scan-help">Le code-barres est au dos, souvent en bas à droite. Douchette, clavier ou copier-coller : tout marche.</p>
      <div class="queue" id="queue"></div>
    </div>
    <div class="dock"><div class="wrap"><div class="sum" id="sum"></div><div class="spacer"></div><button class="btn primary big" id="save-all"></button></div></div>`;

  const input = page.querySelector("#scan-input");
  const scanner = page.querySelector("#scanner");
  input.addEventListener("focus", () => scanner.classList.remove("off"));
  input.addEventListener("blur", () => scanner.classList.add("off"));
  scanner.addEventListener("click", () => input.focus());
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addScan(input.value); input.value = ""; } });
  input.addEventListener("input", () => { const v = cleanIsbn(input.value); if (v.length === 13 && isValidIsbn(v)) { addScan(v); input.value = ""; } });
  page.querySelector("#save-all").addEventListener("click", saveQueue);
  page.querySelector("#empty-queue").addEventListener("click", async () => {
    if (!(await confirmDialog({ title: "Vider le carton ?", body: `Les ${plural(state.queue.length, "album scanné", "albums scannés")} seront retirés de la liste. Rien n'a encore été enregistré dans le fonds.`, confirmLabel: "Vider" }))) return;
    state.queue = [];
    openCard = null;
    saveState();
    renderScan();
  });
  drawQueue();
  if (openCard) openCardFocus(); else input.focus();
}

function drawQueue() {
  const list = document.getElementById("queue");
  if (!list) return;
  const counts = { ok: 0, warn: 0, err: 0 };
  state.queue.forEach((q) => { const [c] = queueStatus(q); if (c in counts) counts[c]++; });
  const savable = state.queue.filter((q) => q.notice && q.status !== "duplicate").length;
  document.getElementById("sum").innerHTML = state.queue.length
    ? `<span class="pill ok"><span class="dot"></span>${plural(counts.ok, "prêt", "prêts")}</span>${counts.warn ? `<span class="pill warn"><span class="dot"></span>${counts.warn} à compléter (enregistrables quand même)</span>` : ""}${counts.err ? `<span class="pill err"><span class="dot"></span>${plural(counts.err, "doublon ignoré", "doublons ignorés")}</span>` : ""}`
    : `<span class="muted">Le carton est vide.</span>`;
  const save = document.getElementById("save-all");
  save.disabled = !savable;
  save.innerHTML = `${icon.check}Enregistrer ${savable ? plural(savable, "album", "albums") : "le carton"}`;
  document.getElementById("empty-queue").hidden = !state.queue.length;

  if (!state.queue.length) {
    list.innerHTML = `<div class="queue-empty"><img class="empty-art" src="assets/vide-carton.webp" alt=""><b>Le carton est vide</b>Bipez un premier album pour commencer.<br>Pour essayer : 9782205049718 (Aldébaran, tome 5).</div>`;
    return;
  }
  list.innerHTML = state.queue.map((q) => {
    const [cls, label] = queueStatus(q);
    const dup = q.status === "duplicate" ? state.notices.find((x) => x.isbn === q.isbn) : null;
    const n = dup || q.notice || { title: "", type: "album", authors: [], isbn: q.isbn };
    const open = openCard === q.isbn && q.notice;
    return `
      <div class="qcard ${q.status === "loading" ? "loading" : cls}" data-isbn="${q.isbn}">
        ${coverHtml(n)}
        <div style="min-width:0">
          <h3>${esc(displayTitle(n) || (q.status === "loading" ? "Recherche en cours" : "Titre inconnu"))}</h3>
          <div class="meta">${esc([seriesLabel(n), authorNames(n), n.publisher, year(n)].filter(Boolean).join(" · ") || "En attente des informations")}</div>
          <div class="isbn">ISBN ${esc(q.isbn)}</div>
        </div>
        <div class="side">
          <span class="pill ${cls}"><span class="dot"></span>${esc(label)}</span>
          <div class="row">
            ${dup ? `<a class="btn small" href="#/notice/${dup.id}">Voir la notice</a>` : q.notice ? `<button class="btn small" data-edit>${icon.pencil}${open ? "Fermer" : "Compléter"}</button>` : ""}
            <button class="btn small ghost" data-remove title="Retirer du carton">${icon.close}Retirer</button>
          </div>
        </div>
        ${open ? `<form class="qedit" novalidate>${noticeFields(q.notice)}<div class="field c6 qedit-actions"><button class="btn dark">${icon.check}Terminer cette notice</button></div></form>` : ""}
      </div>`;
  }).join("");

  list.querySelectorAll(".qcard").forEach((card) => {
    const isbn = card.dataset.isbn;
    const index = state.queue.findIndex((q) => q.isbn === isbn);
    card.querySelector("[data-remove]").addEventListener("click", () => {
      const [removed] = state.queue.splice(index, 1);
      if (openCard === isbn) openCard = null;
      saveState(); drawQueue(); refocus();
      toast("Album retiré du carton", () => { state.queue.splice(index, 0, removed); saveState(); drawQueue(); });
    });
    card.querySelector("[data-edit]")?.addEventListener("click", () => {
      openCard = openCard === isbn ? null : isbn;
      drawQueue();
      if (openCard) openCardFocus(); else refocus();
    });
    const form = card.querySelector(".qedit");
    if (form) {
      bindFields(form);
      form.addEventListener("submit", (e) => { e.preventDefault(); readForm(form, state.queue[index].notice); openCard = null; dirty = false; saveState(); drawQueue(); refocus(); });
    }
  });
}

function openCardFocus() {
  const card = document.querySelector(`.qcard[data-isbn="${openCard}"]`);
  if (!card) return;
  card.scrollIntoView({ block: "start", behavior: "smooth" });
  const form = card.querySelector(".qedit");
  if (form) focusFirstGap(form);
}

const refocus = () => document.getElementById("scan-input")?.focus({ preventScroll: true });

async function addScan(raw) {
  const isbn = cleanIsbn(raw);
  if (!isbn) return;
  if (!isValidIsbn(isbn)) { beep(false); toast(`Code-barres illisible (${isbn}). Rebipez l'album.`); return; }
  if (state.queue.some((q) => q.isbn === isbn)) { beep(false); toast("Cet album est déjà dans le carton"); return; }
  const item = { isbn, status: "loading", notice: null };
  state.queue.unshift(item);
  if (state.notices.some((x) => x.isbn === isbn)) {
    item.status = "duplicate";
    beep(false);
    saveState(); drawQueue(); return;
  }
  drawQueue();
  try {
    const r = await lookupIsbn(isbn);
    const known = seriesList().find((s) => fold(s.name) === fold(r.series))?.name;
    item.notice = { type: "album", title: r.title, series: known || r.series || null, volume: r.volume, isbn, publisher: r.publisher, date: r.date, pages: r.pages,
      authors: r.authors.map((name) => ({ name, role: "Auteur" })), keywords: [] };
    item.status = "found";
    beep(true);
  } catch {
    item.notice = { type: "album", title: "", series: null, volume: null, isbn, publisher: "", date: "", pages: null, authors: [], keywords: [] };
    item.status = "notfound";
    beep(false);
  }
  saveState();
  // Pas trouvé : on ouvre directement la saisie, sauf si une autre carte est en cours.
  if (item.status === "notfound" && !openCard) { openCard = isbn; drawQueue(); openCardFocus(); }
  else drawQueue();
}

function saveQueue() {
  const toSave = state.queue.filter((q) => q.notice && q.status !== "duplicate");
  for (const q of toSave) {
    state.notices.push({ ...q.notice, id: nextId(), title: q.notice.title || `Sans titre (${q.isbn})`, addedBy: me().name, addedAt: new Date().toISOString(), editedBy: null, editedAt: null });
  }
  const incomplete = toSave.filter((q) => missing(q.notice).length).length;
  state.queue = [];
  openCard = null;
  saveState();
  toast(`${plural(toSave.length, "album ajouté", "albums ajoutés")} au fonds${incomplete ? `, dont ${incomplete} à compléter` : ""}`);
  renderScan();
}

// ---------- Compléter les notices, une par une ----------

let doneThisSession = 0;

function renderTodo(p) {
  const page = shell("todo");
  if (!canEdit()) return renderForbidden(page);
  const todo = state.notices.filter((x) => missing(x).length);
  if (!todo.length) {
    page.innerHTML = `<div class="wrap" style="padding:60px 0"><div class="empty"><img class="empty-art" src="assets/tout-complet.webp" alt=""><b>Tout est complet</b><p>${doneThisSession ? `Vous avez complété ${plural(doneThisSession, "notice", "notices")}. ` : ""}Aucune notice n'attend.</p><a class="btn" href="#/">Retour à la recherche</a></div></div>`;
    return;
  }
  const skip = Number(p.passer || 0) % todo.length;
  const original = todo[skip];
  const n = structuredClone(original);
  const total = todo.length + doneThisSession;
  page.innerHTML = editorPage(n, {
    title: esc(displayTitle(n) || "Sans titre"),
    subtitle: `Il manque : <b>${esc(missingText(n))}</b>`,
    primary: "Enregistrer et suivante",
    secondary: `<a class="btn ghost" href="#/completer?passer=${skip + 1}">Passer pour l'instant</a>
      <div class="progress"><div class="bar"><i style="width:${Math.round((doneThisSession / total) * 100)}%"></i></div><span>${doneThisSession} faite${doneThisSession > 1 ? "s" : ""} · ${plural(todo.length, "restante", "restantes")}</span></div>`,
  });
  page.querySelector(".back").outerHTML = `<div style="height:20px"></div>`;
  bindEditorPage(page, n, () => {
    Object.assign(original, n);
    saveState();
    const stillMissing = missing(original).length;
    if (!stillMissing) doneThisSession++;
    toast(stillMissing ? `Enregistrée, il manque encore : ${missingText(original)}` : "Notice complète");
    // La notice complétée sort de la liste : le même rang désigne la suivante.
    location.hash = `#/completer?passer=${stillMissing ? skip + 1 : skip}`;
    if (location.hash === `#/completer?passer=${skip}`) router();
  });
}

// ---------- Équipe : qui a accès, avec quel rôle ----------

function renderAccounts() {
  const page = shell("users");
  if (!isAdmin()) return renderForbidden(page);
  const self = me();
  page.innerHTML = `
    <div class="wrap">
      <div class="page-head"><div><h1>L'équipe</h1><p>Les personnes qui peuvent se connecter, et ce que chacune a le droit de faire.</p></div><button class="btn primary" id="add-user">${icon.plus}Ajouter une personne</button></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Personne</th><th>Rôle</th><th>Notices ajoutées</th><th>Dernière visite</th><th></th></tr></thead><tbody>${state.users.map((u) => `
        <tr style="cursor:default"><td><div class="tbook"><span class="av-lg" style="background:${avColor(u.name)}">${esc(initials(u.name))}</span><div><b>${esc(u.name)}${u.id === self.id ? " (vous)" : ""}</b><span>${esc(u.email)}</span></div></div></td>
          <td><select class="role-select ${u.role}" data-user="${u.id}" ${u.id === self.id ? 'disabled title="Vous ne pouvez pas changer votre propre rôle"' : ""}>${ROLES.map((r) => `<option value="${r}" ${r === u.role ? "selected" : ""}>${r}</option>`).join("")}</select><div class="hint">${ROLE_INFO[u.role]}</div></td>
          <td>${state.notices.filter((n) => n.addedBy === u.name).length}</td>
          <td class="muted">${esc(u.lastSeen)}</td>
          <td style="text-align:right">${u.id === self.id ? "" : `<button class="btn small ghost danger-text" data-remove="${u.id}">${icon.trash}Retirer l'accès</button>`}</td></tr>`).join("")}</tbody></table></div>
    </div>`;
  page.querySelectorAll("[data-user]").forEach((sel) => sel.addEventListener("change", async () => {
    const u = state.users.find((x) => x.id === Number(sel.dataset.user));
    if (!(await confirmDialog({ title: `Passer ${u.name} en ${sel.value} ?`, body: `${u.name} pourra : ${ROLE_INFO[sel.value].toLowerCase()}.`, confirmLabel: "Changer le rôle", danger: false }))) { sel.value = u.role; return; }
    u.role = sel.value;
    saveState();
    toast("Rôle mis à jour");
    renderAccounts();
  }));
  page.querySelectorAll("[data-remove]").forEach((b) => b.addEventListener("click", async () => {
    const u = state.users.find((x) => x.id === Number(b.dataset.remove));
    if (!(await confirmDialog({ title: `Retirer l'accès de ${u.name} ?`, body: "Cette personne ne pourra plus se connecter. Les notices qu'elle a ajoutées restent dans le fonds.", confirmLabel: "Retirer l'accès" }))) return;
    const index = state.users.indexOf(u);
    state.users.splice(index, 1);
    saveState();
    renderAccounts();
    toast("Accès retiré", () => { state.users.splice(index, 0, u); saveState(); renderAccounts(); });
  }));
  page.querySelector("#add-user").addEventListener("click", addUserDialog);
}

function addUserDialog() {
  openModal(`<h2>Ajouter une personne</h2>
    <form class="form-grid" id="new-user">
      <div class="field"><label for="u-name">Prénom et nom</label><input class="input" id="u-name" name="name" required></div>
      <div class="field"><label for="u-mail">E-mail</label><input class="input" id="u-mail" name="email" type="email" required placeholder="prenom.nom@maisonbd.local"></div>
      <div class="field"><label>Rôle</label>${ROLES.map((r) => `<label class="check"><input type="radio" name="role" value="${r}" ${r === "Gestionnaire" ? "checked" : ""}><span><b>${r}</b><br><span class="muted">${ROLE_INFO[r]}</span></span></label>`).join("")}</div>
      <div class="modal-actions"><button type="button" class="btn" data-cancel>Annuler</button><button class="btn primary">Ajouter</button></div>
    </form>`, {
    ready: (modal, close) => {
      const form = modal.querySelector("form");
      modal.querySelector("[data-cancel]").addEventListener("click", close);
      modal.querySelector("#u-name").focus();
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!form.reportValidity()) return;
        const f = new FormData(form);
        state.users.push({ id: Math.max(0, ...state.users.map((u) => u.id)) + 1, name: f.get("name").trim(), email: f.get("email").trim(), role: f.get("role"), lastSeen: "Jamais connecté" });
        saveState();
        close();
        toast("Compte créé : un e-mail d'invitation part à cette adresse");
        renderAccounts();
      });
    },
  });
}

// ---------- Connexion ----------

function loginDialog() {
  const demo = state.users.filter((u) => u.role !== "Public");
  openModal(`${art("acces-equipe", "modal-art")}<h2>Se connecter</h2><p>Réservé à l'équipe. La recherche reste ouverte à tous sans connexion.</p>
    <form class="form-grid" id="login-form">
      <div class="field"><label for="l-mail">E-mail</label><input class="input" id="l-mail" name="email" type="email" required autocomplete="username"></div>
      <div class="field"><label for="l-pass">Mot de passe</label><input class="input" id="l-pass" name="password" type="password" required autocomplete="current-password"></div>
      <div class="demo-accounts"><span class="muted">Prototype : connexion d'un clic</span>${demo.map((u) => `<button type="button" class="chip" data-uid="${u.id}">${esc(u.name)} · ${u.role}</button>`).join("")}</div>
      <div class="modal-actions"><button type="button" class="btn" data-cancel>Annuler</button><button class="btn primary">Se connecter</button></div>
    </form>`, {
    ready: (modal, close) => {
      const form = modal.querySelector("form");
      const login = (u) => { state.userId = u.id; saveState(); close(); toast(`Bonjour ${u.name.split(" ")[0]}`); router(); };
      modal.querySelector("[data-cancel]").addEventListener("click", close);
      modal.querySelectorAll("[data-uid]").forEach((b) => b.addEventListener("click", () => login(state.users.find((u) => u.id === Number(b.dataset.uid)))));
      modal.querySelector("#l-mail").focus();
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const u = state.users.find((x) => x.email === form.email.value.trim() && x.role !== "Public");
        if (!u) { form.email.classList.add("missing"); return toast("Aucun compte de l'équipe avec cet e-mail"); }
        login(u);
      });
    },
  });
}

// ---------- Navigation ----------

function currentParams() {
  const [, query] = location.hash.split("?");
  return Object.fromEntries(new URLSearchParams(query));
}

function router() {
  const [path] = location.hash.replace(/^#\/?/, "").split("?");
  const p = currentParams();
  dirty = false;
  let m;
  if (path === "") renderHome();
  else if (path === "recherche") renderResults(p);
  else if (path === "notice/nouvelle") renderNew(p);
  else if ((m = path.match(/^notice\/(\d+)\/modifier$/))) renderEdit(Number(m[1]));
  else if ((m = path.match(/^notice\/(\d+)$/))) renderNotice(Number(m[1]), p);
  else if (path === "scan") renderScan();
  else if (path === "completer") renderTodo(p);
  else if (path === "comptes") renderAccounts();
  else renderMissing(shell("home"));
  if (!(path === "scan" && openCard)) window.scrollTo(0, 0);
}

// Quitter un formulaire modifié : on demande avant de perdre la saisie.
document.addEventListener("click", async (e) => {
  const leave = e.target.closest("a[href^='#'], [data-leave]");
  if (!leave || !dirty || leave.closest("form")) return;
  e.preventDefault();
  if (!(await confirmDialog({ title: "Quitter sans enregistrer ?", body: "Les modifications de cette notice seront perdues.", confirmLabel: "Quitter sans enregistrer" }))) return;
  dirty = false;
  if (leave.matches("[data-leave]")) history.back(); else location.hash = leave.getAttribute("href");
}, true);
document.addEventListener("click", (e) => { if (e.target.closest("[data-leave]") && !dirty) history.back(); });

// La douchette tape comme un clavier : sur l'écran de scan, les chiffres vont toujours dans le champ.
document.addEventListener("keydown", (e) => {
  const scan = document.getElementById("scan-input");
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  if (scan && !typing && /^[0-9Xx]$/.test(e.key)) scan.focus();
  if (!typing && e.key === "/") {
    const search = document.querySelector(".search input");
    if (search) { e.preventDefault(); search.focus(); }
  }
});
window.addEventListener("hashchange", router);
router();
