/* 不可解局 · 游戏机页（play.html）。
 * 走法、渲染、点击映射全部来自 tanks.js（globalThis.TANKS，构建时已与 Python 参考模型逐条差分）；
 * 这里只做 ARC 式的外壳：选机器、开机画面、关卡切换、结束画面、帮助与选关。
 * 路由：#            → 列表（ALL GAMES）
 *       #tk03        → 这台机器，从开机画面开始
 *       #tk03/c10-a4 → 直接进这一关 */
(function () {
  "use strict";
  var T = window.TANKS, DATA = window.TANKS_DATA;
  if (!T || !DATA) return;
  var N = T.N, SCALE = 8;
  var PAL = ["#000000", "#0074D9", "#FF4136", "#2ECC40", "#FFDC00", "#AAAAAA", "#F012BE", "#FF851B",
             "#7FDBFF", "#870C25", "#39CCCC", "#01FF70", "#B10DC9", "#555555", "#FFFFFF", "#DDDDDD"];
  var GAMES = [
    { code: "tk01", group: "C8", sub: "预算与步长余数。普通 agent 就做得出。" },
    { code: "tk02", group: "C9", sub: "说明里不写的规则：闩。两臂都没做出来。" },
    { code: "tk03", group: "C10", sub: "闩串成多米诺链。规则难学全，推理不够难。" },
  ];
  GAMES.forEach(function (g) {
    g.levels = DATA.levels.filter(function (l) { return l.group === g.group; });
    g.name = g.levels.length ? g.levels[0].genLabel : g.code;
  });
  GAMES = GAMES.filter(function (g) { return g.levels.length; });   // 构建只发布了哪几版，就只有哪几台

  var game = null, lv = 0, st = null, canvas, ctx;
  function $(id) { return document.getElementById(id); }
  function show(el, on) { el.hidden = !on; }
  function shortName(l) {   // c10-p3 → 练3；c10-a4 → A4
    var t = l.id.split("-")[1];
    return t.charAt(0) === "p" ? "练" + t.slice(1) : t.toUpperCase();
  }

  function paint(c, grid, grid_lines) {
    var g = c.getContext("2d");
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      g.fillStyle = PAL[grid[y][x]];
      g.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
    }
    if (!grid_lines) return;
    g.fillStyle = "rgba(255,255,255,0.045)";          // ARC 屏上那层淡网格
    for (var k = 1; k < N; k++) {
      g.fillRect(k * SCALE, 0, 1, N * SCALE);
      g.fillRect(0, k * SCALE, N * SCALE, 1);
    }
  }

  // ---------------------------------------------------------------- 列表
  function renderList() {
    var box = $("games");
    if (box.childElementCount) return;
    GAMES.forEach(function (g) {
      var a = document.createElement("a");
      a.className = "game"; a.href = "#" + g.code;
      var c = document.createElement("canvas");
      c.width = c.height = N * SCALE;
      var tl = g.levels.filter(function (l) { return l.kind !== "练习"; })[0] || g.levels[0];
      paint(c, T.render(tl.board, T.start(tl), tl.budget), true);
      a.appendChild(c);
      a.insertAdjacentHTML("beforeend",
        '<div class="gc">' + g.code.toUpperCase() + '</div><div class="gn"></div><div class="gs"></div>');
      a.querySelector(".gn").textContent = g.name + " · " + g.levels.length + " 关";
      a.querySelector(".gs").textContent = g.sub;
      box.appendChild(a);
    });
  }

  // ---------------------------------------------------------------- 游戏
  function level() { return game.levels[lv]; }
  function draw() {
    var L = level();
    paint(canvas, T.render(L.board, st, L.budget), true);
    $("c-level").textContent = "LEVEL " + (lv + 1) + " / " + game.levels.length;
    $("s-used").textContent = st.used;
    $("s-budget").textContent = L.budget;
    $("s-fine").textContent = L.board.latches.length ? st.st.fine.length + " / " + L.board.latches.length : "本关没有闩";
    var m = $("s-msg");
    m.className = st.won ? "ok" : st.lost ? "bad" : "";
    m.textContent = st.won ? "赢了" : st.lost ? "预算用完" : "";
  }
  function closeOverlays() { ["ov-end", "ov-help", "ov-select"].forEach(function (id) { show($(id), false); }); }
  function setLevel(i, fromStart) {
    lv = Math.max(0, Math.min(game.levels.length - 1, i));
    var L = level();
    st = T.start(L);
    closeOverlays();
    if (!fromStart) show($("ov-start"), false);
    $("reveal").innerHTML = L.reveal;
    $("reveal-box").open = false;
    $("help-body").textContent = L.ruleText;
    history.replaceState(null, "", "#" + game.code + "/" + L.id);
    draw();
  }
  function openGame(g, levelId) {
    game = g;
    $("g-crumb").textContent = "GAME " + g.code.toUpperCase();
    $("g-dataset").textContent = "DATASET: 液槽世界 · " + g.name;
    $("c-code").textContent = g.code;
    $("ov-start-title").textContent = g.name;
    var i = 0;
    g.levels.forEach(function (l, k) { if (l.id === levelId) i = k; });
    show($("ov-start"), !levelId);
    setLevel(i, !levelId);
    document.title = g.name + " · 不可解局 · 游戏机";
  }
  function finish() {
    var last = lv === game.levels.length - 1;
    $("ov-end-title").textContent = st.won ? (last ? "ALL CLEAR" : "LEVEL CLEAR") : "GAME OVER";
    $("ov-end-sub").textContent = st.won
      ? "用了 " + st.used + " 步，预算 " + level().budget + "。"
      : "预算用完了。这一关到底打不打得通？可以看下面的揭晓。";
    show($("b-nextlv"), !last);
    show($("ov-end"), true);
    $("b-nextlv").focus();
  }
  function onClick(ev) {
    if (!game || st.won || st.lost) return;
    var r = canvas.getBoundingClientRect();
    var x = Math.floor((ev.clientX - r.left) / r.width * N), y = Math.floor((ev.clientY - r.top) / r.height * N);
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    var L = level();
    st = T.play(L.board, L.budget, st, T.hit(L.board, x, y) || ["noop"]);
    var a = $("a-click");
    a.classList.add("flash");
    setTimeout(function () { a.classList.remove("flash"); }, 120);
    draw();
    if (st.won || st.lost) {
      var ended = st;                       // 350 ms 内换了关或重开，就不再弹这一关的结束画面
      setTimeout(function () { if (st === ended) finish(); }, 350);
    }
  }
  function openSelect() {
    var box = $("sel-grid"), html = "", head = "";
    game.levels.forEach(function (l, k) {
      var h = l.kind === "练习" ? "练习关" : (l.id.split("-")[1].charAt(0) === "a" ? "测试关 · A 套" : "测试关 · B 套");
      if (h !== head) { html += '<div class="sg-h">' + h + "</div>"; head = h; }
      html += '<button type="button" data-lv="' + k + '"' + (k === lv ? ' aria-current="true"' : "") +
              ' title="' + l.title.replace(/"/g, "&quot;") + '">' + shortName(l) + "</button>";
    });
    box.innerHTML = html;
    closeOverlays();
    show($("ov-select"), true);
  }

  // ---------------------------------------------------------------- 路由
  function route() {
    var h = decodeURIComponent(location.hash.replace(/^#/, "")), parts = h.split("/");
    var g = GAMES.filter(function (x) { return x.code === parts[0]; })[0];
    show($("v-list"), !g);
    show($("v-game"), !!g);
    if (!g) { game = null; renderList(); document.title = "不可解局 · 游戏机"; return; }
    if (game !== g || (parts[1] && parts[1] !== level().id)) openGame(g, parts[1]);
  }
  function step(d) {
    var k = (GAMES.indexOf(game) + d + GAMES.length) % GAMES.length;
    location.hash = GAMES[k].code;
  }

  function init() {
    canvas = $("c-canvas");
    canvas.width = canvas.height = N * SCALE;
    canvas.addEventListener("click", onClick);
    $("b-start").addEventListener("click", function () { show($("ov-start"), false); });
    $("b-reset").addEventListener("click", function () { if (game) setLevel(lv); });
    $("b-retry").addEventListener("click", function () { setLevel(lv); });
    $("b-nextlv").addEventListener("click", function () { setLevel(lv + 1); });
    $("b-help").addEventListener("click", function () { if (game) { closeOverlays(); show($("ov-help"), true); } });
    $("b-select").addEventListener("click", function () { if (game) openSelect(); });
    $("sel-grid").addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-lv]");
      if (b) setLevel(+b.getAttribute("data-lv"));
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-close]"), function (b) {
      b.addEventListener("click", closeOverlays);
    });
    $("g-prev").addEventListener("click", function () { step(-1); });
    $("g-next").addEventListener("click", function () { step(1); });
    if (GAMES.length < 2) $("g-prev").parentNode.hidden = true;
    $("c-share").addEventListener("click", function () {
      try { navigator.clipboard.writeText(location.href); } catch (e) { /* 剪贴板不可用就算了 */ }
    });
    document.addEventListener("keydown", function (ev) {
      if (!game || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      var k = ev.key.toLowerCase();
      if (k === "r") setLevel(lv);
      else if (k === "h") { closeOverlays(); show($("ov-help"), true); }
      else if (k === "s") openSelect();
      else if (k === "escape") closeOverlays();
      else if (k === "enter" && !$("ov-start").hidden) show($("ov-start"), false);
    });
    window.addEventListener("hashchange", route);
    route();
  }
  window.ARCPLAY = { get state() { return st; }, get level() { return game && level(); }, setLevel: function (i) { setLevel(i); } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
