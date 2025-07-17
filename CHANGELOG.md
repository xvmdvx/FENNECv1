# Changelog

All notable changes to this project will be documented in this file.

## Unreleased
- Start of new changelog. Latest updates have been incorporated into the README.
- Fixed email order count in Fraud Review XRAY to read from the active email
  search tab rather than always using the DB order email.
- Prevented Fraud Review tab from regaining focus when EKATA finishes during
  XRAY. Now the flow proceeds directly to Adyen without interrupting the
  current tab.
- Queue View summary now shows totals from the downloaded CSV and flags orders
  marked as Possible Fraud.
- Fixed CSV totals reverting after Queue View; summary now remains until run again.
- CSV orders and summary now persist across page refreshes so the table does not
  revert to the initial search results until Queue View is executed again.
