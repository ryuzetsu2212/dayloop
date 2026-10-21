"use strict";
/* HabitStreak - habit tracker, penyimpanan lokal (localStorage key: habitstreak_v1) */

var LS_KEY = "habitstreak_v1";

var COLORS = ["#10B981", "#14B8A6", "#38BDF8", "#8B5CF6", "#F59E0B", "#F43F5E"];
var ICONS = ["\u{1F3C3}", "\u{1F4DA}", "\u{1F4AA}", "\u{1F9D8}", "\u{1F6B6}", "\u{1F4A7}",
  "\u{1F34E}", "\u{1F957}", "\u{1F3B5}", "\u{1F3A8}", "\u{1F4BB}", "\u{270D}",
  "\u{1F4B0}", "\u{1F9F9}", "\u{1F6BF}", "\u{1F6CC}", "\u{23F0}", "\u{1F4CC}",
  "\u{1F33F}", "\u{1F436}", "\u{26BD}", "\u{1F3AE}", "\u{1F4F1}", "\u{2764}"];

var state = { habits: [], checkins: {} };
var editingId = null;
var selIcon = ICONS[0];
var selColor = COLORS[0];
var selectedDay = null;

/* ---------- util tanggal ---------- */
function pad(n) { return (n < 10 ? "0" : "") + n; }
function dateKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function todayKey() { return dateKey(new Date()); }
function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
function parseKey(k) { var p = k.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
var NAMA_HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
var NAMA_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
  "Agustus", "September", "Oktober", "November", "Desember"];
function prettyDate(d) {
  return NAMA_HARI[d.getDay()] + ", " + d.getDate() + " " + NAMA_BULAN[d.getMonth()] + " " + d.getFullYear();
}
function uid() { return "h" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

/* ---------- storage ---------- */
function load() {
  try {
    var raw = localStorage.getItem(LS_KEY);
    if (raw) {
      var d = JSON.parse(raw);
      if (d && Array.isArray(d.habits) && d.checkins) state = d;
    }
  } catch (e) { /* abaikan, mulai dari kosong */ }
  if (!state.notes) state.notes = {};
  if (!state.theme) state.theme = "dark";
  state.habits.forEach(function (h) { if (typeof h.archived === "undefined") h.archived = false; });
}
function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
  syncReminders();
}
function activeHabits() { return state.habits.filter(function (h) { return !h.archived; }); }
function renderAll() { renderToday(); renderCalendar(); renderStats(); }

/* ---------- tema ---------- */
function applyTheme() {
  document.body.classList.toggle("light", state.theme === "light");
  var b = document.getElementById("btnTheme");
  if (b) b.innerHTML = state.theme === "light" ? "&#9789;" : "&#9728;";
}
function toggleTheme() {
  state.theme = state.theme === "light" ? "dark" : "light";
  save();
  applyTheme();
}

/* ---------- bridge notifikasi native ---------- */
function syncReminders() {
  if (!window.AndroidBridge) return;
  try {
    state.habits.forEach(function (h) {
      if (h.reminderTime) {
        var p = h.reminderTime.split(":");
        window.AndroidBridge.scheduleReminder(h.id, h.name, h.icon, parseInt(p[0], 10), parseInt(p[1], 10));
      } else {
        window.AndroidBridge.cancelReminder(h.id);
      }
    });
  } catch (e) {}
}
function cancelReminderNative(id) {
  if (!window.AndroidBridge) return;
  try { window.AndroidBridge.cancelReminder(id); } catch (e) {}
}

