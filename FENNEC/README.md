# FENNEC (v0.3)

FENNEC's principal function is injecting a SIDEBAR (SB), as a navigation companion, that exctracts information from relevant enviroemts and displays it in a reordered manner and to improve agents productivity and reduce mental stress. Each enviroment has its unique layout depending on the necessities of the type.

## Features

SIDEBAR HEADER:
It remains constant throuhgout all layouts, unless IMPORTANT restriction is added.
   Left: Hamburguer Icon/Menu. This floater contains QUICK ACTIONS.
   Center: Icon, App name and version in parentheses.
   Right: Icon, clean window action. Close SB button.

CLASSIC MODE:
This is the default and most basic layout for the sidebar. It shows in Gmail (GM) and DB.

MAIN (BUSINESS FORMATION ORDERS: SILVER, GOLD, PLATINUM)
   DB:
      Title: "ORDER SUMMARY" + QUICK SUMMARY display/collapse button (⚡)
      1st box: COMPANY summary
      2nd box: AGENT summary
      3rd box: MEMBERS (LLC) or DIRECTORS (CORP, NPROFIT)
      4th box: SHAREHOLDERS (CORP, NPROFIT)
      5th box: Officers (CORP, NPROFIT)
      End: [🤖 FILE] button centered.
   GM:
      Title: [📧 SEARCH] button centered.
      1st box: COMPANY summary
      2nd box: AGENT summary
      3rd box: MEMBERS (LLC) or DIRECTORS (CORP, NPROFIT)
      4th box: SHAREHOLDERS (CORP, NPROFIT)
      5th box: Officers (CORP, NPROFIT)
      6th box: Issue summary
      End: [🔄 REFRESH] button centered.

MISC (ALL NON-BUSINESS FORMATION ORDERS)
   DB:
      Title: FAMILY TREE display/collapse icon (🌳), "ORDER SUMMARY", QUICK SUMMARY display/collapse icon (⚡)
      1st box: COMPANY summary
      2nd box: AGENT summary
      3rd box: MEMBERS (LLC) or DIRECTORS (CORP, NPROFIT)
      4th box: SHAREHOLDERS (CORP, NPROFIT)
      5th box: Officers (CORP, NPROFIT)
   GM:
      Title: [📧 SEARCH] button centered.
      1st box: COMPANY summary
      2nd box: AGENT summary
      3rd box: MEMBERS (LLC) or DIRECTORS (CORP, NPROFIT)
      4th box: SHAREHOLDERS (CORP, NPROFIT)
      5th box: Officers (CORP, NPROFIT)
      6th box: Issue summary
      End: [🔄 REFRESH] button centered.

REVIEW MODE:
This is a detailed mode for the Revenue Assurance team to assist on the order review step.

MAIN:
   DB:
      Title: "ORDER SUMMARY" + QUICK SUMMARY display/collapse button (⚡)
      1st box: COMPANY summary
      2nd box: AGENT summary
      3rd box: MEMBERS (LLC) or DIRECTORS (CORP, NPROFIT)
      4th box: SHAREHOLDERS (CORP, NPROFIT)
      5th box: Officers (CORP, NPROFIT)
   GM:
      Title: [📧 SEARCH], [🧬 DNA] & [🩻 XRAY] buttons centered.
      1st box: ADYEN's DNA summary
      2nd box: COMPANY summary (with re-estructured QUICK SUMMARY contained in same box)
      3rd box: CLIENT summary
      4th box: BILLING summary
      5th box: Issue summary
      End: [🔄 REFRESH] button centered.

MISC:
   DB:
      Title: FAMILY TREE display/collapse button (🌳), "ORDER SUMMARY", QUICK SUMMARY display/collapse button (⚡)
      1st box: CLIENT summary
      2nd box: BILLING summary
      3rd box: COMPANY summary
      4th box: AGENT summary
      5th box: MEMBERS (LLC) or DIRECTORS (CORP, NPROFIT)
      6th box: SHAREHOLDERS (CORP, NPROFIT)
      7th box: Officers (CORP, NPROFIT)
      End: [🤖 FILE] Button: Centered.
   GM:
      Title: [📧 SEARCH], [🧬 DNA] & [🩻 XRAY] buttons centered.
      1st box: ADYEN's DNA summary (Only if DNA or XRAY have been triggered)
      2nd box: COMPANY summary (with re-estructured QUICK SUMMARY contained in same box)
      3rd box: CLIENT summary
      4th box: BILLING summary
      5th box: Issue summary
      End: [🔄 REFRESH] button centered.

ICONS/BUTTONS/FUNCTIONS:

📧 SEARCH: Opens tabs in background:
   1. Gmail Search with Order Number, Customer Email, Customer Name. 
   2. Order in DB
🗑 CLEAR TABS: Closes all tabs, except the one active, in current window.
🔄 Refresh: Updates sidebar information instantly with active tab extracted information.
🧬 DNA: Opens order payment information in Adyen and exctracts relevant information from 2 tabs:
   1. Payment Details
   2. DNA

   Focus is regained to original email once information is retrieved.
🩻 XRAY: Runs SEARCH and DNA operations, one after the other. 
   It regains focus on original email at the end.
🤖 FILE: Automator that opens and fills the SOS filing process.

GENERAL FEATURES:
- Clicking COMPANY NAME opens the SOS search.
- Clicking the STATE ID in the sidebar opens the Coda Knowledge Base in a popup window covering about 70% of the page.

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
5. Open the extension **Options** from the menu or the Extensions page to set a default sidebar width and Review Mode.


## Development

This repository now includes a minimal `package.json` to simplify future testing and build automation. The `npm test` command prints manual testing steps.

### Manual testing
Rest assured all Manual testing has been completed when reporting bugs or malfunctions.
The `manual-test.js` script prints a checklist for manually verifying the extension. For a complete checklist see [manual-test.js](manual-test.js). 

## Development notes

The `manual-test.js` script prints a checklist for manually verifying the extension. Terms used across this project are defined in `dictionary.txt`. When adding new features, update this README so the documentation stays current.

