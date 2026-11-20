// ===== التنبيهات والتذكيرات =====
window.VIEWS = window.VIEWS || {};

(function () {
  const KEY = "platform-alerts";
  const SENT = "platform-alerts-sent";
  const PRAYERS = [["Fajr", "الفجر"], ["Dhuhr", "الظهر"], ["Asr", "العصر"], ["Maghrib", "المغرب"], ["Isha", "العشاء"]];

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
  const toMin = t => { const p = t.split(":").map(Number); return p[0] * 60 + p[1]; };
  function fmtMin(m) {
    const h = Math.floor(m / 60);
    return (h % 12 || 12) + ":" + pad(m % 60) + (h < 12 ? " ص" : " م");
  }
  function dur(m) {
    const h = Math.floor(m / 60), r = m % 60;
    if (!h) return r + " دقيقة";
    if (!r) return h + " ساعة";
    return h + " ساعة و" + r + " دقيقة";
  }
  const todayIso = () => new Date().toLocaleDateString("en-CA");

  function settings() {
    return Object.assign({ enabled: false, tasks: true, lessons: true, blocks: true, prayers: true, before: 10, prayerBefore: 5 }, read(KEY, {}));
  }

  // مواقيت الصلاة المحفوظة من قسم صلاتي
  function prayerTimes(dateIso) {
    const p = read("platform-prayer", null);
    if (!p) return null;
    if (p.mode === "manual") return PRAYERS.every(x => p.manual && p.manual[x[0]]) ? p.manual : null;
    return p.cache && p.cache.date === dateIso ? p.cache.times : null;
  }

  // كل ما يستحق تنبيهًا اليوم
  function todayEvents(s) {
    const dateIso = todayIso();
    const ev = [];
    if (s.tasks) read("platform-tasks", []).filter(t => !t.done && t.date === dateIso && t.time)
      .forEach(t => ev.push({ id: "task:" + t.id + ":" + dateIso, min: toMin(t.time), before: s.before, label: "مهمة: " + t.title }));
    if (s.lessons) read("platform-lessons", []).filter(l => !l.done && l.date === dateIso && l.time)
      .forEach(l => ev.push({ id: "lesson:" + l.id + ":" + dateIso, min: toMin(l.time), before: s.before, label: "درس: " + l.title }));
    if (s.blocks) read("platform-blocks", []).filter(b => (b.daily || b.date === dateIso) && b.start && b.type !== "sleep")
      .forEach(b => ev.push({ id: "block:" + b.id + ":" + dateIso, min: toMin(b.start), before: s.before, label: b.title }));
    if (s.prayers) {
      const pt = prayerTimes(dateIso);
      if (pt) PRAYERS.forEach(p => {
        if (pt[p[0]]) ev.push({ id: "prayer:" + p[0] + ":" + dateIso, min: toMin(pt[p[0]]), before: s.prayerBefore, label: "صلاة " + p[1] });
      });
    }
    return ev.sort((a, b) => a.min - b.min);
  }

  // رسالة داخل الصفحة
  function toast(text) {
    let wrap = document.getElementById("alerts-toasts");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "alerts-toasts";
      wrap.style.cssText = "position:fixed;top:12px;left:12px;right:12px;z-index:50;display:grid;gap:8px;max-width:420px;margin-inline:auto;pointer-events:none";
      document.body.appendChild(wrap);
    }
    const d = document.createElement("div");
    d.style.cssText = "background:#14302b;color:#fff;padding:12px 16px;border-radius:10px;border-right:5px solid #d9a21b;pointer-events:auto;display:flex;justify-content:space-between;gap:12px;align-items:center";
    const s = document.createElement("span");
    s.textContent = text;
    const b = document.createElement("button");
    b.textContent = "إغلاق";
    b.style.cssText = "background:none;border:0;color:#d9a21b;cursor:pointer;font:inherit";
    b.addEventListener("click", () => d.remove());
    d.append(s, b);
    wrap.appendChild(d);
    setTimeout(() => d.remove(), 20000);
  }

  function notify(title, body) {
    toast(title + (body ? " • " + body : ""));
    if ("Notification" in window && Notification.permission === "granted") {
      try { new Notification(title, { body }); } catch (e) { /* بعض الأجهزة لا تدعمه */ }
    }
  }

  // فحص دوري يعمل طول ما الصفحة مفتوحة
  function check() {
    const s = settings();
    if (!s.enabled) return;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const dateIso = todayIso();
    const sentData = read(SENT, {});
    const sent = sentData.date === dateIso ? sentData.ids : [];
    let changed = false;
    todayEvents(s).forEach(e => {
      if (sent.includes(e.id)) return;
      if (nowMin >= e.min - e.before && nowMin <= e.min) {
        notify(e.label, nowMin >= e.min ? "الآن" : "بعد " + dur(e.min - nowMin));
        sent.push(e.id);
        changed = true;
      }
    });
    if (changed) write(SENT, { date: dateIso, ids: sent });
  }
  setInterval(check, 30000);
  setTimeout(check, 3000);

  // ===== صفحة التنبيهات =====
  VIEWS.alerts = function (box) {
    function draw() {
      const s = settings();
      const supported = "Notification" in window;
      const perm = supported ? Notification.permission : "unsupported";
      const lbl = "display:grid;gap:4px;font-weight:500";
      const chk = (id, on, text) => `<label style="display:flex;gap:8px;align-items:center"><input id="${id}" type="checkbox" ${on ? "checked" : ""} style="width:18px;height:18px"> ${text}</label>`;
      const opts = (list, sel) => list.map(m => `<option value="${m}" ${m === sel ? "selected" : ""}>${m === 0 ? "في الموعد نفسه" : "قبلها بـ " + m + " دقيقة"}</option>`).join("");

      let permHtml;
      if (perm === "granted") permHtml = `<p>إشعارات المتصفح: <strong>مسموحة</strong></p>`;
      else if (perm === "denied") permHtml = `<p>إشعارات المتصفح: <strong>مرفوضة</strong>. لتفعيلها اضغط على أيقونة القفل جنب عنوان الموقع وغيّر إذن الإشعارات. وفي الأثناء ستصلك التنبيهات داخل الصفحة.</p>`;
      else if (perm === "default") permHtml = `<button id="a-perm" class="btn" style="justify-self:start;padding:8px 14px">اسمح بإشعارات المتصفح</button>`;
      else permHtml = `<p>متصفحك لا يدعم إشعارات النظام، وستصلك التنبيهات داخل الصفحة.</p>`;

      const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
      const upcoming = todayEvents(s).filter(e => e.min >= nowMin);
      const upHtml = upcoming.length
        ? upcoming.map(e => `<div class="card" style="display:flex;justify-content:space-between;gap:10px;margin-bottom:8px">
            <strong>${esc(e.label)}</strong><span>${fmtMin(e.min)} • ينبّهك ${e.before === 0 ? "في الموعد" : "قبلها بـ " + e.before + " دقيقة"}</span></div>`).join("")
        : `<div class="empty"><strong>لا توجد تنبيهات قادمة اليوم</strong>التنبيهات تُبنى من المهام والدروس والأنشطة التي لها وقت، ومن مواقيت الصلاة المحفوظة.</div>`;

      box.innerHTML = `
        <div class="card" style="display:grid;gap:14px">
          ${chk("a-on", s.enabled, "<strong>تفعيل التنبيهات</strong>")}
          ${permHtml}
          <p>التنبيهات تعمل طول ما صفحة الموقع مفتوحة في المتصفح، ولو أغلقتها لن تصلك.</p>
        </div>

        <div class="card" style="display:grid;gap:12px;margin-top:14px">
          <h3>نبّهني على</h3>
          ${chk("a-tasks", s.tasks, "المهام التي لها وقت")}
          ${chk("a-lessons", s.lessons, "الدروس والمحاضرات")}
          ${chk("a-blocks", s.blocks, "أنشطة جدولي اليومي (ما عدا النوم)")}
          ${chk("a-prayers", s.prayers, "مواقيت الصلاة (من قسم صلاتي)")}
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
            <label style="${lbl}">تنبيه المهام والدروس والأنشطة
              <select id="a-before">${opts([5, 10, 15, 30, 60], s.before)}</select></label>
            <label style="${lbl}">تنبيه الصلاة
              <select id="a-pbefore">${opts([0, 5, 10, 15, 30], s.prayerBefore)}</select></label>
          </div>
          <button id="a-test" class="btn" style="justify-self:start;padding:8px 14px">جرّب تنبيهًا الآن</button>
        </div>

        <h3 style="margin:20px 0 10px">تنبيهات اليوم القادمة</h3>
        ${upHtml}`;

      const q = id => box.querySelector(id);
      const bind = (id, key, isBox) => q(id).addEventListener("change", e => {
        const v = isBox ? e.target.checked : Number(e.target.value);
        write(KEY, Object.assign(settings(), { [key]: v }));
        draw();
      });
      bind("#a-on", "enabled", true); bind("#a-tasks", "tasks", true); bind("#a-lessons", "lessons", true);
      bind("#a-blocks", "blocks", true); bind("#a-prayers", "prayers", true);
      bind("#a-before", "before", false); bind("#a-pbefore", "prayerBefore", false);
      q("#a-test").addEventListener("click", () => notify("تنبيه تجريبي", "لو شفت الرسالة دي يبقى التنبيهات شغالة"));
      const pb = q("#a-perm");
      if (pb) pb.addEventListener("click", () => {
        Notification.requestPermission().then(draw, draw);
      });
    }
    draw();
  };
})();