/* ---------- streak ---------- */
function isDone(habitId, key) {
  var arr = state.checkins[key];
  return !!arr && arr.indexOf(habitId) !== -1;
}
function streakOf(habitId) {
  var count = 0;
  var d = new Date();
  if (!isDone(habitId, dateKey(d))) d = addDays(d, -1); // hari ini belum -> mulai dari kemarin
  while (isDone(habitId, dateKey(d))) { count++; d = addDays(d, -1); }
  return count;
}
function weekStart() {
  // Senin minggu berjalan
  var d = new Date();
  return addDays(d, -((d.getDay() + 6) % 7));
}
function weekDone(habitId) {
  // jumlah repetisi dari Senin sampai hari ini
  var c = 0, s = weekStart(), now = new Date();
  var days = Math.round((now.getTime() - s.getTime()) / 864e5);
  for (var i = 0; i <= days; i++) c += countOf(habitId, dateKey(addDays(s, i)));
  return c;
}

/* ---------- render: hari ini ---------- */
function renderToday() {
  var list = document.getElementById("todayList");
  var empty = document.getElementById("todayEmpty");
  var key = todayKey();
  var habits = activeHabits();
  list.innerHTML = "";
  if (habits.length === 0) { empty.classList.remove("hidden"); }
  else { empty.classList.add("hidden"); }

  var doneCount = 0;
  habits.forEach(function (h) {
    var n = countOf(h.id, key);
    var done = n > 0;
    if (done) doneCount++;
    var st = streakOf(h.id);
    var wd = weekDone(h.id);
    var row = document.createElement("div");
    row.className = "habit";
    row.innerHTML =
      '<div class="colorbar" style="background:' + h.color + '"></div>' +
      '<div class="hicon">' + h.icon + "</div>" +
      '<div class="hinfo"><div class="hname">' + esc(h.name) + "</div>" +
      '<div class="hsub">' + (st > 0 ? '<span class="fire">\u{1F525} ' + st + " hari</span> \u00B7 " : "") +
      wd + "/" + h.targetPerWeek + " minggu ini" + (h.reminderTime ? " \u00B7 \u23F0 " + h.reminderTime : "") + "</div></div>" +
      '<button class="editbtn" data-edit="' + h.id + '" aria-label="Ubah">\u270E</button>' +
      '<div class="stepper"><button class="stepbtn" data-dec="' + h.id + '" aria-label="Kurangi">\u2212</button>' +
      '<button class="stepbtn plus" data-inc="' + h.id + '" aria-label="Tambah">+</button></div>';
    list.appendChild(row);
  });

  var hs = document.getElementById("headerStreak");
  hs.textContent = doneCount + "/" + habits.length + " hari ini";

  list.querySelectorAll("[data-inc]").forEach(function (el) {
    el.addEventListener("click", function () { bump(el.getAttribute("data-inc"), 1); });
  });
  list.querySelectorAll("[data-dec]").forEach(function (el) {
    el.addEventListener("click", function () { bump(el.getAttribute("data-dec"), -1); });
  });
  list.querySelectorAll("[data-edit]").forEach(function (el) {
    el.addEventListener("click", function (ev) { ev.stopPropagation(); openModal(el.getAttribute("data-edit")); });
  });
}
function countOf(habitId, key) {
  var arr = state.checkins[key] || [], n = 0;
  for (var i = 0; i < arr.length; i++) if (arr[i] === habitId) n++;
  return n;
}
function bump(habitId, delta) {
  var key = todayKey();
  var arr = state.checkins[key] || [];
  if (delta > 0) { arr.push(habitId); }
  else {
    var i = arr.indexOf(habitId);
    if (i !== -1) arr.splice(i, 1);
  }
  if (arr.length) state.checkins[key] = arr; else delete state.checkins[key];
  save();
  renderAll();
}

