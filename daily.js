// ===== الجدول اليومي بالساعات =====
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
  const pad = n => String(n).padStart(2, "0");
  function fmt(t) {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    return (h % 12 || 12) + ":" + pad(m) + (h < 12 ? " ص" : " م");
  }
  function hourLabel(h) { return (h % 12 || 12) + (h < 12 ? " ص" : " م"); }

  // كل نص ساعة على مدار اليوم
  const TIMES = [];
  for (let h = 0; h < 24; h++) { TIMES.push(pad(h) + ":00"); TIMES.push(pad(h) + ":30"); }
  function options(selected, withNone) {
    return (withNone ? `<option value="">بدون وقت نهاية</option>` : "") +
      TIMES.map(t => `<option value="${t}" ${t === selected ? "selected" : ""}>${fmt(t)}</option>`).join("");
  }

  VIEWS.daily = function (box) {
    let day = new Date();
    let blocks = read(BLOCKS_KEY, []);
    const iso = d => d.toLocaleDateString("en-CA");
    const saveBlocks = () => write(BLOCKS_KEY, blocks);

    function blockHtml(b) {
      const range = fmt(b.start) + (b.end ? " إلى " + fmt(b.end) : "");
      return `<div class="card" style="border-right:5px solid ${COLORS[b.type]};padding:10px 14px;display:flex;justify-content:space-between;align-items:center;gap:10px">
        <div><strong>${esc(b.title)}</strong>
          <p>${TYPES[b.type]} • ${range}${b.daily ? " • يتكرر يوميًا" : ""}</p></div>
        <button class="link" data-bdel="${b.id}">حذف</button>
      </div>`;
    }
    function taskHtml(t) {
      return `<div class="card" style="padding:10px 14px;display:flex;gap:12px;align-items:center">
        <input type="checkbox" data-tdone="${t.id}" ${t.done ? "checked" : ""} style="width:20px;height:20px">
        <div style="${t.done ? "text-decoration:line-through;opacity:.6" : ""}">
          <strong>${esc(t.title)}</strong><p>مهمة • ${fmt(t.time)}</p></div>
      </div>`;
    }

    function draw() {
      const dateIso = iso(day);
      const label = day.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      const tasks = read(TASKS_KEY, []).filter(t => t.date === dateIso);
      const dayBlocks = blocks.filter(b => b.daily || b.date === dateIso);

      const nextHour = (new Date().getHours() + 1) % 24;
      const defStart = pad(nextHour) + ":00";
      const defEnd = pad((nextHour + 1) % 24) + ":00";

      const byHour = {};
      const put = (time, html) => {
        const h = Number(time.split(":")[0]);
        (byHour[h] = byHour[h] || []).push({ time, html });
      };
      dayBlocks.forEach(b => put(b.start, blockHtml(b)));
      tasks.filter(t => t.time).forEach(t => put(t.time, taskHtml(t)));
      const untimed = tasks.filter(t => !t.time);

      const rows = [];
      for (let h = 0; h < 24; h++) {
        const items = (byHour[h] || []).sort((a, b) => a.time.localeCompare(b.time));
        if (h < 5 && !items.length) continue;
        rows.push(`<div style="display:flex;gap:12px;border-top:1px solid #d5dfdb;padding:8px 0;min-height:44px">
          <div style="width:52px;color:#5d716c;flex-shrink:0">${hourLabel(h)}</div>
          <div style="flex:1;display:grid;gap:6px">${items.map(i => i.html).join("")}</div></div>`);
      }

      const lbl = "display:grid;gap:4px;font-weight:500";
      box.innerHTML = `
        <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:14px">
          <button class="link" id="d-prev">اليوم السابق</button>
          <strong style="font-size:1.1rem">${label}</strong>
          <button class="link" id="d-next">اليوم التالي</button>
          <button class="link" id="d-today">الرجوع لليوم</button>
        </div>

        <div class="card" style="display:grid;gap:12px;margin-bottom:18px">
          <label style="${lbl}">اسم النشاط
            <input id="b-title" type="text" placeholder="مثال: مذاكرة الرياضيات">
          </label>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px">
            <label style="${lbl}">نوع النشاط
              <select id="b-type">${Object.keys(TYPES).map(k => `<option value="${k}">${TYPES[k]}</option>`).join("")}</select>
            </label>
            <label style="${lbl}">يبدأ الساعة
              <select id="b-start">${options(defStart, false)}</select>
            </label>
            <label style="${lbl}">ينتهي الساعة
              <select id="b-end">${options(defEnd, true)}</select>
            </label>
          </div>
          <label style="display:flex;gap:8px;align-items:center">
            <input id="b-daily" type="checkbox"> يتكرر كل يوم (مثل النوم أو الصلاة)
          </label>
          <button id="b-add" class="btn">إضافة للجدول</button>
        </div>

        ${untimed.length ? `<h3 style="margin:12px 0 8px;font-size:1rem">مهام اليوم بدون وقت</h3><div style="display:grid;gap:6px;margin-bottom:14px">${untimed.map(taskHtml).join("")}</div>` : ""}
        <div>${rows.join("")}</div>`;

      const q = id => box.querySelector(id);
      const go = n => { day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + n); draw(); };
      q("#d-prev").addEventListener("click", () => go(-1));
      q("#d-next").addEventListener("click", () => go(1));
      q("#d-today").addEventListener("click", () => { day = new Date(); draw(); });

      const add = () => {
        const title = q("#b-title").value.trim();
        if (!title) { alert("اكتب اسم النشاط أولًا"); q("#b-title").focus(); return; }
        blocks.push({
          id: Date.now() + "-" + Math.random().toString(36).slice(2, 6),
          title, type: q("#b-type").value, start: q("#b-start").value, end: q("#b-end").value,
          daily: q("#b-daily").checked, date: dateIso
        });
        saveBlocks();
        draw();
      };
      q("#b-add").addEventListener("click", add);
      q("#b-title").addEventListener("keydown", e => { if (e.key === "Enter") add(); });

      box.querySelectorAll("[data-bdel]").forEach(b => b.addEventListener("click", () => {
        const item = blocks.find(x => x.id === b.dataset.bdel);
        if (item.daily && !confirm("هذا النشاط يتكرر يوميًا، وسيُحذف من كل الأيام. متابعة؟")) return;
        blocks = blocks.filter(x => x.id !== item.id);
        saveBlocks();
        draw();
      }));

      box.querySelectorAll("[data-tdone]").forEach(c => c.addEventListener("change", () => {
        const all = read(TASKS_KEY, []);
        const t = all.find(x => x.id === c.dataset.tdone);
        if (t) { t.done = c.checked; write(TASKS_KEY, all); }
        draw();
      }));
    }

    draw();
  };
})();