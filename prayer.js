// ===== قسم الصلاة =====
window.VIEWS = window.VIEWS || {};

(function () {
  const KEY = "platform-prayer";
  const NAMES = [["Fajr", "الفجر"], ["Sunrise", "الشروق"], ["Dhuhr", "الظهر"], ["Asr", "العصر"], ["Maghrib", "المغرب"], ["Isha", "العشاء"]];
  const DEFAULTS = { Fajr: "04:30", Sunrise: "06:00", Dhuhr: "12:00", Asr: "15:30", Maghrib: "18:00", Isha: "19:30" };
  const METHODS = [[5, "الهيئة المصرية العامة للمساحة"], [4, "أم القرى (مكة المكرمة)"], [3, "رابطة العالم الإسلامي"],
    [2, "أمريكا الشمالية (ISNA)"], [1, "جامعة العلوم الإسلامية بكراتشي"]];
  let timer = null;

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
  function fmt(t) {
    const [h, m] = t.split(":").map(Number);
    return (h % 12 || 12) + ":" + pad(m) + (h < 12 ? " ص" : " م");
  }
  function dur(m) {
    const h = Math.floor(m / 60), r = m % 60;
    if (!h) return r + " دقيقة";
    if (!r) return h + " ساعة";
    return h + " ساعة و" + r + " دقيقة";
  }
  function hoursOpts(sel) {
    let s = "";
    for (let h = 0; h < 24; h++) s += `<option value="${h}" ${h === sel ? "selected" : ""}>${(h % 12 || 12) + (h < 12 ? " ص" : " م")}</option>`;
    return s;
  }
  function minsOpts(sel) {
    let s = "";
    for (let m = 0; m < 60; m++) s += `<option value="${m}" ${m === sel ? "selected" : ""}>${pad(m)}</option>`;
    return s;
  }

  VIEWS.prayer = function (box) {
    if (timer) clearInterval(timer);
    let set = Object.assign({ mode: "auto", city: "", country: "", method: 5, manual: {}, cache: null }, read(KEY, {}));
    let status = "";
    const save = () => write(KEY, set);
    const today = () => new Date().toLocaleDateString("en-CA");
    const cacheKey = () => (set.city + "|" + set.country + "|" + set.method).trim().toLowerCase();
    const mounted = () => !!box.querySelector("#prayer-root");

    function currentTimes() {
      if (set.mode === "manual") return NAMES.every(n => set.manual[n[0]]) ? set.manual : null;
      if (set.cache && set.cache.date === today() && set.cache.key === cacheKey()) return set.cache.times;
      return null;
    }

    async function load() {
      if (!set.city.trim() || !set.country.trim()) { status = "اكتب اسم المدينة والدولة أولًا."; draw(); return; }
      status = "جاري جلب المواقيت...";
      draw();
      try {
        const url = "https://api.aladhan.com/v1/timingsByCity?city=" + encodeURIComponent(set.city.trim()) +
          "&country=" + encodeURIComponent(set.country.trim()) + "&method=" + set.method;
        const r = await fetch(url);
        const j = await r.json();
        if (!r.ok || !j.data || !j.data.timings) throw new Error("bad");
        const times = {};
        NAMES.forEach(n => {
          const m = String(j.data.timings[n[0]]).match(/(\d{1,2}):(\d{2})/);
          if (!m) throw new Error("bad");
          times[n[0]] = pad(Number(m[1])) + ":" + m[2];
        });
        set.cache = { date: today(), key: cacheKey(), times };
        save();
        status = "";
      } catch (e) {
        status = "ما قدرناش نجيب المواقيت. تأكد من النت ومن كتابة المدينة والدولة بالإنجليزي، أو استخدم الوضع اليدوي.";
      }
      if (mounted()) draw();
    }

    function tick() {
      const el = box.querySelector("#p-next");
      const times = currentTimes();
      if (!el || !times) return;
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const prayers = NAMES.filter(n => n[0] !== "Sunrise");
      let next = prayers.find(n => toMin(times[n[0]]) > nowMin);
      let diff, wrapped = false;
      if (next) diff = toMin(times[next[0]]) - nowMin;
      else { next = prayers[0]; wrapped = true; diff = 1440 - nowMin + toMin(times[next[0]]); }
      el.textContent = "الصلاة القادمة: " + next[1] + (wrapped ? " (غدًا)" : "") + " بعد " + dur(diff);
      box.querySelectorAll("[data-k]").forEach(r => { r.style.background = r.dataset.k === next[0] ? "#e3f1ed" : ""; });
    }

    function draw() {
      const times = currentTimes();
      const lbl = "display:grid;gap:4px;font-weight:500";
      let form;
      if (set.mode === "auto") {
        form = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px">
            <label style="${lbl}">المدينة (بالإنجليزي)
              <input id="p-city" type="text" dir="ltr" placeholder="Cairo" value="${esc(set.city)}"></label>
            <label style="${lbl}">الدولة (بالإنجليزي)
              <input id="p-country" type="text" dir="ltr" placeholder="Egypt" value="${esc(set.country)}"></label>
            <label style="${lbl}">طريقة الحساب
              <select id="p-method">${METHODS.map(m => `<option value="${m[0]}" ${m[0] === set.method ? "selected" : ""}>${m[1]}</option>`).join("")}</select></label>
          </div>
          <button id="p-load" class="btn">هات المواقيت</button>`;
      } else {
        form = `<div style="display:grid;gap:10px">` + NAMES.map(n => {
          const v = (set.manual[n[0]] || DEFAULTS[n[0]]).split(":");
          return `<div style="display:flex;gap:10px;align-items:center">
            <strong style="width:70px">${n[1]}</strong>
            <select data-h="${n[0]}">${hoursOpts(Number(v[0]))}</select>
            <select data-m="${n[0]}">${minsOpts(Number(v[1]))}</select></div>`;
        }).join("") + `</div><button id="p-save" class="btn">احفظ المواقيت</button>`;
      }

      let timesHtml = "";
      if (times) {
        timesHtml = `<div class="card" style="margin-top:18px">
          <h3 id="p-next" style="margin-bottom:10px"></h3>
          ${NAMES.map(n => `<div data-k="${n[0]}" style="display:flex;justify-content:space-between;padding:8px 10px;border-radius:8px">
            <span>${n[1]}</span><strong>${fmt(times[n[0]])}</strong></div>`).join("")}
          <p style="margin-top:8px">${set.mode === "auto" ? "مواقيت اليوم لمدينة " + esc(set.city) + " (" + esc(set.country) + ")" : "المواقيت اللي حفظتها بنفسك"}</p>
        </div>`;
      }

      box.innerHTML = `<div id="prayer-root">
        <div class="card" style="display:grid;gap:12px">
          <label style="${lbl}">طريقة معرفة المواقيت
            <select id="p-mode">
              <option value="auto" ${set.mode === "auto" ? "selected" : ""}>تلقائي حسب المدينة</option>
              <option value="manual" ${set.mode === "manual" ? "selected" : ""}>أدخلها بنفسي</option>
            </select></label>
          ${form}
        </div>
        ${status ? `<div class="empty" style="margin-top:14px"><strong>${status}</strong></div>` : ""}
        ${timesHtml}</div>`;

      const q = id => box.querySelector(id);
      q("#p-mode").addEventListener("change", e => {
        set.mode = e.target.value; save();
        if (set.mode === "auto" && set.city.trim() && set.country.trim() && !currentTimes()) load(); else draw();
      });
      if (set.mode === "auto") {
        q("#p-city").addEventListener("input", e => { set.city = e.target.value; save(); });
        q("#p-country").addEventListener("input", e => { set.country = e.target.value; save(); });
        q("#p-method").addEventListener("change", e => { set.method = Number(e.target.value); save(); });
        q("#p-load").addEventListener("click", load);
      } else {
        q("#p-save").addEventListener("click", () => {
          NAMES.forEach(n => {
            const h = box.querySelector(`[data-h="${n[0]}"]`).value;
            const m = box.querySelector(`[data-m="${n[0]}"]`).value;
            set.manual[n[0]] = pad(Number(h)) + ":" + pad(Number(m));
          });
          save();
          status = "";
          draw();
        });
      }
      tick();
    }

    timer = setInterval(() => {
      if (!mounted()) { clearInterval(timer); timer = null; return; }
      tick();
    }, 30000);

    if (set.mode === "auto" && set.city.trim() && set.country.trim() && !currentTimes()) load(); else draw();
  };
})();