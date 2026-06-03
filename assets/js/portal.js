(function () {
  'use strict';

  var DONE_KEY = 'nurLib_done';
  var TERM_KEY = 'nurLib_term';
  var SUB_KEY = 'nurLib_sub';

  var terms = curriculumData.terms;
  var allTermKeys = Object.keys(terms);
  var filledTermKeys = [];
  var emptyTermKeys = [];

  allTermKeys.forEach(function (key) {
    var subjects = terms[key].subjects || {};
    var hasLectures = Object.keys(subjects).some(function (subKey) {
      return (subjects[subKey].lectures || []).length > 0;
    });
    if (hasLectures || Object.keys(subjects).length > 0) {
      filledTermKeys.push(key);
    } else {
      emptyTermKeys.push(key);
    }
  });

  var activeTerm = localStorage.getItem(TERM_KEY) || filledTermKeys[0] || allTermKeys[0];
  var activeSub = localStorage.getItem(SUB_KEY) || null;
  var allOpen = false;
  var doneMap = loadDone();

  var termBar = document.getElementById('termBar');
  var subjectBar = document.getElementById('subjectBar');
  var ctrlBar = document.getElementById('ctrlBar');
  var btnToggle = document.getElementById('btnToggle');
  var ctrlProg = document.getElementById('ctrlProgress');
  var lecBox = document.getElementById('lectures');
  var emptyBox = document.getElementById('emptyBox');
  var subjectTitle = document.getElementById('subjectTitle');
  var activeLabel = document.getElementById('activeLabel');
  var activeTitle = document.getElementById('activeTitle');

  var FILE_SLOTS = [
    {
      key: 'original_ppt',
      label: 'الباور الأصلي',
      icon: iconDocument()
    },
    {
      key: 'translated_ppt',
      label: 'الباور المترجم',
      icon: iconNotes()
    },
    {
      key: 'my_quiz',
      label: 'بنك أسئلة (اجتهاد شخصي)',
      icon: iconTarget()
    },
    {
      key: 'doctor_quiz',
      label: 'بنك أسئلة الدكتورة',
      icon: iconStethoscope()
    }
  ];

  function init() {
    renderTermBar();
    loadTerm(activeTerm);
    btnToggle.addEventListener('click', toggleAll);
  }

  function renderTermBar() {
    termBar.innerHTML = '';

    filledTermKeys.forEach(function (key) {
      var pill = document.createElement('button');
      pill.className = 'term-pill' + (key === activeTerm ? ' active' : '');
      pill.textContent = shortTermName(terms[key].name);
      pill.setAttribute('data-t', key);
      pill.type = 'button';
      pill.addEventListener('click', function () {
        setTerm(key);
      });
      termBar.appendChild(pill);
    });

    if (emptyTermKeys.length > 0) {
      var wrap = document.createElement('div');
      wrap.className = 'term-select-wrap';

      var select = document.createElement('select');
      select.className = 'term-select-native';
      select.id = 'termSelectNative';

      var placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'باقي الترمات';
      placeholder.disabled = true;
      select.appendChild(placeholder);

      emptyTermKeys.forEach(function (key) {
        select.add(new Option(shortTermName(terms[key].name), key));
      });

      if (emptyTermKeys.indexOf(activeTerm) > -1) {
        select.value = activeTerm;
        select.classList.add('active');
      } else {
        select.value = '';
      }

      select.addEventListener('change', function () {
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
    var term = terms[termKey];
    var subjects = Object.keys(term.subjects || {});

    if (subjects.length === 0) {
      activeSub = null;
      subjectBar.style.display = 'none';
      ctrlBar.style.display = 'none';
      lecBox.style.display = 'none';
      emptyBox.style.display = '';
      subjectTitle.textContent = 'لا توجد مواد';
      updateHero(term.name, 'انت مستعجل علي ايه 🙂');
      return;
    }

    if (!activeSub || !term.subjects[activeSub]) {
      activeSub = firstSubjectWithLectures(term) || subjects[0];
    } else if ((term.subjects[activeSub].lectures || []).length === 0) {
      activeSub = firstSubjectWithLectures(term) || activeSub;
    }

    localStorage.setItem(SUB_KEY, activeSub);
    subjectBar.style.display = '';
    lecBox.style.display = '';
    emptyBox.style.display = 'none';
    renderSubjects(termKey, subjects);
    renderLectures(termKey, activeSub);
  }

  function renderSubjects(termKey, subjects) {
    subjectBar.innerHTML = '';

    subjects.forEach(function (subjectKey) {
      var subject = terms[termKey].subjects[subjectKey];
      var count = (subject.lectures || []).length;
      var chip = document.createElement('button');
      chip.className = 'sub-chip' + (subjectKey === activeSub ? ' active' : '');
      chip.type = 'button';
      chip.setAttribute('data-s', subjectKey);
      chip.textContent = subject.name + ' · ' + count;
      chip.addEventListener('click', function () {
        activeSub = subjectKey;
        localStorage.setItem(SUB_KEY, subjectKey);
        renderSubjects(termKey, subjects);
        renderLectures(termKey, subjectKey);
      });
      subjectBar.appendChild(chip);
    });
  }

  function renderLectures(termKey, subjectKey) {
    var term = terms[termKey];
    var subject = term.subjects[subjectKey];
    var lectures = subject.lectures || [];

    lecBox.innerHTML = '';
    allOpen = false;
    updateToggleBtn();
    subjectTitle.textContent = subject.name;

    if (lectures.length === 0) {
      ctrlBar.style.display = 'none';
      lecBox.innerHTML = emptyMarkup('🙂', 'انت مستعجل علي ايه 🙂', '');
      updateHero(term.name, subject.name);
      return;
    }

    ctrlBar.style.display = '';

    lectures.forEach(function (lecture) {
      lecBox.appendChild(makeLectureCard(termKey, subjectKey, lecture));
    });

    updateStats(termKey, subjectKey, lectures);
  }

  function makeLectureCard(termKey, subjectKey, lecture) {
    var doneKey = termKey + '_' + subjectKey + '_' + lecture.num;
    var isDone = !!doneMap[doneKey];
    var files = lecture.files || {};
    var available = countFiles(files);

    var card = document.createElement('article');
    card.className = 'lec-card' + (isDone ? ' done' : '');

    var head = document.createElement('div');
    head.className = 'lec-head';

    var num = document.createElement('span');
    num.className = 'lec-num';
    num.textContent = lecture.num;

    var main = document.createElement('div');
    main.className = 'lec-main';

    var title = document.createElement('h3');
    title.className = 'lec-title';
    title.textContent = lecture.title_ar;

    var meta = document.createElement('div');
    meta.className = 'lec-meta';
    meta.appendChild(document.createTextNode(available + ' ملفات'));
    meta.appendChild(makeFileDots(files));

    main.appendChild(title);
    main.appendChild(meta);

    var actions = document.createElement('div');
    actions.className = 'lec-actions';
    actions.appendChild(makeCheckbox(doneKey, card, termKey, subjectKey));

    var chev = document.createElement('span');
    chev.className = 'lec-chev';
    chev.innerHTML = iconChevron();
    actions.appendChild(chev);

    head.appendChild(num);
    head.appendChild(main);
    head.appendChild(actions);

    var body = document.createElement('div');
    body.className = 'lec-body';
    var inner = document.createElement('div');
    inner.className = 'lec-body-inner';
    FILE_SLOTS.forEach(function (slot) {
      inner.appendChild(makeFileRow(slot, normalizeFiles(files[slot.key])));
    });
    body.appendChild(inner);

    head.addEventListener('click', function () {
      toggleCard(card, body);
    });

    card.appendChild(head);
    card.appendChild(body);
    return card;
  }

  function makeCheckbox(doneKey, card, termKey, subjectKey) {
    var label = document.createElement('label');
    label.className = 'lec-cb';
    label.title = 'تمت المذاكرة';
    label.addEventListener('click', function (event) {
      event.stopPropagation();
    });

    var input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!doneMap[doneKey];
    input.addEventListener('change', function () {
      if (input.checked) {
        doneMap[doneKey] = true;
      } else {
        delete doneMap[doneKey];
      }
      saveDone();
      card.classList.toggle('done', input.checked);
      updateStats(termKey, subjectKey);
    });

    var visual = document.createElement('span');
    visual.className = 'lec-cb-v';
    label.appendChild(input);
    label.appendChild(visual);
    return label;
  }

  function makeFileRow(slot, paths) {
    var row = document.createElement('div');
    row.className = 'f-row';

    var label = document.createElement('div');
    label.className = 'f-label';

    var icon = document.createElement('span');
    icon.className = 'f-label-icon ' + slot.key;
    icon.innerHTML = slot.icon;

    var text = document.createElement('span');
    text.textContent = slot.label;

    label.appendChild(icon);
    label.appendChild(text);

    var buttons = document.createElement('div');
    buttons.className = 'f-btns';

    if (paths.length) {
      paths.forEach(function (path, index) {
        var item = document.createElement('div');
        item.className = 'f-file';

        var name = document.createElement('span');
        name.className = 'f-file-name';
        name.textContent = paths.length > 1 ? ('ملف ' + (index + 1)) : 'الملف';

        var actions = document.createElement('div');
        actions.className = 'f-btns';

        var url = encodeURI(path);
        var openBtn = document.createElement('a');
        openBtn.className = 'f-btn f-btn--open';
        openBtn.href = url;
        openBtn.target = '_blank';
        openBtn.rel = 'noopener';
        openBtn.innerHTML = iconOpen() + '<span>فتح</span>';
        openBtn.addEventListener('click', stop);

        var downloadBtn = document.createElement('a');
        downloadBtn.className = 'f-btn f-btn--dl';
        downloadBtn.href = url;
        downloadBtn.download = '';
        downloadBtn.innerHTML = iconDownload() + '<span>تحميل</span>';
        downloadBtn.addEventListener('click', stop);

        actions.appendChild(openBtn);
        actions.appendChild(downloadBtn);
        item.appendChild(name);
        item.appendChild(actions);
        buttons.appendChild(item);
      });
    } else {
      var na = document.createElement('div');
      na.className = 'f-na';
      na.textContent = 'غير متوفر';
      buttons.appendChild(na);
    }

    row.appendChild(label);
    row.appendChild(buttons);
    return row;
  }

  function makeFileDots(files) {
    var dots = document.createElement('span');
    dots.className = 'file-dots';
    FILE_SLOTS.forEach(function (slot) {
      var dot = document.createElement('span');
      dot.className = 'file-dot' + (normalizeFiles(files[slot.key]).length ? ' on' : '');
      dots.appendChild(dot);
    });
    return dots;
  }

  function toggleCard(card, body) {
    if (card.classList.contains('open')) {
      body.style.maxHeight = body.scrollHeight + 'px';
      body.offsetHeight;
      body.style.maxHeight = '0';
      card.classList.remove('open');
      return;
    }

    card.classList.add('open');
    body.style.maxHeight = body.scrollHeight + 'px';
    var onEnd = function () {
      body.style.maxHeight = 'none';
      body.removeEventListener('transitionend', onEnd);
    };
    body.addEventListener('transitionend', onEnd);
  }

  function toggleAll() {
    var cards = lecBox.querySelectorAll('.lec-card');
    allOpen = !allOpen;

    Array.prototype.forEach.call(cards, function (card) {
      var body = card.querySelector('.lec-body');
      if (allOpen) {
        card.classList.add('open');
        body.style.maxHeight = body.scrollHeight + 'px';
        setTimeout(function () { body.style.maxHeight = 'none'; }, 260);
      } else {
        body.style.maxHeight = body.scrollHeight + 'px';
        body.offsetHeight;
        body.style.maxHeight = '0';
        card.classList.remove('open');
      }
    });

    updateToggleBtn();
  }

  function updateToggleBtn() {
    btnToggle.textContent = allOpen ? 'إغلاق الكل' : 'عرض الكل';
  }

  function updateStats(termKey, subjectKey, lectures) {
    var subject = terms[termKey].subjects[subjectKey];
    lectures = lectures || subject.lectures || [];

    var done = 0;
    var files = 0;
    lectures.forEach(function (lecture) {
      if (doneMap[termKey + '_' + subjectKey + '_' + lecture.num]) done++;
      files += countFiles(lecture.files || {});
    });

    ctrlProg.innerHTML = '<b>' + done + '</b> / ' + lectures.length + ' مكتملة';
    updateHero(terms[termKey].name, subject.name);
  }

  function updateHero(termName, subjectName) {
    activeLabel.textContent = shortTermName(termName);
    activeTitle.textContent = subjectName || 'اختار المادة وابدأ';
  }

  function countFiles(files) {
    return FILE_SLOTS.reduce(function (count, slot) {
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
    var subjects = Object.keys(term.subjects || {});
    for (var i = 0; i < subjects.length; i++) {
      if ((term.subjects[subjects[i]].lectures || []).length > 0) {
        return subjects[i];
      }
    }
    return null;
  }

  function emptyMarkup(icon, title, sub) {
    return '<div class="empty-box"><div class="empty-icon">' + icon + '</div><p class="empty-title">' + title + '</p>' + (sub ? '<p class="empty-sub">' + sub + '</p>' : '') + '</div>';
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

  function stop(event) {
    event.stopPropagation();
  }

  function svg(path, extra) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" ' + (extra || '') + '><path d="' + path + '"></path></svg>';
  }

  function iconChevron() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>';
  }

  function iconOpen() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
  }

  function iconDownload() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v11"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path></svg>';
  }

  function iconDocument() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"></path><path d="M14 3v5h5"></path><path d="M9 13h6"></path><path d="M9 17h5"></path></svg>';
  }

  function iconNotes() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4h12v16H6z"></path><path d="M9 8h6"></path><path d="M9 12h6"></path><path d="M9 16h4"></path></svg>';
  }

  function iconTarget() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="3"></circle><path d="M12 2v3"></path><path d="M12 19v3"></path><path d="M2 12h3"></path><path d="M19 12h3"></path></svg>';
  }

  function iconStethoscope() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4v5a4 4 0 0 0 8 0V4"></path><path d="M10 13v2a5 5 0 0 0 10 0v-1"></path><circle cx="20" cy="12" r="2"></circle></svg>';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
