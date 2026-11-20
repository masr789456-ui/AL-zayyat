// ===== قسم المهام =====
window.VIEWS = window.VIEWS || {};

(function () {
  const KEY = "platform-tasks";
  const PRI = { high: "عالية", mid: "متوسطة", low: "منخفضة" };
  const RANK = { high: 0, mid: 1, low: 2 };

  function read(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* نكمل بدون حفظ */ }
  }
  function esc(t) {
    return String(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function subjectNames() {
    const p = read("platform-profile", {});
    const key = "platform-subjects:" + [p.system, p.grade, p.college].filter(Boolean).join("|");
    return read(key, []).map(s => s.name);
  }
  function niceDate(d) {
    if (!d) return "";
    return new Date(d + "T00:00:00").toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" });
  }

  VIEWS.tasks = function (box) {
    let list = read(KEY, []);
    const save = () => write(KEY, list);

    function sorted() {
      return list.slice().sort((a, b) =>
        (a.done - b.done) ||
        (a.date || "9999").localeCompare(b.date || "9999") ||
        (a.time || "99:99").localeCompare(b.time || "99:99") ||
        (RANK[a.pri] - RANK[b.pri]));
    }

    function draw() {
      const subs = subjectNames();
      const today = new Date().toLocaleDateString("en-CA");
      const left = list.filter(t => !t.done).length;

      const rows = sorted().map(t => {
        const meta = [t.subject, niceDate(t.date), t.time, "الأولوية " + PRI[t.pri]]
          .filter(Boolean).map(esc).join(" • ");
        return `<div class="card" style="display:flex;gap:12px;align-items:center;margin-bottom:10px">
          <input type="checkbox" data-done="${t.id}" ${t.done ? "checked" : ""} style="width:20px;height:20px">
          <div style="flex:1;${t.done ? "text-decoration:line-through;opacity:.6" : ""}">
            <strong>${esc(t.title)}</strong><p>${meta}</p>
          </div>
          <button class="link" data-del="${t.id}">حذف</button>
        </div>`;
      }).join("");

      box.innerHTML = `
        <div class="add-row" style="flex-wrap:wrap">
          <input id="t-title" type="text" placeholder="المهمة، مثال: حل تمارين الرياضيات" style="flex:2;min-width:220px">
          <select id="t-subject"><option value="">بدون مادة</option>${subs.map(s => `<option>${esc(s)}</option>`).join("")}</select>
          <input id="t-date" type="date" value="${today}">
          <input id="t-time" type="time">
          <select id="t-pri">
            <option value="mid">أولوية متوسطة</option>
            <option value="high">أولوية عالية</option>
            <option value="low">أولوية منخفضة</option>
          </select>
          <button id="t-add" class="btn">إضافة</button>
        </div>
        <p class="date">${list.length ? "المتبقي " + left + " من " + list.length : ""}</p>
        ${rows || `<div class="empty"><strong>لا توجد مهام بعد</strong>اكتب أول مهمة لك فوق.</div>`}`;

      const q = id => box.querySelector(id);
      const add = () => {
        const title = q("#t-title").value.trim();
        if (!title) return;
        list.push({
          id: Date.now() + "-" + Math.random().toString(36).slice(2, 6),
          title,
          subject: q("#t-subject").value,
          date: q("#t-date").value,
          time: q("#t-time").value,
          pri: q("#t-pri").value,
          done: false
        });
        save();
        draw();
      };
      q("#t-add").addEventListener("click", add);
      q("#t-title").addEventListener("keydown", e => { if (e.key === "Enter") add(); });

      box.querySelectorAll("[data-done]").forEach(c => c.addEventListener("change", () => {
        const t = list.find(x => x.id === c.dataset.done);
        t.done = c.checked;
        save();
        draw();
      }));
      box.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", () => {
        list = list.filter(x => x.id !== b.dataset.del);
        save();
        draw();
      }));
    }

    draw();
  };
})();