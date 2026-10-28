"use strict";

/* =========================================================
   Configurazione dei percorsi
   ========================================================= */
const LESSONS_PER_UNIT = 5;           // l'ultima di ogni unità è la "sfida"
const MAX_HEARTS = 5;
const TRACKS = {
  geo: {
    label: "Geografia",
    units: [
      { title: "Capitali d'Europa e del mondo", desc: "I paesi più famosi e le loro capitali" },
      { title: "Esploratore", desc: "Nord Europa, Sud America e nuovi continenti" },
      { title: "Viaggiatore", desc: "Balcani, Baltico, Africa e Asia: ora si scrive!" },
      { title: "Cartografo", desc: "Caucaso, Asia centrale, Africa e Caraibi" },
      { title: "Maestro di geografia", desc: "Micro-stati, isole e capitali rarissime" },
    ],
  },
  flags: {
    label: "Bandiere",
    units: [
      { title: "Bandiere famose", desc: "Quelle che hai visto mille volte" },
      { title: "Tricolori e croci", desc: "Nord Europa, Americhe e bandiere simili" },
      { title: "Occhio ai dettagli", desc: "Stelle, strisce e colori quasi uguali" },
      { title: "Vessillologo", desc: "Bandiere dell'Asia, dell'Africa e dei Caraibi" },
      { title: "Maestro di bandiere", desc: "Micro-stati e bandiere gemelle" },
    ],
  },
};

/* =========================================================
   Utilità
   ========================================================= */
const $ = (id) => document.getElementById(id);
const rand = (n) => Math.floor(Math.random() * n);
const shuffle = (a) => {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const byCode = Object.fromEntries(COUNTRIES.map((c) => [c.f, c]));
const flagUrl = (c) => `https://flagcdn.com/w320/${c.f}.png`;
const flagEmoji = (c) =>
  String.fromCodePoint(...c.f.toUpperCase().split("").map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));

function normalize(s) {
  s = s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
  return s.replace(/^(il|la|lo|l|el) /, "");
}
function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}
function typedMatches(input, answers) {
  const x = normalize(input);
  if (!x) return false;
  return answers.some((ans) => {
    const y = normalize(ans);
    if (x === y) return true;
    const tol = y.length >= 11 ? 2 : y.length >= 6 ? 1 : 0;   // tollera piccoli errori di battitura
    return tol > 0 && levenshtein(x, y) <= tol;
  });
}
function weighted(entries) {          // [[valore, peso], ...]
  const tot = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * tot;
  for (const [v, w] of entries) { if ((r -= w) < 0) return v; }
  return entries[0][0];
}

/* =========================================================
   Stato salvato
   ========================================================= */
const SAVE_KEY = "geoquiz.v1";
const defaultState = () => ({
  xp: 0, streak: 0, lastDay: null,
  geo: { done: 0, stars: {} },
  flags: { done: 0, stars: {} },
});
let state = defaultState();
try { state = { ...defaultState(), ...JSON.parse(localStorage.getItem(SAVE_KEY) || "{}") }; } catch (e) { /* ignora */ }
const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* ignora */ } };
let track = state.lastTrack || "geo";

const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
function touchStreak() {
  const today = dayKey();
  if (state.lastDay === today) return;
  const y = new Date(); y.setDate(y.getDate() - 1);
  state.streak = state.lastDay === dayKey(y) ? state.streak + 1 : 1;
  state.lastDay = today;
}
function currentStreak() {            // mostra 0 se la serie è già interrotta
  const y = new Date(); y.setDate(y.getDate() - 1);
  return [dayKey(), dayKey(y)].includes(state.lastDay) ? state.streak : 0;
}

/* =========================================================
   Generazione delle domande
   ========================================================= */
const poolFor = (unit) => COUNTRIES.filter((c) => c.tier <= unit);

function similarity(a, b) {
  return SIMILAR_FLAGS.some((g) => g.includes(a.f) && g.includes(b.f));
}

/** Sceglie 3 distrattori: dal livello 2 in poi sempre più "vicini" alla risposta giusta. */
function distractors(target, unit, trackId, key) {
  const seen = new Set([key(target)]);
  const scored = poolFor(unit)
    .filter((c) => c !== target)
    .map((c) => {
      let s = Math.random();
      if (c.c === target.c) s += 0.3 * (unit - 1);
      if (trackId === "flags" && unit >= 2 && similarity(c, target)) s += 1.2 + 0.3 * unit;
      return [c, s];
    })
    .sort((a, b) => b[1] - a[1]);
  const out = [];
  for (const [c] of scored) {
    if (out.length === 3) break;
    if (seen.has(key(c))) continue;
    seen.add(key(c)); out.push(c);
  }
  return out;
}