/* ---------- render: kalender ---------- */
var calY = 0, calM = 0;
var calCells = [];
var MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
function renderCalendar() {
  var now = new Date();
  if (!calY) { calY = now.getFullYear(); calM = now.getMonth(); }
  document.getElementById("calTitle").textContent = MONTHS[calM] + " " + calY;
  var grid = document.getElementById("calGrid");
  grid.innerHTML = "";
  calCells = [];
  ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].forEach(function (d) {
    var e = document.createElement("div");
    e.className = "cal-dow"; e.textContent = d;
    grid.appendChild(e);
  });
  var first = new Date(calY, calM, 1).getDay();
  var dim = new Date(calY, calM + 1, 0).getDate();
  for (var i = 0; i < first; i++) {
    var b = document.createElement("div");
    b.className = "cal-day blank";
    grid.appendChild(b);
  }
  var totalHabits = state.habits.length;
  var tk = todayKey();
  for (var d = 1; d <= dim; d++) {
    var key = dateKey(new Date(calY, calM, d));
    var n = (state.checkins[key] || []).length;
    var c = document.createElement("div");
    c.className = "cal-day" + (n > 0 && totalHabits > 0 ? " has l" + Math.min(4, Math.ceil(n / totalHabits * 4)) : "");
    if (key === tk) c.classList.add("today");
    if (key === selectedDay) c.classList.add("sel");
    c.textContent = d;
    (function (cell, k) {
      cell.addEventListener("click", function () { selectDay(k, cell); });
    })(c, key);
    grid.appendChild(c);
    calCells.push({ cell: c, key: key });
  }
  if (!selectedDay) selectedDay = tk;
  var found = calCells.filter(function (x) { return x.key === selectedDay; })[0];
  if (found) selectDay(selectedDay, found.cell);
  else document.getElementById("dayDetail").classList.add("hidden");
}
function calMove(delta) {
  calM += delta;
  if (calM < 0) { calM = 11; calY--; }
  if (calM > 11) { calM = 0; calY++; }
  renderCalendar();
}
function selectDay(key, cell) {
  selectedDay = key;
  calCells.forEach(function (x) { x.cell.classList.remove("sel"); });
  if (cell) cell.classList.add("sel");
  var box = document.getElementById("dayDetail");
  box.classList.remove("hidden");
  var done = state.checkins[key] || [];
  var html = "<h3>" + prettyDate(parseKey(key)) + " &mdash; " + done.length + " habit selesai</h3>";
  if (done.length === 0) {
    html += '<p class="none">Tidak ada habit yang diselesaikan hari itu.</p>';
  } else {
    html += "<ul>";
    var counts = {};
    done.forEach(function (id) { counts[id] = (counts[id] || 0) + 1; });
    Object.keys(counts).forEach(function (id) {
      var h = state.habits.filter(function (x) { return x.id === id; })[0];
      var note = (state.notes[key] || {})[id];
      html += "<li><span>" + (h ? h.icon : "\u2753") + "</span><span>" + esc(h ? h.name : "(habit dihapus)") +
        (counts[id] > 1 ? " \u00D7" + counts[id] : "") +
        (note ? '<span class="day-note">\u201C' + esc(note) + "\u201D</span>" : "") + "</span></li>";
    });
    html += "</ul>";
  }
  box.innerHTML = html;
}

