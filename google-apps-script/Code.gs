/** Before I do – The Singles Experience Google Sheets web-app entry point. */
function doPost(e) {
  try {
    var request = JSON.parse(e && e.postData ? e.postData.contents : "{}");
    if (!request || request.action !== "registerSingles") {
      return json_({ ok: false, code: "UNKNOWN_ACTION", message: "Unknown action." });
    }
    return handleSingles_(request);
  } catch (error) {
    return json_({
      ok: false,
      code: "DATABASE_ERROR",
      message: "The registration database is temporarily unavailable.",
    });
  }
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(
    ContentService.MimeType.JSON
  );
}