function pickKind(trackId, unit, lesson) {
  const late = lesson >= 2;
  if (trackId === "geo") {
    return weighted([
      ["cap", 40], ["cap2c", 30],
      ["cont", unit <= 2 ? 20 : 6],
      ["odd", unit >= 2 ? 15 : 0],
      ["typeCap", unit >= 3 && late ? 12 + 10 * (unit - 3) + (lesson === 4 ? 10 : 0) : 0],
    ]);
  }
  return weighted([
    ["f2n", 60 - 6 * unit],
    ["n2f", unit === 1 && lesson === 0 ? 0 : 30],
    ["typeName", unit >= 3 && late ? 14 + 10 * (unit - 3) + (lesson === 4 ? 10 : 0) : 0],
  ]);
}

function buildQuestion(kind, t, unit, trackId) {
  const opts = (list, label, extra) =>
    shuffle([t, ...list]).map((c) => ({ label: label(c), country: c, correct: c === t, ...extra }));
  switch (kind) {
    case "cap":
      return { kind, prompt: `Qual è la capitale di ${t.n}?`,
        options: opts(distractors(t, unit, trackId, (c) => c.cap), (c) => c.cap), answer: t.cap };
    case "cap2c":
      return { kind, prompt: `${t.cap} è la capitale di quale paese?`,
        options: opts(distractors(t, unit, trackId, (c) => c.n), (c) => c.n), answer: t.n };
    case "cont": {
      const others = shuffle(CONTINENTS.filter((c) => c !== t.c)).slice(0, 3);
      return { kind, prompt: `In quale continente si trova ${t.n}?`,
        options: shuffle([t.c, ...others]).map((c) => ({ label: c, correct: c === t.c })), answer: t.c };
    }
    case "odd": {
      const pool = poolFor(unit);
      const groups = CONTINENTS.filter((cn) => cn !== t.c && pool.filter((c) => c.c === cn).length >= 3);
      const cn = groups[rand(groups.length)];
      const same = shuffle(pool.filter((c) => c.c === cn)).slice(0, 3);
      return { kind, prompt: `Quale di questi paesi NON si trova in ${cn}?`,
        options: opts(same, (c) => c.n), answer: t.n,
        note: `${t.n} si trova in ${t.c}.` };
    }
    case "typeCap":
      return { kind, prompt: `Scrivi la capitale di ${t.n}`, type: true, answer: t.cap,
        accept: [t.cap, ...(t.alt_cap || [])] };
    case "f2n":
      return { kind, prompt: "Di quale paese è questa bandiera?", flag: t,
        options: opts(distractors(t, unit, trackId, (c) => c.n), (c) => c.n), answer: t.n };
    case "n2f":
      return { kind, prompt: `Quale di queste è la bandiera di ${t.n}?`, flagOptions: true,
        options: opts(distractors(t, unit, trackId, (c) => c.f), () => ""), answer: t.n };
    case "typeName":
      return { kind, prompt: "Scrivi il nome di questo paese", flag: t, type: true, answer: t.n,
        accept: [t.n, ...(t.alt || [])] };
  }
}

function buildLesson(trackId, unit, lesson) {
  const isBoss = lesson === LESSONS_PER_UNIT - 1;
  const count = isBoss ? 12 : 10;
  let fresh = COUNTRIES.filter((c) => c.tier === unit);
  const review = COUNTRIES.filter((c) => c.tier < unit);
  if (unit === 1) fresh = fresh.slice(0, 8 + lesson * 4);   // la prima unità si apre gradualmente
  const newRatio = unit === 1 ? 1 : isBoss ? 0.5 : 0.65;

  const used = new Set();
  const targets = [];
  let guard = 0;
  while (targets.length < count && guard++ < 500) {
    const src = Math.random() < newRatio || !review.length ? fresh : review;
    const c = src[rand(src.length)];
    if (!used.has(c.f)) { used.add(c.f); targets.push(c); }
  }
  return targets.map((t) => buildQuestion(pickKind(trackId, unit, lesson), t, unit, trackId));
}

/* =========================================================
   Schermata home (percorso)
   ========================================================= */
const OFFSETS = [0, 46, 78, 46, 0, -46, -78, -46];
const nodeIndex = (u, l) => u * LESSONS_PER_UNIT + l;

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
  window.scrollTo(0, 0);
}

