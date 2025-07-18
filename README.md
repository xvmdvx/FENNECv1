# FENNEC (POO)

FENNEC (POO)'s principal function is injecting a SIDEBAR (SB) as a navigation companion that extracts information from relevant environments and displays it in a reordered manner to improve agents' productivity and reduce mental stress. Each environment has its unique layout depending on the type's necessities.

## Directory overview

The extension FENNEC (POO) lives in the `FENNEC/` folder. Key pieces include:

- `manifest.json` – Manifest V3 configuration. The service worker is `core/background_email_search.js`.
- `core/` – Shared helpers and the service worker.
  - `background_email_search.js` – handles messaging, tab control and CORS removal for the local Mistral integration.
  - `utils.js` – common utilities such as copying text and opening search tabs.
  - `sidebar.js` – `Sidebar` class used to build the sidebar container.
  - `launcher.js` – base `Launcher` class for environment scripts.
  - `messenger.js` – helper for sending/receiving messages consistently.
  - `mistral_chat.js` – chat widget used when Dev Mode is enabled.
- `environments/` – Content scripts injected into specific sites:
  - `gmail/gmail_launcher.js` – Gmail interface.
  - `db/db_launcher.js` – Internal order pages.
  - `db/csv_hook.js` – Captures CSV downloads in Order Search.
  - `db/table_inject.js` – Injects new rows into the results table using jQuery.
  - `adyen/adyen_launcher.js` – Adyen payment pages.
  - `txsos/tx_sos_launcher.js` – Texas SOS filing site.
  - `usps/usps_launcher.js` – USPS address verification.
- `styles/` – Sidebar and options page stylesheets.
- `popup.html` and `popup.js` – enable/disable the extension and open the options page.
- `options.html` and `options.js` – persist user preferences such as sidebar width.
- `dictionary.txt` – glossary of abbreviations used in the code and documentation.
- `CHANGELOG.md` – lists new features and fixes.
- `README.md` – this guide.

For historical changes refer to the **Changelog**. This document is reset everytime requested by the user, ensuring changes are now reflected on README, DICTIONARY, AGENTS, etc.

### Architecture

FENNEC (POO) follows a modular object‑oriented design.  All reusable classes live in the `core/` folder and are loaded by the service worker at `core/background_email_search.js`.  This worker acts as the central hub: it routes messages, opens or closes tabs and forwards requests to the local Ollama server.

The user interface is created by the `Sidebar` class while overlay panels (Diagnose, Update, Fraud Review, etc.) inherit from the `Floater` base class.  Each supported site provides its own launcher—such as `gmail_launcher.js` or `db_launcher.js`—which extends the generic `Launcher` class to detect the page, extract data and inject the sidebar.  Communication between content scripts and the service worker is handled by the `Messenger` utility and common actions are provided by `utils.js`.  This structure keeps features isolated per environment while sharing a single backbone for consistent behavior across the extension.

## Features

SIDEBAR HEADER:
It remains constant throughout all layouts, unless an IMPORTANT restriction is added.
   Left: Hamburger Icon/Menu. This floater contains QUICK ACTIONS.
   Center: Icon, App name and version in parentheses.
   Right: Icon for clean window action. Close SB button.

PROFILES:
  FILING: Equivale a la DB SB MAIN, con todas sus funcionalidades.
  FILING/MISC:  DB SB MISC
  ISSUES: GM SB + FILING + FILING/MISC
  FRAUD: DB SB REVIEW MODE
  ID CONFIRM: GM SB REVIEW MODE

