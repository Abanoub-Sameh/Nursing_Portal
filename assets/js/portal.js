(function () {
  'use strict';

  // LocalStorage Keys
  const DONE_KEY = 'nurLib_done';
  const TERM_KEY = 'nurLib_term';
  const SUB_KEY = 'nurLib_sub';

  // State variables (initialized in init())
  let terms = null;
  let allTermKeys = [];
  let filledTermKeys = [];
  let emptyTermKeys = [];
  let activeTerm = null;
  let activeSub = null;
  let doneMap = {};

  // DOM Elements
  const termBar = document.getElementById('termBar');
  const subjectBar = document.getElementById('subjectBar');
  const lecBox = document.getElementById('lectures');
  const emptyBox = document.getElementById('emptyBox');
  const emptyTitle = document.getElementById('emptyTitle');
  const emptySub = document.getElementById('emptySub');
  const studentGreeting = document.getElementById('studentGreeting');

  // File Slot Metadata
  const FILE_SLOTS = [
    { key: 'original_ppt', label: 'الباور الأصلي للدكتورة', class: 'original_ppt' },
    { key: 'translated_ppt', label: 'الباور المترجم', class: 'translated_ppt' },
    { key: 'my_quiz', label: 'بنك أسئلة (الأدمن)', class: 'my_quiz' },
    { key: 'doctor_quiz', label: 'بنك أسئلة الدكتورة', class: 'doctor_quiz' }
  ];

  function init() {
    if (typeof curriculumData === 'undefined') {
      throw new Error('لم يتم العثور على ملف البيانات (curriculum.js). يرجى التأكد من وجود الملف في نفس المجلد.');
    }

    terms = curriculumData.terms || {};
    allTermKeys = Object.keys(terms);
    filledTermKeys = [];
    emptyTermKeys = [];

    // Categorize terms based on content availability
    allTermKeys.forEach((key) => {
      const subjects = terms[key].subjects || {};
      const hasContent = Object.keys(subjects).some((subKey) => {
        return (subjects[subKey].lectures || []).length > 0;
      });
      if (hasContent) {
        filledTermKeys.push(key);
      } else {
        emptyTermKeys.push(key);
      }
    });

    activeTerm = localStorage.getItem(TERM_KEY) || filledTermKeys[0] || allTermKeys[0];
    activeSub = localStorage.getItem(SUB_KEY) || null;
    doneMap = loadDone();

    updateGreeting();
    renderTermBar();
    loadTerm(activeTerm);
    initOneSignal();
  }

  // Time-based student greeting generator
  function updateGreeting() {
    const hour = new Date().getHours();
    let text = "📚 محاضرات، ترجمه و بنوك في مكان واحد";
    
    if (hour >= 5 && hour < 12) {
      text = "صباح الخير يا دكتور! جاهز لمذاكرة النهاردة؟ ☀️";
    } else if (hour >= 12 && hour < 17) {
      text = "📚 محاضرات، ترجمه و بنوك في مكان واحد";
    } else if (hour >= 17 && hour < 24) {
      text = "مساء الورد يا بطل! جاهز لجرعة مذاكرة لذيذة؟ 🌙";
    } else {
      text = "سهاري يا دكتور؟ عاش يا بطل، ربنا يوفقك ويسهلها عليك! 🦉";
    }
    
    if (studentGreeting) studentGreeting.textContent = text;
  }

  // Render horizontal Term bar pills
  function renderTermBar() {
    termBar.innerHTML = '';

    filledTermKeys.forEach((key) => {
      const pill = document.createElement('button');
      pill.className = 'term-pill' + (key === activeTerm ? ' active' : '');
      pill.textContent = shortTermName(terms[key].name);
      pill.setAttribute('data-t', key);
      pill.type = 'button';
      pill.addEventListener('click', () => setTerm(key));
      termBar.appendChild(pill);
    });

    // Native select drop-down for empty terms
    if (emptyTermKeys.length > 0) {
      const wrap = document.createElement('div');
      wrap.className = 'term-select-wrap';

      const select = document.createElement('select');
      select.className = 'term-select-native';
      select.id = 'termSelectNative';

      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'باقي الترمات';
      placeholder.disabled = true;
      select.appendChild(placeholder);

      emptyTermKeys.forEach((key) => {
        select.add(new Option(shortTermName(terms[key].name), key));
      });

      if (emptyTermKeys.indexOf(activeTerm) > -1) {
        select.value = activeTerm;
        select.classList.add('active');
      } else {
        select.value = '';
      }

      select.addEventListener('change', () => {
        if (select.value) setTerm(select.value);
      });

      wrap.appendChild(select);
      termBar.appendChild(wrap);
    }
  }

  function setTerm(key) {
    activeTerm = key;
    localStorage.setItem(TERM_KEY, key);
    renderTermBar();
    loadTerm(key);
  }

  function loadTerm(termKey) {
    const term = terms[termKey];
    
    // Sort subjects by lecture count descending
    const sortedSubjects = Object.keys(term.subjects || {}).sort((a, b) => {
      const countA = (term.subjects[a].lectures || []).length;
      const countB = (term.subjects[b].lectures || []).length;
      return countB - countA;
    });

    if (sortedSubjects.length === 0) {
      activeSub = null;
      subjectBar.style.display = 'none';
      lecBox.style.display = 'none';
      emptyBox.style.display = '';
      emptyTitle.textContent = 'انت مستعجل على ايه 🙂';
      emptySub.textContent = 'الترم ده فاضي حالياً، المحاضرات هتنزل هنا أول ما تتوفر.';
      return;
    }

    if (!activeSub || !term.subjects[activeSub]) {
      activeSub = sortedSubjects[0];
    } else if ((term.subjects[activeSub].lectures || []).length === 0) {
      activeSub = sortedSubjects[0] || activeSub;
    }

    localStorage.setItem(SUB_KEY, activeSub);
    subjectBar.style.display = '';
    lecBox.style.display = '';
    emptyBox.style.display = 'none';
    
    renderSubjects(termKey, sortedSubjects);
    renderLectures(termKey, activeSub);
  }

  // Render active term's subjects scrollable chips (sorted by lecture count)
  function renderSubjects(termKey, sortedSubjectKeys) {
    subjectBar.innerHTML = '';

    sortedSubjectKeys.forEach((subjectKey) => {
      const subject = terms[termKey].subjects[subjectKey];
      const count = (subject.lectures || []).length;
      const chip = document.createElement('button');
      chip.className = 'sub-chip' + (subjectKey === activeSub ? ' active' : '');
      chip.type = 'button';
      chip.setAttribute('data-s', subjectKey);
      chip.textContent = `${subject.name} · ${count}`;
      chip.addEventListener('click', () => {
        activeSub = subjectKey;
        localStorage.setItem(SUB_KEY, subjectKey);
        renderSubjects(termKey, sortedSubjectKeys);
        renderLectures(termKey, subjectKey);
      });
      subjectBar.appendChild(chip);
    });
  }

  // Render lectures inside the active subject
  function renderLectures(termKey, subjectKey) {
    const term = terms[termKey];
    const subject = term.subjects[subjectKey];
    const lectures = subject.lectures || [];

    lecBox.innerHTML = '';

    if (lectures.length === 0) {
      lecBox.style.display = 'none';
      emptyBox.style.display = '';
      emptyTitle.textContent = 'المحاضرات لسه منزلتش 🙂';
      emptySub.textContent = `مادة ${subject.name} مفيش فيها محاضرات مرفوعة لسه.`;
      return;
    }

    lecBox.style.display = 'grid';
    emptyBox.style.display = 'none';

    lectures.forEach((lecture) => {
      lecBox.appendChild(makeLectureCard(termKey, subjectKey, lecture));
    });
  }

  // Construct lecture accordion HTML element
  function makeLectureCard(termKey, subjectKey, lecture) {
    const doneKey = `${termKey}_${subjectKey}_${lecture.num}`;
    const isDone = !!doneMap[doneKey];
    const files = lecture.files || {};
    const availableFiles = countFiles(files);

    const card = document.createElement('article');
    card.className = 'lec-card' + (isDone ? ' done' : '');

    const head = document.createElement('div');
    head.className = 'lec-head';

    const num = document.createElement('span');
    num.className = 'lec-num';
    num.textContent = lecture.num;

    const main = document.createElement('div');
    main.className = 'lec-main';

    const title = document.createElement('h3');
    title.className = 'lec-title';
    title.textContent = lecture.title_ar;

    const meta = document.createElement('div');
    meta.className = 'lec-meta';
    meta.appendChild(document.createTextNode(`${availableFiles} ملفات`));
    meta.appendChild(makeFileDots(files));

    main.appendChild(title);
    main.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'lec-actions';
    actions.appendChild(makeCheckbox(doneKey, card));

    const chev = document.createElement('span');
    chev.className = 'lec-chev';
    chev.innerHTML = iconChevron();
    actions.appendChild(chev);

    head.appendChild(num);
    head.appendChild(main);
    head.appendChild(actions);

    const body = document.createElement('div');
    body.className = 'lec-body';
    
    const inner = document.createElement('div');
    inner.className = 'lec-body-inner';
    
    FILE_SLOTS.forEach((slot) => {
      inner.appendChild(makeFileRow(slot, normalizeFiles(files[slot.key])));
    });
    body.appendChild(inner);

    // Accordion expand/collapse click handler (excluding tap on checkbox)
    head.addEventListener('click', (event) => {
      if (event.target.closest('.lec-cb')) return;
      toggleCard(card, body);
    });

    card.appendChild(head);
    card.appendChild(body);
    return card;
  }

  // Create study checkbox "تمت المذاكرة"
  function makeCheckbox(doneKey, card) {
    const label = document.createElement('label');
    label.className = 'lec-cb';
    label.title = 'تمت المذاكرة';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!doneMap[doneKey];
    
    input.addEventListener('change', () => {
      if (input.checked) {
        doneMap[doneKey] = true;
      } else {
        delete doneMap[doneKey];
      }
      saveDone();
      card.classList.toggle('done', input.checked);
    });

    const visual = document.createElement('span');
    visual.className = 'lec-cb-v';
    
    label.appendChild(input);
    label.appendChild(visual);
    return label;
  }

  // Construct individual file slot row
  function makeFileRow(slot, paths) {
    const row = document.createElement('div');
    row.className = 'f-row';

    const label = document.createElement('div');
    label.className = 'f-label';

    const icon = document.createElement('span');
    icon.className = 'f-label-icon ' + slot.class;
    icon.innerHTML = getSlotSvgIcon(slot.key);

    const text = document.createElement('span');
    text.textContent = slot.label;

    label.appendChild(icon);
    label.appendChild(text);

    const buttons = document.createElement('div');
    buttons.className = 'f-btns';

    if (paths.length) {
      paths.forEach((path, index) => {
        const item = document.createElement('div');
        item.className = 'f-file';

        const name = document.createElement('span');
        name.className = 'f-file-name';
        name.textContent = paths.length > 1 ? (`ملف ${index + 1}: ${path.split("/").pop()}`) : path.split("/").pop();
        name.title = path;

        const actions = document.createElement('div');
        actions.className = 'f-btns';

        const url = encodeURI(path);
        const openBtn = document.createElement('a');
        openBtn.className = 'f-btn f-btn--open';
        openBtn.href = url;
        openBtn.target = '_blank';
        openBtn.rel = 'noopener';
        openBtn.innerHTML = iconOpen() + '<span>فتح</span>';
        openBtn.addEventListener('click', stopPropagation);

        const downloadBtn = document.createElement('a');
        downloadBtn.className = 'f-btn f-btn--dl';
        downloadBtn.href = url;
        downloadBtn.download = '';
        downloadBtn.innerHTML = iconDownload() + '<span>تحميل</span>';
        downloadBtn.addEventListener('click', stopPropagation);

        actions.appendChild(openBtn);
        actions.appendChild(downloadBtn);
        item.appendChild(name);
        item.appendChild(actions);
        buttons.appendChild(item);
      });
    } else {
      const na = document.createElement('div');
      na.className = 'f-na';
      na.textContent = 'غير متوفر';
      buttons.appendChild(na);
    }

    row.appendChild(label);
    row.appendChild(buttons);
    return row;
  }

  // Create four colored file status dots
  function makeFileDots(files) {
    const dots = document.createElement('span');
    dots.className = 'file-dots';
    FILE_SLOTS.forEach((slot) => {
      const dot = document.createElement('span');
      const count = normalizeFiles(files[slot.key]).length;
      dot.className = 'file-dot' + (count ? ' on' : '');
      dots.appendChild(dot);
    });
    return dots;
  }

  // Accordion slide animation toggle
  function toggleCard(card, body) {
    const isOpen = card.classList.contains('open');
    if (isOpen) {
      body.style.maxHeight = body.scrollHeight + 'px';
      body.offsetHeight; // Force DOM repaint
      body.style.maxHeight = '0';
      card.classList.remove('open');
    } else {
      card.classList.add('open');
      body.style.maxHeight = body.scrollHeight + 'px';
      const onEnd = () => {
        if (card.classList.contains('open')) {
          body.style.maxHeight = 'none';
        }
        body.removeEventListener('transitionend', onEnd);
      };
      body.addEventListener('transitionend', onEnd);
    }
  }

  function countFiles(files) {
    return FILE_SLOTS.reduce((count, slot) => {
      return count + normalizeFiles(files[slot.key]).length;
    }, 0);
  }

  function shortTermName(name) {
    return String(name || '').replace(/\s*\(.*?\)\s*/g, '').trim();
  }

  function normalizeFiles(value) {
    if (Array.isArray(value)) {
      return value.filter(Boolean);
    }
    return value ? [value] : [];
  }

  function firstSubjectWithLectures(term) {
    const subjects = Object.keys(term.subjects || {});
    for (let i = 0; i < subjects.length; i++) {
      if ((term.subjects[subjects[i]].lectures || []).length > 0) {
        return subjects[i];
      }
    }
    return null;
  }

  function loadDone() {
    try {
      return JSON.parse(localStorage.getItem(DONE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function saveDone() {
    localStorage.setItem(DONE_KEY, JSON.stringify(doneMap));
  }

  function stopPropagation(event) {
    event.stopPropagation();
  }

  // Custom Icon SVGs (Tajawal & Inter matching clean outline icons)
  function getSlotSvgIcon(key) {
    if (key === 'original_ppt') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 22V4c0-.5.2-1 .6-1.4C5 2.2 5.5 2 6 2h8l6 6v14M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>';
    }
    if (key === 'translated_ppt') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
    }
    if (key === 'my_quiz') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>';
    }
    if (key === 'doctor_quiz') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
    }
    return '';
  }

  function iconChevron() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>';
  }

  // Toggle All cards logic (fallback)
  function toggleAll() {
    const cards = lecBox.querySelectorAll('.lec-card');
    let anyOpen = false;
    Array.prototype.forEach.call(cards, (c) => { if (c.classList.contains('open')) anyOpen = true; });
    
    Array.prototype.forEach.call(cards, (card) => {
      const body = card.querySelector('.lec-body');
      if (!anyOpen) {
        card.classList.add('open');
        body.style.maxHeight = body.scrollHeight + 'px';
        setTimeout(() => { if (card.classList.contains('open')) body.style.maxHeight = 'none'; }, 260);
      } else {
        body.style.maxHeight = body.scrollHeight + 'px';
        body.offsetHeight;
        body.style.maxHeight = '0';
        card.classList.remove('open');
      }
    });
  }

  function iconOpen() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
  }

  function iconDownload() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>';
  }

  // ── OneSignal Integration ──────────────────────────────────────
  // The soft-prompt banner is shown INDEPENDENTLY of OneSignal SDK.
  // OneSignal is only triggered when the user clicks "Accept".

  function initOneSignal() {
    const appId = curriculumData.onesignal_app_id;

    // Check if protocol is file:// (local load without web server)
    if (location.protocol === 'file:') {
      console.warn("⚠️ OneSignal لا يعمل على بروتوكول file:///. استخدم خادم محلي (server.py) للاختبار.");
      showSoftPromptBanner(true); // test mode
      return;
    }

    // Initialize OneSignal SDK v16 in the background (won't block banner)
    if (appId) {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      OneSignalDeferred.push(async function(OneSignal) {
        try {
          // Detect GitHub Pages subdirectory path for service worker.
          // OneSignal expects serviceWorkerPath without a leading slash.
          var swPath = 'OneSignalSDKWorker.js';
          var swScope = '/';
          var pathPrefix = location.pathname.replace(/\/[^\/]*$/, '');
          if (pathPrefix && pathPrefix !== '/') {
            swPath = pathPrefix.replace(/^\//, '') + '/OneSignalSDKWorker.js';
            swScope = pathPrefix + '/';
          }

          await OneSignal.init({
            appId: appId,
            notifyButton: { enable: false },
            allowLocalhostAsSecureOrigin: true,
            serviceWorkerParam: { scope: swScope },
            serviceWorkerPath: swPath
          });

          if (OneSignal.Notifications.permission) {
            await OneSignal.User.PushSubscription.optIn();
          }

          console.log("OneSignal subscription:", {
            permission: OneSignal.Notifications.permission,
            optedIn: OneSignal.User.PushSubscription.optedIn,
            id: OneSignal.User.PushSubscription.id
          });
          console.log("✅ OneSignal initialized successfully.");
        } catch (e) {
          console.warn("⚠️ OneSignal init failed:", e);
        }
      });
    } else {
      console.warn("⚠️ OneSignal App ID غير موجود في curriculum.js.");
    }

    // Show the soft-prompt banner regardless of OneSignal status
    showSoftPromptBanner(false);
  }

  function showSoftPromptBanner(isTestMode) {
    // Don't show if permission already granted or denied
    if (!isTestMode && typeof Notification !== 'undefined' && Notification.permission !== 'default') {
      return;
    }

    // Don't show if dismissed this session
    if (sessionStorage.getItem('notify_prompt_dismissed') === 'true') {
      return;
    }

    var promptBanner = document.getElementById('notifyPrompt');
    if (!promptBanner) return;

    promptBanner.style.display = 'flex';
    setTimeout(function() { promptBanner.classList.add('show'); }, 300);

    var btnAccept = document.getElementById('btnNotifyAccept');
    var btnDecline = document.getElementById('btnNotifyDecline');

    if (btnAccept) {
      btnAccept.onclick = function() {
        promptBanner.classList.remove('show');
        setTimeout(function() { promptBanner.style.display = 'none'; }, 400);

        if (isTestMode) {
          alert("🧪 وضع المحاكاة: في البيئة الحقيقية (HTTPS) سيظهر طلب إذن المتصفح الأصلي.");
          return;
        }

        // Try OneSignal v16 first, then fallback to native prompt
        if (window.OneSignalDeferred) {
          OneSignalDeferred.push(async function(OneSignal) {
            try {
              await OneSignal.Notifications.requestPermission();
              await OneSignal.User.PushSubscription.optIn();
              console.log("OneSignal subscription after prompt:", {
                permission: OneSignal.Notifications.permission,
                optedIn: OneSignal.User.PushSubscription.optedIn,
                id: OneSignal.User.PushSubscription.id
              });
            } catch (e) {
              console.warn("OneSignal requestPermission failed, trying native:", e);
              if (typeof Notification !== 'undefined') {
                Notification.requestPermission();
              }
            }
          });
        } else if (typeof Notification !== 'undefined') {
          Notification.requestPermission();
        }
      };
    }

    if (btnDecline) {
      btnDecline.onclick = function() {
        promptBanner.classList.remove('show');
        setTimeout(function() { promptBanner.style.display = 'none'; }, 400);
        sessionStorage.setItem('notify_prompt_dismissed', 'true');
      };
    }
  }

  function loadCurriculumData() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'curriculum.js?v=' + Date.now();
      script.onload = resolve;
      script.onerror = () => reject(new Error('لم يتم العثور على ملف البيانات (curriculum.js).'));
      document.head.appendChild(script);
    });
  }

  async function startApp() {
    try {
      await loadCurriculumData();
      init();
    } catch (e) {
      alert("Error during initialization: " + e.message);
      console.error(e);
    }
  }

  // Document Readiness Init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
  } else {
    startApp();
  }
})();
