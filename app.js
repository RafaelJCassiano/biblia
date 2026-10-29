(function () {
  "use strict";
  var BIBLE, GUIDE, CTX, ABBR, IDX;
  var CFG = window.APP_CONFIG || {};
  var PWA = !document.getElementById("bible-data");
  function setData(b, g, c) { BIBLE = b; GUIDE = g; CTX = c; ABBR = BIBLE.map(function (x) { return x.a; }); IDX = {}; ABBR.forEach(function (x, i) { IDX[x] = i; }); }
  var LS = "leitura-guiada-v1";
  var SECTIONS = [
    ["Evangelhos", [39, 40, 41, 42]],
    ["Atos dos Apóstolos", [43]],
    ["Cartas de Paulo", [44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56]],
    ["Hebreus e cartas gerais", [57, 58, 59, 60, 61, 62, 63, 64]],
    ["Apocalipse", [65]]
  ];
  var GENERIC_Q = ["O que este texto diz sobre Deus e sobre Jesus?", "O que ele pede de mim hoje?"];
  var STOP = {};
  ("para com uma por dos das aos nas nos seu sua seus suas ele ela eles elas mas nao como mais foi sao ser ter tem era ora pois sobre entre quando onde assim ainda tambem porque quem qual cada todo todos toda todas vos meu minha teu tua lhe lhes isto isso este esta esse essa aquele aquela estava disse dizendo entao porem todavia tudo outro outra ate desde sem dele dela deles delas que tinha havia pelo pela pelos pelas numa num aquilo seja sereis serao tendo sendo fazer faz fez foram vem veio vir vai ide ides vede").split(" ").forEach(function (w) { STOP[w] = 1; });
  var CONNS = ["porque", "portanto", "pois", "mas", "para que", "assim", "porem", "contudo"];
  var STEPS = [
    { f: "o", t: "Observação", s: "O que o texto diz?" },
    { f: "c", t: "Contextualização", s: "Quando, por quem e para quem?" },
    { f: "i", t: "Interpretação", s: "O que significava para os primeiros leitores?" },
    { f: "p", t: "Aplicação", s: "Como se aplica hoje?" }
  ];
  var app = document.getElementById("app");
  var layer = document.getElementById("layer");

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function norm(s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function trim(s) { return (s || "").trim(); }

  /* ---------- registros ---------- */
  function blank() { return { r: 0, s: "", o: "", c: "", i: "", p: "", a: ["", ""], h: [], n: [], ts: 0 }; }
  function normRec(v) {
    var b = blank(); v = v || {};
    b.r = v.r ? 1 : 0; b.s = v.s || ""; b.o = v.o || ""; b.c = v.c || ""; b.i = v.i || ""; b.p = v.p || "";
    b.a = [(v.a || [])[0] || "", (v.a || [])[1] || ""]; b.h = v.h || []; b.n = v.n || []; b.ts = v.ts || 0;
    return b;
  }
  function hasAny(r) {
    return !!(trim(r.s) || trim(r.o) || trim(r.c) || trim(r.i) || trim(r.p) || trim(r.a[0]) || trim(r.a[1]) || r.n.some(function (n) { return trim(n.t); }));
  }

  var S = { ch: {}, meta: { size: 1, last: null, ts: 0 } };
  try { var raw = JSON.parse(localStorage.getItem(LS)); if (raw && raw.ch) { S = raw; S.meta = S.meta || { size: 1, last: null, ts: 0 }; } } catch (e) {}
  Object.keys(S.ch).forEach(function (k) { S.ch[k] = normRec(S.ch[k]); });
  function saveLocal() { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} }
  function R(key) { return S.ch[key] || blank(); }
  function W(key) { if (!S.ch[key]) S.ch[key] = blank(); return S.ch[key]; }
  function touch(key) { W(key).ts = Date.now(); saveLocal(); queue(key); }
  function touchMeta() { S.meta.ts = Date.now(); saveLocal(); queue("meta"); }

  /* ---------- sincronização com a conta ---------- */
  var rem = null, pending = {}, timer = null, busy = false, syncState = "local", remoteTs = {};
  function setStatus(s) { if (s) syncState = s; var el = $("#status"); if (el) el.textContent = syncState === "saving" ? "Salvando…" : syncState === "synced" ? "Salvo na sua conta" : "Salvo neste aparelho"; }
  function queue(k) { pending[k] = 1; if (!rem) { setStatus("local"); return; } setStatus("saving"); clearTimeout(timer); timer = setTimeout(flush, 900); }
  function flush() {
    if (!rem) return;
    if (busy) { timer = setTimeout(flush, 900); return; }
    var keys = Object.keys(pending);
    if (!keys.length) return;
    busy = true;
    var chain = Promise.resolve(), ad = rem;
    keys.forEach(function (k) {
      chain = chain.then(function () {
        delete pending[k];
        var data = k === "meta" ? S.meta : S.ch[k];
        if (!data) return;
        return ad.save(k, JSON.parse(JSON.stringify(data)));
      });
    });
    chain.then(function () { busy = false; setStatus("synced"); if (Object.keys(pending).length) timer = setTimeout(flush, 900); })
      .catch(function () { busy = false; keys.forEach(function (k) { pending[k] = 1; }); setStatus("local"); });
  }
  function syncWith(ad) {
    return ad.load().then(function (docs) {
      var changed = false, curKey = route.v === "ch" ? route.bi + "-" + route.ch : null, curChanged = false;
      remoteTs = {};
      docs.forEach(function (d) {
        var v = d.v; if (!v) return;
        remoteTs[d.id] = v.ts || 0;
        if (d.id === "meta") { if ((v.ts || 0) > (S.meta.ts || 0)) { S.meta = v; changed = true; } return; }
        var l = S.ch[d.id];
        if (!l || (v.ts || 0) > (l.ts || 0)) { S.ch[d.id] = normRec(v); changed = true; if (d.id === curKey) curChanged = true; }
      });
      rem = ad;
      Object.keys(S.ch).forEach(function (k) { if ((S.ch[k].ts || 0) > (remoteTs[k] || 0)) pending[k] = 1; });
      if ((S.meta.ts || 0) > (remoteTs.meta || 0)) pending.meta = 1;
      if (changed) {
        saveLocal();
        var ae = document.activeElement, typing = ae && (ae.tagName === "TEXTAREA" || ae.tagName === "INPUT");
        if (!BIBLE) { /* aguardando o texto */ }
        else if (route.v === "ch") { if (curChanged && !typing && !layer.firstChild) render(); }
        else if (!typing) render();
      }
      setStatus("synced");
      if (Object.keys(pending).length) { setStatus("saving"); flush(); }
    });
  }
  function initRemote() {
    if (!window.claude || !window.claude.use) return;
    Promise.all([window.claude.use("db"), window.claude.use("user")]).then(function (r) {
      var db = r[0], user = r[1];
      if (!db || !user) return;
      return user.id().then(function (id) {
        if (!id) return;
        var c = db.collection("data/users/" + id);
        return syncWith({
          load: function () { return c.get().then(function (snap) { return snap.docs.map(function (d) { return { id: d.id, v: d.data() }; }); }); },
          save: function (k, d) { return c.doc(k).set(d); }
        });
      });
    }).catch(function () {});
  }

  /* ---------- Supabase (versão instalável) ---------- */
  var sb = null, sbUser = null, deferredInstall = null;
  function sbConfigured() { return !!(CFG.supabaseUrl && CFG.supabaseKey && window.supabase && window.supabase.createClient); }
  function sbAdapter() {
    return {
      load: function () { return sb.from("estudos").select("chave,dados").then(function (r) { if (r.error) throw r.error; return (r.data || []).map(function (x) { return { id: x.chave, v: x.dados }; }); }); },
      save: function (k, d) { return sb.from("estudos").upsert({ user_id: sbUser.id, chave: k, dados: d, atualizado_em: d.ts || Date.now() }, { onConflict: "user_id,chave" }).then(function (r) { if (r.error) throw r.error; }); }
    };
  }
  function sbSync() { if (!sb || !sbUser) return Promise.resolve(); setStatus("saving"); return syncWith(sbAdapter()).catch(function () { setStatus("local"); }); }
  function downloadBible() {
    return sb.storage.from("biblia").download(CFG.bibleFile || "biblia-acf.json").then(function (r) {
      if (r.error) throw r.error; return r.data.text();
    }).then(function (t) { var j = JSON.parse(t); if (!j || !j.b || j.b.length !== 66) throw new Error("formato"); return idbSet("biblia", j).then(function () { return j; }); });
  }
  function afterLogin() {
    var p = BIBLE ? Promise.resolve() : downloadBible().then(function (j) { useBible(j); }).catch(function () { setMsg("Entrou, mas não consegui baixar o texto bíblico. Confira se o arquivo foi enviado ao Storage (veja o README)."); });
    p.then(sbSync).then(function () { if (route.v === "acc") render(); });
  }
  function sbStart() {
    if (!sbConfigured() || sb) return;
    var url = String(CFG.supabaseUrl || "").trim().replace(/^["\']|["\']$/g, "");
    try { url = new URL(url).origin; } catch (e) {}
    sb = window.supabase.createClient(url, String(CFG.supabaseKey || "").trim(), { auth: { persistSession: true, autoRefreshToken: true } });
    sb.auth.onAuthStateChange(function (ev, sess) {
      var u = sess && sess.user, was = sbUser && sbUser.id;
      sbUser = u || null;
      setTimeout(function () {
        if (!u) { rem = null; setStatus("local"); }
        else if (was !== u.id) afterLogin();
        if (route.v === "acc" || !BIBLE) render();
      }, 0);
    });
  }
  function setMsg(t) { var el = $("#accmsg"); if (el) el.textContent = t; }
  function authBox() {
    if (!sbConfigured()) return '<p class="note">A sincronização com o Supabase ainda não está configurada. Preencha o arquivo config.js (veja o README).</p>';
    if (sbUser) return '<div class="item"><p>Conectado como <b>' + esc(sbUser.email || "") + '</b>.</p><div class="acts" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn" id="syncnow">Sincronizar agora</button><button class="btn ghost" id="signout">Sair</button></div><p class="hint" id="accmsg" aria-live="polite" style="margin-top:8px"></p></div>';
    return '<form id="authform" class="item"><label class="hint" for="em">E-mail</label><input id="em" type="email" autocomplete="username" required><label class="hint" for="pw" style="margin-top:8px;display:block">Senha</label><input id="pw" type="password" autocomplete="current-password" minlength="6" required><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn" type="submit" id="signin">Entrar</button><button class="btn ghost" type="button" id="signup">Criar conta</button></div><p class="hint" id="accmsg" aria-live="polite" style="margin-top:8px"></p></form>';
  }
  function authErr(e) { var m = e && e.message ? e.message : ""; if (/Invalid path/i.test(m)) return "O endereço do Supabase no config.js está errado. Use só https://SEU-PROJETO.supabase.co, sem nada depois.";
    if (/Invalid API key|apikey/i.test(m)) return "A chave do Supabase no config.js está errada. Use a chave anon (publishable) do projeto.";
    if (/Invalid login/i.test(m)) return "E-mail ou senha incorretos."; if (/not confirmed/i.test(m)) return "Confirme o e-mail antes de entrar."; if (/signups? not allowed|disabled/i.test(m)) return "Novas contas estão desativadas neste projeto."; return "Não deu certo: " + m; }
  function doSignIn() {
    var em = $("#em").value.trim(), pw = $("#pw").value; if (!em || !pw) return;
    setMsg("Entrando…");
    sb.auth.signInWithPassword({ email: em, password: pw }).then(function (r) { if (r.error) setMsg(authErr(r.error)); });
  }
  function doSignUp() {
    var em = $("#em").value.trim(), pw = $("#pw").value; if (!em || pw.length < 6) { setMsg("Informe o e-mail e uma senha de pelo menos 6 caracteres."); return; }
    setMsg("Criando conta…");
    sb.auth.signUp({ email: em, password: pw }).then(function (r) {
      if (r.error) { setMsg(authErr(r.error)); return; }
      if (!r.data.session) setMsg("Conta criada. Confirme o e-mail que enviamos e depois toque em Entrar.");
    });
  }

  /* ---------- texto bíblico no aparelho ---------- */
  function idb() { return new Promise(function (res, rej) { try { var q = indexedDB.open("leitura-guiada", 1); q.onupgradeneeded = function () { q.result.createObjectStore("kv"); }; q.onsuccess = function () { res(q.result); }; q.onerror = function () { rej(q.error); }; } catch (e) { rej(e); } }); }
  function idbGet(k) { return idb().then(function (db) { return new Promise(function (res, rej) { var r = db.transaction("kv").objectStore("kv").get(k); r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }).catch(function () { return null; }); }
  function idbSet(k, v) { return idb().then(function (db) { return new Promise(function (res, rej) { var t = db.transaction("kv", "readwrite"); t.objectStore("kv").put(v, k); t.oncomplete = function () { res(); }; t.onerror = function () { rej(t.error); }; }); }).catch(function () {}); }
  function fetchJson(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(u); return r.json(); }); }
  function useBible(j) { setData(j.b, GUIDE, CTX); start(); }
  function viewSetup() {
    app.innerHTML = '<section class="page"><h1>Texto bíblico</h1><p>O app precisa do texto da Bíblia neste aparelho. Ele é baixado ou importado uma vez e fica guardado para ler sem internet.</p>' +
      (sbConfigured() ? "<h2 class=\"sub\">Entrar para baixar</h2>" + authBox() : "") +
      '<h2 class="sub">Importar de um arquivo</h2><p class="hint">Escolha o arquivo biblia-acf.json.</p><input type="file" id="bfile" accept=".json,application/json"><p class="hint" id="bmsg" aria-live="polite"></p></section>';
  }

  /* ---------- backup ---------- */
  function backupJson() { return JSON.stringify({ app: "leitura-guiada", v: 1, meta: S.meta, ch: S.ch }); }
  function importBackup(text) {
    var j; try { j = JSON.parse(text); } catch (e) { return "O texto colado não é um backup válido."; }
    if (!j || typeof j.ch !== "object") return "Não encontrei anotações nesse backup.";
    var n = 0;
    Object.keys(j.ch).forEach(function (k) {
      if (!/^\d+-\d+$/.test(k)) return;
      var inc = normRec(j.ch[k]), cur = S.ch[k];
      if (!cur || inc.ts > cur.ts) { S.ch[k] = inc; pending[k] = 1; n++; }
    });
    if (j.meta && (j.meta.ts || 0) > (S.meta.ts || 0)) { S.meta = j.meta; pending.meta = 1; }
    saveLocal();
    if (rem) { setStatus("saving"); clearTimeout(timer); timer = setTimeout(flush, 300); }
    return "Importado: " + n + (n === 1 ? " capítulo" : " capítulos") + ".";
  }
  function openImport() {
    openLayer('<h2>Importar backup</h2><p class="hint">Cole o texto do backup ou escolha o arquivo. Anotações mais recentes vencem as antigas.</p><textarea id="bk-text" rows="6" placeholder="Cole o backup aqui"></textarea><p class="hint" style="margin-top:8px">Ou escolha um arquivo:</p><input type="file" id="bk-file" accept=".json,application/json"><p class="hint" id="bk-msg" aria-live="polite"></p><div class="acts"><button class="btn" id="bk-go">Importar</button><button class="btn ghost" data-close="1">Fechar</button></div>', "#bk-text");
  }

  /* ---------- notas recolhíveis ---------- */
  function toggleNote(id) {
    var key = route.bi + "-" + route.ch, r = W(key), n = r.n.filter(function (x) { return x.id === id; })[0];
    if (!n) return; n.x = n.x ? 0 : 1; touch(key); refreshVerses(); renderNotes();
  }
  function firstLine(t) { var l = (t || "").split("\n").filter(function (x) { return x.trim(); })[0] || ""; l = l.trim(); return l ? (l.length > 90 ? l.slice(0, 90) + "…" : l) : "(vazia)"; }

  /* ---------- referências ---------- */
  function bookName(bi) { return BIBLE[bi].n; }
  function parseRef(s) {
    var m = s.match(/^(\S+) (\d+)(?::(\d+)(?:-(\d+))?)?(?:-(\d+))?$/);
    if (!m || IDX[m[1]] === undefined) return null;
    var bi = IDX[m[1]], n = BIBLE[bi].c.length, ch, v1 = null, v2 = null;
    if (n === 1 && !m[3]) { ch = 1; v1 = +m[2]; v2 = m[5] ? +m[5] : null; }
    else { ch = +m[2]; if (m[3]) { v1 = +m[3]; v2 = m[4] ? +m[4] : null; } }
    if (ch < 1 || ch > n) return null;
    return { bi: bi, ch: ch, v1: v1, v2: v2 };
  }
  function refLabel(p) {
    var t = bookName(p.bi);
    if (BIBLE[p.bi].c.length === 1) return t + (p.v1 ? " " + p.v1 + (p.v2 ? "-" + p.v2 : "") : "");
    return t + " " + p.ch + (p.v1 ? ":" + p.v1 + (p.v2 ? "-" + p.v2 : "") : "");
  }
  function naaUrl(bi, ch) {
    if (bi < 39) return null;
    var slug = ABBR[bi] === "atos" ? "at" : ABBR[bi];
    return "https://www.bibliaonline.com.br/naa/" + slug + "/" + ch;
  }
  function naaLink(bi, ch, cls) {
    var u = naaUrl(bi, ch);
    return u ? '<a class="' + (cls || "linkbtn") + '" href="' + u + '" target="_blank" rel="noopener noreferrer">Abrir na NAA ↗</a>' : "";
  }
  function title(bi, ch) { var g = GUIDE[ABBR[bi] + "-" + ch]; return g ? g.t : ""; }
  function prevCh(bi, ch) { if (ch > 1) return [bi, ch - 1]; if (bi > 0) return [bi - 1, BIBLE[bi - 1].c.length]; return null; }
  function nextCh(bi, ch) { if (ch < BIBLE[bi].c.length) return [bi, ch + 1]; if (bi < 65) return [bi + 1, 1]; return null; }

  /* ---------- navegação ---------- */
  var route = { v: "home" }, tab = "read", kw = null, stepOpen = { 0: true };
  function go(r, keepScroll) {
    route = r; kw = null;
    if (r.v === "ch") {
      S.meta.last = r.bi + "-" + r.ch; touchMeta();
      try { history.replaceState(null, "", "#" + r.bi + "-" + r.ch); } catch (e) {}
    } else { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {} }
    render();
    if (!keepScroll) window.scrollTo(0, 0);
    if (r.v === "ch" && r.verse) { var el = $('.v[data-v="' + r.verse + '"]'); if (el) el.scrollIntoView({ block: "center" }); }
  }
  function autosize(ta) {
    ta.style.height = "auto";
    var h = ta.scrollHeight + 2;
    ta.style.height = Math.min(h, Math.round(window.innerHeight * 0.7)) + "px";
  }

  /* ---------- análise do texto para a observação ---------- */
  function keywords(verses) {
    var cnt = {}, disp = {};
    verses.forEach(function (t) {
      (t.match(/[\p{L}]+/gu) || []).forEach(function (w) {
        var k = norm(w);
        if (k.length < 4 || STOP[k]) return;
        cnt[k] = (cnt[k] || 0) + 1; if (!disp[k]) disp[k] = w.toLowerCase();
      });
    });
    return Object.keys(cnt).filter(function (k) { return cnt[k] >= 3; })
      .sort(function (a, b) { return cnt[b] - cnt[a] || (a < b ? -1 : 1); }).slice(0, 8)
      .map(function (k) { return { k: k, w: disp[k], n: cnt[k] }; });
  }
  function connectives(verses) {
    var out = [];
    CONNS.forEach(function (c) {
      var re = new RegExp("(^|[^a-z])" + c + "([^a-z]|$)"), vs = [];
      verses.forEach(function (t, i) { if (re.test(norm(t))) vs.push(i + 1); });
      if (vs.length) out.push({ c: c, v: vs });
    });
    return out;
  }
  function markWord(t, k) {
    if (!k) return esc(t);
    var n = norm(t), out = "", pos = 0, p = 0, i;
    while ((i = n.indexOf(k, p)) >= 0) {
      var e = i + k.length, okL = i === 0 || !/[a-z0-9]/.test(n.charAt(i - 1)), okR = e >= n.length || !/[a-z0-9]/.test(n.charAt(e));
      if (okL && okR) { out += esc(t.slice(pos, i)) + "<mark>" + esc(t.slice(i, e)) + "</mark>"; pos = e; }
      p = e;
    }
    return out + esc(t.slice(pos));
  }

  /* ---------- telas ---------- */
  function counts() {
    var read = 0, sum = 0, total = 0;
    SECTIONS.forEach(function (s) { s[1].forEach(function (bi) { for (var c = 1; c <= BIBLE[bi].c.length; c++) { total++; var r = R(bi + "-" + c); if (r.r) read++; if (trim(r.s)) sum++; } }); });
    return { read: read, sum: sum, total: total };
  }
  function viewHome() {
    var ct = counts(), last = S.meta.last, lp = last ? last.split("-").map(Number) : [39, 1];
    var started = !!last;
    var h = '<section class="hero"><h1>Novo Testamento, um capítulo por vez</h1>' +
      '<p>Leia o texto e estude em quatro passos: observação, contexto, interpretação e aplicação. Anote por versículo, escreva o resumo e volte quando quiser. Tudo fica guardado.</p>' +
      '<div class="cont"><div><small>' + (started ? "Continuar de onde parou" : "Começar") + '</small><strong>' + esc(bookName(lp[0])) + " " + lp[1] + (title(lp[0], lp[1]) ? " · " + esc(title(lp[0], lp[1])) : "") + '</strong></div>' +
      '<button class="btn" data-open="' + lp[0] + "-" + lp[1] + '">' + (started ? "Continuar" : "Ler Mateus 1") + '</button></div>' +
      '<div class="meter"><div class="bar" aria-hidden="true"><i style="width:' + (ct.read / ct.total * 100).toFixed(1) + '%"></i></div><span>' + ct.read + " de " + ct.total + " capítulos lidos · " + ct.sum + " com resumo</span></div></section>";
    SECTIONS.forEach(function (s) {
      h += '<section class="sect"><h2>' + esc(s[0]) + "</h2>";
      s[1].forEach(function (bi) {
        var n = BIBLE[bi].c.length, rd = 0, chips = "";
        for (var c = 1; c <= n; c++) {
          var k = bi + "-" + c, r = R(k), has = hasAny(r);
          if (r.r) rd++;
          chips += '<button class="chip' + (r.r ? " read" : "") + (has ? " has" : "") + (k === last ? " cur" : "") + '" data-open="' + k + '" title="' + esc(title(bi, c)) + '" aria-label="' + esc(bookName(bi)) + " " + c + (r.r ? ", lido" : "") + (has ? ", com anotações" : "") + '">' + c + "</button>";
        }
        h += '<div class="book"><h3>' + esc(bookName(bi)) + "<small>" + rd + "/" + n + " lidos</small></h3><div class=\"chips\">" + chips + "</div></div>";
      });
      h += "</section>";
    });
    app.innerHTML = h;
  }

  function versesHtml(bi, ch) {
    var key = bi + "-" + ch, r = R(key), verses = BIBLE[bi].c[ch - 1], hl = {}, nv = {};
    r.h.forEach(function (n) { hl[n] = 1; });
    r.n.forEach(function (n) { if (n.v && trim(n.t)) nv[n.v] = n; });
    return verses.map(function (t, i) {
      var n = i + 1;
      return '<p class="v' + (hl[n] ? " hl" : "") + (nv[n] ? " hasnote" : "") + '" data-v="' + n + '" role="button" tabindex="0" aria-label="Versículo ' + n + ', abrir nota"><sup>' + n + "</sup><span>" + markWord(t, kw) + (nv[n] ? '<em class="vn' + (nv[n].x ? " col" : "") + '" data-tn="' + nv[n].id + '" role="button" tabindex="0" aria-expanded="' + (!nv[n].x) + '" aria-label="Nota do versículo ' + n + ', tocar para ' + (nv[n].x ? "expandir" : "recolher") + '">' + esc(nv[n].t) + "</em>" : "") + "</span></p>";
    }).join("");
  }
  function refreshVerses() { var el = $(".verses"); if (el && route.v === "ch") el.innerHTML = versesHtml(route.bi, route.ch); }

  function noteLabel(n) { return n.v ? "Versículo " + n.v : "Nota livre"; }
  function sortedNotes(r) { return r.n.slice().sort(function (a, b) { if (!a.v && !b.v) return a.ts - b.ts; if (!a.v) return 1; if (!b.v) return -1; return a.v - b.v; }); }
  function notesHtml(r) {
    var ns = sortedNotes(r);
    if (!ns.length) return '<p class="hint">Nenhuma nota ainda. Toque num versículo para anotar nele, ou crie uma nota livre.</p>';
    return ns.map(function (n) {
      return '<div class="note-item' + (n.x ? " col" : "") + '"><header><button class="mini tog" data-tn="' + n.id + '" aria-expanded="' + (!n.x) + '">' + (n.x ? "▸ " : "▾ ") + noteLabel(n) + '</button><button class="mini danger" data-delnote="' + n.id + '">Excluir</button></header>' +
        (n.x ? '<p class="prev" data-tn="' + n.id + '">' + esc(firstLine(n.t)) + "</p>" : '<textarea id="n-' + n.id + '" data-note="' + n.id + '" rows="2" placeholder="Escreva a nota"></textarea>') + "</div>";
    }).join("");
  }
  function fillNotes() {
    var r = R(route.bi + "-" + route.ch);
    $$("[data-note]").forEach(function (ta) { var n = r.n.filter(function (x) { return x.id === ta.getAttribute("data-note"); })[0]; ta.value = n ? n.t : ""; autosize(ta); });
  }
  function renderNotes() {
    var el = $("#notes"); if (!el) return;
    var r = R(route.bi + "-" + route.ch);
    el.innerHTML = notesHtml(r); fillNotes();
    var tg = $("#togall");
    if (tg) tg.innerHTML = r.n.length > 1 ? '<button class="mini" data-act="togall">' + (r.n.some(function (n) { return !n.x; }) ? "Recolher todas" : "Expandir todas") + "</button>" : "";
  }

  function step(i, inner, filled) {
    var s = STEPS[i];
    return '<details class="step" data-step="' + i + '"' + (stepOpen[i] ? " open" : "") + "><summary><span>" + (i + 1) + ". " + s.t + " <small>" + s.s + "</small></span>" + (filled ? '<span class="dot" title="Preenchido"></span>' : "") + '</summary><div class="body">' + inner + "</div></details>";
  }
  function ta(f, ph, rows) { return '<textarea id="f-' + f + '" data-f="' + f + '" rows="' + (rows || 4) + '" placeholder="' + esc(ph) + '"></textarea>'; }

  function viewChapter(bi, ch) {
    var key = bi + "-" + ch, g = GUIDE[ABBR[bi] + "-" + ch], r = R(key), verses = BIBLE[bi].c[ch - 1];
    var qs = g ? g.q : GENERIC_Q, cx = CTX[ABBR[bi]];
    var pv = prevCh(bi, ch), nx = nextCh(bi, ch);
    var refs = (g ? g.r : []).map(function (x) { var p = parseRef(x); return p ? '<button class="ref" data-ref="' + esc(x) + '">' + esc(refLabel(p)) + "</button>" : ""; }).join("");
    var kws = keywords(verses), conns = connectives(verses);

    var s1 = '<ul class="rules"><li>Leia o capítulo todo, devagar, duas vezes.</li><li>Procure palavras e ideias que se repetem, verbos, contrastes e comparações.</li><li>Note as palavras de ligação (porque, portanto, mas, para que): elas mostram a lógica do texto.</li><li>Veja quem fala, com quem fala e onde.</li></ul>' +
      (kws.length ? '<div><p class="hint" style="margin-bottom:6px">Palavras que mais se repetem aqui. Toque para marcar no texto:</p><div class="kw">' + kws.map(function (x) { return '<button data-kw="' + esc(x.k) + '" aria-pressed="' + (kw === x.k) + '">' + esc(x.w) + "<i>" + x.n + "</i></button>"; }).join("") + "</div></div>" : "") +
      (conns.length ? '<p class="conn"><b>Palavras de ligação:</b> ' + conns.map(function (x) { return esc(x.c) + " (v. " + x.v.slice(0, 6).join(", ") + (x.v.length > 6 ? "…" : "") + ")"; }).join(" · ") + "</p>" : "") +
      ta("o", "Escreva à vontade o que você observa no texto ou o que ouve na pregação.", 9);
    var s2 = (cx ? '<dl class="ctx"><dt>Autor</dt><dd>' + esc(cx.a) + "</dd><dt>Para quem</dt><dd>" + esc(cx.p) + "</dd><dt>Quando</dt><dd>" + esc(cx.d) + "</dd><dt>Objetivo</dt><dd>" + esc(cx.o) + "</dd></dl>" : "") +
      '<ul class="rules"><li>Olhe o que vem antes e o que vem depois deste capítulo.</li><li>Pense em cultura, lugar e momento histórico dos primeiros leitores.</li></ul>' +
      ta("c", "Contexto: onde este trecho se encaixa no livro? O que estava acontecendo?", 4);
    var s3 = '<ul class="rules"><li>Pergunte o que o texto significava para quem o recebeu primeiro. Ele não pode significar para nós o que nunca significou para eles.</li><li>Compare com outras passagens. O trecho claro ajuda a entender o difícil.</li></ul>' +
      qs.map(function (q, i) { return '<div class="q"><label for="q' + i + '">' + (i + 1) + ". " + esc(q) + '</label><textarea id="q' + i + '" data-q="' + i + '" rows="3" placeholder="Sua resposta (opcional)"></textarea></div>'; }).join("") +
      (refs ? '<div><p class="hint" style="margin-bottom:6px">Referências para comparar (toque para ler aqui):</p><div class="refs">' + refs + "</div></div>" : "") +
      ta("i", "O que o texto significava para os primeiros leitores?", 5);
    var s4 = '<ul class="rules"><li>Separe o princípio que não muda da situação daquele tempo.</li><li>Pergunte onde esse princípio toca a sua vida, a sua casa, a sua igreja.</li><li>Termine com uma atitude concreta.</li></ul>' +
      ta("p", "Princípio que não muda e como aplico hoje.", 5);

    var h = '<div class="crumbs"><button class="linkbtn" data-act="home">← Todos os livros</button>' +
      naaLink(bi, ch) + '<div class="size" role="group" aria-label="Tamanho do texto"><button data-size="-1" aria-label="Diminuir texto">A−</button><button data-size="1" aria-label="Aumentar texto">A+</button></div></div>' +
      '<div class="seg"><div role="tablist"><button role="tab" data-tab="read" aria-selected="' + (tab === "read") + '">Ler</button><button role="tab" data-tab="study" aria-selected="' + (tab === "study") + '">Estudar e anotar</button></div></div>' +
      '<div class="cols" data-view="' + tab + '"><article class="reader">' +
      '<header class="chead"><div class="numeral" aria-hidden="true">' + ch + "</div><div><div class=\"bk\">" + esc(bookName(bi)) + " " + ch + '</div><h1 class="theme">' + esc(g ? g.t : "Sem guia para este capítulo") + "</h1></div></header>" +
      (g && g.n ? '<p class="note">' + esc(g.n) + "</p>" : "") +
      '<div class="verses" style="--rs:' + (S.meta.size || 1) + '">' + versesHtml(bi, ch) + "</div>" +
      '<p class="tip">Toque num versículo para escrever uma nota ou marcá-lo.</p>' +
      '<nav class="pn" aria-label="Capítulos">' +
      (pv ? '<button class="btn ghost" data-open="' + pv[0] + "-" + pv[1] + '">← ' + esc(bookName(pv[0])) + " " + pv[1] + "</button>" : "<span></span>") +
      (nx ? '<button class="btn ghost" data-open="' + nx[0] + "-" + nx[1] + '">' + esc(bookName(nx[0])) + " " + nx[1] + " →</button>" : "") + "</nav></article>" +
      '<aside class="study" aria-label="Estudo e anotações do capítulo">' +
      (g ? "" : '<p class="note">Este capítulo ainda não tem guia. Os passos abaixo servem para qualquer texto.</p>') +
      "<section><h2>Estudo em quatro passos</h2>" +
      step(0, s1, trim(r.o)) + step(1, s2, trim(r.c)) + step(2, s3, trim(r.i) || trim(r.a[0]) || trim(r.a[1])) + step(3, s4, trim(r.p)) + "</section>" +
      '<section><div class="sh"><h2>Notas</h2><span id="togall"></span></div><div id="notes" class="notes"></div><button class="btn ghost" id="addnote" style="margin-top:10px">+ Nova nota</button></section>' +
      '<section><h2>Meu resumo</h2><p class="hint">Junte tudo em poucas linhas, com suas palavras.</p>' +
      '<textarea id="f-s" data-f="s" rows="6" placeholder="O que você entendeu deste capítulo?"></textarea>' +
      '<div class="foot"><span id="wc"></span><button class="btn ghost" id="readbtn" aria-pressed="' + (r.r ? "true" : "false") + '">' + (r.r ? "Lido ✓" : "Marcar como lido") + "</button></div>" +
      '<div class="status" id="status" aria-live="polite"></div></section></aside></div>';
    app.innerHTML = h;
    $$("[data-f]").forEach(function (t) { t.value = r[t.getAttribute("data-f")] || ""; });
    qs.forEach(function (q, i) { $("#q" + i).value = r.a[i] || ""; });
    $("#wc").textContent = wc(r.s);
    renderNotes();
    $$("textarea", app).forEach(autosize);
    setStatus();
  }
  function wc(t) { var n = (t.trim().match(/\S+/g) || []).length; return n + (n === 1 ? " palavra" : " palavras"); }

  function recSections(r, qs) {
    var out = [];
    if (trim(r.s)) out.push(["Resumo", r.s]);
    if (trim(r.o)) out.push(["Observação", r.o]);
    if (trim(r.c)) out.push(["Contexto", r.c]);
    if (trim(r.a[0])) out.push(["Pergunta: " + qs[0], r.a[0]]);
    if (trim(r.a[1])) out.push(["Pergunta: " + qs[1], r.a[1]]);
    if (trim(r.i)) out.push(["Interpretação", r.i]);
    if (trim(r.p)) out.push(["Aplicação", r.p]);
    sortedNotes(r).forEach(function (n) { if (trim(n.t)) out.push(["Nota · " + noteLabel(n), n.t]); });
    return out;
  }
  function viewSummaries() {
    var items = [];
    Object.keys(S.ch).forEach(function (k) { var r = S.ch[k]; if (hasAny(r)) { var p = k.split("-").map(Number); items.push({ bi: p[0], ch: p[1], r: r }); } });
    items.sort(function (a, b) { return a.bi - b.bi || a.ch - b.ch; });
    var h = '<section class="page"><h1>Meus resumos</h1><p>' + (items.length ? items.length + (items.length === 1 ? " capítulo com anotações." : " capítulos com anotações.") : "Quando você escrever um resumo, uma observação ou uma nota, aparece aqui.") + "</p>";
    if (items.length) h += '<button class="btn" data-act="copyall">Copiar tudo</button>';
    items.forEach(function (it) {
      var g = GUIDE[ABBR[it.bi] + "-" + it.ch], qs = g ? g.q : GENERIC_Q;
      h += '<article class="item"><h3><span>' + esc(bookName(it.bi)) + " " + it.ch + '</span><button class="linkbtn" data-open="' + it.bi + "-" + it.ch + '">Abrir</button></h3>' + (g ? "<small>" + esc(g.t) + "</small>" : "");
      recSections(it.r, qs).forEach(function (s) { h += '<div class="qa">' + esc(s[0]) + "</div><p>" + esc(s[1]) + "</p>"; });
      h += "</article>";
    });
    h += '<h2 class="sub">Backup</h2><p class="hint">Guarde uma cópia das suas anotações ou traga de outro lugar.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost" data-act="bk-copy">Copiar backup</button>' + (PWA ? '<button class="btn ghost" data-act="bk-file">Baixar arquivo</button>' : "") + '<button class="btn ghost" data-act="bk-import">Importar backup</button></div>';
    app.innerHTML = h + "</section>";
  }
  function viewAccount() {
    app.innerHTML = '<section class="page"><h1>Conta e sincronização</h1><p>Entre para guardar suas anotações na nuvem e usar em mais de um aparelho. Sem conta, tudo continua salvo neste aparelho.</p>' + authBox() +
      '<h2 class="sub">Instalar o app</h2>' + (deferredInstall ? '<button class="btn" id="install">Instalar na tela inicial</button>' : '<p class="hint">No Chrome do Android: menu ⋮ e depois Instalar app (ou Adicionar à tela inicial). No iPhone: Compartilhar e depois Adicionar à Tela de Início.</p>') + "</section>";
  }
  function allText() {
    var out = [];
    Object.keys(S.ch).map(function (k) { return k.split("-").map(Number); }).sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; }).forEach(function (p) {
      var r = S.ch[p[0] + "-" + p[1]]; if (!r || !hasAny(r)) return;
      var g = GUIDE[ABBR[p[0]] + "-" + p[1]], qs = g ? g.q : GENERIC_Q, t = bookName(p[0]) + " " + p[1] + (g ? " · " + g.t : "") + "\n";
      recSections(r, qs).forEach(function (s) { t += "\n" + s[0] + "\n" + s[1].trim() + "\n"; });
      out.push(t);
    });
    return out.join("\n---\n\n");
  }

  var searchScope = "nt", searchIdx = {};
  function buildIdx(scope) {
    if (searchIdx[scope]) return searchIdx[scope];
    var a = [], from = scope === "nt" ? 39 : 0;
    for (var bi = from; bi < 66; bi++) BIBLE[bi].c.forEach(function (vs, ci) { vs.forEach(function (t, vi) { a.push({ bi: bi, c: ci + 1, v: vi + 1, t: t, n: norm(t) }); }); });
    return (searchIdx[scope] = a);
  }
  function viewSearch() {
    app.innerHTML = '<section class="page"><h1>Buscar no texto</h1><p>Procure uma palavra ou expressão. Acentos não importam.</p>' +
      '<div class="searchrow"><input id="q" type="search" placeholder="Ex.: graça, perdoar, luz" autocomplete="off" aria-label="Buscar"><button class="btn ghost" id="scope" aria-pressed="' + (searchScope === "all") + '">' + (searchScope === "all" ? "Bíblia toda" : "Só Novo Testamento") + '</button></div><div id="res"></div></section>';
    $("#q").focus();
  }
  function doSearch() {
    var q = norm($("#q").value.trim()), res = $("#res");
    if (q.length < 3) { res.innerHTML = '<p class="empty">Digite pelo menos 3 letras.</p>'; return; }
    var terms = q.split(/\s+/), idx = buildIdx(searchScope), out = [], more = false;
    for (var i = 0; i < idx.length; i++) {
      var e = idx[i], ok = true;
      for (var j = 0; j < terms.length; j++) if (e.n.indexOf(terms[j]) < 0) { ok = false; break; }
      if (ok) { if (out.length >= 60) { more = true; break; } out.push(e); }
    }
    if (!out.length) { res.innerHTML = '<p class="empty">Nada encontrado.</p>'; return; }
    res.innerHTML = out.map(function (e) {
      var spans = [];
      terms.forEach(function (t) { var p = 0, k; while ((k = e.n.indexOf(t, p)) >= 0) { spans.push([k, k + t.length]); p = k + t.length; } });
      spans.sort(function (a, b) { return a[0] - b[0]; });
      var html = "", pos = 0;
      spans.forEach(function (s) { if (s[0] < pos) { if (s[1] > pos) { html += "<mark>" + esc(e.t.slice(pos, s[1])) + "</mark>"; pos = s[1]; } return; } html += esc(e.t.slice(pos, s[0])) + "<mark>" + esc(e.t.slice(s[0], s[1])) + "</mark>"; pos = s[1]; });
      html += esc(e.t.slice(pos));
      return '<button class="hit" data-open="' + e.bi + "-" + e.c + "-" + e.v + '"><b>' + esc(bookName(e.bi)) + " " + e.c + ":" + e.v + "</b><span>" + html + "</span></button>";
    }).join("") + (more ? '<p class="empty">Mostrando os primeiros 60 resultados. Refine a busca para ver outros.</p>' : "");
  }

  function render() {
    if (!BIBLE) { viewSetup(); return; }
    ["home", "sum", "search", "acc"].forEach(function (n) { var b = $("#n-" + n); if (b) { if ((route.v === n) || (n === "home" && route.v === "ch")) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); } });
    if (route.v === "ch") viewChapter(route.bi, route.ch);
    else if (route.v === "sum") viewSummaries();
    else if (route.v === "search") viewSearch();
    else if (route.v === "acc") viewAccount();
    else viewHome();
  }

  /* ---------- folhas ---------- */
  function closeLayer() {
    var had = !!layer.firstChild;
    layer.innerHTML = ""; document.removeEventListener("keydown", escClose);
    if (had && route.v === "ch") { refreshVerses(); renderNotes(); }
  }
  function escClose(e) { if (e.key === "Escape") closeLayer(); }
  function openLayer(html, focusSel) {
    layer.innerHTML = '<div class="shade" data-close="1"><div class="sheet" role="dialog" aria-modal="true">' + html + "</div></div>";
    document.addEventListener("keydown", escClose);
    var f = $(focusSel || ".sheet button, .sheet textarea", layer); if (f) f.focus();
  }
  function showRef(str) {
    var p = parseRef(str); if (!p) return;
    var vs = BIBLE[p.bi].c[p.ch - 1], a = p.v1 || 1, b = p.v2 || (p.v1 ? p.v1 : Math.min(vs.length, 15)), cut = !p.v1 && vs.length > 15;
    if (b > vs.length) b = vs.length;
    var body = "";
    for (var i = a; i <= b; i++) body += '<p class="v" style="cursor:default"><sup>' + i + "</sup><span>" + esc(vs[i - 1]) + "</span></p>";
    openLayer('<h2>' + esc(refLabel(p)) + '</h2><div class="verses">' + body + "</div>" + (cut ? '<p class="tip">Mostrando os 15 primeiros de ' + vs.length + " versículos.</p>" : "") +
      '<div class="acts"><button class="btn" data-open="' + p.bi + "-" + p.ch + (p.v1 ? "-" + p.v1 : "") + '">Abrir o capítulo</button>' + naaLink(p.bi, p.ch, "btn ghost") + '<button class="btn ghost" data-close="1">Fechar</button></div>');
  }
  function noteFor(key, v) { return R(key).n.filter(function (n) { return n.v === v; })[0]; }
  function openVerse(v) {
    var key = route.bi + "-" + route.ch, txt = BIBLE[route.bi].c[route.ch - 1][v - 1], isHl = R(key).h.indexOf(v) >= 0, n = noteFor(key, v);
    openLayer("<h2>" + esc(bookName(route.bi)) + " " + route.ch + ":" + v + '</h2><p class="vtext">' + esc(txt) + '</p><label class="hint" for="vn">Nota deste versículo</label><textarea id="vn" rows="6" placeholder="Escreva sua nota"></textarea>' +
      '<div class="acts"><button class="btn ghost" id="vhl" aria-pressed="' + isHl + '">' + (isHl ? "Marcado ✓" : "Marcar versículo") + '</button><button class="btn" data-close="1">Pronto</button></div>', "#vn");
    var t = $("#vn"); t.value = n ? n.t : ""; t.setAttribute("data-verse", v); autosize(t); t.focus();
  }
  function copyText(t, btn, label, again) {
    function fb() { openLayer("<h2>Copiar</h2><p class=\"hint\">Selecione o texto e copie.</p><textarea readonly id=\"ct\"></textarea><div class=\"acts\"><button class=\"btn ghost\" data-close=\"1\">Fechar</button></div>"); var x = $("#ct"); x.value = t; x.focus(); x.select(); }
    try { navigator.clipboard.writeText(t).then(function () { if (btn) { btn.textContent = "Copiado ✓"; setTimeout(function () { btn.textContent = again; }, 1800); } }, fb); } catch (e) { fb(); }
  }
  function copyAll() {
    var t = allText();
    function fallback() { openLayer("<h2>Copiar tudo</h2><p class=\"hint\">Selecione o texto e copie.</p><textarea readonly id=\"ct\"></textarea><div class=\"acts\"><button class=\"btn ghost\" data-close=\"1\">Fechar</button></div>"); var x = $("#ct"); x.value = t; x.focus(); x.select(); }
    try { navigator.clipboard.writeText(t).then(function () { var b = $('[data-act="copyall"]'); if (b) { b.textContent = "Copiado ✓"; setTimeout(function () { b.textContent = "Copiar tudo"; }, 1800); } }, fallback); } catch (e) { fallback(); }
  }

  /* ---------- eventos ---------- */
  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t.closest) return;
    if (t.closest(".sheet") && !t.closest("[data-open],[data-close],#vhl")) return;
    var el = t.closest("[data-open],[data-act],[data-ref],[data-close],[data-tab],[data-size],[data-kw],[data-delnote],[data-tn],[data-v],#addnote,#readbtn,#scope,#vhl,#signup,#signout,#syncnow,#install,#bk-go");
    if (!el) return;
    if (el.hasAttribute("data-close")) { if (el === t || el.tagName === "BUTTON") closeLayer(); return; }
    if (el.hasAttribute("data-open")) {
      var p = el.getAttribute("data-open").split("-").map(Number);
      closeLayer(); tab = "read"; go({ v: "ch", bi: p[0], ch: p[1], verse: p[2] || 0 }); return;
    }
    var act = el.getAttribute("data-act");
    if (act === "home") { closeLayer(); go({ v: "home" }); return; }
    if (act === "sum") { go({ v: "sum" }); return; }
    if (act === "search") { go({ v: "search" }); return; }
    if (act === "copyall") { copyAll(); return; }
    if (act === "acc") { go({ v: "acc" }); return; }
    if (act === "bk-copy") { copyText(backupJson(), el, "Copiar backup", "Copiar backup"); return; }
    if (act === "bk-file") {
      var bl = new Blob([backupJson()], { type: "application/json" }), au = document.createElement("a");
      au.href = URL.createObjectURL(bl); au.download = "leitura-guiada-backup.json"; document.body.appendChild(au); au.click(); au.remove(); return;
    }
    if (act === "bk-import") { openImport(); return; }
    if (act === "togall") {
      var tk2 = route.bi + "-" + route.ch, tr2 = W(tk2), anyOpen = tr2.n.some(function (n) { return !n.x; });
      tr2.n.forEach(function (n) { n.x = anyOpen ? 1 : 0; }); touch(tk2); refreshVerses(); renderNotes(); return;
    }
    if (el.id === "signup") { doSignUp(); return; }
    if (el.id === "signout") { sb.auth.signOut(); return; }
    if (el.id === "syncnow") { setMsg("Sincronizando…"); sbSync().then(function () { setMsg("Pronto."); }); return; }
    if (el.id === "install" && deferredInstall) { deferredInstall.prompt(); deferredInstall = null; return; }
    if (el.id === "bk-go") { var msg = importBackup($("#bk-text").value); var mm = $("#bk-msg"); if (mm) mm.textContent = msg; return; }
    if (el.hasAttribute("data-tn") && route.v === "ch") { toggleNote(el.getAttribute("data-tn")); return; }
    if (el.hasAttribute("data-ref")) { showRef(el.getAttribute("data-ref")); return; }
    if (el.hasAttribute("data-tab")) { tab = el.getAttribute("data-tab"); render(); window.scrollTo(0, 0); return; }
    if (el.hasAttribute("data-size")) {
      var s = Math.round(((S.meta.size || 1) + (+el.getAttribute("data-size")) * 0.1) * 10) / 10;
      S.meta.size = Math.max(0.9, Math.min(1.6, s)); touchMeta();
      var vv = $(".verses"); if (vv) vv.style.setProperty("--rs", S.meta.size);
      return;
    }
    if (el.hasAttribute("data-kw")) { var k = el.getAttribute("data-kw"); kw = kw === k ? null : k; $$("[data-kw]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-kw") === kw); }); refreshVerses(); return; }
    if (el.id === "addnote" && route.v === "ch") {
      var key = route.bi + "-" + route.ch, r = W(key), id = newId();
      r.n.push({ id: id, v: 0, t: "", ts: Date.now() }); touch(key); renderNotes();
      var nt = $("#n-" + id); if (nt) nt.focus(); return;
    }
    if (el.hasAttribute("data-delnote") && route.v === "ch") {
      if (el.getAttribute("data-sure") !== "1") { el.setAttribute("data-sure", "1"); el.textContent = "Confirmar exclusão"; setTimeout(function () { if (el.isConnected) { el.removeAttribute("data-sure"); el.textContent = "Excluir"; } }, 3000); return; }
      var k2 = route.bi + "-" + route.ch, rr = W(k2), nid = el.getAttribute("data-delnote");
      rr.n = rr.n.filter(function (x) { return x.id !== nid; }); touch(k2); renderNotes(); refreshVerses(); return;
    }
    if (el.id === "vhl" && route.v === "ch") {
      var vk = route.bi + "-" + route.ch, vn = +$("#vn").getAttribute("data-verse"), vr = W(vk), vi = vr.h.indexOf(vn);
      if (vi >= 0) vr.h.splice(vi, 1); else vr.h.push(vn);
      touch(vk); el.setAttribute("aria-pressed", vi < 0); el.textContent = vi < 0 ? "Marcado ✓" : "Marcar versículo"; return;
    }
    if (el.id === "readbtn" && route.v === "ch") {
      var rk = route.bi + "-" + route.ch, r2 = W(rk); r2.r = r2.r ? 0 : 1; touch(rk);
      el.setAttribute("aria-pressed", r2.r ? "true" : "false"); el.textContent = r2.r ? "Lido ✓" : "Marcar como lido"; return;
    }
    if (el.id === "scope") { searchScope = searchScope === "nt" ? "all" : "nt"; el.setAttribute("aria-pressed", searchScope === "all"); el.textContent = searchScope === "all" ? "Bíblia toda" : "Só Novo Testamento"; doSearch(); return; }
    if (el.hasAttribute("data-v") && route.v === "ch" && el.closest(".reader")) { openVerse(+el.getAttribute("data-v")); }
  });
  document.addEventListener("keydown", function (e) {
    var t = e.target;
    if ((e.key === "Enter" || e.key === " ") && t && t.classList && t.classList.contains("vn") && route.v === "ch") { e.preventDefault(); toggleNote(t.getAttribute("data-tn")); return; }
    if ((e.key === "Enter" || e.key === " ") && t && t.classList && t.classList.contains("v") && route.v === "ch" && t.closest(".reader")) { e.preventDefault(); openVerse(+t.getAttribute("data-v")); }
  });
  document.addEventListener("submit", function (e) { if (e.target.id === "authform") { e.preventDefault(); doSignIn(); } });
  function readFile(file, cb) { var fr = new FileReader(); fr.onload = function () { cb(String(fr.result)); }; fr.readAsText(file); }
  document.addEventListener("change", function (e) {
    var t = e.target; if (!t.files || !t.files[0]) return;
    if (t.id === "bfile") {
      readFile(t.files[0], function (txt) {
        var j; try { j = JSON.parse(txt); } catch (x) { j = null; }
        if (!j || !j.b || j.b.length !== 66) { var m = $("#bmsg"); if (m) m.textContent = "Esse arquivo não parece ser o texto da Bíblia deste app."; return; }
        idbSet("biblia", j).then(function () { useBible(j); });
      });
    } else if (t.id === "bk-file") {
      readFile(t.files[0], function (txt) { $("#bk-text").value = txt; var mm = $("#bk-msg"); if (mm) mm.textContent = importBackup(txt); });
    }
  });
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferredInstall = e; if (route.v === "acc") render(); });
  var inputTimer = null, tt = null;
  document.addEventListener("input", function (e) {
    var t = e.target;
    if (t.id === "q" && t.type === "search") { clearTimeout(inputTimer); inputTimer = setTimeout(doSearch, 180); return; }
    if (route.v !== "ch" || !t.getAttribute) return;
    var key = route.bi + "-" + route.ch, f = t.getAttribute("data-f");
    if (f) { W(key)[f] = t.value; if (f === "s") $("#wc").textContent = wc(t.value); autosize(t); debounceTouch(key); }
    else if (t.getAttribute("data-q") !== null) { W(key).a[+t.getAttribute("data-q")] = t.value; autosize(t); debounceTouch(key); }
    else if (t.getAttribute("data-note")) {
      var id = t.getAttribute("data-note"), n = W(key).n.filter(function (x) { return x.id === id; })[0];
      if (n) { n.t = t.value; n.ts = n.ts || Date.now(); autosize(t); debounceTouch(key); }
    } else if (t.id === "vn") {
      var v = +t.getAttribute("data-verse"), r = W(key), nn = r.n.filter(function (x) { return x.v === v; })[0];
      if (!nn) { nn = { id: newId(), v: v, t: "", ts: Date.now() }; r.n.push(nn); }
      nn.t = t.value; autosize(t); debounceTouch(key);
    }
  });
  function debounceTouch(key) { var r = W(key); r.ts = Date.now(); saveLocal(); setStatus(rem ? "saving" : "local"); clearTimeout(tt); tt = setTimeout(function () { touch(key); }, 600); }
  document.addEventListener("toggle", function (e) {
    var d = e.target;
    if (d && d.matches && d.matches("details.step")) { stepOpen[d.getAttribute("data-step")] = d.open; if (d.open) $$("textarea", d).forEach(autosize); }
  }, true);
  window.addEventListener("pagehide", function () { saveLocal(); });
  document.addEventListener("keydown", function (e) {
    if (route.v !== "ch" || layer.firstChild) return;
    var tg = e.target && e.target.tagName; if (tg === "TEXTAREA" || tg === "INPUT") return;
    if (e.key === "ArrowRight") { var n = nextCh(route.bi, route.ch); if (n) go({ v: "ch", bi: n[0], ch: n[1] }); }
    if (e.key === "ArrowLeft") { var p = prevCh(route.bi, route.ch); if (p) go({ v: "ch", bi: p[0], ch: p[1] }); }
  });

  var started = false;
  function start() {
    if (started) return; started = true;
    var m = (location.hash || "").match(/^#(\d+)-(\d+)$/);
    if (m && BIBLE[+m[1]] && +m[2] >= 1 && +m[2] <= BIBLE[+m[1]].c.length) route = { v: "ch", bi: +m[1], ch: +m[2] };
    render();
    initRemote();
  }
  function boot() {
    if (!PWA) {
      setData(JSON.parse(document.getElementById("bible-data").textContent).b, JSON.parse(document.getElementById("guide-data").textContent), JSON.parse(document.getElementById("ctx-data").textContent));
      start(); return;
    }
    var nav = $("#n-acc"); if (nav) nav.hidden = !sbConfigured();
    if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(function () {});
    app.innerHTML = '<p class="empty page">Carregando…</p>';
    Promise.all([fetchJson("guia.json"), fetchJson("contexto.json")]).then(function (r) {
      GUIDE = r[0]; CTX = r[1];
      sbStart();
      return idbGet("biblia").then(function (j) {
        if (j && j.b) return j;
        return fetchJson("biblia.json").then(function (x) { return idbSet("biblia", x).then(function () { return x; }); }).catch(function () { return null; });
      });
    }).then(function (j) { if (j && j.b) useBible(j); else render(); })
      .catch(function () { app.innerHTML = '<p class="empty page">Não foi possível carregar os arquivos do app. Verifique a conexão e tente de novo.</p>'; });
  }
  boot();
})();