MAIN (BUSINESS FORMATION ORDERS: SILVER, GOLD, PLATINUM)
   DB:
      Title: "ORDER SUMMARY" + QUICK SUMMARY display/collapse button (⚡)
      1st box: COMPANY summary
         - Line 1: Company name with copy icon and link to the SOS search.
         - Line 2: State ID with copy icon (and formation date if present).
         - Line 3: State abbreviation linking to the Knowledge Base.
         - Line 4: Physical and mailing addresses.
         - Line 5: Business purpose line.
         - Line 6: RA and VA tags indicating service status.
      2nd box: AGENT summary
         - Line 1: Agent name.
         - Line 2: Agent address.
         - Line 3: Service status tag (Active, Resigned or Unknown).
      3rd box: MEMBERS (LLC) or DIRECTORS (CORP, NPROFIT)
         - Each entry: Name and address, separated with horizontal rules.
      4th box: SHAREHOLDERS (CORP, NPROFIT)
         - Each entry: Name, address and "Shares:" line when available.
      5th box: Officers (CORP, NPROFIT)
         - Each entry: Name, address (if any) and officer position.
      (Dev Mode) [🤖 FILE] button centered followed by [🔄 REFRESH].
      (Dev Mode) Mistral Box: Chat interface under REFRESH.
   GM:
      Title: [📧 SEARCH] button centered.
      1st box: COMPANY summary
         - Same lines as DB COMPANY box.
      2nd box: AGENT summary
         - Same lines as DB AGENT box.
      3rd box: MEMBERS (LLC) or DIRECTORS (CORP, NPROFIT)
         - Same structure as in DB.
      4th box: SHAREHOLDERS (CORP, NPROFIT)
         - Same structure as in DB.
      5th box: Officers (CORP, NPROFIT)
         - Same structure as in DB.
      6th box: Issue summary
         - Header with ACTIVE/RESOLVED tag.
         - Issue text.
         - Comment input and **COMMENT & RESOLVE** button.
      - Multiple document uploads are supported. Each file becomes a PDF and the button label switches to **UPDATE**.
      Quick resolve field under Issue summary
      Reuses any open DB tab for comments and resolves the issue only if active
      The comment box disappears after submission showing your comment and a
      success message. Resolving automatically updates the tag to RESOLVED.
      (Dev Mode) End: [🔄 REFRESH] button centered.

MISC (ALL NON-BUSINESS FORMATION ORDERS)
   DB:
      Title: FAMILY TREE display/collapse icon (🌳), "ORDER SUMMARY", QUICK SUMMARY display/collapse icon (⚡)
      1st box: COMPANY summary
         - Same lines as DB COMPANY box.
      2nd box: AGENT summary
         - Same lines as DB AGENT box.
      3rd box: MEMBERS (LLC) or DIRECTORS (CORP, NPROFIT)
         - Same structure as in DB.
      4th box: SHAREHOLDERS (CORP, NPROFIT)
         - Same structure as in DB.
      5th box: Officers (CORP, NPROFIT)
         - Same structure as in DB.
   GM:
      Title: [📧 SEARCH] button centered.
      1st box: COMPANY summary
         - Same lines as DB COMPANY box.
      2nd box: AGENT summary
         - Same lines as DB AGENT box.
      3rd box: MEMBERS (LLC) or DIRECTORS (CORP, NPROFIT)
         - Same structure as in DB.
      4th box: SHAREHOLDERS (CORP, NPROFIT)
         - Same structure as in DB.
      5th box: Officers (CORP, NPROFIT)
         - Same structure as in DB.
      6th box: Issue summary
         - Header with ACTIVE/RESOLVED tag.
         - Issue text.
   (Dev Mode) End: [🔄 REFRESH] button centered.

REVIEW MODE:
This is a detailed mode for the Revenue Assurance team to assist with the order review step.
In Review Mode the sidebar stays locked across all tabs until DNA runs on a different order.
The header shows the hamburger menu and trash icons so quick actions and CLEAR TABS remain available in any environment.

