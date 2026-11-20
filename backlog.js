// ===== قسم التراكمات والتوزيع الذكي =====
window.VIEWS = window.VIEWS || {};

(function () {
  const DATA_KEY = "platform-backlog";
  const SET_KEY = "platform-backlog-settings";
  const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const AMOUNTS = [[30, "نصف ساعة"], [60, "ساعة"], [90, "ساعة ونصف"], [120, "ساعتان"], [180, "3 ساعات"],
    [240, "4 ساعات"], [360, "6 ساعات"], [480, "8 ساعات"], [720, "12 ساعة"], [1200, "20 ساعة"]];
  const MAX_DAYS = 60;

  function read(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* نكمل بدون حفظ */ }
  }
  function esc(t) {
    return String(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  const iso = d => d.toLocaleDateString("en-CA");
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  function niceDate(s) {
    return new Date(s + "T00:00:00").toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" });
  }
  function dur(m) {
    const h = Math.floor(m / 60), r = m % 60;
    if (!h) return r + " دقيقة";
    if (!r) return h + " ساعة";
    return h + " ساعة و" + r + " دقيقة";
  }
  function subjectNames() {
    const p = read("platform-profile", {});
    const key = "platform-subjects:" + [p.system, p.grade, p.college].filter(Boolean).join("|");
    return read(key, []).map(s => s.name);
  }

  // توزيع التراكمات على الأيام: الأقرب موعدًا أولًا
  function buildPlan(items, set, doneToday, today) {
    const queue = items.filter(i => i.doneMin < i.minutes)
      .sort((a, b) => (a.deadline || "9999").localeCompare(b.deadline || "9999") || a.created - b.created)
      .map(i => ({ item: i, left: i.minutes - i.doneMin, end: null }));
    const days = [];
    for (let n = 0; n < MAX_DAYS && queue.some(q => q.left > 0); n++) {
      const d = addDays(today, n);
      const date = iso(d);
      const sessions = [];
      if (String(d.getDay()) !== set.rest) {
        let cap = set.hours * 60 - (n === 0 ? doneToday : 0);
        for (const q of queue) {
          while (q.left > 0 && cap >= 15) {
            const m = Math.min(set.chunk, q.left, cap);
            sessions.push({ id: q.item.id, title: q.item.title, subject: q.item.subject, min: m });
            q.left -= m; cap -= m; q.end = date;
          }
        }
      }
      days.push({ date, sessions });
    }
    return { days, queue };
  }

  VIEWS.backlog = function (box) {
    let data = read(DATA_KEY, { items: [], log: [] });
    let set = Object.assign({ hours: 2, chunk: 45, rest: "" }, read(SET_KEY, {}));
    const saveData = () => write(DATA_KEY, data);
    const saveSet = () => write(SET_KEY, set);

    function draw() {
      const now = new Date();
      const todayIso = iso(now);
      const doneToday = data.log.filter(l => l.date === todayIso).reduce((s, l) => s + l.min, 0);
      const plan = buildPlan(data.items, set, doneToday, now);
      const info = {};
      plan.queue.forEach(q => { info[q.item.id] = q; });
      const pending = data.items.filter(i => i.doneMin < i.minutes);
      const finished = data.items.filter(i => i.doneMin >= i.minutes);
      const remaining = pending.reduce((s, i) => s + (i.minutes - i.doneMin), 0);
      const subs = subjectNames();
      const lbl = "display:grid;gap:4px;font-weight:500";

      // ملخص
      let summary = "";
      if (pending.length) {
        const notDone = plan.queue.some(q => q.left > 0);
        const last = plan.days[plan.days.length - 1];
        summary = notDone
          ? `باقي عليك ${dur(remaining)}، والوقت المخصص لا يكفي لإنهائها خلال ${MAX_DAYS} يومًا. زوّد الساعات اليومية.`
          : `باقي عليك ${dur(remaining)}. بهذا المعدل تنهي كل التراكمات ${plan.days.length === 1 ? "اليوم" : "يوم " + niceDate(last.date) + " (بعد " + (plan.days.length - 1) + " يوم)"}.`;
      } else if (data.items.length) {
        summary = "أنهيت كل تراكماتك. أحسنت!";
      }

      // جلسات اليوم
      const restToday = String(now.getDay()) === set.rest;
      const todaySessions = plan.days.length && plan.days[0].date === todayIso ? plan.days[0].sessions : [];
      let todayHtml = "";
      if (pending.length) {
        if (restToday) {
          todayHtml = `<div class="empty"><strong>اليوم يوم راحة</strong>لا توجد جلسات تراكمات اليوم.</div>`;
        } else if (!todaySessions.length) {
          todayHtml = `<div class="empty"><strong>${doneToday ? "أنجزت المطلوب اليوم، أحسنت" : "لا توجد جلسات اليوم"}</strong></div>`;
        } else {
          todayHtml = todaySessions.map(s => {
            const meta = [s.subject, dur(s.min)].filter(Boolean).map(esc).join(" • ");
            return `<div class="card" style="display:flex;gap:12px;align-items:center;margin-bottom:10px">
              <div style="flex:1"><strong>${esc(s.title)}</strong><p>${meta}</p></div>
              <button class="btn" data-sdone="${s.id}" data-min="${s.min}" style="padding:8px 14px">أنجزتها</button>
            </div>`;
          }).join("");
        }
      }

      // الأيام القادمة
      const later = plan.days.slice(1, 8).filter(d => d.sessions.length).map(d => {
        const total = d.sessions.reduce((s, x) => s + x.min, 0);
        return `<div class="card" style="margin-bottom:10px"><h3>${niceDate(d.date)} (${dur(total)})</h3>
          ${d.sessions.map(s => `<p>${esc(s.title)} • ${dur(s.min)}</p>`).join("")}</div>`;
      }).join("");

      // قائمة التراكمات
      const itemRow = i => {
        const pct = Math.round(Math.min(100, i.doneMin / i.minutes * 100));
        const q = info[i.id];
        let warn = "";
        if (q && q.left > 0) warn = "لن ينتهي خلال الفترة القادمة بهذه الساعات";
        else if (q && i.deadline && q.end > i.deadline) warn = "الوقت لا يكفي قبل الموعد، وستنتهي يوم " + niceDate(q.end);
        const meta = [i.subject, "الإجمالي " + dur(i.minutes), i.deadline ? "الموعد " + niceDate(i.deadline) : ""]
          .filter(Boolean).map(esc).join(" • ");
        return `<div class="card" style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;gap:10px">
            <div><strong style="${pct === 100 ? "text-decoration:line-through;opacity:.6" : ""}">${esc(i.title)}</strong><p>${meta}</p></div>
            <button class="link" data-del="${i.id}">حذف</button>
          </div>
          <div style="height:8px;background:#e3ebe8;border-radius:999px;overflow:hidden;margin:8px 0 4px">
            <div style="height:100%;width:${pct}%;background:#1f7a6b"></div></div>
          <p>أنجزت ${pct}%${pct < 100 ? " • المتبقي " + dur(i.minutes - i.doneMin) : ""}</p>
          ${warn ? `<p style="color:#9a5b00;margin-top:4px">${warn}</p>` : ""}
        </div>`;
      };

      box.innerHTML = `
        <div class="card" style="display:grid;gap:12px;margin-bottom:18px">
          <h3>وقتك المتاح</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px">
            <label style="${lbl}">كم ساعة تخصصها يوميًا للتراكمات؟
              <select id="s-hours">${[1, 2, 3, 4, 5, 6].map(h => `<option value="${h}" ${h === set.hours ? "selected" : ""}>${h === 1 ? "ساعة" : h === 2 ? "ساعتان" : h + " ساعات"}</option>`).join("")}</select>
            </label>
            <label style="${lbl}">مدة الجلسة الواحدة
              <select id="s-chunk">${[30, 45, 60].map(m => `<option value="${m}" ${m === set.chunk ? "selected" : ""}>${m} دقيقة</option>`).join("")}</select>
            </label>
            <label style="${lbl}">يوم راحة أسبوعي
              <select id="s-rest"><option value="">بدون يوم راحة</option>${DAYS.map((n, i) => `<option value="${i}" ${String(i) === set.rest ? "selected" : ""}>${n}</option>`).join("")}</select>
            </label>
          </div>
          <p>حدد الوقت اللي تقدر تلتزم بيه فعلًا، بعد النوم والصلاة والأكل والدروس.</p>
        </div>

        <div class="card" style="display:grid;gap:12px;margin-bottom:18px">
          <h3>أضف تراكمًا جديدًا</h3>
          <label style="${lbl}">إيه اللي متأخر فيه؟
            <input id="b-title" type="text" placeholder="مثال: مراجعة الوحدة الأولى في الفيزياء">
          </label>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px">
            <label style="${lbl}">المادة
              <select id="b-subject"><option value="">بدون مادة</option>${subs.map(s => `<option>${esc(s)}</option>`).join("")}</select>
            </label>
            <label style="${lbl}">هياخد وقت قد إيه تقريبًا؟
              <select id="b-amount">${AMOUNTS.map(a => `<option value="${a[0]}" ${a[0] === 120 ? "selected" : ""}>${a[1]}</option>`).join("")}</select>
            </label>
            <label style="${lbl}">آخر موعد (اختياري)
              <input id="b-deadline" type="date">
            </label>
          </div>
          <button id="b-add" class="btn">إضافة التراكم</button>
        </div>

        ${summary ? `<div class="card" style="border-right:5px solid #d9a21b;margin-bottom:18px"><strong>${summary}</strong></div>` : ""}
        ${todayHtml ? `<h3 style="margin-bottom:10px">جلسات اليوم</h3>${todayHtml}` : ""}
        ${later ? `<h3 style="margin:18px 0 10px">الأيام القادمة</h3>${later}` : ""}
        ${pending.length ? `<h3 style="margin:18px 0 10px">تراكماتك</h3>${pending.map(itemRow).join("")}` : ""}
        ${finished.length ? `<h3 style="margin:18px 0 10px">المنتهية</h3>${finished.map(itemRow).join("")}` : ""}
        ${data.items.length ? "" : `<div class="empty"><strong>لا توجد تراكمات</strong>أضف أول تراكم من النموذج فوق، وسنوزعه على أيامك.</div>`}`;

      const q = id => box.querySelector(id);
      q("#s-hours").addEventListener("change", e => { set.hours = Number(e.target.value); saveSet(); draw(); });
      q("#s-chunk").addEventListener("change", e => { set.chunk = Number(e.target.value); saveSet(); draw(); });
      q("#s-rest").addEventListener("change", e => { set.rest = e.target.value; saveSet(); draw(); });

      const add = () => {
        const title = q("#b-title").value.trim();
        if (!title) { alert("اكتب اللي متأخر فيه أولًا"); q("#b-title").focus(); return; }
        data.items.push({
          id: Date.now() + "-" + Math.random().toString(36).slice(2, 6),
          title, subject: q("#b-subject").value, minutes: Number(q("#b-amount").value),
          doneMin: 0, deadline: q("#b-deadline").value, created: Date.now()
        });
        saveData();
        draw();
      };
      q("#b-add").addEventListener("click", add);
      q("#b-title").addEventListener("keydown", e => { if (e.key === "Enter") add(); });

      box.querySelectorAll("[data-sdone]").forEach(b => b.addEventListener("click", () => {
        const item = data.items.find(x => x.id === b.dataset.sdone);
        const m = Number(b.dataset.min);
        item.doneMin = Math.min(item.minutes, item.doneMin + m);
        data.log.push({ date: todayIso, min: m });
        saveData();
        draw();
      }));
      box.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", () => {
        if (!confirm("حذف هذا التراكم؟")) return;
        data.items = data.items.filter(x => x.id !== b.dataset.del);
        saveData();
        draw();
      }));
    }

    draw();
  };
})();