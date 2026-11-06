/**
 * CHEM 3A Exam Retake Sign-Up: Google Apps Script backend
 *
 * SETUP (about 5 minutes):
 * 1. Make a new Google Sheet named "CHEM 3A Retake Sign-Ups".
 * 2. Extensions > Apps Script. Delete what's there and paste this whole file. Save.
 * 3. Deploy > New deployment > type "Web app".
 *      Execute as: Me      Who has access: Anyone
 *    Click Deploy, approve the permissions, and copy the Web app URL (ends in /exec).
 * 4. In signup.html, paste that URL into CONFIG.scriptUrl.
 *
 * If you change this script later: Deploy > Manage deployments > edit (pencil) >
 * Version: New version > Deploy. The URL stays the same.
 */

const SEATS_BY_DAY = null; // null = no limit. To cap: { 1: 8, 3: 8, 5: 30 } (Mon, Wed, Fri; also set CONFIG.seats in signup.html)
// Spot limits for single time slots (key = date + "T" + start time). Keep the same as the caps in signup.html.
const SLOT_CAPS = { "2026-12-07T12:00": 5, "2026-12-07T16:00": 5, "2026-12-11T08:00": 10 };
// Walk-in days (Study Hall Day): seats for the whole day; no 48-hour cutoff, never counted as late, no 72-hour email.
const WALK_IN_DAYS = { "2026-11-17": 32 };
const SEND_STUDENT_EMAIL = true;  // emails each student a confirmation
const NOTIFY_ME = "";             // your email to get a copy of each sign-up ("" = off)
// Sign-ups close MIN_HOURS before a time. A sign-up or change between MIN_HOURS and NOTICE_HOURS emails LATE_NOTICE_TO.
const MIN_HOURS = 48, NOTICE_HOURS = 72;
const DEADLINE = Utilities.parseDate("2026-11-15 23:59:59", "America/Los_Angeles", "yyyy-MM-dd HH:mm:ss"); // last moment to sign up or change
const LATE_NOTICE_TO = "dk021@fresnocitycollege.edu";
const SHEET_NAME = "Sign-Ups";
const SHEET_ID = "1O7V98-8H3C4siBkKOouEbStVHFy6G4Qt3eKMsQ41EQo"; // the "CHEM 3A Retake Sign-Ups" Google Sheet ("" = the sheet this script is attached to)

const HEADERS = ["Submitted", "Name", "Email", "Lab section", "Exam", "Date", "Day",
  "Window", "Finals week?", "No time works?", "Alternatives", "Availability", "Notes", "Status", "Student ID"];
// CHEM 3A QR attendance responses. The Roster tab checks these students off as they fill out the form.
// The attendance sheet must be shared (Viewer is enough) with the Google account that owns this script.
const ATTENDANCE_SHEET_ID = "";   // set in the live script, not in the public repo
const ATTENDANCE_GID = 1621423899;

function sheet_() {
  const ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#e4f3ec");
  }
  if (sh.getRange(1, 15).getValue() !== "Student ID") sh.getRange(1, 15).setValue("Student ID").setFontWeight("bold").setBackground("#e4f3ec");
  return sh;
}