MAIN:
   DB:
      Title: "ORDER SUMMARY"
      1st box: COMPANY summary
         - Same lines as the DB COMPANY box.
      2nd box: ADYEN's DNA summary
         - Line 1: Card holder name.
         - Line 2: Payment method • last four digits • expiry • funding source.
         - Line 3: Billing address and issuing bank.
         - Line 4: CVV, AVS and DB match tags.
         - Line 5: Fraud scoring.
         - Line 6: Transaction table with totals.
      3rd box: KOUNT summary
         - Email age, device location, VIP declines and Ekata results.
      4th box: BILLING summary
         - Line 1: Cardholder name.
         - Line 2: Card type • last four digits • expiry.
         - Line 3: AVS result tag.
         - Line 4: Billing address.
      5th box: CLIENT summary
         - Line 1: Client name and ID link.
         - Line 2: Role tags or NOT LISTED.
         - Line 3: Email and phone.
         - Line 4: Companies count and LTV.
      6th box: AGENT summary
         - Same lines as the DB AGENT box.
      7th box: MEMBERS (LLC) or DIRECTORS (CORP, NPROFIT)
      8th box: SHAREHOLDERS (CORP, NPROFIT)
      9th box: Officers (CORP, NPROFIT)
     10th box: Issue summary
         - Header with ACTIVE/RESOLVED tag and issue text.
   (Dev Mode) End: [🔄 REFRESH] button centered.
   GM:
      Title: [📧 SEARCH], [🧬 DNA] & [🩻 XRAY] buttons centered.
      1st box: ADYEN's DNA summary
      - Same lines as DB ADYEN box.
      2nd box: KOUNT summary
         - Email age, device location, VIP declines and Ekata results.
      3rd box: COMPANY summary (with restructured QUICK SUMMARY contained in the same box)
         - Same lines as DB COMPANY box.
      4th box: CLIENT summary
         - Same lines as DB CLIENT box.
      5th box: BILLING summary
         - Same lines as DB BILLING box.
      6th box: Issue summary
         - Header with ACTIVE/RESOLVED tag and issue text.
   (Dev Mode) End: [🔄 REFRESH] button centered.

MISC:
   DB:
      Title: FAMILY TREE display/collapse button (🌳), "ORDER SUMMARY"
      1st box: ADYEN's DNA summary (only if DNA or XRAY have been triggered)
         - Same lines as DB ADYEN box.
      2nd box: KOUNT summary
         - Email age, device location, VIP declines and Ekata results.
      3rd box: COMPANY summary (with restructured QUICK SUMMARY contained in the same box)
         - Same lines as DB COMPANY box.
      4th box: CLIENT summary
         - Same lines as DB CLIENT box.
      5th box: BILLING summary
         - Same lines as DB BILLING box.
      6th box: Issue summary
         - Header with ACTIVE/RESOLVED tag and issue text.
      (Dev Mode) End: [🔄 REFRESH] button centered.
   GM:
      Title: [📧 SEARCH], [🧬 DNA] & [🩻 XRAY] buttons centered.
      1st box: ADYEN's DNA summary (only if DNA or XRAY have been triggered)
         - Same lines as DB ADYEN box.
      2nd box: KOUNT summary
         - Email age, device location, VIP declines and Ekata results.
      3rd box: COMPANY summary (with restructured QUICK SUMMARY contained in the same box)
         - Same lines as DB COMPANY box.
      4th box: CLIENT summary
         - Same lines as DB CLIENT box.
      5th box: BILLING summary
         - Same lines as DB BILLING box.
      6th box: Issue summary
         - Header with ACTIVE/RESOLVED tag and issue text.
      (Dev Mode) End: [🔄 REFRESH] button centered.
   ADYEN:
      1st box: ADYEN's DNA summary (only if DNA or XRAY have been triggered)
         - Same lines as DB ADYEN box.
      2nd box: KOUNT summary
         - Email age, device location, VIP declines and Ekata results.
      3rd box: COMPANY summary (with restructured QUICK SUMMARY contained in the same box)
         - Same lines as DB COMPANY box.
      4th box: CLIENT summary
         - Same lines as DB CLIENT box.
      5th box: BILLING summary
         - Same lines as DB BILLING box.
      6th box: Issue summary
         - Header with ACTIVE/RESOLVED tag and issue text.
      (Dev Mode) End: [🔄 REFRESH] button centered.

DEV MODE:
Eexperimental mode where upcoming features are tested before release.
   DB:
      [🤖 FILE] and [🔄 REFRESH] buttons plus the Mistral Box appear at the bottom.
   GM:
      [🔄 REFRESH] button appears at the bottom.

ICONS/BUTTONS/FUNCTIONS:

📧 SEARCH (GM SB & GM SB REVIEW MODE): Opens tabs in background:
   1. Gmail Search with Order Number, Customer Email, Customer Name. 
   2. Order in DB

