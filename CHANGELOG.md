# Changelog

All notable changes to this project will be documented in this file.

## Unreleased
- Start of new changelog. Latest updates have been incorporated into the README.
- Fixed email order count in Fraud Review XRAY to read from the active email
  search tab rather than always using the DB order email.
- Prevented Fraud Review tab from regaining focus when EKATA finishes during
  XRAY. Now the flow proceeds directly to Adyen without interrupting the
  current tab.
