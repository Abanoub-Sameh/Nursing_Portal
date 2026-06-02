/* ═══════════════════════════════════════
   مكتبة تمريض — Portal JS
   Lightweight, no frameworks, no bloat
   ═══════════════════════════════════════ */
(function () {
  'use strict';

  var DONE_KEY = 'nurLib_done';
  var TERM_KEY = 'nurLib_term';
  var SUB_KEY  = 'nurLib_sub';

  var terms = curriculumData.terms;
  var allTermKeys = Object.keys(terms);

  // Separate terms with content vs empty
  var filledTermKeys = [];
  var emptyTermKeys = [];
  allTermKeys.forEach(function (k) {
    if (Object.keys(terms[k].subjects).length > 0) {
      filledTermKeys.push(k);
    } else {
      emptyTermKeys.push(k);
    }
  });

  var activeTerm = localStorage.getItem(TERM_KEY) || filledTermKeys[0] || allTermKeys[0];
  var activeSub  = localStorage.getItem(SUB_KEY) || null;
  var allOpen = false;
  var doneMap = loadDone();

  // DOM
  var termBar    = document.getElementById('termBar');
  var subjectBar = document.getElementById('subjectBar');
  var ctrlBar    = document.getElementById('ctrlBar');
  var btnToggle  = document.getElementById('btnToggle');
  var ctrlProg   = document.getElementById('ctrlProgress');
  var lecBox     = document.getElementById('lectures');
  var emptyBox   = document.getElementById('emptyBox');

  var FILE_SLOTS = [
    { key: 'original_ppt',   icon: '📄', label: 'الباوربوينت الأصلي' },
    { key: 'translated_ppt', icon: '📝', label: 'الملخص / المترجم' },
    { key: 'my_quiz',        icon: '🎯', label: 'بنك الأسئلة — الأدمن' },
    { key: 'doctor_quiz',    icon: '🩺', label: 'بنك أسئلة الدكتورة' }
  ];

  // ─── Init ───
  function init() {
    renderTermBar();
    loadTerm(activeTerm);
    btnToggle.addEventListener('click', toggleAll);
  }

  // ─── Term Bar ───
  // Show filled terms as pills. If there are empty terms, show a native select dropdown.
  function renderTermBar() {
    termBar.innerHTML = '';

    // Render filled terms as pills
    filledTermKeys.forEach(function (k) {
      var pill = document.createElement('button');
      pill.className = 'term-pill' + (k === activeTerm ? ' active' : '');
      pill.textContent = terms[k].name;
      pill.setAttribute('data-t', k);
      pill.type = 'button';
      pill.addEventListener('click', function () {
        setTerm(k);
      });
      termBar.appendChild(pill);
    });

    // If empty terms exist, show a native select dropdown
    if (emptyTermKeys.length > 0) {
      var selectWrap = document.createElement('div');
      selectWrap.className = 'term-select-wrap';

      var select = document.createElement('select');
      select.className = 'term-select-native';
      select.id = 'termSelectNative';

      // Default placeholder option
      var placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'المزيد ▾';
      placeholder.disabled = true;
      select.appendChild(placeholder);

      emptyTermKeys.forEach(function (k) {
        var opt = document.createElement('option');
        opt.value = k;
        opt.textContent = terms[k].name;
        select.appendChild(opt);
      });

      // Style and select active term if it is in empty ones
      if (emptyTermKeys.indexOf(activeTerm) > -1) {
        select.value = activeTerm;
        select.classList.add('active');
      } else {
        select.value = '';
        select.classList.remove('active');
      }

      select.addEventListener('change', function () {
        var val = select.value;
        if (val) {
          setTerm(val);
        }
      });

      selectWrap.appendChild(select);
      termBar.appendChild(selectWrap);
    }
  }

  function setTerm(k) {
    activeTerm = k;
    localStorage.setItem(TERM_KEY, k);
    
    // Update pill highlights
    var pills = termBar.querySelectorAll('.term-pill');
    for (var i = 0; i < pills.length; i++) {
      pills[i].classList.toggle('active', pills[i].getAttribute('data-t') === k);
    }

    // Update select element state
    var select = document.getElementById('termSelectNative');
    if (select) {
      if (emptyTermKeys.indexOf(k) > -1) {
        select.value = k;
        select.classList.add('active');
      } else {
        select.value = '';
        select.classList.remove('active');
      }
    }

    loadTerm(k);
  }

  // ─── Load Term ───
  function loadTerm(tk) {
    var term = terms[tk];
    var subs = Object.keys(term.subjects);

    if (subs.length === 0) {
      subjectBar.style.display = 'none';
      ctrlBar.style.display = 'none';
      lecBox.innerHTML = '';
      lecBox.style.display = 'none';
      emptyBox.style.display = '';
      return;
    }

    emptyBox.style.display = 'none';
    subjectBar.style.display = '';
    ctrlBar.style.display = '';
    lecBox.style.display = '';

    if (!activeSub || !term.subjects[activeSub]) {
      activeSub = subs[0];
    }
    localStorage.setItem(SUB_KEY, activeSub);
    renderSubjects(tk, subs);
    renderLectures(tk, activeSub);
  }

  // ─── Subjects ───
  function renderSubjects(tk, subs) {
    subjectBar.innerHTML = '';
    subs.forEach(function (sk) {
      var chip = document.createElement('button');
      chip.className = 'sub-chip' + (sk === activeSub ? ' active' : '');
      chip.textContent = terms[tk].subjects[sk].name;
      chip.type = 'button';
      chip.setAttribute('data-s', sk);
      chip.addEventListener('click', function () {
        activeSub = sk;
        localStorage.setItem(SUB_KEY, sk);
        var chips = subjectBar.querySelectorAll('.sub-chip');
        for (var i = 0; i < chips.length; i++) {
          chips[i].classList.toggle('active', chips[i].getAttribute('data-s') === sk);
        }
        renderLectures(tk, sk);
      });
      subjectBar.appendChild(chip);
    });
  }

  // ─── Lectures ───
  function renderLectures(tk, sk) {
    var sub = terms[tk].subjects[sk];
    var lecs = sub.lectures || [];
    lecBox.innerHTML = '';
    allOpen = false;
    updateToggleBtn();

    if (lecs.length === 0) {
      lecBox.innerHTML = '<div class="empty-box"><div class="empty-icon">📚</div><p class="empty-title">المحاضرات جاية في السكة!</p><p class="empty-sub">سيتم رفع المحتوى أول بأول</p></div>';
      ctrlBar.style.display = 'none';
      return;
    }

    ctrlBar.style.display = '';

    lecs.forEach(function (lec) {
      var ck = tk + '_' + sk + '_' + lec.num;
      var isDone = !!doneMap[ck];

      // Card
      var card = document.createElement('div');
      card.className = 'lec-card' + (isDone ? ' done' : '');

      // Header
      var head = document.createElement('div');
      head.className = 'lec-head';

      var num = document.createElement('span');
      num.className = 'lec-num';
      num.textContent = lec.num;

      var title = document.createElement('span');
      title.className = 'lec-title';
      title.textContent = lec.title_ar;

      var acts = document.createElement('div');
      acts.className = 'lec-actions';

      // Checkbox
      var cbLabel = document.createElement('label');
      cbLabel.className = 'lec-cb';
      cbLabel.title = 'تمت المذاكرة';
      cbLabel.addEventListener('click', function (e) { e.stopPropagation(); });

      var cbIn = document.createElement('input');
      cbIn.type = 'checkbox';
      cbIn.checked = isDone;
      (function (key, cardRef, inp) {
        inp.addEventListener('change', function () {
          if (inp.checked) { doneMap[key] = true; } else { delete doneMap[key]; }
          saveDone();
          cardRef.classList.toggle('done', inp.checked);
          updateProgress(tk, sk);
        });
      })(ck, card, cbIn);

      var cbVis = document.createElement('span');
      cbVis.className = 'lec-cb-v';

      cbLabel.appendChild(cbIn);
      cbLabel.appendChild(cbVis);

      var chev = document.createElement('span');
      chev.className = 'lec-chev';
      chev.textContent = '▼';

      acts.appendChild(cbLabel);
      acts.appendChild(chev);

      head.appendChild(num);
      head.appendChild(title);
      head.appendChild(acts);

      // Body
      var body = document.createElement('div');
      body.className = 'lec-body';

      var inner = document.createElement('div');
      inner.className = 'lec-body-inner';

      FILE_SLOTS.forEach(function (slot) {
        var fp = (lec.files && lec.files[slot.key]) || '';
        inner.appendChild(makeFileRow(slot, fp));
      });

      body.appendChild(inner);

      // Click to toggle
      (function (c, b) {
        head.addEventListener('click', function () {
          toggleCard(c, b);
        });
      })(card, body);

      card.appendChild(head);
      card.appendChild(body);
      lecBox.appendChild(card);
    });

    updateProgress(tk, sk);
  }

  // ─── File Row ───
  function makeFileRow(slot, path) {
    var row = document.createElement('div');
    row.className = 'f-row';

    var label = document.createElement('div');
    label.className = 'f-label';
    label.innerHTML = '<span class="f-label-icon">' + slot.icon + '</span><span>' + slot.label + '</span>';

    var btns = document.createElement('div');
    btns.className = 'f-btns';

    if (path) {
      var url = encodeURI(path);

      var openBtn = document.createElement('a');
      openBtn.className = 'f-btn f-btn--open';
      openBtn.href = url;
      openBtn.target = '_blank';
      openBtn.rel = 'noopener';
      openBtn.innerHTML = '👁️ فتح';
      openBtn.addEventListener('click', function (e) { e.stopPropagation(); });

      var dlBtn = document.createElement('a');
      dlBtn.className = 'f-btn f-btn--dl';
      dlBtn.href = url;
      dlBtn.download = '';
      dlBtn.innerHTML = '📥 تحميل';
      dlBtn.addEventListener('click', function (e) { e.stopPropagation(); });

      btns.appendChild(openBtn);
      btns.appendChild(dlBtn);
    } else {
      var na = document.createElement('div');
      na.className = 'f-na';
      na.textContent = '⏳ غير متوفر';
      btns.appendChild(na);
    }

    row.appendChild(label);
    row.appendChild(btns);
    return row;
  }

  // ─── Accordion ───
  function toggleCard(card, body) {
    if (card.classList.contains('open')) {
      body.style.maxHeight = body.scrollHeight + 'px';
      body.offsetHeight; // reflow
      body.style.maxHeight = '0';
      card.classList.remove('open');
    } else {
      card.classList.add('open');
      body.style.maxHeight = body.scrollHeight + 'px';
      var onEnd = function () {
        body.style.maxHeight = 'none';
        body.removeEventListener('transitionend', onEnd);
      };
      body.addEventListener('transitionend', onEnd);
    }
  }

  function toggleAll() {
    var cards = lecBox.querySelectorAll('.lec-card');
    allOpen = !allOpen;
    for (var i = 0; i < cards.length; i++) {
      var b = cards[i].querySelector('.lec-body');
      if (allOpen) {
        cards[i].classList.add('open');
        b.style.maxHeight = b.scrollHeight + 'px';
        (function (bRef) {
          var fn = function () { bRef.style.maxHeight = 'none'; bRef.removeEventListener('transitionend', fn); };
          bRef.addEventListener('transitionend', fn);
        })(b);
      } else {
        b.style.maxHeight = b.scrollHeight + 'px';
        b.offsetHeight;
        b.style.maxHeight = '0';
        cards[i].classList.remove('open');
      }
    }
    updateToggleBtn();
  }

  function updateToggleBtn() {
    btnToggle.textContent = allOpen ? '📁 إغلاق الكل' : '📂 عرض الكل';
  }

  // ─── Done state ───
  function loadDone() {
    try { return JSON.parse(localStorage.getItem(DONE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveDone() {
    localStorage.setItem(DONE_KEY, JSON.stringify(doneMap));
  }

  function updateProgress(tk, sk) {
    var sub = terms[tk].subjects[sk];
    if (!sub) return;
    var total = sub.lectures.length;
    var done = 0;
    sub.lectures.forEach(function (lec) {
      if (doneMap[tk + '_' + sk + '_' + lec.num]) done++;
    });
    if (total > 0) {
      ctrlProg.innerHTML = '<b>' + done + '</b> / ' + total + ' مكتملة';
    } else {
      ctrlProg.innerHTML = '';
    }
  }

  // ─── Boot ───
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
