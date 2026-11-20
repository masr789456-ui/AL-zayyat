// ===== الجدول الأسبوعي =====
window.VIEWS = window.VIEWS || {};

(function () {
  const BLOCKS_KEY = "platform-blocks";
  const TASKS_KEY = "platform-tasks";
  const TYPES = { lesson: "درس أو محاضرة", study: "مذاكرة", rest: "راحة", sleep: "نوم", personal: "التزام شخصي" };
  const COLORS = { lesson: "#1f7a6b", study: "#2b5fa8", rest: "#8a6d1b", sleep: "#5b4a8a", personal: "#9a4a3a" };

  function read(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* نكمل بدون حفظ */ }
  }
  function esc(t) {
    return String(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function fmt(t) {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    return (h % 12 || 12) + ":" + String(m).padStart(2, "0") + (h < 12 ? " ص" : " م");
  }
  const iso = d => d.toLocaleDateString("en-CA");
  // بداية الأسبوع يوم السبت
  function weekStart(d) {
    const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    s.setDate(s.getDate() - ((s.getDay() + 1) % 7));
    return s;
  }

  VIEWS.weekly = function (box) {
    let anchor = new Date();

    function blockHtml(b) {
      const range = fmt(b.start) + (b.end ? " - " + fmt(b.end) : "");
      return `<div style="border-right:4px solid ${COLORS[b.type]};padding:4px 8px;background:#f7faf9;border-radius:6px">
        <strong>${esc(b.title)}</strong>
        <div style="font-size:.85rem;color:#5d716c">${TYPES[b.type]} • ${range}</div></div>`;
    }
    function taskHtml(t) {
      return `<label style="display:flex;gap:8px;align-items:flex-start;padding:4px 8px;background:#fff;border:1px solid #d5dfdb;border-radius:6px">
        <input type="checkbox" data-tdone="${t.id}" ${t.done ? "checked" : ""} style="width:18px;height:18px;margin-top:4px">
        <span style="${t.done ? "text-decoration:line-through;opacity:.6" : ""}">
          <strong>${esc(t.title)}</strong>
          <span style="display:block;font-size:.85rem;color:#5d716c">${t.time ? "مهمة • " + fmt(t.time) : "مهمة"}</span>
        </span></label>`;
    }

    function draw() {
      const start = weekStart(anchor);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
      const todayIso = iso(new Date());
      const blocks = read(BLOCKS_KEY, []);
      const tasks = read(TASKS_KEY, []);
      const opts = { day: "numeric", month: "long" };
      const rangeLabel = start.toLocaleDateString("ar-EG", opts) + " إلى " + end.toLocaleDateString("ar-EG", opts);

      let cols = "";
      for (let i = 0; i < 7; i++) {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        const dIso = iso(d);
        const items = [];
        blocks.filter(b => b.daily || b.date === dIso).forEach(b => items.push({ time: b.start, html: blockHtml(b) }));
        tasks.filter(t => t.date === dIso).forEach(t => items.push({ time: t.time || "99:99", html: taskHtml(t) }));
        items.sort((a, b) => a.time.localeCompare(b.time));
        const isToday = dIso === todayIso;

        cols += `<div class="card" style="padding:12px;display:grid;gap:8px;align-content:start;${isToday ? "border:2px solid #1f7a6b" : ""}">
          <h3 style="font-size:1rem">${d.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" })}${isToday ? " (اليوم)" : ""}</h3>
          ${items.length ? items.map(x => x.html).join("") : `<p style="color:#5d716c;font-size:.9rem">لا يوجد شيء في هذا اليوم</p>`}
          <input class="w-add" data-date="${dIso}" type="text" placeholder="مهمة سريعة ثم Enter" style="font-size:.9rem">
        </div>`;
      }

      box.innerHTML = `
        <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:14px">
          <button class="link" id="w-prev">الأسبوع السابق</button>
          <strong style="font-size:1.1rem">${rangeLabel}</strong>
          <button class="link" id="w-next">الأسبوع التالي</button>
          <button class="link" id="w-now">الرجوع لهذا الأسبوع</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px">${cols}</div>`;

      const shift = n => { anchor = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + n); draw(); };
      box.querySelector("#w-prev").addEventListener("click", () => shift(-7));
      box.querySelector("#w-next").addEventListener("click", () => shift(7));
      box.querySelector("#w-now").addEventListener("click", () => { anchor = new Date(); draw(); });

      box.querySelectorAll("[data-tdone]").forEach(c => c.addEventListener("change", () => {
        const all = read(TASKS_KEY, []);
        const t = all.find(x => x.id === c.dataset.tdone);
        if (t) { t.done = c.checked; write(TASKS_KEY, all); }
        draw();
      }));

      box.querySelectorAll(".w-add").forEach(inp => inp.addEventListener("keydown", e => {
        if (e.key !== "Enter") return;
        const title = inp.value.trim();
        if (!title) return;
        const all = read(TASKS_KEY, []);
        all.push({
          id: Date.now() + "-" + Math.random().toString(36).slice(2, 6),
          title, subject: "", date: inp.dataset.date, time: "", pri: "mid", done: false
        });
        write(TASKS_KEY, all);
        draw();
      }));
    }

    draw();
  };
})();