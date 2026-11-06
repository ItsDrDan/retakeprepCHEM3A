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
const SEND_STUDENT_EMAIL = true;  // emails each student a confirmation
const NOTIFY_ME = "";             // your email to get a copy of each sign-up ("" = off)
const SHEET_NAME = "Sign-Ups";
const SHEET_ID = "1O7V98-8H3C4siBkKOouEbStVHFy6G4Qt3eKMsQ41EQo"; // the "CHEM 3A Retake Sign-Ups" Google Sheet ("" = the sheet this script is attached to)

const HEADERS = ["Submitted", "Name", "Email", "Lab section", "Exam", "Date", "Day",
  "Window", "Finals week?", "No time works?", "Alternatives", "Availability", "Notes", "Status"];

function sheet_() {
  const ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#e4f3ec");
  }
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
    const name = String(d.name || "").trim(), email = String(d.email || "").trim().toLowerCase();
    if (!name || !email) return json_({ ok: false, error: "Name and email are required." });

    const sh = sheet_();
    const values = sh.getDataRange().getValues();
    // Same email signs up again = replace their old row (lets students change their day)
    let rowIndex = -1;
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][2]).toLowerCase() === email) { rowIndex = i + 1; break; }
    }

    const date = String(d.date || "");
    const p = date.slice(0, 10).split("-").map(Number), dow = new Date(p[0], p[1] - 1, p[2]).getDay();
    const cap = SLOT_CAPS[date] || (SEATS_BY_DAY && date.length === 10 ? SEATS_BY_DAY[dow] : 0);
    if (cap) {
      const c = counts_(sh);
      let mine = 0;
      if (rowIndex > 0) {
        const old = values[rowIndex - 1][5];
        const oldDate = old instanceof Date ? Utilities.formatDate(old, "America/Los_Angeles", "yyyy-MM-dd") : String(old);
        if (oldDate === date) mine = 1;
      }
      if ((c[date] || 0) - mine >= cap) {
        return json_({ ok: false, error: "Sorry, that time just filled up. Pick another time.", counts: c });
      }
    }

    const row = [new Date(), name, email, d.section || "", d.exam || "", date ? "'" + date : "", d.dateLabel ? "'" + d.dateLabel : "",
      d.window || "", d.finals ? "Yes" : "", d.noneWork ? "Yes" : "", d.alternatives || "",
      d.availability || "", d.notes || "", d.noneWork ? "Needs a time" : d.request ? "Requested" : "Booked"];

    if (rowIndex > 0) sh.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    else sh.appendRow(row);

    const when = d.when ? d.when : d.noneWork ? "No listed time works. Dr. Dan will email you to set a time."
      : d.finals ? d.dateLabel + " (finals week request). Dr. Dan will email you to confirm the time."
      : d.dateLabel + ", " + d.window + " (office hours)";
    const body = "Hi " + name + ",\n\n" + (d.request ? "Your CHEM 3A exam retake request is in." : "You're signed up for your CHEM 3A exam retake.") + "\n\n" +
      "Exam: " + d.exam + "\n" +
      "Lab section: " + d.section + "\n" +
      "When: " + when + "\n\n" +
      "Need to change your day? Fill out the sign-up form again with this same email.\n\n- Dr. Dan";
    if (SEND_STUDENT_EMAIL) { try { MailApp.sendEmail(email, "CHEM 3A exam retake sign-up", body); } catch (err) {} }
    if (NOTIFY_ME) { try { MailApp.sendEmail(NOTIFY_ME, "Retake sign-up: " + name, body + "\n\nNotes: " + (d.notes || "-") + "\nAvailability: " + (d.availability || "-")); } catch (err) {} }

    try { buildSchedule_(sh); } catch (err) {}
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
  rows.sort((a, b) => (keyOf(a) || "9999").localeCompare(keyOf(b) || "9999") || String(a[1]).localeCompare(String(b[1])));
  const data = [["CHEM 3A Exam Retake Schedule", "", "", "", "", "", ""],
                ["Updated " + Utilities.formatDate(new Date(), "America/Los_Angeles", "EEE MMM d, h:mm a"), "", "", "", "", "", ""],
                ["", "", "", "", "", "", ""]];
  const heads = [];
  let last = null;
  rows.forEach(r => {
    const k = keyOf(r);
    const group = k ? dayOf(r) + "  |  " + (r[7] || "") : "No listed time works (needs a time)";
    if (group !== last) {
      const n = rows.filter(x => (keyOf(x) ? dayOf(x) + "  |  " + (x[7] || "") : "No listed time works (needs a time)") === group).length;
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
