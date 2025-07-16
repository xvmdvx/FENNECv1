# Changelog

All notable changes to this project will be documented in this file.

## Unreleased
- Start of new changelog.
- Added Reset Extension button in the popup to clear storage and reload.
- Added hamburger and trash icons to Review Mode header across all environments.
- Fixed SEARCH button triggering XRAY instead of opening Gmail and DB tabs.
- Issues box in Gmail Review Mode now supports multiple document uploads.
- Added Messenger module to unify extension messaging across environments.
  Uploaded files are converted to PDF before being sent and the button label
  changes to **UPDATE** after each upload.
- Removed deprecated showDiagnoseResults helper and finalized documentation.
- Fixed duplicate tabs when triggering XRAY or SEARCH.
- Fixed Gmail sidebar not refreshing after XRAY and avoided double DB and Gmail tabs when using SEARCH or XRAY.
- Fixed Trial floater not appearing after XRAY completion when the fraud tracker
  page was opened late.
- Fixed Trial floater disappearing when reopening the fraud tracker after XRAY
  had already finished.
- Set fraudXrayFinished when data is extracted so the Trial floater shows even if DB tab wasn't open.
- DB email search is now opened in the background during XRAY and focused after DNA extraction.
- Fixed duplicate "Orders Found" lines in the Trial floater.
- Fixed Trial floater not showing after XRAY completion.
- Added CLIENT and COUNTRIES INVOLVED lines to the DB box in the Trial floater.
- Queue View CSV results now update Order Search summary and apply orange flags with console logs for debugging.
- Fixed QUEUE flow only downloading CSV instead of executing full scan.
- Restored opening the Fraud Review page and manual CSV button click so the queue view fully refreshes.
