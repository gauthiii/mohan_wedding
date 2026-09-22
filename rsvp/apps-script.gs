/**
 * RSVP collector for the Mohan & Nandhini invitation.
 *
 * Paste this into a Google Apps Script project bound to a Google Sheet, then
 * deploy it as a Web App. Setup steps are in rsvp/README.md.
 *
 * It appends one row per response and returns JSON. It is deliberately the only
 * thing that touches the spreadsheet: the website never holds a Google
 * credential, because the Web App runs as you and is called anonymously.
 */

var SHEET_NAME = 'RSVPs';

var COLUMNS = [
  'Received',
  'Name',
  'Attending',
  'Guests',
  'Phone',
  'Message',
  'Invitation',
  'Language',
];

/** Returns the target sheet, creating and formatting it on first use. */
function getSheet_() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.getSheetByName(SHEET_NAME) || book.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COLUMNS);
    sheet.getRange(1, 1, 1, COLUMNS.length)
      .setFontWeight('bold')
      .setBackground('#f3e7d3');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 160); // Received
    sheet.setColumnWidth(2, 200); // Name
    sheet.setColumnWidth(6, 380); // Message
  }
  return sheet;
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function text_(value, limit) {
  return String(value == null ? '' : value).trim().slice(0, limit || 300);
}

/** Opening the deployment URL in a browser should say something useful. */
function doGet() {
  return json_({ ok: true, service: 'mohan-nandhini-rsvp' });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json_({ ok: false, error: 'empty request' });
    }

    var body = JSON.parse(e.postData.contents);

    // Honeypot: a real person never fills a field they cannot see.
    if (text_(body.website)) return json_({ ok: true, skipped: true });

    var name = text_(body.name, 120);
    var phone = text_(body.phone, 40);
    var attendance = text_(body.attendance, 10);
    if (!name || !phone || (attendance !== 'yes' && attendance !== 'no')) {
      return json_({ ok: false, error: 'missing required fields' });
    }

    var guests = parseInt(body.guests, 10);
    if (!(guests >= 1 && guests <= 20)) guests = 1;

    // One writer at a time, so two guests submitting together cannot collide.
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      getSheet_().appendRow([
        new Date(),
        name,
        attendance === 'yes' ? 'Yes' : 'No',
        attendance === 'yes' ? guests : 0,
        "'" + phone, // leading quote keeps +91… and leading zeros intact
        text_(body.message, 1000),
        text_(body.invitation, 40),
        text_(body.language, 10),
      ]);
    } finally {
      lock.releaseLock();
    }

    return json_({ ok: true });
  } catch (error) {
    return json_({ ok: false, error: String(error) });
  }
}