function counts_(sh) {
  const out = {};
  const rows = sh.getDataRange().getValues().slice(1);
  rows.forEach(r => {
    const date = r[5] instanceof Date ? Utilities.formatDate(r[5], "America/Los_Angeles", "yyyy-MM-dd") : String(r[5] || "");
    if (date && r[13] !== "Cancelled") out[date] = (out[date] || 0) + 1;
  });
  return out;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return json_({ ok: true, counts: counts_(sheet_()) });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.noRetake) { d.date = ""; d.request = false; d.noneWork = false; }
    const sid = String(d.studentId || "").replace(/\D/g, "").replace(/^0+/, "");
    const name = String(d.name || "").trim(), email = String(d.email || "").trim().toLowerCase();
    if (!name || !email) return json_({ ok: false, error: "Name and email are required." });

    const sh = sheet_();
    const values = sh.getDataRange().getValues();
    // Same email signs up again = replace their old row (lets students change their day)
    let rowIndex = -1;
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][2]).toLowerCase() === email || (sid && String(values[i][14]).replace(/\D/g, "").replace(/^0+/, "") === sid)) { rowIndex = i + 1; break; }
    }

    const date = String(d.date || "");
    const walkIn = date.length > 10 && !!WALK_IN_DAYS[date.slice(0, 10)];
    const late = Date.now() > DEADLINE.getTime() && !walkIn && !d.noRetake;   // after the deadline: still accepted, as a request that isn't guaranteed
    if (late) d.request = true;
    let hoursAway = null;
    if (date) {
      const startAt = Utilities.parseDate(date.slice(0, 10) + " " + (d.start || "00:00"), "America/Los_Angeles", "yyyy-MM-dd HH:mm");
      hoursAway = (startAt.getTime() - Date.now()) / 3600000;
      if (walkIn && hoursAway < 0) return json_({ ok: false, error: "That time has already started. Pick a later time." });
      if (hoursAway < MIN_HOURS && !walkIn) return json_({ ok: false, error: "Sign-ups close 48 hours before each time. Pick a later day." });
    }
    const p = date.slice(0, 10).split("-").map(Number), dow = new Date(p[0], p[1] - 1, p[2]).getDay();
    const cap = SLOT_CAPS[date] || (walkIn ? WALK_IN_DAYS[date.slice(0, 10)] : 0) || (SEATS_BY_DAY && date.length === 10 ? SEATS_BY_DAY[dow] : 0);
    const same = k => walkIn ? k.length > 10 && k.slice(0, 10) === date.slice(0, 10) : k === date;
    if (cap) {
      const c = counts_(sh);
      let mine = 0;
      if (rowIndex > 0) {
        const old = values[rowIndex - 1][5];
        const oldDate = old instanceof Date ? Utilities.formatDate(old, "America/Los_Angeles", "yyyy-MM-dd") : String(old);
        if (same(oldDate)) mine = 1;
      }
      const used = Object.keys(c).filter(same).reduce((a, k) => a + c[k], 0);
      if (used - mine >= cap) {
        return json_({ ok: false, error: "Sorry, that time just filled up. Pick another time.", counts: c });
      }
    }

    const row = [new Date(), name, email, d.section || "", d.exam || "", date ? "'" + date : "", d.dateLabel ? "'" + d.dateLabel : "",
      d.window || "", d.finals ? "Yes" : "", d.noneWork ? "Yes" : "", d.alternatives || "",
      d.availability || "", d.notes || "", d.noRetake ? "No retake" : late ? "Late request" : d.noneWork ? "Needs a time" : d.request ? "Requested" : "Booked", sid ? "'" + sid : ""];

    if (rowIndex > 0) sh.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    else sh.appendRow(row);

    const when = d.when ? d.when : d.noneWork ? "No listed time works. Dr. Dan will email you to set a time."
      : d.finals ? d.dateLabel + " (finals week request). Dr. Dan will email you to confirm the time."
      : d.dateLabel + ", " + d.window + " (office hours)";
    const body = d.noRetake ? "Hi " + name + ",\n\nThanks for letting Dr. Dan know you don't want an exam retake. Your exam scores stay as they are.\n\nChanged your mind? Fill out the sign-up form again with this same email.\n\n- Dr. Dan" :
      "Hi " + name + ",\n\n" + (late ? "Your late CHEM 3A exam retake request is in. The sign-up deadline was November 15, so this time is not guaranteed. Dr. Dan will email you if he can't fit you in." : d.request ? "Your CHEM 3A exam retake request is in." : "You're signed up for your CHEM 3A exam retake.") + "\n\n" +
      "Exam: " + d.exam + "\n" +
      "Lab section: " + d.section + "\n" +
      "When: " + when + "\n\n" +
      "Need to change your day? Fill out the sign-up form again with this same email.\n\n- Dr. Dan";
    if (SEND_STUDENT_EMAIL) { try { MailApp.sendEmail(email, "CHEM 3A exam retake sign-up", body); } catch (err) {} }
    if (NOTIFY_ME) { try { MailApp.sendEmail(NOTIFY_ME, "Retake sign-up: " + name, body + "\n\nNotes: " + (d.notes || "-") + "\nAvailability: " + (d.availability || "-")); } catch (err) {} }

    const soon = hoursAway !== null && hoursAway < NOTICE_HOURS && !walkIn;
    if (LATE_NOTICE_TO && (soon || late)) {
      const what = (rowIndex > 0 ? "changed their retake time" : "signed up") + (late ? " AFTER the Nov 15 deadline (late request)" : "");
      try { MailApp.sendEmail(LATE_NOTICE_TO, (late ? "Late retake request: " : "Retake within 72 hours: ") + name,
        name + " " + what + (hoursAway !== null ? ", about " + Math.round(hoursAway) + " hours before the exam time." : ".") + "\n\n" +
        "Exam: " + d.exam + "\nLab section: " + d.section + "\nWhen: " + (d.dateLabel || "") + ", " + (d.window || "") +
        "\nEmail: " + email + "\nNotes: " + (d.notes || "-")); } catch (err) {}
    }
    try { buildSchedule_(sh); } catch (err) {}
    try { buildRoster_(sh); } catch (err) {}
    return json_({ ok: true, counts: counts_(sh) });
  } catch (err) {
    return json_({ ok: false, error: "Server error: " + err });
  } finally {
    lock.releaseLock();
  }
}

