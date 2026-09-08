/* Frontend Interview Drills - client. Talks to the JSON-file API in server.js. */
(function () {
  "use strict";

  /* ------------------------------------------------------------- helpers */

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var ICONS = {
    check: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5L6.2 12 13 4"/></svg>',
    chev: '<svg class="chev" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4l7 6-7 6"/></svg>',
    star: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .74 4.3L8 11.6l-3.84 2-.73-4.3-3.1-3 4.3-.6z"/></svg>',
    starOn: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .74 4.3L8 11.6l-3.84 2-.73-4.3-3.1-3 4.3-.6z"/></svg>',
    trash: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.8 4h10.4M6.4 4V2.6h3.2V4M4.2 4l.6 9h6.4l.6-9M6.6 6.4v4.2M9.4 6.4v4.2"/></svg>',
    pencil: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11.2 2.4l2.4 2.4L5.6 12.8 2.4 13.6l.8-3.2z"/></svg>'
  };

  var toastEl = $("#toast");
  var toastTimer = null;
  function toast(message, isError) {
    toastEl.textContent = message;
    toastEl.classList.toggle("error", !!isError);
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, isError ? 4500 : 1900);
  }

  function api(path, method, body) {
    return fetch("/api" + path, {
      method: method || "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw new Error(data.error || ("Request failed (" + res.status + ")"));
        return data;
      });
    });
  }

  function debounce(fn, ms) {
    var t = null;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  /* --------------------------------------------------------------- state */

  var db = { categories: [], questions: [] };
  var filter = "all";
  var search = "";
  var openQuestions = new Set();
  var collapsedCats = new Set(readJson("drills.collapsed", []));

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function sortedCategories() {
    return db.categories.slice().sort(function (a, b) { return a.order - b.order; });
  }
  function questionsOf(categoryId) {
    return db.questions
      .filter(function (q) { return q.categoryId === categoryId; })
      .sort(function (a, b) { return a.order - b.order; });
  }
  function localQuestion(id) {
    return db.questions.find(function (q) { return q.id === id; }) || null;
  }

  function matchesFilter(q) {
    if (filter === "todo") return q.status !== "reviewed";
    if (filter === "done") return q.status === "reviewed";
    if (filter === "starred") return q.starred === true;
    if (filter === "unanswered") return !q.answer.trim();
    return true;
  }
  function matchesSearch(q) {
    if (!search) return true;
    var needle = search.toLowerCase();
    return q.text.toLowerCase().indexOf(needle) !== -1 || q.answer.toLowerCase().indexOf(needle) !== -1;
  }
  function isVisible(q) { return matchesFilter(q) && matchesSearch(q); }

  /* -------------------------------------------------------------- render */

  var categoriesEl = $("#categories");
  var jumpEl = $("#jumpNav");
  var emptyEl = $("#emptyState");

  function render() {
    categoriesEl.textContent = "";
    jumpEl.textContent = "";

    sortedCategories().forEach(function (cat) {
      categoriesEl.appendChild(renderCategory(cat));

      var link = document.createElement("a");
      link.href = "#cat-" + cat.id;
      link.innerHTML = cat.code + ' <span class="n"></span>';
      $(".n", link).textContent = questionsOf(cat.id).length;
      link.addEventListener("click", function () {
        var det = document.getElementById("cat-" + cat.id);
        if (det) { det.open = true; collapsedCats.delete(cat.id); writeJson("drills.collapsed", Array.from(collapsedCats)); }
      });
      jumpEl.appendChild(link);
    });

    categoriesEl.appendChild(renderAddCategory());
    refreshCounts();
    applyFilter();
  }

  function renderCategory(cat) {
    var questions = questionsOf(cat.id);

    var det = document.createElement("details");
    det.className = "cat";
    det.id = "cat-" + cat.id;
    det.open = !collapsedCats.has(cat.id);
    det.dataset.categoryId = cat.id;

    var summary = document.createElement("summary");
    var tag = document.createElement("span");
    tag.className = "catTag";
    tag.textContent = cat.code;
    var title = document.createElement("span");
    title.className = "catTitle";
    title.textContent = cat.title;
    title.title = "Double-click to rename";
    title.addEventListener("dblclick", function (ev) {
      ev.preventDefault();
      renameCategory(cat);
    });
    var count = document.createElement("span");
    count.className = "catCount";
    count.dataset.countFor = cat.id;
    count.textContent = "0/" + questions.length;

    var del = document.createElement("button");
    del.className = "iconbtn danger";
    del.type = "button";
    del.title = "Delete category and its questions";
    del.setAttribute("aria-label", "Delete category " + cat.title);
    del.innerHTML = ICONS.trash;
    del.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      deleteCategory(cat);
    });

    summary.appendChild(tag);
    summary.appendChild(title);
    summary.appendChild(count);
    summary.appendChild(del);
    summary.insertAdjacentHTML("beforeend", ICONS.chev);
    det.appendChild(summary);

    det.addEventListener("toggle", function () {
      if (det.open) collapsedCats.delete(cat.id); else collapsedCats.add(cat.id);
      writeJson("drills.collapsed", Array.from(collapsedCats));
    });

    var body = document.createElement("div");
    body.className = "catBody";
    questions.forEach(function (q, index) {
      body.appendChild(renderQuestion(cat, q, index));
    });
    body.appendChild(renderAddQuestion(cat));
    det.appendChild(body);

    return det;
  }

  function renderQuestion(cat, q, index) {
    var displayId = cat.code + "-" + String(index + 1).padStart(2, "0");

    var row = document.createElement("div");
    row.className = "qrow";
    row.dataset.id = q.id;
    row.classList.toggle("done", q.status === "reviewed");
    var isOpen = openQuestions.has(q.id);
    row.classList.toggle("open", isOpen);

    /* head */
    var head = document.createElement("div");
    head.className = "qhead";

    var check = document.createElement("button");
    check.className = "qcheck";
    check.type = "button";
    check.title = "Mark reviewed";
    check.setAttribute("aria-label", "Mark " + displayId + " as reviewed");
    check.innerHTML = ICONS.check;
    check.addEventListener("click", function () { toggleReviewed(q.id); });

    var idSpan = document.createElement("span");
    idSpan.className = "qid mono";
    idSpan.textContent = displayId;

    var main = document.createElement("div");
    main.className = "qmain";
    var text = document.createElement("div");
    text.className = "qtext";
    text.textContent = q.text;
    main.appendChild(text);

    var flags = document.createElement("div");
    flags.className = "qflags";
    if (q.answer.trim()) {
      var answered = document.createElement("span");
      answered.className = "flag";
      answered.textContent = "answered";
      flags.appendChild(answered);
    } else {
      var blank = document.createElement("span");
      blank.className = "flag muted";
      blank.textContent = "no answer yet";
      flags.appendChild(blank);
    }
    main.appendChild(flags);
    main.addEventListener("click", function () { toggleOpen(q.id); });

    var tools = document.createElement("div");
    tools.className = "qtools";

    var star = document.createElement("button");
    star.className = "iconbtn" + (q.starred ? " starred" : "");
    star.type = "button";
    star.title = q.starred ? "Unstar" : "Star this question";
    star.innerHTML = q.starred ? ICONS.starOn : ICONS.star;
    star.addEventListener("click", function () { toggleStar(q.id); });

    var edit = document.createElement("button");
    edit.className = "iconbtn";
    edit.type = "button";
    edit.title = "Edit question and answer";
    edit.innerHTML = ICONS.pencil;
    edit.addEventListener("click", function () { toggleOpen(q.id); });

    tools.appendChild(star);
    tools.appendChild(edit);

    head.appendChild(check);
    head.appendChild(idSpan);
    head.appendChild(main);
    head.appendChild(tools);
    row.appendChild(head);

    /* body */
    var body = document.createElement("div");
    body.className = "qbody";
    body.hidden = !isOpen;

    var qLabel = document.createElement("p");
    qLabel.className = "qlabel";
    qLabel.textContent = "Question";
    var qArea = document.createElement("textarea");
    qArea.className = "textline";
    qArea.rows = 2;
    qArea.value = q.text;

    var aLabel = document.createElement("p");
    aLabel.className = "qlabel";
    aLabel.style.marginTop = "12px";
    aLabel.textContent = "Your answer";
    var aArea = document.createElement("textarea");
    aArea.className = "answer";
    aArea.placeholder = "Write the answer in your own words — the version you would actually say out loud.";
    aArea.value = q.answer;

    var foot = document.createElement("div");
    foot.className = "qbodyfoot";

    var hint = document.createElement("span");
    hint.className = "savehint";
    hint.textContent = "";

    var moveLabel = document.createElement("span");
    moveLabel.textContent = "Category:";
    var select = document.createElement("select");
    select.className = "btn small";
    sortedCategories().forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.code + " · " + c.title;
      if (c.id === q.categoryId) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener("change", function () {
      patchQuestion(q.id, { categoryId: select.value }).then(render);
    });

    var removeBtn = document.createElement("button");
    removeBtn.className = "iconbtn danger";
    removeBtn.type = "button";
    removeBtn.title = "Delete this question";
    removeBtn.innerHTML = ICONS.trash;
    removeBtn.addEventListener("click", function () { deleteQuestion(q); });

    var spacer = document.createElement("span");
    spacer.className = "spacer";

    foot.appendChild(hint);
    foot.appendChild(spacer);
    foot.appendChild(moveLabel);
    foot.appendChild(select);
    foot.appendChild(removeBtn);

    var saveField = function (field, el) {
      var flush = function () {
        var value = el.value;
        var current = localQuestion(q.id);
        if (!current || current[field] === value) return;
        if (field === "text" && !value.trim()) { el.value = current.text; return; }
        hint.textContent = "saving…";
        hint.className = "savehint saving";
        var payload = {};
        payload[field] = value;
        patchQuestion(q.id, payload).then(function () {
          hint.textContent = "saved";
          hint.className = "savehint saved";
          setTimeout(function () {
            if (hint.textContent === "saved") { hint.textContent = ""; hint.className = "savehint"; }
          }, 1600);
          updateFlags(q.id);
          refreshCounts();
        }).catch(function (err) {
          hint.textContent = "not saved";
          hint.className = "savehint";
          toast(err.message, true);
        });
      };
      el.addEventListener("input", debounce(flush, 600));
      el.addEventListener("blur", flush);
    };
    saveField("text", qArea);
    saveField("answer", aArea);

    body.appendChild(qLabel);
    body.appendChild(qArea);
    body.appendChild(aLabel);
    body.appendChild(aArea);
    body.appendChild(foot);
    row.appendChild(body);

    return row;
  }

  function renderAddQuestion(cat) {
    var wrap = document.createElement("div");
    wrap.className = "addrow";

    var button = document.createElement("button");
    button.className = "addbtn";
    button.type = "button";
    button.textContent = "+ Add a question to " + cat.title;

    var form = document.createElement("form");
    form.className = "addform";
    form.hidden = true;
    var area = document.createElement("textarea");
    area.className = "textline";
    area.rows = 2;
    area.placeholder = "New question…";
    var submit = document.createElement("button");
    submit.className = "btn primary";
    submit.type = "submit";
    submit.textContent = "Add";
    form.appendChild(area);
    form.appendChild(submit);

    button.addEventListener("click", function () {
      button.hidden = true;
      form.hidden = false;
      area.focus();
    });

    area.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); form.requestSubmit(); }
      if (ev.key === "Escape") { form.hidden = true; button.hidden = false; area.value = ""; }
    });

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var text = area.value.trim();
      if (!text) return;
      api("/questions", "POST", { categoryId: cat.id, text: text }).then(function (created) {
        db.questions.push(created);
        area.value = "";
        render();
        toast("Question added");
        // Keep the inline composer open where it was, ready for the next one.
        var det = document.getElementById("cat-" + cat.id);
        if (det) {
          var nextBtn = $(".addbtn", det);
          if (nextBtn) nextBtn.click();
        }
      }).catch(function (err) { toast(err.message, true); });
    });

    wrap.appendChild(button);
    wrap.appendChild(form);
    return wrap;
  }

  function renderAddCategory() {
    var wrap = document.createElement("div");
    wrap.className = "addrow";
    wrap.id = "addCategoryRow";

    var form = document.createElement("form");
    form.className = "addform";
    form.hidden = true;

    var titleInput = document.createElement("input");
    titleInput.className = "textline";
    titleInput.placeholder = "New category name, e.g. System Design";

    var codeInput = document.createElement("input");
    codeInput.className = "textline";
    codeInput.placeholder = "Code";
    codeInput.style.maxWidth = "90px";
    codeInput.maxLength = 4;

    var submit = document.createElement("button");
    submit.className = "btn primary";
    submit.type = "submit";
    submit.textContent = "Add";

    form.appendChild(titleInput);
    form.appendChild(codeInput);
    form.appendChild(submit);

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var title = titleInput.value.trim();
      if (!title) return;
      api("/categories", "POST", { title: title, code: codeInput.value.trim() }).then(function (created) {
        db.categories.push(created);
        titleInput.value = "";
        codeInput.value = "";
        form.hidden = true;
        render();
        toast("Category added");
      }).catch(function (err) { toast(err.message, true); });
    });

    titleInput.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") form.hidden = true;
    });

    wrap.appendChild(form);
    return wrap;
  }

  /* -------------------------------------------------------------- mutate */

  function patchQuestion(id, payload) {
    return api("/questions/" + id, "PATCH", payload).then(function (updated) {
      var index = db.questions.findIndex(function (q) { return q.id === id; });
      if (index !== -1) db.questions[index] = updated;
      return updated;
    });
  }

  function toggleReviewed(id) {
    var q = localQuestion(id);
    if (!q) return;
    var next = q.status === "reviewed" ? "todo" : "reviewed";
    patchQuestion(id, { status: next }).then(function (updated) {
      var row = categoriesEl.querySelector('.qrow[data-id="' + id + '"]');
      if (row) row.classList.toggle("done", updated.status === "reviewed");
      refreshCounts();
      applyFilter();
    }).catch(function (err) { toast(err.message, true); });
  }

  function toggleStar(id) {
    var q = localQuestion(id);
    if (!q) return;
    patchQuestion(id, { starred: !q.starred }).then(function (updated) {
      var row = categoriesEl.querySelector('.qrow[data-id="' + id + '"]');
      if (row) {
        var btn = $(".qtools .iconbtn", row);
        btn.classList.toggle("starred", updated.starred);
        btn.innerHTML = updated.starred ? ICONS.starOn : ICONS.star;
        btn.title = updated.starred ? "Unstar" : "Star this question";
      }
      applyFilter();
    }).catch(function (err) { toast(err.message, true); });
  }

  function toggleOpen(id) {
    var row = categoriesEl.querySelector('.qrow[data-id="' + id + '"]');
    if (!row) return;
    var body = $(".qbody", row);
    var willOpen = body.hidden;
    body.hidden = !willOpen;
    row.classList.toggle("open", willOpen);
    if (willOpen) {
      openQuestions.add(id);
      var area = $("textarea.answer", body);
      if (area) area.focus();
    } else {
      openQuestions.delete(id);
    }
  }

  function updateFlags(id) {
    var q = localQuestion(id);
    var row = categoriesEl.querySelector('.qrow[data-id="' + id + '"]');
    if (!q || !row) return;
    var flag = $(".qflags .flag", row);
    if (!flag) return;
    var answered = !!q.answer.trim();
    flag.textContent = answered ? "answered" : "no answer yet";
    flag.className = answered ? "flag" : "flag muted";
  }

  function deleteQuestion(q) {
    if (!confirm("Delete this question?\n\n" + q.text)) return;
    api("/questions/" + q.id, "DELETE").then(function () {
      db.questions = db.questions.filter(function (item) { return item.id !== q.id; });
      openQuestions.delete(q.id);
      render();
      toast("Question deleted");
    }).catch(function (err) { toast(err.message, true); });
  }

  function deleteCategory(cat) {
    var count = questionsOf(cat.id).length;
    if (!confirm("Delete the category \"" + cat.title + "\" and its " + count + " question(s)?\n\nA backup of the database is saved to data/backups first.")) return;
    api("/categories/" + cat.id, "DELETE").then(function () {
      db.questions = db.questions.filter(function (q) { return q.categoryId !== cat.id; });
      db.categories = db.categories.filter(function (c) { return c.id !== cat.id; });
      render();
      toast("Category deleted");
    }).catch(function (err) { toast(err.message, true); });
  }

  function renameCategory(cat) {
    var title = prompt("Category name:", cat.title);
    if (title === null) return;
    title = title.trim();
    if (!title) return;
    var code = prompt("Short code (up to 4 characters):", cat.code);
    if (code === null) code = cat.code;
    api("/categories/" + cat.id, "PATCH", { title: title, code: code.trim() || cat.code }).then(function (updated) {
      var index = db.categories.findIndex(function (c) { return c.id === cat.id; });
      if (index !== -1) db.categories[index] = updated;
      render();
    }).catch(function (err) { toast(err.message, true); });
  }

  /* ------------------------------------------------------ counts, filter */

  var statReviewed = $("#statReviewed");
  var statAnswered = $("#statAnswered");
  var statTrack = $("#statTrack");

  function refreshCounts() {
    var doneAll = 0;
    var answeredAll = 0;

    db.categories.forEach(function (cat) {
      var list = questionsOf(cat.id);
      var doneCat = list.filter(function (q) { return q.status === "reviewed"; }).length;
      var el = categoriesEl.querySelector('[data-count-for="' + cat.id + '"]');
      if (el) el.textContent = doneCat + "/" + list.length;
      doneAll += doneCat;
    });

    db.questions.forEach(function (q) { if (q.answer.trim()) answeredAll++; });

    var total = db.questions.length;
    statReviewed.textContent = doneAll + " / " + total;
    statAnswered.textContent = String(answeredAll);
    statTrack.style.width = (total ? (doneAll / total * 100) : 0) + "%";
  }

  function applyFilter() {
    var anyVisible = false;

    $$("details.cat", categoriesEl).forEach(function (det) {
      var categoryId = det.dataset.categoryId;
      var visibleInCat = 0;

      $$(".qrow", det).forEach(function (row) {
        var q = localQuestion(row.dataset.id);
        var show = q ? isVisible(q) : false;
        row.hidden = !show;
        if (show) visibleInCat++;
      });

      var filtering = filter !== "all" || search !== "";
      var list = questionsOf(categoryId);
      // Hide a whole category only while filtering, so empty categories stay
      // reachable (and addable to) in the default view.
      det.hidden = filtering && visibleInCat === 0 && list.length > 0;
      var addRow = $(".addrow", det);
      if (addRow) addRow.hidden = filtering;
      if (visibleInCat > 0) anyVisible = true;
      if (filtering && visibleInCat > 0) det.open = true;
    });

    var addCat = $("#addCategoryRow");
    if (addCat) addCat.hidden = false;

    emptyEl.hidden = anyVisible || db.questions.length === 0;
  }

  /* ---------------------------------------------------------- drill mode */

  var drillOverlay = $("#drillOverlay");
  var drillQueue = [];
  var drillIndex = 0;

  function startDrill() {
    // Drop focus from whatever opened the drill, so Space activates the drill
    // rather than re-clicking that button.
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    drillQueue = db.questions.filter(isVisible);
    if (!drillQueue.length) drillQueue = db.questions.slice();
    if (!drillQueue.length) { toast("No questions to drill yet", true); return; }
    for (var i = drillQueue.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = drillQueue[i]; drillQueue[i] = drillQueue[j]; drillQueue[j] = tmp;
    }
    drillIndex = 0;
    drillOverlay.hidden = false;
    showDrill();
  }

  function showDrill() {
    if (drillIndex >= drillQueue.length) { closeDrill(); toast("Deck finished — nice."); return; }
    var q = drillQueue[drillIndex];
    var fresh = localQuestion(q.id);
    if (!fresh) { drillIndex++; return showDrill(); }
    var cat = db.categories.find(function (c) { return c.id === fresh.categoryId; });

    $("#drillTag").textContent = cat ? cat.code : "??";
    $("#drillMeta").textContent = (drillIndex + 1) + " of " + drillQueue.length +
      (fresh.status === "reviewed" ? " · reviewed" : "");
    $("#drillQuestion").textContent = fresh.text;

    var answerEl = $("#drillAnswer");
    var hasAnswer = !!fresh.answer.trim();
    answerEl.textContent = hasAnswer ? fresh.answer : "You have not written an answer for this one yet.";
    answerEl.className = hasAnswer ? "answerText" : "answerText blank";
    $("#drillAnswerWrap").hidden = true;
    $("#drillReveal").hidden = false;
  }

  function revealDrill() {
    $("#drillAnswerWrap").hidden = false;
    $("#drillReveal").hidden = true;
  }

  function closeDrill() {
    drillOverlay.hidden = true;
  }

  function drillAdvance(markReviewed) {
    var q = drillQueue[drillIndex];
    var done = markReviewed && q
      ? patchQuestion(q.id, { status: "reviewed" }).catch(function (err) { toast(err.message, true); })
      : Promise.resolve();
    done.then(function () {
      if (markReviewed) {
        var row = categoriesEl.querySelector('.qrow[data-id="' + q.id + '"]');
        if (row) row.classList.add("done");
        refreshCounts();
      }
      drillIndex++;
      showDrill();
    });
  }

  $("#startDrill").addEventListener("click", startDrill);
  $("#drillClose").addEventListener("click", closeDrill);
  $("#drillReveal").addEventListener("click", revealDrill);
  $("#drillSkip").addEventListener("click", function () { drillAdvance(false); });
  $("#drillGot").addEventListener("click", function () { drillAdvance(true); });
  drillOverlay.addEventListener("click", function (ev) {
    if (ev.target === drillOverlay) closeDrill();
  });

  /* ------------------------------------------------------------ toolbar */

  $$(".chip[data-filter]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      filter = btn.dataset.filter;
      $$(".chip[data-filter]").forEach(function (other) {
        other.setAttribute("aria-pressed", other === btn ? "true" : "false");
      });
      applyFilter();
    });
  });

  var searchInput = $("#search");
  searchInput.addEventListener("input", debounce(function () {
    search = searchInput.value.trim();
    applyFilter();
  }, 150));

  $("#expandAll").addEventListener("click", function () {
    $$("details.cat").forEach(function (d) { d.open = true; });
    collapsedCats.clear();
    writeJson("drills.collapsed", []);
  });
  $("#collapseAll").addEventListener("click", function () {
    collapsedCats.clear();
    $$("details.cat").forEach(function (d) { d.open = false; collapsedCats.add(d.dataset.categoryId); });
    writeJson("drills.collapsed", Array.from(collapsedCats));
  });

  $("#addCategory").addEventListener("click", function () {
    var row = $("#addCategoryRow");
    var form = $("form", row);
    form.hidden = false;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    $("input", form).focus();
  });

  $("#resetProgress").addEventListener("click", function () {
    if (!confirm("Clear every reviewed mark?\n\nYour written answers are kept. A backup is saved to data/backups first.")) return;
    api("/reset-progress", "POST", { wipeAnswers: false }).then(function () {
      db.questions.forEach(function (q) { q.status = "todo"; q.reviewedAt = null; });
      render();
      toast("Progress reset");
    }).catch(function (err) { toast(err.message, true); });
  });

  $("#exportBtn").addEventListener("click", function () {
    var blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "drills-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });

  var importFile = $("#importFile");
  $("#importBtn").addEventListener("click", function () { importFile.click(); });
  importFile.addEventListener("change", function () {
    var file = importFile.files && importFile.files[0];
    if (!file) return;
    if (!confirm("Replace the whole database with " + file.name + "?\n\nA backup of the current data is saved to data/backups first.")) {
      importFile.value = "";
      return;
    }
    file.text().then(function (text) {
      return api("/import", "POST", { db: JSON.parse(text) });
    }).then(function (imported) {
      db = imported;
      render();
      toast("Imported " + db.questions.length + " questions");
    }).catch(function (err) {
      toast(err.message || "Could not read that file", true);
    }).then(function () { importFile.value = ""; });
  });

  /* -------------------------------------------------------------- theme */

  var THEME_KEY = "drills.theme";
  function applyTheme(value) {
    document.documentElement.setAttribute("data-theme", value === "system" ? "" : value);
  }
  var theme = localStorage.getItem(THEME_KEY) || "system";
  applyTheme(theme);
  $("#themeBtn").addEventListener("click", function () {
    theme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
    toast("Theme: " + theme);
  });

  /* ---------------------------------------------------------- shortcuts */

  document.addEventListener("keydown", function (ev) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName);

    if (!drillOverlay.hidden) {
      if (ev.key === "Escape") { ev.preventDefault(); closeDrill(); }
      else if (ev.key === " " || ev.code === "Space" || ev.key === "Enter") {
        ev.preventDefault();
        if ($("#drillAnswerWrap").hidden) revealDrill(); else drillAdvance(true);
      } else if (ev.key === "ArrowRight") { ev.preventDefault(); drillAdvance(false); }
      return;
    }

    if (typing) {
      if (ev.key === "Escape") ev.target.blur();
      return;
    }
    if (ev.key === "/") { ev.preventDefault(); searchInput.focus(); }
    if (ev.key === "d") { ev.preventDefault(); startDrill(); }
  });

  /* --------------------------------------------------------------- boot */

  api("/db").then(function (data) {
    db = data;
    render();
  }).catch(function (err) {
    toast("Could not load the database: " + err.message, true);
  });
})();
