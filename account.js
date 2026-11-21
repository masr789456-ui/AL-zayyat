// ===== الحسابات ومزامنة البيانات مع Firebase =====
(function () {
  const PREFIX = "platform-";
  const META = "platform-sync-meta";
  const BACKUP = "platform-sync-backup";
  const SKIP = [META, BACKUP, "platform-alerts-sent"];
  const NO_CONTENT = ["platform-profile", "platform-prayer", "platform-alerts", "platform-assistant-settings", "platform-backlog-settings"];
  const INPUT = "padding:10px 12px;border:1px solid #d5dfdb;border-radius:8px;background:#fff;color:#14302b";
  const isSync = k => typeof k === "string" && k.startsWith(PREFIX) && !SKIP.includes(k);

  let auth = null, db = null, reason = "";
  let user = null, timer = null, statusText = "";
  const dirty = new Set();
  const removed = new Set();

  // نتأكد إن الخدمة متاحة، ولو لأ نعرف السبب
  if (typeof firebase === "undefined") {
    reason = "مكتبة Firebase ما اتحمّلتش (غالبًا النت أو حجب للرابط).";
  } else if (!window.FIREBASE_CONFIG) {
    reason = "ملف firebase-config.js مش واصل للصفحة.";
  } else {
    try {
      if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
      auth = firebase.auth();
      db = firebase.firestore();
    } catch (e) {
      auth = null; db = null;
      reason = "تعذّر تشغيل الحسابات (" + (e && (e.code || e.message) || "خطأ غير معروف") + ").";
    }
  }

  const rawSet = Storage.prototype.setItem;
  const rawGet = Storage.prototype.getItem;
  const rawRemove = Storage.prototype.removeItem;
  const lget = k => { try { return rawGet.call(localStorage, k); } catch (e) { return null; } };
  const lset = (k, v) => { try { rawSet.call(localStorage, k, v); } catch (e) { /* نكمل */ } };
  const lrem = k => { try { rawRemove.call(localStorage, k); } catch (e) { /* نكمل */ } };
  const docId = k => encodeURIComponent(k);

  function localKeys() {
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (isSync(k)) out.push(k);
      }
    } catch (e) { /* نكمل */ }
    return out;
  }
  function readMeta() { try { return JSON.parse(lget(META)) || {}; } catch (e) { return {}; } }
  function writeMeta(m) { lset(META, JSON.stringify(m)); }

  function filled(x) {
    if (Array.isArray(x)) return x.length > 0;
    if (x && typeof x === "object") return Object.values(x).some(filled);
    if (typeof x === "string") return x.trim().length > 0;
    return typeof x === "number";
  }
  function hasContent(k, v) {
    if (NO_CONTENT.includes(k)) return false;
    try { return filled(JSON.parse(v)); } catch (e) { return !!v; }
  }

  function setStatus(t) {
    statusText = t;
    const el = document.getElementById("acct-status");
    if (el) el.textContent = t;
  }

  // ===== الواجهة =====
  function explain(e) {
    switch (e && e.code) {
      case "auth/invalid-email": return "الإيميل غير صحيح.";
      case "auth/email-already-in-use": return "الإيميل ده مسجّل قبل كده، جرّب «دخول».";
      case "auth/weak-password": return "كلمة السر ضعيفة، اكتب 6 حروف على الأقل.";
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found": return "الإيميل أو كلمة السر غير صحيحة.";
      case "auth/too-many-requests": return "محاولات كتير، استنى شوية وجرّب تاني.";
      case "auth/network-request-failed": return "مفيش اتصال بالنت، تأكد منه وجرّب تاني.";
      case "auth/popup-closed-by-user":
      case "auth/cancelled-popup-request": return "نافذة جوجل اتقفلت قبل ما الدخول يكتمل.";
      case "auth/popup-blocked": return "المتصفح منع نافذة جوجل، اسمح بالنوافذ المنبثقة للموقع وجرّب تاني.";
      case "auth/unauthorized-domain": return "نطاق الموقع مش مضاف في Firebase (Authentication ثم Settings ثم Authorized domains).";
      case "auth/account-exists-with-different-credential": return "فيه حساب بنفس الإيميل بطريقة دخول تانية، ادخل بيها.";
      case "auth/operation-not-supported-in-this-environment": return "الحسابات بتشتغل من الموقع المنشور على الإنترنت، مش من فتح الملف على الجهاز.";
      default: return "حصلت مشكلة" + (e && e.code ? " (" + e.code + ")" : "") + "، جرّب تاني.";
    }
  }

  function openModal() {
    if (document.getElementById("acct-modal")) return;
    const ov = document.createElement("div");
    ov.id = "acct-modal";
    ov.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.55);display:grid;place-items:center;padding:16px;z-index:100";
    const card = document.createElement("div");
    card.className = "card";
    card.style.cssText = "width:min(400px,100%);display:grid;gap:12px;background:#fff";
    card.innerHTML = `<h3>تسجيل الدخول</h3>
      <p>الحساب اختياري، وبيحفظ بياناتك وتشوفها من أي جهاز.</p>
      <button id="am-google" class="btn" style="background:#fff;color:#14302b;border:1px solid #d5dfdb">الدخول بحساب جوجل</button>
      <p style="text-align:center">أو بالإيميل</p>
      <label style="display:grid;gap:4px;font-weight:500">الإيميل
        <input id="am-email" type="email" dir="ltr" autocomplete="email" style="${INPUT}"></label>
      <label style="display:grid;gap:4px;font-weight:500">كلمة السر (6 حروف على الأقل)
        <input id="am-pass" type="password" dir="ltr" autocomplete="current-password" style="${INPUT}"></label>
      <div id="am-msg" style="min-height:1.4em"></div>
      <button id="am-in" class="btn">دخول</button>
      <button id="am-up" class="btn" style="background:#2b5fa8">إنشاء حساب جديد</button>
      <button id="am-reset" class="link">نسيت كلمة السر؟</button>
      <button id="am-close" class="link">إغلاق</button>`;
    ov.appendChild(card);
    document.body.appendChild(ov);

    const q = id => card.querySelector(id);
    const msg = (t, ok) => { const m = q("#am-msg"); m.textContent = t; m.style.color = ok ? "#155a4f" : "#9a4a3a"; };
    const creds = () => ({ email: q("#am-email").value.trim(), pass: q("#am-pass").value });
    async function go(kind) {
      const c = creds();
      if (!c.email || !c.pass) { msg("اكتب الإيميل وكلمة السر."); return; }
      msg("لحظة...", true);
      try {
        if (kind === "up") await auth.createUserWithEmailAndPassword(c.email, c.pass);
        else await auth.signInWithEmailAndPassword(c.email, c.pass);
        ov.remove();
      } catch (e) { msg(explain(e)); }
    }
    q("#am-in").onclick = () => go("in");
    q("#am-up").onclick = () => go("up");
    q("#am-google").onclick = async () => {
      msg("لحظة...", true);
      try {
        await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
        ov.remove();
      } catch (e) { msg(explain(e)); }
    };
    q("#am-reset").onclick = async () => {
      const c = creds();
      if (!c.email) { msg("اكتب الإيميل الأول."); return; }
      try {
        await auth.sendPasswordResetEmail(c.email);
        msg("لو الإيميل مسجّل هيوصله رابط لإعادة التعيين، شوف الرسايل غير المرغوبة كمان.", true);
      } catch (e) { msg(explain(e)); }
    };
    q("#am-close").onclick = () => ov.remove();
    ov.addEventListener("click", e => { if (e.target === ov) ov.remove(); });
    q("#am-email").focus();
  }

  function renderBox() {
    let box = document.getElementById("acct");
    if (!box) {
      const side = document.querySelector(".side");
      if (!side) return;
      box = document.createElement("div");
      box.id = "acct";
      box.style.cssText = "margin-top:18px;padding:12px 10px;border-top:1px solid #2f4d47;font-size:.9rem;display:grid;gap:8px";
      side.appendChild(box);
    }
    box.textContent = "";
    const info = document.createElement("div");
    if (!auth) {
      info.textContent = "الحسابات غير متاحة الآن: " + reason + " الموقع شغال عادي وبياناتك على جهازك.";
      info.style.color = "#e8c9a0";
      box.appendChild(info);
      return;
    }
    const btn = document.createElement("button");
    btn.style.cssText = "background:#1f7a6b;color:#fff;border:0;border-radius:8px;padding:8px 10px;cursor:pointer;font:inherit";
    if (user) {
      info.textContent = user.email || user.displayName || "حسابك";
      info.style.cssText = "direction:ltr;text-align:right;word-break:break-all;color:#e8f0ed";
      const st = document.createElement("div");
      st.id = "acct-status";
      st.style.color = "#a9bdb7";
      st.textContent = statusText;
      btn.textContent = "تسجيل الخروج";
      btn.onclick = doSignOut;
      box.append(info, st, btn);
    } else {
      info.textContent = "بياناتك محفوظة على هذا الجهاز فقط.";
      info.style.color = "#a9bdb7";
      btn.textContent = "تسجيل الدخول أو إنشاء حساب";
      btn.onclick = openModal;
      box.append(info, btn);
    }
    const sl = document.getElementById("setup-login");
    if (sl) sl.hidden = !!user;
  }

  function addSetupLink() {
    const sb = document.querySelector(".setup-box");
    if (!sb || document.getElementById("setup-login")) return;
    const b = document.createElement("button");
    b.id = "setup-login";
    b.className = "link";
    b.textContent = "عندي حساب؟ سجّل دخول";
    b.onclick = openModal;
    sb.appendChild(b);
  }

  renderBox();
  if (!auth) return;
  addSetupLink();

  // ===== حفظ التغييرات على الحساب =====
  function touch(k, isRemove) {
    if (!user) return;
    let m = readMeta();
    if (m.uid !== user.uid) m = { uid: user.uid, times: {} };
    m.times = m.times || {};
    m.times[k] = Date.now();
    writeMeta(m);
    if (isRemove) { removed.add(k); dirty.delete(k); } else { dirty.add(k); removed.delete(k); }
    setStatus("جاري الحفظ...");
    clearTimeout(timer);
    timer = setTimeout(flush, 1500);
  }
  Storage.prototype.setItem = function (k, v) {
    rawSet.call(this, k, v);
    if (this === localStorage && isSync(k)) touch(k, false);
  };
  Storage.prototype.removeItem = function (k) {
    rawRemove.call(this, k);
    if (this === localStorage && isSync(k)) touch(k, true);
  };

  async function flush() {
    if (!user || (!dirty.size && !removed.size)) return;
    const col = db.collection("users").doc(user.uid).collection("data");
    const m = readMeta();
    const times = m.uid === user.uid ? (m.times || {}) : {};
    const sent = Array.from(dirty);
    const gone = Array.from(removed);
    const batch = db.batch();
    sent.forEach(k => {
      const v = lget(k);
      if (v === null) batch.delete(col.doc(docId(k)));
      else batch.set(col.doc(docId(k)), { key: k, value: v, updatedAt: times[k] || Date.now() });
    });
    gone.forEach(k => batch.delete(col.doc(docId(k))));
    try {
      await batch.commit();
      sent.forEach(k => dirty.delete(k));
      gone.forEach(k => removed.delete(k));
      setStatus("بياناتك محفوظة على حسابك");
    } catch (e) {
      setStatus("تعذر الحفظ الآن، هنحاول تاني");
      timer = setTimeout(flush, 15000);
    }
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });

  // ===== عند تسجيل الدخول: نقارن بيانات الجهاز ببيانات الحساب =====
  async function reconcile(u) {
    setStatus("جاري مزامنة بياناتك...");
    const col = db.collection("users").doc(u.uid).collection("data");
    const snap = await col.get();
    const cloud = {};
    snap.forEach(d => {
      const x = d.data();
      if (x && isSync(x.key) && typeof x.value === "string") cloud[x.key] = { value: x.value, t: x.updatedAt || 0 };
    });
    const keys = localKeys();
    const local = {};
    keys.forEach(k => { local[k] = lget(k); });
    const meta = readMeta();
    const same = meta.uid === u.uid;
    const times = same ? (meta.times || {}) : {};
    const cloudKeys = Object.keys(cloud);
    const localHas = keys.some(k => hasContent(k, local[k]));
    const cloudHas = cloudKeys.some(k => hasContent(k, cloud[k].value));
    const now = Date.now();
    const up = [], del = [];
    let changed = false;
    const takeCloud = k => { lset(k, cloud[k].value); times[k] = cloud[k].t; changed = true; };
    const upload = k => { times[k] = now; up.push(k); };

    if (!cloudKeys.length || (localHas && !cloudHas)) {
      keys.forEach(upload);
    } else if (!localHas) {
      cloudKeys.forEach(takeCloud);
      keys.filter(k => !(k in cloud)).forEach(upload);
    } else if (same) {
      cloudKeys.forEach(k => {
        if (!(k in local)) { if ((times[k] || 0) > cloud[k].t) del.push(k); else takeCloud(k); }
        else if (local[k] === cloud[k].value) times[k] = cloud[k].t;
        else if ((times[k] || 0) > cloud[k].t) upload(k);
        else takeCloud(k);
      });
      keys.filter(k => !(k in cloud)).forEach(upload);
    } else {
      const useCloud = confirm("على جهازك بيانات، وفي حسابك بيانات كمان.\n\nاضغط «موافق» لاستخدام بيانات حسابك (بيانات الجهاز هتتبدّل).\nاضغط «إلغاء» لرفع بيانات جهازك مكان بيانات الحساب.");
      lset(BACKUP, JSON.stringify(local));
      if (useCloud) {
        cloudKeys.forEach(takeCloud);
        keys.filter(k => !(k in cloud)).forEach(k => { lrem(k); changed = true; });
      } else {
        keys.forEach(upload);
        cloudKeys.filter(k => !(k in local)).forEach(k => del.push(k));
      }
    }
    writeMeta({ uid: u.uid, times });
    up.forEach(k => { dirty.add(k); removed.delete(k); });
    del.forEach(k => { removed.add(k); dirty.delete(k); });
    await flush();
    if (changed) { location.reload(); return; }
    setStatus("بياناتك محفوظة ومتزامنة");
  }

  async function doSignOut() {
    clearTimeout(timer);
    await flush();
    if (dirty.size || removed.size) {
      alert("لسه فيه بيانات ما اتحفظتش على حسابك. اتأكد من النت وجرّب تاني.");
      return;
    }
    if (!confirm("هتتمسح بياناتك من الجهاز ده، وتفضل محفوظة على حسابك. متابعة؟")) return;
    localKeys().forEach(lrem);
    lrem(META);
    lrem(BACKUP);
    try { await auth.signOut(); } catch (e) { /* نكمل */ }
    location.reload();
  }

  auth.onAuthStateChanged(async u => {
    user = u;
    renderBox();
    if (!u) return;
    try { await reconcile(u); }
    catch (e) { setStatus("تعذرت المزامنة الآن، وبياناتك على جهازك سليمة."); }
  });
})();