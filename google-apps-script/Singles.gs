/** Singles backend: requires an explicit SINGLES_SPREADSHEET_ID; writes only to Singles Event Registrations. */
function handleSingles_(request) {
  var properties = PropertiesService.getScriptProperties();
  var secret = properties.getProperty("SINGLES_SHARED_SECRET");
  if (!secret || typeof request.secret !== "string" || request.secret !== secret) {
    return json_({ ok: false, code: "UNAUTHORIZED", message: "Unauthorized." });
  }
  var validation = validateSingles(request.data);
  if (Object.keys(validation.errors).length) {
    return json_({ ok: false, code: "VALIDATION_ERROR", errors: validation.errors });
  }
  var destination = properties.getProperty("SINGLES_SPREADSHEET_ID");
  if (!destination) return json_({ ok: false, code: "CONFIGURATION_ERROR" });
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    lock.waitLock(25000);
    locked = true;
    var spreadsheet = SpreadsheetApp.openById(destination);
    var sheet = spreadsheet.getSheetByName("Singles Event Registrations");
    if (!sheet) sheet = spreadsheet.insertSheet("Singles Event Registrations");
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, SINGLES_HEADERS.length).setValues([SINGLES_HEADERS]);
      sheet.setFrozenRows(1);
    }
    var headers = sheet.getRange(1, 1, 1, SINGLES_HEADERS.length).getDisplayValues()[0];
    if (
      JSON.stringify(headers) !== JSON.stringify(SINGLES_HEADERS) ||
      sheet.getLastColumn() !== SINGLES_HEADERS.length
    ) {
      return json_({ ok: false, code: "CONFIGURATION_ERROR" });
    }
    var row = singlesRow(validation.value, new Date().toISOString());
    if (sheet.getLastRow() > 1) {
      var rows = sheet
        .getRange(2, 1, sheet.getLastRow() - 1, SINGLES_HEADERS.length)
        .getDisplayValues();
      for (var index = 0; index < rows.length; index++) {
        if (rows[index][0] !== row[0]) continue;
        // A lost response can be retried with the same ID and answers. Changed data must not overwrite a saved registration.
        var same = rows[index].every(function (cell, column) {
          return column === 1 || cell === row[column];
        });
        return json_(
          same
            ? { ok: true, saved: true, submissionId: row[0], submittedAt: rows[index][1] }
            : { ok: false, code: "SUBMISSION_CONFLICT" }
        );
      }
    }
    var nextRow = sheet.getLastRow() + 1;
    var range = sheet.getRange(nextRow, 1, 1, SINGLES_HEADERS.length);
    // RAW avoids Sheets parsing '+' as a formula or modifying leading zeros.
    range.setNumberFormat("@");
    Sheets.Spreadsheets.Values.update(
      { values: [row] },
      destination,
      "'Singles Event Registrations'!A" + nextRow + ":L" + nextRow,
      { valueInputOption: "RAW" }
    );
    SpreadsheetApp.flush();
    var saved = range.getDisplayValues()[0];
    if (
      JSON.stringify(saved) !== JSON.stringify(row) ||
      range.getFormulas()[0].some(function (formula) {
        return !!formula;
      })
    ) {
      return json_({ ok: false, code: "DATABASE_ERROR" });
    }
    return json_({ ok: true, saved: true, submissionId: row[0], submittedAt: row[1] });
  } catch (error) {
    return json_({ ok: false, code: "DATABASE_ERROR" });
  } finally {
    if (locked) lock.releaseLock();
  }
}
