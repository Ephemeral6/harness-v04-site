/* 液槽世界（C8 / C9 / C10）的浏览器实现 + 可玩页。
 * 规则与 c8/c9/c10 的 model.py（以及服务端执行的 Lean 世界）逐条对应；
 * showcase/build_tanks.py 在构建时用 node 把这份 JS 与 Python 逐条差分（转移、整帧、每个像素的点击映射）。
 * 同一个文件在 node 里也能 require：导出到 globalThis.TANKS。 */
(function (root) {
  "use strict";
  var N = 64, FLOOR = 63, DMAX = 58;
  var BG = 0, WALL = 5, LIQ = 1, BTN = 4, GOFF = 8, GON = 11;
  var LATCH = 10, CUE = 12, OPEN = 14, HUD_LEFT = 15, HUD_USED = 13, HUD_WON = 3, HUD_LOST = 2;

  function cap(b, j) {
    var m = DMAX;
    if (j >= 1) m = Math.min(m, b.height[j - 1]);
    if (j <= b.n - 2) m = Math.min(m, b.height[j]);
    return m;
  }
  function hasBtn(b, i, side) {
    var ow = b.oneway.length ? b.oneway[i - 1] : "";
    return ow === "" || ow === side;
  }
  function isLatch(b, i) { return b.latches.indexOf(i) >= 0; }
  function released(s, i) { return s.fine.indexOf(i) >= 0; }
  function stepOf(b, s, i) { return isLatch(b, i) && released(s, i) ? 1 : b.thick[i - 1]; }
  function latchReady(b, s, i) {
    if (!isLatch(b, i) || released(s, i)) return false;
    if (b.rule === "both_full") return s.levels[i - 1] === cap(b, i - 1) && s.levels[i] === cap(b, i);
    if (b.rule === "left_full_right_empty") return s.levels[i - 1] === cap(b, i - 1) && s.levels[i] === 0;
    return false;
  }
  function lit(b, s, k) {
    var g = b.gauges[k];
    return s.levels[g[0] - 1] === g[1] && s.levels[g[0]] === g[1];
  }
  function clone(s) { return { levels: s.levels.slice(), cursors: s.cursors.map(function (c) { return c.slice(); }), fine: s.fine.slice() }; }

  function step(b, s, a) {
    if (a[0] === "btn") {
      var i = a[1], side = a[2];
      if (i < 1 || i > b.n - 1 || !hasBtn(b, i, side)) return s;
      var gain = side === "L" ? i - 1 : i, lose = side === "L" ? i : i - 1;
      var t = stepOf(b, s, i);
      if (s.levels[lose] < t || s.levels[gain] + t > cap(b, gain)) return s;
      var n = clone(s);
      n.levels[gain] += t; n.levels[lose] -= t;
      return n;
    }
    if (a[0] === "gauge") {
      var k = a[1];
      if (k >= b.gauges.length || !lit(b, s, k)) return s;
      var gi = b.gauges[k][0], z0 = gi - 1, z1 = gi, m = clone(s);
      m.cursors = m.cursors.map(function (c) { return [c[0], c[1] === z0 ? z1 : (c[1] === z1 ? z0 : c[1])]; });
      m.cursors.sort(function (p, q) { return p[0] - q[0] || p[1] - q[1]; });
      return m;
    }
    if (a[0] === "latch") {
      if (!latchReady(b, s, a[1])) return s;
      var r = clone(s);
      r.fine.push(a[1]); r.fine.sort(function (p, q) { return p - q; });
      return r;
    }
    return s;
  }
  function isGoal(b, s) {
    var where = {};
    s.cursors.forEach(function (c) { where[c[0]] = c[1]; });
    var pairs = b.targets.filter(function (t) { return t[0] in where; });
    if (!pairs.length) return false;
    return pairs.every(function (t) {
      var z = where[t[0]];
      return s.levels[z] === t[2] && (z === t[1] - 1 || z === t[1]);
    });
  }
  function play(b, budget, g, a) {
    if (g.won || g.lost) return g;
    var s2 = step(b, g.st, a), u = g.used + 1;
    if (isGoal(b, s2)) return { st: s2, used: u, won: true, lost: false };
    if (budget <= u) return { st: s2, used: u, won: false, lost: true };
    return { st: s2, used: u, won: false, lost: false };
  }
  function layout(b) {
    var total = 2, j;
    for (j = 0; j < b.n; j++) total += b.widths[j];
    for (j = 0; j < b.n - 1; j++) total += b.thick[j];
    var x = Math.floor((N - total) / 2) + 1, tanks = [], walls = [];
    for (j = 0; j < b.n; j++) {
      tanks.push([x, x + b.widths[j]]); x += b.widths[j];
      if (j < b.n - 1) { walls.push([x, x + b.thick[j]]); x += b.thick[j]; }
    }
    return { tanks: tanks, walls: walls };
  }
  function render(b, g, budget) {
    var s = g.st, grid = [], x, y, i, L = layout(b);
    for (y = 0; y < N; y++) { grid.push(new Array(N).fill(BG)); }
    if (budget !== null) {
      for (x = 0; x < Math.min(budget, N); x++) grid[0][x] = x >= budget - g.used ? HUD_USED : HUD_LEFT;
      if (g.won) grid[0] = new Array(N).fill(HUD_WON);
      else if (g.lost) grid[0] = new Array(N).fill(HUD_LOST);
    }
    var lx = L.tanks[0][0] - 1, rx = L.tanks[L.tanks.length - 1][1];
    for (y = FLOOR - DMAX + 1; y <= FLOOR; y++) { grid[y][lx] = WALL; grid[y][rx] = WALL; }
    L.walls.forEach(function (w, idx) {
      var di = idx + 1, h = b.height[idx], body = WALL;
      if (isLatch(b, di)) body = released(s, di) ? OPEN : LATCH;
      for (var yy = FLOOR - h + 1; yy <= FLOOR; yy++) for (var xx = w[0]; xx < w[1]; xx++) grid[yy][xx] = body;
      if (latchReady(b, s, di)) for (var xc = w[0]; xc < w[1]; xc++) grid[FLOOR - h + 1][xc] = CUE;
      var top = FLOOR - h;
      if (hasBtn(b, di, "L")) grid[top][w[0]] = BTN;
      if (hasBtn(b, di, "R")) grid[top][w[1] - 1] = BTN;
    });
    L.tanks.forEach(function (t, j) {
      for (var yy = FLOOR - s.levels[j] + 1; yy <= FLOOR; yy++) for (var xx = t[0]; xx < t[1]; xx++) grid[yy][xx] = LIQ;
    });
    b.targets.forEach(function (t) {
      var w = L.walls[t[1] - 1];
      grid[FLOOR - t[2]][Math.floor((w[0] + w[1] - 1) / 2)] = t[0];
    });
    b.gauges.forEach(function (gg, k) {
      var w = L.walls[gg[0] - 1], col = lit(b, s, k) ? GON : GOFF;
      for (var xx = w[0]; xx < w[1]; xx++) grid[FLOOR - gg[1]][xx] = col;
    });
    s.cursors.forEach(function (c) {
      var t = L.tanks[c[1]], yy = FLOOR - s.levels[c[1]];
      for (var xx = t[0]; xx < t[1]; xx++) grid[yy][xx] = c[0];
    });
    return grid;
  }
  function hit(b, x, y) {
    var L = layout(b), i;
    for (i = 1; i <= L.walls.length; i++) {
      var w = L.walls[i - 1], top = FLOOR - b.height[i - 1];
      if (y === top && x === w[0] && hasBtn(b, i, "L")) return ["btn", i, "L"];
      if (y === top && x === w[1] - 1 && hasBtn(b, i, "R")) return ["btn", i, "R"];
    }
    for (var k = 0; k < b.gauges.length; k++) {
      var gw = L.walls[b.gauges[k][0] - 1];
      if (y === FLOOR - b.gauges[k][1] && x >= gw[0] && x < gw[1]) return ["gauge", k];
    }
    var marks = {};
    b.targets.forEach(function (t) { marks[t[1] + ":" + (FLOOR - t[2])] = 1; });
    for (var q = 0; q < b.latches.length; q++) {
      var li = b.latches[q], lw = L.walls[li - 1], ltop = FLOOR - b.height[li - 1];
      if (x >= lw[0] && x < lw[1] && y > ltop && y <= FLOOR && !marks[li + ":" + y]) return ["latch", li];
    }
    return null;
  }
  function start(lv) { return { st: clone(lv.start), used: 0, won: false, lost: false }; }

  var API = { N: N, cap: cap, step: step, play: play, isGoal: isGoal, render: render, hit: hit, layout: layout,
              latchReady: latchReady, start: start };
  root.TANKS = API;

  // ------------------------------------------------------------------ 可玩页（只在浏览器里跑）
  if (typeof document === "undefined") return;
  var PAL = ["#000000", "#0074D9", "#FF4136", "#2ECC40", "#FFDC00", "#AAAAAA", "#F012BE", "#FF851B",
             "#7FDBFF", "#870C25", "#39CCCC", "#01FF70", "#B10DC9", "#555555", "#FFFFFF", "#DDDDDD"];
  var data = root.TANKS_DATA, cur = null, game = null, canvas, ctx, SCALE = 8;

  function $(id) { return document.getElementById(id); }
  function draw() {
    var grid = render(cur.board, game, cur.budget);
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      ctx.fillStyle = PAL[grid[y][x]];
      ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
    }
    $("tk-used").textContent = game.used;
    $("tk-budget").textContent = cur.budget;
    $("tk-left").textContent = cur.budget - game.used;
    $("tk-fine").textContent = cur.board.latches.length
      ? game.st.fine.length + " / " + cur.board.latches.length : "本关没有闩";
    var m = $("tk-msg");
    m.className = "msg" + (game.won ? " ok" : game.lost ? " bad" : "");
    m.textContent = game.won ? "赢了：光标都停在各自目标的深度上。"
      : game.lost ? "预算用完，没赢。点「重开」再来。"
      : "点隔条顶上的黄格搬液体。";
  }
  function choose(id) {
    var hit_ = data.levels.filter(function (l) { return l.id === id; });
    if (!hit_.length) return;
    cur = hit_[0];
    game = start(cur);
    $("tk-name").textContent = cur.title;
    $("tk-gen").textContent = cur.genLabel;
    $("tk-rule").textContent = cur.ruleText;
    $("tk-reveal").innerHTML = cur.reveal;
    $("tk-reveal-box").open = false;
    Array.prototype.forEach.call(document.querySelectorAll("[data-tk]"), function (el) {
      el.setAttribute("aria-pressed", el.getAttribute("data-tk") === id ? "true" : "false");
    });
    draw();
  }
  function onClick(ev) {
    if (!cur || game.won || game.lost) return;
    var r = canvas.getBoundingClientRect();
    var x = Math.floor((ev.clientX - r.left) / r.width * N), y = Math.floor((ev.clientY - r.top) / r.height * N);
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    game = play(cur.board, cur.budget, game, hit(cur.board, x, y) || ["noop"]);
    draw();
  }
  function init() {
    canvas = $("tk-canvas");
    if (!canvas) return;
    canvas.width = N * SCALE; canvas.height = N * SCALE;
    ctx = canvas.getContext("2d");
    canvas.addEventListener("click", onClick);
    $("tk-reset").addEventListener("click", function () { if (cur) { game = start(cur); draw(); } });
    Array.prototype.forEach.call(document.querySelectorAll("[data-tk]"), function (el) {
      el.addEventListener("click", function () {
        var id = el.getAttribute("data-tk");
        choose(id);
        history.replaceState(null, "", "#" + id);
      });
    });
    var h = location.hash.replace("#", "");
    choose(data.levels.some(function (l) { return l.id === h; }) ? h : data.levels[0].id);
  }
  root.TANKS.ui = { choose: choose, get game() { return game; }, get level() { return cur; } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})(typeof window !== "undefined" ? window : globalThis);