🗑 CLEAR TABS: Closes all tabs, except the one active, in current window.

🧹 CLEAR: Resets the sidebar to its INITIAL state depending on the enviroment.

🔄 Refresh: Updates sidebar information instantly with information extracted from the active tab.

🩻 XRAY: Runs SEARCH and Opens order payment information in Adyen and extracts relevant information from two tabs:
   1. Payment Details
   2. DNA one after the other and opens the Kount workflow page when available.
   The DB email search page is opened immediately so results load in the background.
   Once DNA completes the search tab is focused to grab the history and then focus returns to the Fraud tracker.
   A KOUNT summary box appears below DNA after the data is extracted.

### Fraud Review XRAY flow
0. Click the XRAY icon in the fraud tracker list.
1. Open the order in DB.
2. Refresh DB to obtain the correct LTV.
3. Open DB email search in a background tab so results start loading.
4. Open KOUNT and extract data.
5. Open EKATA and extract data.
6. Open ADYEN and navigate to Payment Details, then extract data.
7. Open ADYEN DNA.
8. Return to the DB email search tab and wait for results. Once loaded, extract the order counts.
9. Return to the original fraud tracker tab with the floater fully built and still showing LOADING if any value was missing.
10. Finish the XRAY session once a decision is made, the floater is manually closed or a new XRAY session begins.
   
🤖 FILE: Automator that opens and fills the SOS filing process.

GENERAL FEATURES:
- Clicking COMPANY NAME opens the SOS search, injects the name and hits search.
- Clicking the STATE ID in the sidebar opens the Coda Knowledge Base in a popup window covering about 70% of the page.
- RA and VA tags display in the COMPANY box. If the Registered Agent Service shows an expiration date in the past, the RA tag turns yellow and reads **EXPIRED**.
- A magnifier icon on the COMPANY box toggles a form with inputs to run SOS name or ID searches using custom parameters.
- 🩺 DIAGNOSE overlay lists hold orders from the Family Tree and now displays all child orders.
- When the sidebar is opened manually in Gmail or Adyen, it starts empty and only shows the action buttons. Order details appear after using SEARCH, DNA or XRAY.
- Visiting the Fraud tracker in DB automatically opens the sidebar in Review Mode and adds 🩻 XRAY icons next to each order number.

## Known limitations
- The scripts rely on the browser DOM provided by Chrome.
  
## Reference dictionary
- [dictionary.txt](dictionary.txt) file explains the abbreviations and shorthand terms used throughout the extension.
- [CHANGELOG.md](CHANGELOG.md) for a detailed list of bug fixes. When adding new features, also update.


## Installation in Chrome
1. Clone or download this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (toggle in the top right).
4. Click **Load unpacked** and select the project folder. The sidebar will then
   be available when visiting supported pages.
5. Open the extension **Options** from the menu or the Extensions page to set a default sidebar width and Review Mode. You can also toggle Review Mode directly from the extension popup. The popup now includes a **Reset Extension** button to clear saved settings and reload.


## Local Mistral integration
The Mistral Box sends prompts to a local [Ollama](https://ollama.ai) server.
Start Ollama so the API is reachable at `http://127.0.0.1:11434/api/generate`.
Responses from that endpoint appear below the REFRESH button.
Requests are sent through the background script, which installs a
declarative rule to remove the `Origin` header so Ollama accepts them
without triggering CORS errors.
If the chat displays **Mistral service unavailable. Ensure Ollama is running.**
start or restart Ollama and click **Retry** in the chat box.

## Development

This repository now includes a minimal `package.json` to simplify future testing and build automation. The `npm test` command prints manual testing steps.

### Manual testing
Rest assured that all manual testing has been completed when reporting bugs or malfunctions.
The `manual-test.js` script prints a checklist for manually verifying the extension. For a complete checklist see [manual-test.js](manual-test.js). 

## Development notes

The `manual-test.js` script prints a checklist for manually verifying the extension. Terms used across this project are defined in `dictionary.txt`. When adding new features, update this README so the documentation stays current.