/* ---------- render: statistik ---------- */
function completionRate(days) {
  var habits = activeHabits();
  if (habits.length === 0) return 0;
  var now = new Date(), total = 0;
  for (var i = 0; i < days; i++) total += (state.checkins[dateKey(addDays(now, -i))] || []).length;
  var possible = habits.length * days;
  return Math.min(100, Math.round(total / possible * 100));
}
function totalCheckins() {
  var t = 0;
  Object.keys(state.checkins).forEach(function (k) { t += state.checkins[k].length; });
  return t;
}
function longestStreakEver(habitId) {
  // streak terpanjang sepanjang riwayat
  var keys = Object.keys(state.checkins).filter(function (k) { return state.checkins[k].indexOf(habitId) !== -1; }).sort();
  if (!keys.length) return 0;
  var best = 1, cur = 1;
  for (var i = 1; i < keys.length; i++) {
    var diff = Math.round((parseKey(keys[i]) - parseKey(keys[i - 1])) / 864e5);
    if (diff === 1) { cur++; if (cur > best) best = cur; } else cur = 1;
  }
  return best;
}
function renderStats() {
  document.getElementById("statRate7").textContent = completionRate(7) + "%";
  document.getElementById("statRate30").textContent = completionRate(30) + "%";
  var habits = activeHabits();
  var best = 0;
  habits.forEach(function (h) { var s = longestStreakEver(h.id); if (s > best) best = s; });
  document.getElementById("statBest").textContent = best + " hari";
  document.getElementById("statTotal").textContent = totalCheckins();

  var list = document.getElementById("streakList");
  list.innerHTML = "";
  if (habits.length === 0) {
    list.innerHTML = '<p class="none" style="color:var(--muted);font-size:.88rem">Belum ada habit.</p>';
  } else {
    var sorted = habits.slice().sort(function (a, b) { return streakOf(b.id) - streakOf(a.id); });
    sorted.forEach(function (h) {
      var row = document.createElement("div");
      row.className = "streak-row";
      row.innerHTML = '<span class="hicon">' + h.icon + '</span><span class="nm">' + esc(h.name) +
        '</span><span class="st">\u{1F525} ' + streakOf(h.id) + "</span>";
      list.appendChild(row);
    });
  }

  renderWeekChart();
  renderArchived();
}

/* ---------- grafik tren 8 minggu ---------- */
function renderWeekChart() {
  var el = document.getElementById("weekChart");
  el.innerHTML = "";
  var weeks = [];
  for (var w = 7; w >= 0; w--) {
    var total = 0;
    for (var d = 0; d < 7; d++) {
      var key = dateKey(addDays(new Date(), -(w * 7 + d)));
      total += (state.checkins[key] || []).length;
    }
    var lbl = addDays(new Date(), -(w * 7 + 6));
    weeks.push({ total: total, label: pad(lbl.getDate()) + "/" + pad(lbl.getMonth() + 1) });
  }
  var max = 1;
  weeks.forEach(function (x) { if (x.total > max) max = x.total; });
  weeks.forEach(function (wk) {
    var col = document.createElement("div");
    col.className = "bar-col";
    col.innerHTML = '<div class="bar-track"><div class="bar" style="height:' +
      Math.round(wk.total / max * 100) + '%"></div></div>' +
      '<span class="bar-val">' + wk.total + "</span>" +
      '<span class="bar-lbl">' + wk.label + "</span>";
    el.appendChild(col);
  });
}

/* ---------- arsip ---------- */
function renderArchived() {
  var box = document.getElementById("archivedBox");
  var list = document.getElementById("archivedList");
  var arch = state.habits.filter(function (h) { return h.archived; });
  if (arch.length === 0) { box.classList.add("hidden"); return; }
  box.classList.remove("hidden");
  list.innerHTML = "";
  arch.forEach(function (h) {
    var row = document.createElement("div");
    row.className = "streak-row";
    row.innerHTML = '<span class="hicon">' + h.icon + '</span><span class="nm">' + esc(h.name) + "</span>" +
      '<button class="btn ghost small" data-unarchive="' + h.id + '">Aktifkan</button>';
    list.appendChild(row);
  });
  list.querySelectorAll("[data-unarchive]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var h = state.habits.filter(function (x) { return x.id === btn.getAttribute("data-unarchive"); })[0];
      if (h) { h.archived = false; save(); renderAll(); }
    });
  });
}
function toggleArchive() {
  var h = state.habits.filter(function (x) { return x.id === editingId; })[0];
  if (!h) return;
  h.archived = !h.archived;
  if (h.archived) cancelReminderNative(h.id);
  save();
  closeModal();
  renderAll();
}
function moveHabit(dir) {
  var idx = -1;
  for (var k = 0; k < state.habits.length; k++) if (state.habits[k].id === editingId) { idx = k; break; }
  var j = idx + dir;
  if (idx < 0 || j < 0 || j >= state.habits.length) return;
  var t = state.habits[idx];
  state.habits[idx] = state.habits[j];
  state.habits[j] = t;
  save();
  renderAll();
}

