// ===== قسم الدروس والمحاضرات =====
window.VIEWS = window.VIEWS || {};

(function () {
  const KEY = "platform-lessons";
  const KINDS = { onsite: "حضوري", online: "أونلاين", recorded: "مسجّل" };

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
  function niceDate(d) {
    return d ? new Date(d + "T00:00:00").toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" }) : "";
  }
  function subjectNames() {
    const p = read("platform-profile", {});
    const key = "platform-subjects:" + [p.system, p.grade, p.college].filter(Boolean).join("|");
    return read(key, []).map(s => s.name);
  }
  // نقبل روابط http و https فقط
  function cleanUrl(raw) {
    raw = (raw || "").trim();
    if (!raw) return "";
    if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;
    try {
      const u = new URL(raw);
      return (u.protocol === "http:" || u.protocol === "https:") ? u.href : null;
    } catch (e) { return null; }
  }

  const TIMES = [];
  for (let h = 0; h < 24; h++) { TIMES.push(pad(h) + ":00"); TIMES.push(pad(h) + ":30"); }

  VIEWS.lessons = function (box) {
    let list = read(KEY, []);
    const save = () => write(KEY, list);

    function row(l, todayIso) {
      const late = !l.done && l.date && l.date < todayIso;
      const meta = [l.subject, KINDS[l.kind], niceDate(l.date), fmt(l.time)].filter(Boolean).map(esc).join(" • ");
      return `<div class="card" style="display:flex;gap:12px;align-items:center;margin-bottom:10px">
        <input type="checkbox" data-done="${l.id}" ${l.done ? "checked" : ""} style="width:20px;height:20px">
        <div style="flex:1;${l.done ? "text-decoration:line-through;opacity:.6" : ""}">
          <strong>${esc(l.title)}</strong>${late ? ' <span style="color:#9a5b00">(فات موعده)</span>' : ""}
          <p>${meta}</p>
          ${l.url ? `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" style="color:#155a4f">فتح رابط الدرس</a>` : ""}
        </div>
        <button class="link" data-del="${l.id}">حذف</button>
      </div>`;
    }

    function draw() {
      const todayIso = new Date().toLocaleDateString("en-CA");
      const subs = subjectNames();
      const byDate = (a, b) => (a.date || "9999").localeCompare(b.date || "9999") || (a.time || "99:99").localeCompare(b.time || "99:99");
      const upcoming = list.filter(l => !l.done).sort(byDate);
      const finished = list.filter(l => l.done).sort(byDate);
      const lbl = "display:grid;gap:4px;font-weight:500";

      box.innerHTML = `
        <div class="card" style="display:grid;gap:12px;margin-bottom:18px">
          <label style="${lbl}">اسم الدرس أو المحاضرة
            <input id="l-title" type="text" placeholder="مثال: الوحدة الأولى في الفيزياء">
          </label>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px">
            <label style="${lbl}">المادة
              <select id="l-subject"><option value="">بدون مادة</option>${subs.map(s => `<option>${esc(s)}</option>`).join("")}</select>
            </label>
            <label style="${lbl}">نوع الدرس
              <select id="l-kind">${Object.keys(KINDS).map(k => `<option value="${k}">${KINDS[k]}</option>`).join("")}</select>
            </label>
            <label style="${lbl}">التاريخ
              <input id="l-date" type="date" value="${todayIso}">
            </label>
            <label style="${lbl}">يبدأ الساعة
              <select id="l-time"><option value="">بدون وقت</option>${TIMES.map(t => `<option value="${t}">${fmt(t)}</option>`).join("")}</select>
            </label>
          </div>
          <label style="${lbl}">رابط الدرس (اختياري)
            <input id="l-url" type="text" dir="ltr" placeholder="الصق رابط الفيديو أو الحصة هنا">
          </label>
          <button id="l-add" class="btn">إضافة الدرس</button>
        </div>

        <p class="date">${list.length ? "أنجزت " + finished.length + " من " + list.length : ""}</p>
        ${upcoming.length ? `<h3 style="margin-bottom:10px">القادمة والمتبقية</h3>${upcoming.map(l => row(l, todayIso)).join("")}` : ""}
        ${finished.length ? `<h3 style="margin:18px 0 10px">المنتهية</h3>${finished.map(l => row(l, todayIso)).join("")}` : ""}
        ${list.length ? "" : `<div class="empty"><strong>لا توجد دروس بعد</strong>أضف أول درس أو محاضرة من النموذج فوق.</div>`}`;

      const q = id => box.querySelector(id);
      const add = () => {
        const title = q("#l-title").value.trim();
        if (!title) { alert("اكتب اسم الدرس أولًا"); q("#l-title").focus(); return; }
        const url = cleanUrl(q("#l-url").value);
        if (url === null) { alert("الرابط غير صحيح، تأكد منه أو اتركه فارغًا"); return; }
        list.push({
          id: Date.now() + "-" + Math.random().toString(36).slice(2, 6),
          title, subject: q("#l-subject").value, kind: q("#l-kind").value,
          date: q("#l-date").value, time: q("#l-time").value, url, done: false
        });
        save();
        draw();
      };
      q("#l-add").addEventListener("click", add);
      q("#l-title").addEventListener("keydown", e => { if (e.key === "Enter") add(); });

      box.querySelectorAll("[data-done]").forEach(c => c.addEventListener("change", () => {
        const l = list.find(x => x.id === c.dataset.done);
        l.done = c.checked;
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