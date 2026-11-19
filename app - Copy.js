// ===== البيانات: الأنظمة التعليمية والصفوف =====
const SCHOOL_GRADES = [
  "الأول الإعدادي", "الثاني الإعدادي", "الثالث الإعدادي",
  "الأول الثانوي", "الثاني الثانوي", "الثالث الثانوي"
];
const SYSTEMS = {
  "التعليم العام": SCHOOL_GRADES,
  "التعليم الأزهري": SCHOOL_GRADES,
  "التعليم العربي واللغات": SCHOOL_GRADES,
  "الجامعي": ["الفرقة الأولى", "الفرقة الثانية", "الفرقة الثالثة", "الفرقة الرابعة", "الفرقة الخامسة"]
};

// ===== الأقسام (phase = المرحلة التي سيُبنى فيها القسم) =====
const SECTIONS = [
  { id: "home",     name: "الرئيسية",       phase: 1, desc: "" },
  { id: "subjects", name: "موادي الدراسية", phase: 2, desc: "مواد مرحلتك، لكل مادة مساحة مستقلة." },
  { id: "files",    name: "ملفاتي ومصادري", phase: 3, desc: "الصور والمذكرات والروابط والكتب." },
  { id: "daily",    name: "جدولي اليومي",   phase: 4, desc: "يومك بالساعات: دروس ومذاكرة وراحة." },
  { id: "weekly",   name: "جدولي الأسبوعي", phase: 4, desc: "مهامك ومواعيدك طوال الأسبوع." },
  { id: "lessons",  name: "دروسي ومحاضراتي", phase: 4, desc: "الدروس الحضورية والأونلاين والمسجلة." },
  { id: "backlog",  name: "تراكماتي",       phase: 5, desc: "ما تأخرت فيه، وتوزيعه على الوقت المتاح." },
  { id: "tasks",    name: "مهامي",          phase: 4, desc: "المهام الدراسية والشخصية بمواعيدها." },
  { id: "prayer",   name: "صلاتي",          phase: 6, desc: "مواقيت الصلاة داخل جدول يومك." },
  { id: "progress", name: "إنجازاتي",       phase: 4, desc: "نسبة إنجازك اليومية والأسبوعية." },
  { id: "alerts",   name: "التنبيهات",      phase: 6, desc: "تذكيرات بمواعيدك ومهامك." },
  { id: "assistant",name: "المساعد الذكي",  phase: 5, desc: "يقترح لك جدولًا مناسبًا." }
];

// ===== حفظ الملف الشخصي في المتصفح =====
const KEY = "platform-profile";
function loadProfile() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; }
}
function saveProfile(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* لو التخزين غير متاح نكمل بدونه */ }
}

// ===== عناصر الصفحة =====
const $ = (id) => document.getElementById(id);
const setupEl = $("setup"), appEl = $("app");
let profile = loadProfile();
let current = "home";

// ===== شاشة الإعداد =====
function fillSystems() {
  $("system").innerHTML = Object.keys(SYSTEMS).map(s => `<option>${s}</option>`).join("");
  updateGrades();
}
function updateGrades() {
  const sys = $("system").value;
  $("grade").innerHTML = SYSTEMS[sys].map(g => `<option>${g}</option>`).join("");
  $("college-wrap").hidden = sys !== "الجامعي";
}
$("system").addEventListener("change", updateGrades);
$("save-setup").addEventListener("click", () => {
  profile = { system: $("system").value, grade: $("grade").value, college: $("college").value.trim() };
  saveProfile(profile);
  start();
});
$("change-profile").addEventListener("click", () => {
  appEl.hidden = true;
  setupEl.hidden = false;
});

// ===== القائمة الجانبية =====
function renderNav() {
  $("nav").innerHTML = SECTIONS.map(s =>
    `<button data-id="${s.id}" ${s.id === current ? 'aria-current="true"' : ""}>${s.name}</button>`
  ).join("");
}
$("nav").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-id]");
  if (btn) show(btn.dataset.id);
});

// ===== عرض الأقسام =====
function show(id) {
  current = id;
  const s = SECTIONS.find(x => x.id === id);
  const box = $("view");
  $("view-title").textContent = s.name;
  renderNav();

  if (id === "home") {
    box.innerHTML = homeView();
    box.querySelectorAll("[data-go]").forEach(b =>
      b.addEventListener("click", () => show(b.dataset.go)));
  } else if (window.VIEWS && window.VIEWS[id]) {
    box.innerHTML = "";
    window.VIEWS[id](box);
  } else {
    box.innerHTML = placeholderView(s);
  }
}

function homeView() {
  const today = new Date().toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const cards = SECTIONS.filter(s => s.id !== "home" && s.id !== "assistant").map(s =>
    `<button class="card" data-go="${s.id}"><h3>${s.name}</h3><p>${s.desc}</p></button>`
  ).join("");
  return `
    <p class="date">${today}</p>
    <div class="empty"><strong>لا توجد مهام لليوم بعد</strong>سنضيف هنا جدول يومك عندما نبني قسم المهام.</div>
    <div class="card assistant"><h3>المساعد الذكي</h3><p>اقترح لي جدولًا مناسبًا، ونظّم مهامي وتراكماتي</p></div>
    <h3 style="margin:26px 0 12px">أقسام المنصة</h3>
    <div class="grid">${cards}</div>`;
}

function placeholderView(s) {
  return `<div class="empty"><strong>${s.name}</strong>${s.desc}<br>هذا القسم سنبنيه في المرحلة ${s.phase}.</div>`;
}

// ===== التشغيل =====
function start() {
  setupEl.hidden = true;
  appEl.hidden = false;
  const line = [profile.system, profile.grade, profile.college].filter(Boolean).join(" - ");
  $("profile-line").textContent = line;
  show("home");
}

fillSystems();
if (profile && SYSTEMS[profile.system]) start(); else setupEl.hidden = false;