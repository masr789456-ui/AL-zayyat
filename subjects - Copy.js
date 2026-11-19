// ===== قسم المواد الدراسية =====
window.VIEWS = window.VIEWS || {};

(function () {
  const COMMON = ["اللغة العربية", "اللغة الإنجليزية", "الرياضيات", "العلوم", "الدراسات الاجتماعية", "التربية الدينية"];
  const AZHAR = ["القرآن الكريم", "الفقه", "التفسير", "الحديث", "التوحيد"];

  function profile() {
    try { return JSON.parse(localStorage.getItem("platform-profile")) || {}; } catch (e) { return {}; }
  }
  function storageKey() {
    const p = profile();
    return "platform-subjects:" + [p.system, p.grade, p.college].filter(Boolean).join("|");
  }
  function load() {
    try { return JSON.parse(localStorage.getItem(storageKey())) || []; } catch (e) { return []; }
  }
  function save(list) {
    try { localStorage.setItem(storageKey(), JSON.stringify(list)); } catch (e) { /* نكمل بدون حفظ */ }
  }
  function esc(t) {
    return String(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function suggestions() {
    const p = profile();
    if (p.system === "الجامعي") return [];
    return p.system === "التعليم الأزهري" ? COMMON.concat(AZHAR) : COMMON;
  }

  VIEWS.subjects = function (box) {
    let list = load();

    function add(name) {
      name = name.trim();
      if (!name || list.some(s => s.name === name)) return;
      list.push({ id: Date.now() + "-" + Math.random().toString(36).slice(2, 6), name });
      save(list);
      draw();
    }

    function draw() {
      const taken = list.map(s => s.name);
      const chips = suggestions().filter(n => !taken.includes(n))
        .map(n => `<button class="chip" data-add="${esc(n)}">+ ${esc(n)}</button>`).join("");
      const cards = list.map(s =>
        `<div class="card"><h3>${esc(s.name)}</h3><button class="link" data-del="${s.id}">حذف</button></div>`
      ).join("");
      box.innerHTML = `
        <div class="add-row">
          <input id="subject-name" type="text" placeholder="اسم المادة">
          <button id="subject-add" class="btn">إضافة مادة</button>
        </div>
        ${chips ? `<div class="chips">${chips}</div>` : ""}
        ${list.length
          ? `<div class="grid">${cards}</div>`
          : `<div class="empty"><strong>لم تضف أي مادة بعد</strong>اكتب اسم المادة أو اختر من المقترحات.</div>`}`;

      const input = box.querySelector("#subject-name");
      const submit = () => add(input.value);
      box.querySelector("#subject-add").addEventListener("click", submit);
      input.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
      box.querySelectorAll("[data-add]").forEach(b => b.addEventListener("click", () => add(b.dataset.add)));
      box.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", () => {
        list = list.filter(s => s.id !== b.dataset.del);
        save(list);
        draw();
      }));
    }

    draw();
  };
})();