/* ---------- modal tambah/edit ---------- */
function buildPickers() {
  var ip = document.getElementById("fIcon");
  ip.innerHTML = "";
  ICONS.forEach(function (ic) {
    var b = document.createElement("button");
    b.type = "button"; b.textContent = ic;
    b.dataset.icon = ic;
    if (ic === selIcon) b.classList.add("sel");
    b.addEventListener("click", function () {
      selIcon = ic;
      ip.querySelectorAll("button").forEach(function (x) { x.classList.remove("sel"); });
      b.classList.add("sel");
    });
    ip.appendChild(b);
  });
  var cp = document.getElementById("fColor");
  cp.innerHTML = "";
  COLORS.forEach(function (c) {
    var b = document.createElement("button");
    b.type = "button"; b.style.background = c; b.dataset.color = c;
    if (c === selColor) b.classList.add("sel");
    b.addEventListener("click", function () {
      selColor = c;
      cp.querySelectorAll("button").forEach(function (x) { x.classList.remove("sel"); });
      b.classList.add("sel");
    });
    cp.appendChild(b);
  });
}
function openModal(id) {
  editingId = id || null;
  disarmDelete();
  var h = id ? state.habits.filter(function (x) { return x.id === id; })[0] : null;
  document.getElementById("modalTitle").textContent = h ? "Ubah habit" : "Habit baru";
  document.getElementById("fName").value = h ? h.name : "";
  document.getElementById("fTarget").value = h ? String(h.targetPerWeek) : "5";
  document.getElementById("fReminder").value = h && h.reminderTime ? h.reminderTime : "";
  selIcon = h ? h.icon : ICONS[0];
  selColor = h ? h.color : COLORS[0];
  buildPickers();
  document.getElementById("btnDelete").classList.toggle("hidden", !h);
  var archBtn = document.getElementById("btnArchive");
  archBtn.classList.toggle("hidden", !h);
  if (h) archBtn.textContent = h.archived ? "Aktifkan lagi" : "Arsipkan";
  document.getElementById("moveRow").classList.toggle("hidden", !h);
  var noteRow = document.getElementById("noteRow");
  noteRow.classList.toggle("hidden", !h);
  if (h) {
    var nk = todayKey();
    document.getElementById("fNote").value = (state.notes[nk] && state.notes[nk][h.id]) || "";
  } else {
    document.getElementById("fNote").value = "";
  }
  document.getElementById("modal").classList.remove("hidden");
  setTimeout(function () { document.getElementById("fName").focus(); }, 100);
}
function closeModal() {
  document.getElementById("modal").classList.add("hidden");
  editingId = null;
  disarmDelete();
}
function saveModal() {
  var name = document.getElementById("fName").value.trim();
  if (!name) { document.getElementById("fName").focus(); return; }
  var target = parseInt(document.getElementById("fTarget").value, 10) || 5;
  var rem = document.getElementById("fReminder").value || null;
  if (editingId) {
    var h = state.habits.filter(function (x) { return x.id === editingId; })[0];
    if (h) { h.name = name; h.icon = selIcon; h.color = selColor; h.targetPerWeek = target; h.reminderTime = rem; }
    var nk = todayKey();
    var noteVal = document.getElementById("fNote").value.trim();
    if (!state.notes[nk]) state.notes[nk] = {};
    if (noteVal) state.notes[nk][editingId] = noteVal;
    else delete state.notes[nk][editingId];
  } else {
    state.habits.push({ id: uid(), name: name, icon: selIcon, color: selColor, targetPerWeek: target, reminderTime: rem, archived: false });
  }
  save();
  closeModal();
  renderAll();
}
function deleteHabit() {
  if (!editingId) return;
  var btn = document.getElementById("btnDelete");
  if (!deleteArmed) {
    deleteArmed = true;
    btn.textContent = "Ketuk lagi untuk hapus";
    btn.classList.add("armed");
    deleteArmTimer = setTimeout(disarmDelete, 3000);
    return;
  }
  clearTimeout(deleteArmTimer);
  cancelReminderNative(editingId);
  state.habits = state.habits.filter(function (x) { return x.id !== editingId; });
  Object.keys(state.checkins).forEach(function (k) {
    state.checkins[k] = state.checkins[k].filter(function (id) { return id !== editingId; });
    if (state.checkins[k].length === 0) delete state.checkins[k];
  });
  save();
  closeModal();
  renderAll();
}
var deleteArmed = false;
var deleteArmTimer = null;
function disarmDelete() {
  deleteArmed = false;
  if (deleteArmTimer) { clearTimeout(deleteArmTimer); deleteArmTimer = null; }
  var btn = document.getElementById("btnDelete");
  if (btn) { btn.textContent = "Hapus"; btn.classList.remove("armed"); }
}

