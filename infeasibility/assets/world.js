/* 展示页的走法：第三份独立实现（Lean 是第一份，world/*.py 是第二份）。
 * 盘面 = 行主序的一维数组，0 是空格；动作 = 空格朝 up/down/left/right 移动，与那格互换；
 * 越界则盘面不变，但仍算一步。
 * 它和 Python 实现对不对得上，由 showcase/parity_check.js 在生成时逐条比对，不一致就不出页面。
 */
(function (root) {
  "use strict";

  var DIRS = ["up", "down", "left", "right"];

  function blankIndex(b) {
    for (var i = 0; i < b.length; i++) if (b[i] === 0) return i;
    return -1;
  }

  function target(i, rows, cols, d) {
    var r = Math.floor(i / cols), c = i % cols;
    if (d === "up") return r > 0 ? i - cols : -1;
    if (d === "down") return r < rows - 1 ? i + cols : -1;
    if (d === "left") return c > 0 ? i - 1 : -1;
    if (d === "right") return c < cols - 1 ? i + 1 : -1;
    throw new Error("unknown direction: " + d);
  }

  function step(b, rows, cols, d) {
    var i = blankIndex(b);
    if (i < 0) return b.slice();
    var j = target(i, rows, cols, d);
    var out = b.slice();
    if (j < 0) return out;
    out[i] = b[j];
    out[j] = 0;
    return out;
  }

  function run(b, rows, cols, route) {
    var cur = b.slice();
    for (var k = 0; k < route.length; k++) cur = step(cur, rows, cols, route[k]);
    return cur;
  }

  /* Φ：去掉空格后，数字序列的逆序对个数取奇偶。 */
  function phi(b) {
    var t = b.filter(function (x) { return x !== 0; });
    var n = 0;
    for (var i = 0; i < t.length; i++)
      for (var j = i + 1; j < t.length; j++) if (t[i] > t[j]) n++;
    return n % 2;
  }

  /* h：每个数字块到它终局位置（数字 t 的终局下标是 t-1）的曼哈顿距离之和，空格不计。 */
  function hval(b, cols) {
    var s = 0;
    for (var k = 0; k < b.length; k++) {
      var t = b[k];
      if (t === 0) continue;
      s += Math.abs(Math.floor(k / cols) - Math.floor((t - 1) / cols)) +
           Math.abs((k % cols) - ((t - 1) % cols));
    }
    return s;
  }

  function same(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  var api = { DIRS: DIRS, blankIndex: blankIndex, target: target, step: step, run: run,
              phi: phi, hval: hval, same: same };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PWorld = api;
})(this);