// Rebuilds the "Schedule" tab: every retake grouped by day and time, so you can see who is testing when.
// Runs after each sign-up. You can also run it by hand: pick buildSchedule in the function menu and click Run.
function buildSchedule() { buildSchedule_(sheet_()); }
function buildSchedule_(sh) {
  const ss = sh.getParent();
  let out = ss.getSheetByName("Schedule");
  if (!out) out = ss.insertSheet("Schedule", 0);
  out.clear();
  const rows = sh.getDataRange().getValues().slice(1).filter(r => r[1] && r[13] !== "Cancelled");
  const keyOf = r => r[5] instanceof Date ? Utilities.formatDate(r[5], "America/Los_Angeles", "yyyy-MM-dd") : String(r[5] || "");
  const dayOf = r => r[6] instanceof Date ? Utilities.formatDate(r[6], "America/Los_Angeles", "EEEE, MMM d") : String(r[6] || keyOf(r));
  const groupOf = r => r[13] === "No retake" ? "Not taking a retake" : keyOf(r) ? dayOf(r) + "  |  " + (r[7] || "") : "No listed time works (needs a time)";
  const sortKey = r => r[13] === "No retake" ? "zzzz" : keyOf(r) || "9999";
  rows.sort((a, b) => sortKey(a).localeCompare(sortKey(b)) || String(a[1]).localeCompare(String(b[1])));
  const data = [["CHEM 3A Exam Retake Schedule", "", "", "", "", "", ""],
                ["Updated " + Utilities.formatDate(new Date(), "America/Los_Angeles", "EEE MMM d, h:mm a"), "", "", "", "", "", ""],
                ["", "", "", "", "", "", ""]];
  const heads = [];
  let last = null;
  rows.forEach(r => {
    const k = keyOf(r);
    const group = groupOf(r);
    if (group !== last) {
      const n = rows.filter(x => groupOf(x) === group).length;
      data.push(["", "", "", "", "", "", ""]);
      heads.push(data.length + 1);
      data.push([group + "   (" + n + (n === 1 ? " student)" : " students)"), "", "", "", "", "", ""]);
      data.push(["Name", "Exam", "Lab section", "Status", "Email", "Notes / availability", "Signed up"]);
      last = group;
    }
    data.push([r[1], r[4], r[3], r[13], r[2], [r[12], r[10], r[11]].filter(String).join(" | "),
      r[0] instanceof Date ? Utilities.formatDate(r[0], "America/Los_Angeles", "M/d h:mm a") : r[0]]);
  });
  if (!rows.length) data.push(["No sign-ups yet.", "", "", "", "", "", ""]);
  out.getRange(1, 1, data.length, 7).setValues(data);
  out.getRange(1, 1).setFontSize(14).setFontWeight("bold");
  out.getRange(2, 1).setFontColor("#646c82");
  heads.forEach(h => {
    out.getRange(h, 1, 1, 7).setBackground("#23776c").setFontColor("#ffffff").setFontWeight("bold");
    out.getRange(h + 1, 1, 1, 7).setBackground("#e4f3ec").setFontWeight("bold");
  });
  out.setColumnWidths(1, 1, 200); out.setColumnWidths(2, 3, 150); out.setColumnWidth(5, 220); out.setColumnWidth(6, 260); out.setColumnWidth(7, 110);
}

