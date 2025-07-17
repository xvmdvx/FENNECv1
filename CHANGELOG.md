# Changelog

All notable changes to this project will be documented in this file.

## Unreleased
- Start of new changelog. Latest updates have been incorporated into the README.
- Fixed email order count in Fraud Review XRAY to read from the active email
  search tab rather than always using the DB order email.
- Prevent DB Fraud Review tab from refocusing when Ekata opens during the XRAY
  flow, so the sequence moves directly to Adyen.
