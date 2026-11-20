// ===== قسم الإنجازات =====
window.VIEWS = window.VIEWS || {};

(function () {
  function read(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  const iso = d => d.toLocaleDateString("en-CA");
  // بداية الأسبوع يوم السبت
  function weekStart(d) {
    const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    s.setDate(s.getDate() - ((s.getDay() + 1) % 7));
    return s;
  }
  function stat(items) {
    const total = items.length;
    const done = items.filter(i => i.done).length;
    return { total, done, pct: total ? Math.round(done / total * 100) : null };
  }

  function card(title, s, emptyText) {
    if (s.pct === null) {
      return `<div class="card"><h3>${title}</h3>
        <p style="margin-top:8px">${emptyText}</p></div>`;
    }
    return `<div class="card">
      <h3>${title}</h3>
      <div style="font-size:2rem;font-weight:700;color:#155a4f;line-height:1.3">${s.pct}%</div>
      <div style="height:10px;background:#e3ebe8;border-radius:999px;overflow:hidden;margin:6px 0 8px">
        <div style="height:100%;width:${s.pct}%;background:#1f7a6b"></div>
      </div>
      <p>أنجزت ${s.done} من ${s.total}</p>
    </div>`;
  }

  VIEWS.progress = function (box) {
    const tasks = read("platform-tasks", []);
    const lessons = read("platform-lessons", []);
    const now = new Date();
    const todayIso = iso(now);
    const start = weekStart(now);
    const weekFrom = iso(start);
    const weekTo = iso(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6));

    const inWeek = x => x.date && x.date >= weekFrom && x.date <= weekTo;
    const todayTasks = stat(tasks.filter(t => t.date === todayIso));
    const weekTasks = stat(tasks.filter(inWeek));
    const allTasks = stat(tasks);
    const allLessons = stat(lessons);
    const weekLessons = stat(lessons.filter(inWeek));

    const lateTasks = tasks.filter(t => !t.done && t.date && t.date < todayIso).length;
    const lateLessons = lessons.filter(l => !l.done && l.date && l.date < todayIso).length;
    const late = lateTasks + lateLessons;

    const lateHtml = late
      ? `<div class="card" style="border-right:5px solid #d9a21b;margin-top:16px">
          <h3>تحتاج انتباهك</h3>
          <p>عندك ${lateTasks} مهمة و${lateLessons} درس فات موعدهم ولم تنجزهم بعد.</p>
        </div>`
      : (tasks.length || lessons.length
          ? `<div class="card" style="border-right:5px solid #1f7a6b;margin-top:16px">
              <h3>ممتاز</h3><p>لا يوجد شيء متأخر عليك الآن.</p></div>`
          : "");

    box.innerHTML = `
      <div class="grid">
        ${card("إنجاز اليوم", todayTasks, "لا توجد مهام لليوم. أضف مهامك من قسم «مهامي».")}
        ${card("إنجاز الأسبوع (المهام)", weekTasks, "لا توجد مهام في هذا الأسبوع.")}
        ${card("دروس الأسبوع", weekLessons, "لا توجد دروس في هذا الأسبوع.")}
      </div>
      <h3 style="margin:24px 0 12px">الإجمالي</h3>
      <div class="grid">
        ${card("كل المهام", allTasks, "لم تضف مهام بعد.")}
        ${card("كل الدروس والمحاضرات", allLessons, "لم تضف دروسًا بعد.")}
      </div>
      ${lateHtml}`;
  };
})();