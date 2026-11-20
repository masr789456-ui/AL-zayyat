// ===== المساعد الذكي: يقترح جدولًا ليوم كامل =====
window.VIEWS = window.VIEWS || {};

(function () {
  const BLOCKS_KEY = "platform-blocks";
  const TASKS_KEY = "platform-tasks";
  const LESSONS_KEY = "platform-lessons";
  const BACKLOG_KEY = "platform-backlog";
  const BSET_KEY = "platform-backlog-settings";
  const ASET_KEY = "platform-assistant-settings";
  const PRAYERS = [["Fajr", "الفجر"], ["Dhuhr", "الظهر"], ["Asr", "العصر"], ["Maghrib", "المغرب"], ["Isha", "العشاء"]];
  const BREAK = 10;
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
  const pad = n => String(n).padStart(2, "0");
  const iso = d => d.toLocaleDateString("en-CA");
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const toMin = t => { const p = t.split(":").map(Number); return p[0] * 60 + p[1]; };
  const toTime = m => pad(Math.floor(m / 60)) + ":" + pad(m % 60);
  function label(m) {
    const h = Math.floor(m / 60);
    return (h % 12 || 12) + ":" + pad(m % 60) + (h < 12 ? " ص" : " م");
  }
  function dur(m) {
    const h = Math.floor(m / 60), r = m % 60;
    if (!h) return r + " دقيقة";
    if (!r) return h + " ساعة";
    return h + " ساعة و" + r + " دقيقة";
  }

  const TIMES = [];
  for (let h = 0; h < 24; h++) { TIMES.push(pad(h) + ":00"); TIMES.push(pad(h) + ":30"); }

  // مواقيت الصلاة المحفوظة من قسم صلاتي
  function prayerInfo(dateIso, todayIso) {
    const p = read("platform-prayer", null);
    if (!p) return { times: null, note: "missing" };
    if (p.mode === "manual") {
      return PRAYERS.every(x => p.manual && p.manual[x[0]]) ? { times: p.manual, note: "" } : { times: null, note: "missing" };
    }
    if (p.cache && p.cache.date === dateIso) return { times: p.cache.times, note: "" };
    if (p.cache && p.cache.date === todayIso && dateIso > todayIso) return { times: p.cache.times, note: "approx" };
    return { times: null, note: "missing" };
  }

  // جلسات التراكمات ليوم معين (نفس منطق قسم تراكماتي)
  function backlogSessions(dayIndex, today) {
    const data = read(BACKLOG_KEY, { items: [], log: [] });
    const set = Object.assign({ hours: 2, chunk: 45, rest: "" }, read(BSET_KEY, {}));
    const doneToday = data.log.filter(l => l.date === iso(today)).reduce((s, l) => s + l.min, 0);
    const queue = data.items.filter(i => i.doneMin < i.minutes)
      .sort((a, b) => (a.deadline || "9999").localeCompare(b.deadline || "9999") || a.created - b.created)
      .map(i => ({ item: i, left: i.minutes - i.doneMin }));
    let out = [];
    for (let n = 0; n <= dayIndex; n++) {
      const d = addDays(today, n);
      const sessions = [];
      if (String(d.getDay()) !== set.rest) {
        let cap = set.hours * 60 - (n === 0 ? doneToday : 0);
        for (const q of queue) {
          while (q.left > 0 && cap >= 15) {
            const m = Math.min(set.chunk, q.left, cap);
            sessions.push({ title: q.item.title, subject: q.item.subject, min: m });
            q.left -= m; cap -= m;
          }
        }
      }
      out = sessions;
    }
    return out;
  }

  VIEWS.assistant = function (box) {
    let set = Object.assign({ day: "0", from: "16:00", to: "22:00", task: 30 }, read(ASET_KEY, {}));
    let result = null;
    let applied = false;

    function generate() {
      const now = new Date();
      const dayIndex = Number(set.day);
      const dateIso = iso(addDays(now, dayIndex));
      const todayIso = iso(now);
      let ws = toMin(set.from);
      const we = toMin(set.to);
      if (ws >= we) return { error: "وقت البداية لازم يكون قبل وقت النهاية." };
      if (dayIndex === 0) ws = Math.max(ws, Math.ceil((now.getHours() * 60 + now.getMinutes()) / 15) * 15);
      if (ws >= we) return { error: "الوقت اللي حددته خلص النهارده. جرّب «بكرة» أو غيّر وقت النهاية." };

      // الأوقات المشغولة
      const busy = [];
      read(BLOCKS_KEY, []).filter(b => (b.daily || b.date === dateIso) && !(b.auto && b.date === dateIso)).forEach(b => {
        const s = toMin(b.start), e = b.end ? toMin(b.end) : s + 60;
        if (e > s) busy.push([s, e]); else { busy.push([s, 1440]); busy.push([0, e]); }
      });
      const tasks = read(TASKS_KEY, []);
      const taskMin = Number(set.task);
      tasks.filter(t => !t.done && t.date === dateIso && t.time).forEach(t => busy.push([toMin(t.time), toMin(t.time) + taskMin]));
      read(LESSONS_KEY, []).filter(l => !l.done && l.date === dateIso && l.time).forEach(l => busy.push([toMin(l.time), toMin(l.time) + 60]));

      // الصلاة: 20 دقيقة + 5 دقايق راحة
      const pr = prayerInfo(dateIso, todayIso);
      const prayerItems = [];
      if (pr.times) PRAYERS.forEach(p => {
        const t = pr.times[p[0]];
        if (!t) return;
        const s = toMin(t);
        busy.push([s, s + 25]);
        if (s < we && s + 20 > ws) prayerItems.push({ kind: "prayer", title: "صلاة " + p[1], start: s, end: s + 20 });
      });

      function place(d) {
        for (let t = ws; t + d <= we; t += 5) {
          if (!busy.some(b => t < b[1] && t + d > b[0])) { busy.push([t, t + d + BREAK]); return t; }
        }
        return null;
      }

      const placed = [], unfit = [];
      tasks.filter(t => !t.done && ((t.date === dateIso && !t.time) || (t.date && t.date < todayIso)))
        .sort((a, b) => ((a.date < todayIso ? 0 : 1) - (b.date < todayIso ? 0 : 1)) || (RANK[a.pri] - RANK[b.pri]))
        .forEach(t => {
          const s = place(taskMin);
          if (s === null) unfit.push(t.title);
          else placed.push({ kind: "task", id: t.id, title: t.title, sub: t.subject, late: t.date < todayIso, start: s, end: s + taskMin });
        });
      let skipped = 0;
      backlogSessions(dayIndex, now).forEach(b => {
        const s = place(b.min);
        if (s === null) skipped++;
        else placed.push({ kind: "backlog", title: b.title, sub: b.subject, start: s, end: s + b.min });
      });
      prayerItems.forEach(p => placed.push(p));
      placed.sort((a, b) => a.start - b.start);
      return { dateIso, date: addDays(now, dayIndex), placed, unfit, skipped, note: pr.note };
    }

    function apply(r) {
      const blocks = read(BLOCKS_KEY, []).filter(b => !(b.auto && b.date === r.dateIso));
      const tasks = read(TASKS_KEY, []);
      r.placed.forEach(p => {
        if (p.kind === "task") {
          const t = tasks.find(x => x.id === p.id);
          if (t) { t.date = r.dateIso; t.time = toTime(p.start); }
        } else if (p.kind === "backlog") {
          blocks.push({ id: Date.now() + "-" + Math.random().toString(36).slice(2, 6), title: p.title, type: "study",
            start: toTime(p.start), end: toTime(p.end), daily: false, date: r.dateIso, auto: true });
        }
      });
      write(BLOCKS_KEY, blocks);
      write(TASKS_KEY, tasks);
    }

    function draw() {
      const lbl = "display:grid;gap:4px;font-weight:500";
      const timeOpts = sel => TIMES.map(t => `<option value="${t}" ${t === sel ? "selected" : ""}>${label(toMin(t))}</option>`).join("");
      let out = "";
      if (result && result.error) {
        out = `<div class="empty"><strong>${result.error}</strong></div>`;
      } else if (result) {
        const dayName = result.date.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" });
        const actionable = result.placed.filter(p => p.kind !== "prayer");
        const kindText = { task: "مهمة", backlog: "جلسة تراكمات", prayer: "وقت الصلاة (محجوز)" };
        const kindColor = { task: "#2b5fa8", backlog: "#1f7a6b", prayer: "#d9a21b" };
        const rows = result.placed.map(p => `
          <div class="card" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:10px;border-right:5px solid ${kindColor[p.kind]}">
            <div style="min-width:150px;font-weight:700">${label(p.start)} - ${label(p.end)}</div>
            <div style="flex:1"><strong>${esc(p.title)}</strong>
              <p>${p.kind === "task" && p.late ? "مهمة متأخرة، اقترحنا لها موعدًا جديدًا" : kindText[p.kind]}${p.sub ? " • " + esc(p.sub) : ""}</p></div>
          </div>`).join("");
        const unfit = result.unfit.length
          ? `<div class="card" style="border-right:5px solid #d9a21b;margin-top:12px"><h3>لم يتسع الوقت لهذه المهام</h3>
              ${result.unfit.map(t => `<p>${esc(t)}</p>`).join("")}
              <p style="margin-top:6px">زوّد وقت المذاكرة أو جرّب «بكرة»، ولن تضيع من قائمة مهامك.</p></div>` : "";
        const skipped = result.skipped
          ? `<p style="margin-top:12px">${result.skipped} جلسة تراكمات لم تتسع اليوم، وستتوزع على الأيام التالية.</p>` : "";
        const note = result.note === "missing"
          ? `<p style="margin-top:12px">مواقيت الصلاة غير محفوظة لهذا اليوم، فالجدول لم يحسب حسابها. افتح «صلاتي» واضغط «هات المواقيت» أولًا.</p>`
          : result.note === "approx"
            ? `<p style="margin-top:12px">مواقيت الصلاة ليوم بكرة تقريبية، مأخوذة من مواقيت اليوم.</p>` : "";
        out = `<h3 style="margin:18px 0 10px">اقتراح ${dayName}</h3>
          ${actionable.length ? rows : `<div class="empty"><strong>لا يوجد ما نجدوله</strong>لا توجد مهام أو تراكمات لهذا اليوم.</div>`}
          ${unfit}${skipped}${note}
          ${actionable.length ? `<div style="margin-top:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <button id="a-apply" class="btn">اعتمد الجدول</button>
            ${applied ? '<strong style="color:#155a4f">اتضاف لجدولك اليومي</strong>' : ""}</div>` : ""}`;
      }

      box.innerHTML = `
        <div class="card" style="display:grid;gap:12px">
          <h3>اقترح لي جدولًا مناسبًا</h3>
          <p>يرتّب لك مهامك وتراكماتك في الوقت الفاضي بعد أنشطتك الثابتة ومواقيت الصلاة، مع راحة ${BREAK} دقائق بين كل نشاط.</p>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px">
            <label style="${lbl}">لأي يوم؟
              <select id="a-day"><option value="0" ${set.day === "0" ? "selected" : ""}>النهارده</option><option value="1" ${set.day === "1" ? "selected" : ""}>بكرة</option></select>
            </label>
            <label style="${lbl}">أقدر أذاكر من الساعة
              <select id="a-from">${timeOpts(set.from)}</select>
            </label>
            <label style="${lbl}">إلى الساعة
              <select id="a-to">${timeOpts(set.to)}</select>
            </label>
            <label style="${lbl}">المهمة الواحدة تأخذ
              <select id="a-task">${[15, 30, 45, 60].map(m => `<option value="${m}" ${Number(set.task) === m ? "selected" : ""}>${m} دقيقة</option>`).join("")}</select>
            </label>
          </div>
          <button id="a-go" class="btn">اقترح الجدول</button>
        </div>
        ${out}`;

      const q = id => box.querySelector(id);
      const change = (key, el) => q(el).addEventListener("change", e => {
        set[key] = e.target.value; write(ASET_KEY, set); result = null; applied = false; draw();
      });
      change("day", "#a-day"); change("from", "#a-from"); change("to", "#a-to"); change("task", "#a-task");
      q("#a-go").addEventListener("click", () => { result = generate(); applied = false; draw(); });
      const ap = q("#a-apply");
      if (ap) ap.addEventListener("click", () => { apply(result); applied = true; draw(); });
    }

    draw();
  };
})();