/* ---------- backup & restore ---------- */
var dataMode = "backup";
function openDataModal(mode) {
  dataMode = mode;
  var ta = document.getElementById("dataText");
  document.getElementById("dataTitle").textContent = mode === "backup" ? "Backup data" : "Restore data";
  document.getElementById("dataHint").textContent = mode === "backup"
    ? "Ini data mentah aplikasimu (format JSON, tidak perlu dibaca). Salin dan simpan di tempat aman."
    : "Tempel teks backup, lalu ketuk Pulihkan.";
  ta.value = mode === "backup" ? JSON.stringify(state, null, 2) : "";
  ta.placeholder = mode === "backup" ? "" : "Tempel data backup di sini...";
  ta.readOnly = mode === "backup";
  document.getElementById("btnCopyData").classList.toggle("hidden", mode !== "backup");
  document.getElementById("btnDoRestore").classList.toggle("hidden", mode !== "restore");
  document.getElementById("dataStatus").textContent = "";
  document.getElementById("dataModal").classList.remove("hidden");
  if (mode === "backup") { ta.focus(); ta.select(); }
}
function closeDataModal() {
  document.getElementById("dataModal").classList.add("hidden");
}
function copyData() {
  var ta = document.getElementById("dataText");
  ta.focus(); ta.select();
  var ok = false;
  try { ok = document.execCommand("copy"); } catch (e) {}
  document.getElementById("dataStatus").textContent = ok ? "Disalin ke clipboard." : "Gagal menyalin, salin manual.";
}
function doRestore() {
  var raw = document.getElementById("dataText").value.trim();
  var st = document.getElementById("dataStatus");
  try {
    var d = JSON.parse(raw);
    if (!d || !Array.isArray(d.habits) || !d.checkins) throw new Error("bad");
    state = d;
    if (!state.notes) state.notes = {};
    if (!state.theme) state.theme = "dark";
    state.habits.forEach(function (h) { if (typeof h.archived === "undefined") h.archived = false; });
    save();
    applyTheme();
    closeDataModal();
    renderAll();
  } catch (e) {
    st.textContent = "Data tidak valid. Pastikan teks backup benar.";
  }
}

