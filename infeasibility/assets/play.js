/* 可玩页：只负责界面。走法、Φ、h 全部来自 world.js（生成时已与 Python 逐条比对）。
 * 实例数据来自 data.js（生成时从 data/*.json 与 formal/*.lean 现取）。 */
(function () {
  "use strict";
  var W = window.PWorld, S = window.SHOW;
  var $ = function (id) {
    var el = document.getElementById(id);
    if (!el) throw new Error("missing #" + id);
    return el;
  };
  var ARROW = { up: "↑", down: "↓", left: "←", right: "→" };
  var NAME = { up: "上", down: "下", left: "左", right: "右" };

  var cur = null;          // 当前实例
  var board = null;        // 当前盘面
  var hist = [];           // 走过的动作
  var boards = [];         // 每一步之后的盘面（含开局）
  var phiFlips = 0;        // Φ 变过几次
  var maxDrop = 0;         // 单步势函数最大下降
  var timer = null;

  function key(b) { return b.join(","); }
  function potential(b) {
    if (cur.gen === "C6") {
      var d = S.dist23[key(b)];
      return d === undefined ? null : d;
    }
    return W.hval(b, cur.cols);
  }
  function stopAnim() { if (timer) { clearInterval(timer); timer = null; } }

  function load(id) {
    stopAnim();
    var inst = S.instances.filter(function (x) { return x.id === id; })[0] || S.instances[0];
    cur = inst;
    board = inst.start.slice();
    hist = []; boards = [board.slice()]; phiFlips = 0; maxDrop = 0;
    var btns = document.querySelectorAll("[data-inst]");
    for (var i = 0; i < btns.length; i++)
      btns[i].setAttribute("aria-pressed", btns[i].getAttribute("data-inst") === inst.id ? "true" : "false");
    $("p-name").textContent = inst.name;
    $("p-gen").textContent = inst.genLabel;
    $("p-claim").textContent = inst.claim;
    $("p-cert").textContent = inst.cert;
    var th = $("p-thm");
    th.textContent = inst.thm;
    th.setAttribute("href", "proof.html#" + inst.thmAnchor);
    $("p-demo").hidden = !inst.route;
    $("p-demo").textContent = inst.route ? "演示已证路线（" + inst.route.length + " 步）" : "";
    $("p-potlabel").textContent = inst.gen === "C6" ? "dist（证书里的距离表）" : "h（曼哈顿距离和）";
    var goalEl = $("p-goal");
    goalEl.innerHTML = "";
    goalEl.appendChild(grid(inst.goal, inst, true));
    try { history.replaceState(null, "", "#" + inst.id); } catch (e) { /* file:// 下可能不许 */ }
    render();
  }

  function remaining() { return cur.budget === null ? null : cur.budget - hist.length; }
  /* 到了终局也不锁：已证路线可能中途就经过终局，演示要把整条路线走完。只有预算用完才锁。 */
  function locked() { var r = remaining(); return r !== null && r <= 0; }
  function firstHit() {
    for (var k = 0; k < boards.length; k++) if (W.same(boards[k], cur.goal)) return k;
    return -1;
  }

  function move(d) {
    if (locked()) return false;
    var before = board, after = W.step(board, cur.rows, cur.cols, d);
    var p0 = potential(before), p1 = potential(after);
    if (p0 !== null && p1 !== null) maxDrop = Math.max(maxDrop, p0 - p1);
    if (W.phi(after) !== W.phi(before)) phiFlips++;
    board = after; hist.push(d); boards.push(after.slice());
    render();
    return true;
  }

  function undo() {
    stopAnim();
    if (!hist.length) return;
    hist.pop(); boards.pop();
    board = boards[boards.length - 1].slice();
    render();
  }

  function grid(b, inst, small) {
    var g = document.createElement("div");
    g.className = "grid" + (small ? " small" : "");
    g.style.gridTemplateColumns = "repeat(" + inst.cols + ", 1fr)";
    var bi = W.blankIndex(b);
    for (var k = 0; k < b.length; k++) {
      var cell = document.createElement(small ? "div" : "button");
      var t = b[k];
      cell.className = "cell" + (t === 0 ? " blank" : (t === k + 1 ? " home" : ""));
      cell.textContent = t === 0 ? "" : String(t);
      if (!small) {
        cell.type = "button";
        var dir = null;
        for (var q = 0; q < W.DIRS.length; q++)
          if (W.target(bi, inst.rows, inst.cols, W.DIRS[q]) === k) dir = W.DIRS[q];
        if (dir) {
          cell.setAttribute("aria-label", "把 " + t + " 推进空格（空格向" + NAME[dir] + "）");
          cell.onclick = (function (dd) { return function () { stopAnim(); move(dd); }; })(dir);
        } else {
          cell.setAttribute("aria-label", t === 0 ? "空格" : "数字 " + t);
          cell.tabIndex = -1;
          cell.onclick = function () {};
        }
      }
      g.appendChild(cell);
    }
    return g;
  }

  function render() {
    var box = $("p-board");
    box.innerHTML = "";
    box.appendChild(grid(board, cur, false));
    var r = remaining();
    $("p-steps").textContent = String(hist.length);
    $("p-budget").textContent = cur.budget === null ? "不限" : String(cur.budget);
    $("p-left").textContent = r === null ? "—" : String(r);
    var ph = W.phi(board);
    $("p-phi").textContent = String(ph);
    $("p-phigoal").textContent = String(W.phi(cur.goal));
    $("p-phiflips").textContent = String(phiFlips);
    var pot = potential(board);
    $("p-pot").textContent = pot === null ? "表外" : String(pot);
    $("p-maxdrop").textContent = hist.length ? String(maxDrop) : "—";

    var msg, cls;
    var fh = firstHit();
    if (W.same(board, cur.goal)) {
      msg = "到达终局，用了 " + hist.length + " 步" +
            (fh >= 0 && fh < hist.length ? "（第 " + fh + " 步时已经第一次经过终局）" : "") + "。";
      cls = "ok";
    } else if (fh >= 0) {
      msg = "第 " + fh + " 步时经过了终局，现在又离开了。"; cls = "";
    } else if (r !== null && r <= 0) {
      msg = "预算用完，没到终局。"; cls = "bad";
    } else if (ph !== W.phi(cur.goal)) {
      msg = "当前 Φ = " + ph + "，终局 Φ = " + W.phi(cur.goal) +
            "。每一步都不改变 Φ，所以按证书，从这里走多少步都到不了终局。"; cls = "bad";
    } else if (r !== null && pot !== null && pot > r) {
      msg = "势 = " + pot + "，剩余预算 = " + r + "。每一步势最多减 1，所以按证书，剩下的步数已经不够。"; cls = "bad";
    } else if (r !== null && pot !== null) {
      msg = "势 = " + pot + " ≤ 剩余预算 " + r + "：证书挡不住，但这不等于一定走得到。"; cls = "";
    } else {
      msg = "Φ 与终局相同：奇偶证书挡不住。能不能走到，要看有没有路线。"; cls = "";
    }
    var m = $("p-msg");
    m.textContent = msg;
    m.className = "msg " + cls;
    var log = hist.map(function (d) { return ARROW[d]; }).join("");
    $("p-log").textContent = log || "（还没走）";
    var dp = document.querySelectorAll("[data-dir]");
    for (var i = 0; i < dp.length; i++) dp[i].disabled = locked();
  }

  function demo() {
    stopAnim();
    if (!cur.route) return;
    load(cur.id);
    var i = 0, route = cur.route;
    timer = setInterval(function () {
      if (i >= route.length) { stopAnim(); return; }
      move(route[i++]);
    }, route.length > 60 ? 60 : 160);
  }

  function randomWalk() {
    stopAnim();
    var seed = 20260926 + hist.length;
    function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
    var n = 0;
    while (n < 200 && !locked()) { move(W.DIRS[Math.floor(rnd() * 4)]); n++; }
  }

  function init() {
    var pick = $("p-pick");
    S.instances.forEach(function (inst) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "pick " + inst.verdictClass;
      b.setAttribute("data-inst", inst.id);
      b.innerHTML = "";
      var n = document.createElement("span"); n.className = "n"; n.textContent = inst.name;
      var v = document.createElement("span"); v.className = "v"; v.textContent = inst.genLabel + " · " + inst.short;
      b.appendChild(n); b.appendChild(v);
      b.onclick = function () { load(inst.id); };
      pick.appendChild(b);
    });
    var dp = document.querySelectorAll("[data-dir]");
    for (var i = 0; i < dp.length; i++)
      dp[i].onclick = (function (d) { return function () { stopAnim(); move(d); }; })(dp[i].getAttribute("data-dir"));
    $("p-undo").onclick = undo;
    $("p-reset").onclick = function () { load(cur.id); };
    $("p-demo").onclick = demo;
    $("p-walk").onclick = randomWalk;
    document.addEventListener("keydown", function (e) {
      var map = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
      var d = map[e.key];
      if (!d) return;
      var tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault(); stopAnim(); move(d);
    });
    var want = (location.hash || "").replace("#", "");
    load(want || S.instances[0].id);
  }

  init();
})();
