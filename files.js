// ===== قسم ملفاتي ومصادري (مكتبة روابط) =====
window.VIEWS = window.VIEWS || {};

(function () {
  const KEY = "platform-library";
  const CATS = { book: "كتاب", notes: "مذكرة أو ملخص", video: "فيديو أو شرح", site: "موقع", other: "أخرى" };

  function read(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* نكمل بدون حفظ */ }
  }
  function esc(t) {
    return String(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  // نقبل روابط http و https فقط
  function cleanUrl(raw) {
    raw = (raw || "").trim();
    if (!raw) return null;
    if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;
    try {
      const u = new URL(raw);
      return (u.protocol === "http:" || u.protocol === "https:") ? u.href : null;
    } catch (e) { return null; }
  }
  function subjectsList() {
    const p = read("platform-profile", {});
    return read("platform-subjects:" + [p.system, p.grade, p.college].filter(Boolean).join("|"), []);
  }

  VIEWS.files = function (box) {
    let list = read(KEY, []);
    let fSub = "", fCat = "", term = "";
    const save = () => write(KEY, list);

    function everything() {
      const fromSubjects = [];
      subjectsList().forEach(s => {
        const d = read("platform-subject-data:" + s.id, { links: [] });
        (d.links || []).forEach(l => fromSubjects.push({ id: l.id, title: l.title, url: l.url, subject: s.name, cat: "", fromSubject: true }));
      });
      return list.concat(fromSubjects);
    }

    function drawList() {
      const t = term.trim().toLowerCase();
      const shown = everything().filter(x =>
        (!fSub || x.subject === fSub) &&
        (!fCat || x.cat === fCat) &&
        (!t || (x.title + " " + x.url).toLowerCase().includes(t)));
      const el = box.querySelector("#f-list");
      el.innerHTML = shown.length
        ? shown.map(x => {
            const meta = [x.subject, x.fromSubject ? "من صفحة المادة" : CATS[x.cat]].filter(Boolean).map(esc).join(" • ");
            return `<div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px">
              <div style="min-width:0">
                <a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer" style="color:#155a4f;font-weight:700;word-break:break-all">${esc(x.title)}</a>
                ${meta ? `<p>${meta}</p>` : ""}
              </div>
              ${x.fromSubject ? "" : `<button class="link" data-del="${x.id}">حذف</button>`}
            </div>`;
          }).join("")
        : `<div class="empty"><strong>${everything().length ? "لا توجد نتائج بهذا الفلتر" : "المكتبة فاضية"}</strong>${everything().length ? "غيّر البحث أو الفلتر." : "أضف أول رابط من النموذج فوق."}</div>`;
      el.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", () => {
        if (!confirm("حذف هذا الرابط؟")) return;
        list = list.filter(x => x.id !== b.dataset.del);
        save();
        drawList();
      }));
    }

    function draw() {
      const subs = subjectsList().map(s => s.name);
      const names = subs.concat(list.map(x => x.subject).filter(n => n && !subs.includes(n)));
      const lbl = "display:grid;gap:4px;font-weight:500";
      const subOpts = sel => `<option value="">كل المواد</option>` + names.map(n => `<option ${n === sel ? "selected" : ""}>${esc(n)}</option>`).join("");

      box.innerHTML = `
        <div class="card" style="display:grid;gap:12px;margin-bottom:18px">
          <h3>أضف رابطًا جديدًا</h3>
          <label style="${lbl}">اسم الرابط
            <input id="f-title" type="text" placeholder="مثال: كتاب الفيزياء للصف الثالث">
          </label>
          <label style="${lbl}">الرابط
            <input id="f-url" type="text" dir="ltr" placeholder="الصق الرابط هنا">
          </label>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px">
            <label style="${lbl}">المادة
              <select id="f-subject"><option value="">بدون مادة</option>${subs.map(n => `<option>${esc(n)}</option>`).join("")}</select>
            </label>
            <label style="${lbl}">النوع
              <select id="f-cat">${Object.keys(CATS).map(k => `<option value="${k}">${CATS[k]}</option>`).join("")}</select>
            </label>
          </div>
          <button id="f-add" class="btn">إضافة للمكتبة</button>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:14px">
          <label style="${lbl}">بحث
            <input id="f-search" type="text" placeholder="اكتب جزءًا من الاسم" value="${esc(term)}">
          </label>
          <label style="${lbl}">فلتر بالمادة
            <select id="f-fsub">${subOpts(fSub)}</select>
          </label>
          <label style="${lbl}">فلتر بالنوع
            <select id="f-fcat"><option value="">كل الأنواع</option>${Object.keys(CATS).map(k => `<option value="${k}" ${k === fCat ? "selected" : ""}>${CATS[k]}</option>`).join("")}</select>
          </label>
        </div>
        <div id="f-list"></div>`;

      const q = id => box.querySelector(id);
      const add = () => {
        const url = cleanUrl(q("#f-url").value);
        if (!url) { alert("اكتب رابطًا صحيحًا، مثل youtube.com/..."); q("#f-url").focus(); return; }
        const title = q("#f-title").value.trim() || new URL(url).hostname;
        list.push({ id: Date.now() + "-" + Math.random().toString(36).slice(2, 6), title, url, subject: q("#f-subject").value, cat: q("#f-cat").value });
        save();
        draw();
      };
      q("#f-add").addEventListener("click", add);
      q("#f-url").addEventListener("keydown", e => { if (e.key === "Enter") add(); });
      q("#f-search").addEventListener("input", e => { term = e.target.value; drawList(); });
      q("#f-fsub").addEventListener("change", e => { fSub = e.target.value; drawList(); });
      q("#f-fcat").addEventListener("change", e => { fCat = e.target.value; drawList(); });
      drawList();
    }

    draw();
  };
})();