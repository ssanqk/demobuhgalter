/* Демо-сховище «Бухгалтера».
   Той самий інтерфейс, що й справжній db.js (doc().get/set/onSnapshot, listPaths,
   exportAll, importAll), але:
     • дані живуть лише в цій вкладці (sessionStorage) — закрив вкладку, і все скинулось;
     • при першому відкритті генеруються готові суми за останні 12 місяців, план і цілі;
     • ні акаунтів, ні сервера — нічого нікуди не відправляється.
   index.html береться з основного сайту без змін. */
(function () {
  "use strict";

  /* ---------- налаштування демо ---------- */
  var PORTFOLIO_URL = "";              // посилання «← До портфоліо» у банері; порожнє — без посилання
  var STORE = "hb-demo:v1";            // ключ у sessionStorage
  var MONTHS_BACK = 12;                // скільки минулих місяців заповнити (+ поточний) — щоб у «Році» був повний минулий рік

  /* ---------- дрібниці ---------- */
  function clone(v) { return v == null ? null : JSON.parse(JSON.stringify(v)); }
  function snap(path, data) {
    return { id: path, exists: data != null, data: function () { return data == null ? undefined : clone(data); } };
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function ymOf(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; }); }

  /* детермінований генератор: однакові суми при кожному «Почати заново» */
  function rng(seedStr) {
    var h = 2166136261;
    for (var i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () {
      h += 0x6D2B79F5;
      var t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- демо-дані ---------- */
  var RATES = { UAH: 1, USD: 44.8571, EUR: 51.1864, PLN: 11.6954 };

  function buildSeed() {
    var now = new Date();
    var docs = {};
    var n = 0;

    for (var back = MONTHS_BACK; back >= 0; back--) {
      var first = new Date(now.getFullYear(), now.getMonth() - back, 1);
      var ym = ymOf(first);
      var daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
      var lastDay = back === 0 ? now.getDate() : daysIn;
      var r = rng("buhgalter-" + ym);
      var rnd = function (a, b, step) { step = step || 10; return Math.round((a + r() * (b - a)) / step) * step; };
      var winter = [10, 11, 0, 1, 2].indexOf(first.getMonth()) >= 0;   // листопад–березень — дорожча комуналка
      var ops = [];

      function add(day, group, cat, amount, note, cur) {
        if (day > lastDay) return;
        cur = cur || "UAH";
        var rate = RATES[cur];
        ops.push({
          id: "demo" + (++n).toString(36) + ym.replace("-", ""),
          date: ym + "-" + pad(Math.min(day, daysIn)),
          group: group, cat: cat, amount: amount, cur: cur, rate: rate,
          uah: Math.round(amount * rate * 100) / 100, note: note
        });
      }

      /* доходи */
      add(5, "income", "salary", 10000, "Аванс");
      add(20, "income", "salary", 15000, "Зарплата");
      if (back % 2 === 0) add(rnd(15, 26, 1), "income", "other", rnd(80, 150, 5), "Фриланс: лендінг для клієнта", "USD");
      else add(rnd(10, 24, 1), "income", "other", rnd(1800, 3200, 100), ["Продав навушники на OLX", "Повернення боргу від друга", "Кешбек"][back % 3]);

      /* заощадження */
      add(5, "savings", "reserve", 3000, "У резервний фонд");
      add(21, "savings", "goal", 100, "На ноутбук", "USD");

      /* постійні */
      add(1, "fixed", "home", 5200, "Оренда квартири");
      add(12, "fixed", "home", winter ? rnd(2100, 2700) : rnd(1300, 1700), "Комунальні");
      add(2, "fixed", "transport", 800, "Проїзний");
      add(rnd(17, 27, 1), "fixed", "transport", rnd(140, 260), "Таксі");
      var shops = ["АТБ", "Сільпо", "Ринок", "Наш Край", "Фора", "Новус", "АТБ"];
      [2, 6, 10, 14, 18, 23, 27].forEach(function (d, i) { add(d, "fixed", "food", rnd(650, 1350), shops[i]); });
      if (r() < 0.7) add(rnd(3, 25, 1), "fixed", "meds", rnd(180, 460), "Аптека");

      /* змінні */
      add(3, "variable", "fun", 299, "YouTube Premium");
      add(8, "variable", "fun", 249, "Netflix");
      if (r() < 0.6) add(rnd(9, 26, 1), "variable", "fun", rnd(900, 1900, 50), ["Rozetka: навушники", "Prom: лампа на стіл", "Rozetka: кросівки", "Книги на Yakaboo"][back % 4]);
      add(9, "variable", "ent", rnd(280, 450), "Кава з друзями");
      add(16, "variable", "ent", rnd(360, 480), "Кіно");
      add(25, "variable", "ent", rnd(600, 950), "Піца на вихідних");
      add(14, "variable", "hobby", 750, "Абонемент у зал");

      ops.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
      var stamp = back === 0
        ? now.getTime() - 3 * 3600 * 1000
        : new Date(first.getFullYear(), first.getMonth(), daysIn, 21, 14).getTime();
      docs["ledger/" + ym] = { ops: ops, updatedAt: stamp };

      docs["plan/" + ym] = {
        cats: {
          "income/salary": 25000, "income/other": 3000,
          "savings/goal": 4500, "savings/reserve": 3000,
          "fixed/home": winter ? 7700 : 6800, "fixed/transport": 1000, "fixed/food": 6500, "fixed/meds": 400,
          "variable/ent": 1500, "variable/fun": 1500, "variable/hobby": 750
        },
        updatedAt: new Date(first.getFullYear(), first.getMonth(), 1, 10, 5).getTime()
      };
    }

    function inMonths(k) { var d = new Date(now.getFullYear(), now.getMonth() + k, 15); return ymOf(d) + "-15"; }
    docs["meta/goals"] = {
      items: [
        { id: "g-laptop", name: "Ноутбук для роботи", target: 1200, saved: 640, cur: "USD", deadline: inMonths(5) },
        { id: "g-reserve", name: "Подушка на 3 місяці", target: 60000, saved: 38500, cur: "UAH", deadline: inMonths(10) },
        { id: "g-mountains", name: "Відпустка в Карпатах", target: 18000, saved: 16200, cur: "UAH", deadline: inMonths(2) },
        { id: "g-krakow", name: "Поїздка до Кракова", target: 600, saved: 90, cur: "EUR", deadline: inMonths(8) }
      ],
      updatedAt: now.getTime() - 26 * 3600 * 1000
    };
    docs["meta/prefs"] = { cats: {}, versions: [], tabs: {}, layout: 2, updatedAt: now.getTime() - 40 * 86400000 };
    return docs;
  }

  /* ---------- сховище вкладки ---------- */
  var mem = null;
  function load() {
    if (mem) return mem;
    try { var s = sessionStorage.getItem(STORE); if (s) mem = JSON.parse(s); } catch (e) {}
    if (!mem || typeof mem !== "object") { mem = buildSeed(); persist(); }
    return mem;
  }
  function persist() { try { sessionStorage.setItem(STORE, JSON.stringify(mem)); } catch (e) {} }
  function resetDemo() { try { sessionStorage.removeItem(STORE); } catch (e) {} location.reload(); }

  var backend = {
    getMany: function (paths) {
      var m = load(), out = {};
      paths.forEach(function (p) { out[p] = m[p] == null ? null : clone(m[p]); });
      return Promise.resolve(out);
    },
    setMany: function (docs) {
      var m = load();
      Object.keys(docs).forEach(function (p) { m[p] = clone(docs[p]); });
      persist();
      return Promise.resolve();
    },
    list: function () { return Promise.resolve(Object.keys(load()).sort()); }
  };

  /* ---------- той самий API, що й у db.js ---------- */
  function makeDb() {
    var known = {}, subs = {};
    function deliver(path, data) {
      var s = JSON.stringify(data == null ? null : data);
      if (known[path] === s) return;
      known[path] = s;
      (subs[path] || []).forEach(function (sub) { try { sub.cb(snap(path, clone(data))); } catch (e) { console.warn(e); } });
    }
    function one(k, v) { var o = {}; o[k] = v; return o; }
    function doc(path) {
      return {
        get: function () { return backend.getMany([path]).then(function (d) { return snap(path, d[path]); }); },
        set: function (data) {
          var copy = clone(data);
          deliver(path, copy);
          return backend.setMany(one(path, copy));
        },
        onSnapshot: function (cb) {
          var sub = { cb: cb };
          (subs[path] = subs[path] || []).push(sub);
          backend.getMany([path]).then(function (d) {
            known[path] = JSON.stringify(d[path]);
            if (subs[path] && subs[path].indexOf(sub) >= 0) cb(snap(path, d[path]));
          });
          return function () {
            var arr = subs[path] || [], i = arr.indexOf(sub);
            if (i >= 0) arr.splice(i, 1);
            if (!arr.length) delete subs[path];
          };
        }
      };
    }
    return {
      mode: "demo",
      account: null,
      doc: doc,
      listPaths: function () { return backend.list(); },
      exportAll: function () {
        return backend.list().then(function (paths) { return backend.getMany(paths); });
      },
      importAll: function (docs) {
        return backend.setMany(docs).then(function () { Object.keys(docs).forEach(function (k) { if (subs[k]) deliver(k, docs[k]); }); });
      },
      logout: resetDemo,
      auth: function () { return Promise.reject(new Error("У демо акаунтів немає")); }
    };
  }

  /* ---------- оформлення демо ---------- */
  function decorate() {
    document.title = "Бухгалтер · демо";

    var b = document.getElementById("storageBanner");
    if (b) {
      b.hidden = false;
      b.classList.add("hb-demo");
      b.innerHTML =
        '<b>Демо-версія.</b> Суми вигадані — додавайте, редагуйте й видаляйте що завгодно. ' +
        'Зміни живуть лише в цій вкладці: закриєте її — і все повернеться до початкового вигляду.' +
        '<span class="hb-demo-act">' +
        '<button type="button" class="btn sm ghost" id="hbDemoReset">Почати заново</button>' +
        (PORTFOLIO_URL ? '<a class="btn sm ghost" href="' + esc(PORTFOLIO_URL) + '">← До портфоліо</a>' : "") +
        '</span>';
      document.getElementById("hbDemoReset").addEventListener("click", function () {
        if (confirm("Скинути всі зміни й повернути демо-дані?")) resetDemo();
      });
    }

    var dm = document.getElementById("dataMode");
    if (dm) dm.innerHTML = "Це <b>демо</b>: дані зберігаються лише в цій вкладці й нікуди не надсилаються. " +
      "У повній версії — вхід за паролем і облік у хмарі, однаковий на телефоні й комп'ютері.";

    var st = document.createElement("style");
    st.textContent =
      ".hb-demo{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;line-height:1.45}" +
      ".hb-demo-act{display:flex;gap:8px;margin-left:auto}" +
      ".hb-demo-act .btn{text-decoration:none;white-space:nowrap}";
    document.head.appendChild(st);
  }

  function connect() {
    load();
    var db = makeDb();
    /* сторінка малює свій стан у .then() після connect — оформлюємо одразу після неї */
    setTimeout(decorate, 0);
    return Promise.resolve(db);
  }

  function toast(text) {
    var el = document.getElementById("hbToast");
    if (!el) { el = document.createElement("div"); el.id = "hbToast"; document.body.appendChild(el); }
    el.textContent = text;
    el.className = "show";
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { el.className = ""; }, 5000);
  }

  window.BalanceDB = { connect: connect, toast: toast, reset: resetDemo };
})();