/* ---------- export CSV & PDF ---------- */
var exportBusy = false;
function guardExport(fn) {
  return function () {
    if (exportBusy) return;
    exportBusy = true;
    try { fn(); } catch (e) {}
    setTimeout(function () { exportBusy = false; }, 2000);
  };
}
function b64utf8(s) { return btoa(unescape(encodeURIComponent(s))); }
function shareFileNative(name, mime, base64) {
  try {
    if (window.AndroidBridge && window.AndroidBridge.saveFile) {
      window.AndroidBridge.saveFile(name, mime, base64);
      return true;
    }
  } catch (e) {}
  return false;
}
function habitName(id) {
  var h = state.habits.filter(function (x) { return x.id === id; })[0];
  return h ? h.name : "(dihapus)";
}
function exportCsv() {
  var rows = ["Tanggal;Habit;Jumlah;Catatan"];
  var keys = Object.keys(state.checkins).sort();
  keys.forEach(function (k) {
    var counts = {};
    state.checkins[k].forEach(function (id) { counts[id] = (counts[id] || 0) + 1; });
    Object.keys(counts).forEach(function (id) {
      var note = ((state.notes[k] || {})[id] || "").replace(/;/g, ",").replace(/\r?\n/g, " ");
      rows.push(k + ";" + habitName(id).replace(/;/g, ",") + ";" + counts[id] + ";" + note);
    });
  });
  shareFileNative("dayloop-" + todayKey() + ".csv", "text/csv", b64utf8("\uFEFF" + rows.join("\r\n")));
}
function pdfEscape(s) {
  return s.replace(/[^\x20-\x7E]/g, "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
function buildPdfReport() {
  var rows = [];
  var keys = Object.keys(state.checkins).sort();
  keys.forEach(function (k) {
    var counts = {};
    state.checkins[k].forEach(function (id) { counts[id] = (counts[id] || 0) + 1; });
    Object.keys(counts).forEach(function (id) {
      var nm = habitName(id);
      if (nm.length > 40) nm = nm.slice(0, 37) + "...";
      rows.push([prettyDate(parseKey(k)), nm, "x" + counts[id]]);
    });
  });

  var W = 595;
  var ACC = "0.063 0.725 0.506", DARK = "0.10 0.13 0.18", GRAY = "0.45 0.47 0.52",
      INK = "0.12 0.14 0.18", ZEBRA = "0.955 0.965 0.96";
  var ROWH = 24, PERPAGE = 26;

  function T(font, size, color, x, y, txt) {
    return "BT /" + font + " " + size + " Tf " + color + " rg " + x + " " + y +
      " Td (" + pdfEscape(txt) + ") Tj ET";
  }

  function pageContent(pg, no, total) {
    var c = [];
    c.push(ACC + " rg 0 790 " + W + " 52 re f");
    c.push(T("F2", 18, "1 1 1", 50, 818, "LAPORAN DAYLOOP"));
    c.push(T("F1", 10, GRAY, 50, 770, "Dibuat: " + prettyDate(new Date())));
    var yTop = 736;
    c.push(DARK + " rg 50 " + (yTop - ROWH) + " 495 " + ROWH + " re f");
    c.push(T("F2", 10, "1 1 1", 58, yTop - 16, "TANGGAL"));
    c.push(T("F2", 10, "1 1 1", 210, yTop - 16, "HABIT"));
    c.push(T("F2", 10, "1 1 1", 492, yTop - 16, "JUMLAH"));
    for (var i = 0; i < pg.length; i++) {
      var ry = yTop - (i + 2) * ROWH;
      if (i % 2 === 1) c.push(ZEBRA + " rg 50 " + ry + " 495 " + ROWH + " re f");
      var r = pg[i];
      c.push(T("F1", 10, INK, 58, ry + 8, r[0]));
      c.push(T("F1", 10, INK, 210, ry + 8, r[1]));
      c.push(T("F2", 10, INK, 492, ry + 8, r[2]));
    }
    var lineY = yTop - pg.length * ROWH;
    c.push("0.85 0.87 0.90 RG 0.75 w 50 " + lineY + " m 545 " + lineY + " l S");
    c.push(T("F1", 9, GRAY, 268, 32, "Halaman " + no + " dari " + total));
    return c.join("\n");
  }

  var pages = [], i;
  if (!rows.length) pages.push([]);
  else for (i = 0; i < rows.length; i += PERPAGE) pages.push(rows.slice(i, i + PERPAGE));

  var parts = ["%PDF-1.4\n"], offsets = [0];
  function addObj(body) { offsets.push(parts.join("").length); parts.push(body); }
  var nP = pages.length, f1 = 3 + nP * 2, f2 = f1 + 1, kids = [], p;
  for (p = 0; p < nP; p++) kids.push((3 + p * 2) + " 0 R");
  addObj("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  addObj("2 0 obj\n<< /Type /Pages /Kids [" + kids.join(" ") + "] /Count " + nP + " >>\nendobj\n");
  pages.forEach(function (pg, px) {
    var cobj = 4 + px * 2;
    addObj((3 + px * 2) + " 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
      "/Resources << /Font << /F1 " + f1 + " 0 R /F2 " + f2 + " 0 R >> >> /Contents " + cobj + " 0 R >>\nendobj\n");
    var cs = pageContent(pg, px + 1, nP);
    addObj(cobj + " 0 obj\n<< /Length " + cs.length + " >>\nstream\n" + cs + "\nendstream\nendobj\n");
  });
  addObj(f1 + " 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");
  addObj(f2 + " 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n");
  var xrefPos = parts.join("").length, total = f2 + 1, o;
  parts.push("xref\n0 " + total + "\n0000000000 65535 f \n");
  for (o = 1; o < total; o++) {
    var off = String(offsets[o]);
    while (off.length < 10) off = "0" + off;
    parts.push(off + " 00000 n \n");
  }
  parts.push("trailer\n<< /Size " + total + " /Root 1 0 R >>\nstartxref\n" + xrefPos + "\n%%EOF");
  return parts.join("");
}
function exportPdf() {
  shareFileNative("dayloop-" + todayKey() + ".pdf", "application/pdf", btoa(buildPdfReport()));
}

/* ---------- navigasi tab ---------- */
document.querySelectorAll(".tab-btn").forEach(function (btn) {
  btn.addEventListener("click", function () {
    document.querySelectorAll(".tab-btn").forEach(function (b) { b.classList.remove("active"); });
    document.querySelectorAll(".tab").forEach(function (t) { t.classList.remove("active"); });
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
  });
});
document.getElementById("fab").addEventListener("click", function () { openModal(null); });
document.getElementById("btnCancel").addEventListener("click", closeModal);
document.getElementById("btnSave").addEventListener("click", saveModal);
document.getElementById("btnDelete").addEventListener("click", deleteHabit);
document.getElementById("calPrev").addEventListener("click", function () { calMove(-1); });
document.getElementById("calNext").addEventListener("click", function () { calMove(1); });
document.getElementById("btnArchive").addEventListener("click", toggleArchive);
document.getElementById("btnUp").addEventListener("click", function () { moveHabit(-1); });
document.getElementById("btnDown").addEventListener("click", function () { moveHabit(1); });
document.getElementById("btnTheme").addEventListener("click", toggleTheme);
document.getElementById("btnBackup").addEventListener("click", function () { openDataModal("backup"); });
document.getElementById("btnRestore").addEventListener("click", function () { openDataModal("restore"); });
document.getElementById("btnExportCsv").addEventListener("click", guardExport(exportCsv));
document.getElementById("btnExportPdf").addEventListener("click", guardExport(exportPdf));
document.getElementById("btnCopyData").addEventListener("click", copyData);
document.getElementById("btnDoRestore").addEventListener("click", doRestore);
document.getElementById("btnCloseData").addEventListener("click", closeDataModal);
document.getElementById("dataModal").addEventListener("click", function (e) {
  if (e.target === this) closeDataModal();
});
document.getElementById("modal").addEventListener("click", function (e) {
  if (e.target === this) closeModal();
});

/* ---------- init ---------- */
load();
applyTheme();
document.getElementById("dateLine").textContent = prettyDate(new Date());
renderAll();
syncReminders(); // pastikan alarm native selaras tiap aplikasi dibuka