function renderHome() {
  document.body.dataset.track = track;
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.track === track));
  $("streak").textContent = currentStreak();
  $("xp").textContent = state.xp;

  const prog = state[track];
  const path = $("path");
  path.innerHTML = "";
  TRACKS[track].units.forEach((unit, u) => {
    const unitLocked = nodeIndex(u, 0) > prog.done;
    const banner = document.createElement("div");
    banner.className = "unit-banner" + (unitLocked ? " locked" : "");
    banner.innerHTML = `<small>Unità ${u + 1}</small><h3></h3><p></p>`;
    banner.querySelector("h3").textContent = unit.title;
    banner.querySelector("p").textContent = unit.desc;
    path.appendChild(banner);

    for (let l = 0; l < LESSONS_PER_UNIT; l++) {
      const idx = nodeIndex(u, l);
      const boss = l === LESSONS_PER_UNIT - 1;
      const done = idx < prog.done, current = idx === prog.done, locked = idx > prog.done;
      const row = document.createElement("div");
      row.className = "node-row";
      row.style.transform = `translateX(${OFFSETS[idx % OFFSETS.length]}px)`;
      const b = document.createElement("button");
      b.className = "node" + (done ? " done" : "") + (current ? " current" : "") + (locked ? " locked" : "");
      b.disabled = locked;
      b.setAttribute("aria-label", `Unità ${u + 1}, ${boss ? "sfida finale" : "lezione " + (l + 1)}`);
      b.textContent = locked ? "🔒" : boss ? "🏆" : done ? "✓" : "★";
      if (done) {
        const s = document.createElement("span");
        s.className = "mini-stars";
        s.textContent = "⭐".repeat(prog.stars[idx] || 1);
        b.appendChild(s);
      }
      b.addEventListener("click", () => startLesson(u, l));
      row.appendChild(b);
      path.appendChild(row);
      if (current) requestAnimationFrame(() => row.scrollIntoView({ block: "center" }));
    }
  });
}

/* =========================================================
   Lezione
   ========================================================= */
let L = null;   // stato lezione in corso

function startLesson(unitIdx, lessonIdx) {
  const unit = unitIdx + 1;
  L = {
    unitIdx, lessonIdx, queue: buildLesson(track, unit, lessonIdx), total: 0,
    hearts: MAX_HEARTS, answered: 0, correct: 0, mistakes: 0, q: null, checked: false, selected: null,
  };
  L.total = L.queue.length;
  showScreen("lesson");
  nextQuestion();
}

function setFlagImage(img, country, cls) {
  img.src = flagUrl(country);
  img.onerror = () => {   // senza rete: ripiego sull'emoji della bandiera
    const span = document.createElement("span");
    span.className = cls; span.textContent = flagEmoji(country);
    img.replaceWith(span);
  };
}

function nextQuestion() {
  if (!L.queue.length) return finishLesson(true);
  const q = (L.q = L.queue.shift());
  L.checked = false; L.selected = null;

  $("bar").style.width = `${(L.answered / L.total) * 100}%`;
  $("hearts").textContent = L.hearts;
  $("prompt").textContent = q.prompt;
  $("feedback").className = "feedback";
  $("fbtext").textContent = "";
  const action = $("action");
  action.textContent = "Controlla"; action.disabled = true;

  // bandiera in alto
  const box = $("flagbox");
  box.hidden = !q.flag;
  if (q.flag) {
    box.innerHTML = '<img id="flagimg" alt="Bandiera da indovinare">';
    setFlagImage($("flagimg"), q.flag, "flag-emoji");
  }

  // risposte
  const optsEl = $("options"), form = $("typeform");
  optsEl.innerHTML = "";
  optsEl.className = "options" + (q.flagOptions ? " flags" : "");
  optsEl.hidden = !!q.type;
  form.hidden = !q.type;
  if (q.type) {
    const input = $("typeinput");
    input.value = ""; input.className = ""; input.disabled = false;
    setTimeout(() => input.focus(), 50);
  } else {
    q.options.forEach((o, i) => {
      const b = document.createElement("button");
      b.className = "opt" + (q.flagOptions ? " flag" : "");
      b.innerHTML = '<span class="key"></span>';
      b.firstChild.textContent = i + 1;
      if (q.flagOptions) {
        const img = document.createElement("img");
        img.alt = `Opzione ${i + 1}`;
        setFlagImage(img, o.country, "flag-emoji small");
        b.appendChild(img);
      } else {
        const t = document.createElement("span"); t.textContent = o.label; b.appendChild(t);
      }
      b.addEventListener("click", () => selectOption(i));
      optsEl.appendChild(b);
    });
  }
}