// Rebuilds the "Roster" tab: every student from the attendance sheet, checked off when they fill out the form
// (signed up or said no retake). Not-yet-responded students are listed first so you know who to remind.
// Runs after each sign-up. You can also run it by hand: pick buildRoster in the function menu and click Run.
function buildRoster() { buildRoster_(sheet_()); }
function buildRoster_(sh) {
  const ss = sh.getParent();
  let out = ss.getSheetByName("Roster");
  if (!out) out = ss.insertSheet("Roster", 1);
  out.clear();
  const tz = "America/Los_Angeles";
  const normId = v => String(v || "").replace(/\D/g, "").replace(/^0+/, "");
  const normName = v => String(v || "").toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
  let att;
  try {
    const a = SpreadsheetApp.openById(ATTENDANCE_SHEET_ID);
    const tab = a.getSheets().find(s => s.getSheetId() === ATTENDANCE_GID) || a.getSheets()[0];
    att = tab.getDataRange().getValues().slice(1);
  } catch (err) {
    out.getRange(1, 1, 2, 1).setValues([["Can't open the attendance sheet yet."],
      ["Share \"CHEM 3A Attendance Sheet (MW) (Responses)\" (Viewer) with the Google account that owns this script, then run buildRoster in the script editor."]]);
    out.getRange(1, 1).setFontWeight("bold").setFontSize(14);
    return;
  }
  // Students from attendance: Timestamp, First Name, Last Name, Student ID #, Section, Code
  const students = {};
  att.forEach(r => {
    const first = String(r[1] || "").trim(), last = String(r[2] || "").trim();
    if (!first && !last) return;
    const id = normId(r[3]);
    const key = id || "name:" + normName(first + last);
    const s = students[key] || (students[key] = { first, last, id, secs: {}, scans: 0, lastSeen: null });
    s.first = first || s.first; s.last = last || s.last;
    const sec = String(r[4] || "").trim(); if (sec) s.secs[sec] = (s.secs[sec] || 0) + 1;
    s.scans++;
    const t = r[0] instanceof Date ? r[0] : null;
    if (t && (!s.lastSeen || t > s.lastSeen)) s.lastSeen = t;
  });
  // Sign-ups by student ID and by name
  const subs = sh.getDataRange().getValues().slice(1).filter(r => r[1] && r[13] !== "Cancelled");
  const byId = {}, byName = {};
  subs.forEach(r => { const id = normId(r[14]); if (id) byId[id] = r; byName[normName(r[1])] = r; });
  const used = new Set();
  const list = Object.values(students).map(s => {
    const r = (s.id && byId[s.id]) || byName[normName(s.first + s.last)] || byName[normName(s.last + s.first)] || null;
    if (r) used.add(r);
    const sec = Object.keys(s.secs).sort((a, b) => s.secs[b] - s.secs[a])[0] || "";
    const when = r ? (r[13] === "No retake" ? "" : (r[6] instanceof Date ? Utilities.formatDate(r[6], tz, "EEE MMM d") : String(r[6] || "")) + (r[7] ? ", " + r[7] : "")) : "";
    return [r ? "✓" : "", s.last + ", " + s.first, s.id, sec, r ? (r[13] === "No retake" ? "No retake" : r[4]) : "", when, r ? r[13] : "",
      s.lastSeen ? Utilities.formatDate(s.lastSeen, tz, "M/d") : "", s.scans];
  });
  list.sort((a, b) => (a[0] ? 1 : 0) - (b[0] ? 1 : 0) || a[1].localeCompare(b[1]));
  const done = list.filter(x => x[0]).length;
  const data = [["CHEM 3A Retake Roster", "", "", "", "", "", "", "", ""],
    ["Responded: " + done + " of " + list.length + "   |   Updated " + Utilities.formatDate(new Date(), tz, "EEE MMM d, h:mm a"), "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", ""],
    ["Done", "Student", "Student ID", "Section (attendance form)", "Choice", "When", "Status", "Last attended", "Scans"]].concat(list);
  const extra = subs.filter(r => !used.has(r));
  if (extra.length) {
    data.push(["", "", "", "", "", "", "", "", ""], ["Sign-ups not matched to the attendance sheet (check the name or ID)", "", "", "", "", "", "", "", ""]);
    extra.forEach(r => data.push(["✓", r[1], r[14], r[3], r[13] === "No retake" ? "No retake" : r[4], r[13] === "No retake" ? "" : String(r[6] || "") + (r[7] ? ", " + r[7] : ""), r[13], "", ""]));
  }
  out.getRange(1, 1, data.length, 9).setValues(data);
  out.getRange(1, 1).setFontSize(14).setFontWeight("bold");
  out.getRange(4, 1, 1, 9).setBackground("#23776c").setFontColor("#ffffff").setFontWeight("bold");
  out.setFrozenRows(4);
  for (let i = 0; i < list.length; i++) {
    out.getRange(5 + i, 1, 1, 9).setBackground(list[i][0] ? "#e4f3ec" : "#fdedf0");
  }
  if (extra.length) out.getRange(5 + list.length + 1, 1).setFontWeight("bold");
  out.setColumnWidth(1, 50); out.setColumnWidth(2, 200); out.setColumnWidth(3, 100); out.setColumnWidth(4, 170);
  out.setColumnWidth(5, 90); out.setColumnWidth(6, 230); out.setColumnWidth(7, 110); out.setColumnWidth(8, 100); out.setColumnWidth(9, 60);
}