function selectOption(i) {
  if (L.checked) return;
  L.selected = i;
  [...$("options").children].forEach((b, k) => b.classList.toggle("selected", k === i));
  $("action").disabled = false;
}

function checkAnswer() {
  const q = L.q;
  let ok;
  if (q.type) {
    const input = $("typeinput");
    ok = typedMatches(input.value, q.accept);
    input.classList.add(ok ? "right" : "wrong");
    input.disabled = true;
  } else {
    ok = q.options[L.selected].correct;
    [...$("options").children].forEach((b, k) => {
      b.disabled = true; b.classList.remove("selected");
      if (q.options[k].correct) b.classList.add("right");
      else if (k === L.selected) b.classList.add("wrong");
    });
  }
  L.checked = true;

  const fb = $("feedback");
  fb.className = "feedback " + (ok ? "ok" : "ko");
  if (ok) {
    L.correct++; L.answered++;
    $("fbtext").textContent = ["Corretto!", "Ottimo!", "Perfetto!", "Esatto!"][rand(4)];
  } else {
    L.mistakes++; L.hearts--;
    L.queue.push(q);        // la domanda sbagliata ritorna a fine lezione
    $("hearts").textContent = L.hearts;
    $("fbtext").innerHTML = "";
    const main = document.createElement("div");
    main.textContent = "Risposta corretta:";
    const small = document.createElement("small");
    small.textContent = q.answer + (q.note ? ` — ${q.note}` : "");
    $("fbtext").append(main, small);
  }
  $("bar").style.width = `${(L.answered / L.total) * 100}%`;
  $("action").textContent = "Continua";
  $("action").disabled = false;
}

function onAction() {
  if (!L) return;
  if (!L.checked) return checkAnswer();
  if (L.hearts <= 0) return finishLesson(false);
  nextQuestion();
}

function finishLesson(win) {
  const idx = nodeIndex(L.unitIdx, L.lessonIdx);
  const acc = Math.round((L.correct / Math.max(1, L.correct + L.mistakes)) * 100);
  const stars = L.mistakes === 0 ? 3 : L.mistakes <= 2 ? 2 : 1;
  let xp = 0;

  if (win) {
    xp = L.correct * 10 + (L.mistakes === 0 ? 20 : 0);
    const prog = state[track];
    if (idx === prog.done) prog.done++;
    prog.stars[idx] = Math.max(prog.stars[idx] || 0, stars);
    state.xp += xp;
    touchStreak();
  }
  state.lastTrack = track;
  save();

  const last = L;
  $("resEmoji").textContent = win ? (stars === 3 ? "🏆" : "🎉") : "💔";
  $("resTitle").textContent = win ? "Lezione completata!" : "Hai finito le vite!";
  $("resTitle").className = win ? "" : "fail";
  $("resStars").textContent = win ? "⭐".repeat(stars) + "☆".repeat(3 - stars) : "";
  $("resXp").textContent = `+${xp}`;
  $("resAcc").textContent = `${acc}%`;
  $("resRetry").onclick = () => startLesson(last.unitIdx, last.lessonIdx);
  $("resContinue").onclick = () => { renderHome(); showScreen("home"); };
  L = null;
  showScreen("result");
}

/* =========================================================
   Eventi
   ========================================================= */
document.querySelectorAll(".tab").forEach((t) =>
  t.addEventListener("click", () => { track = t.dataset.track; state.lastTrack = track; save(); renderHome(); }));

$("action").addEventListener("click", onAction);
$("typeform").addEventListener("submit", (e) => { e.preventDefault(); if (!$("action").disabled || L.checked) onAction(); });
$("typeinput").addEventListener("input", () => { if (!L.checked) $("action").disabled = !$("typeinput").value.trim(); });
$("quit").addEventListener("click", () => {
  if (confirm("Vuoi uscire? I progressi di questa lezione andranno persi.")) { L = null; renderHome(); showScreen("home"); }
});
$("reset").addEventListener("click", () => {
  if (confirm("Vuoi davvero azzerare tutti i progressi?")) { state = defaultState(); save(); track = "geo"; renderHome(); }
});
document.addEventListener("keydown", (e) => {
  if (!L || !$("lesson").classList.contains("active")) return;
  if (e.key === "Enter") {
    if (e.target === $("typeinput")) return;   // gestito dal form
    e.preventDefault();
    if (!$("action").disabled) onAction();
  } else if (!L.q.type && !L.checked && /^[1-4]$/.test(e.key)) {
    selectOption(Number(e.key) - 1);
  }
});

renderHome();
