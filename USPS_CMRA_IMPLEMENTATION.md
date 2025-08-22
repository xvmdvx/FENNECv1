# USPS CMRA Validation Implementation

## Overview
This document describes the implementation of USPS address validation with CMRA (Commercial Mail Receiving Agency) detection and Google search integration for addresses in the FENNEC (MVP) sidebar.

## Features Implemented

### 1. USPS CMRA Detection
- **Location**: `environments/usps/usps_launcher.js`
- **Functionality**: 
  - Automatically fills USPS form with address from URL parameter
  - Waits for results page to load
  - **Automatically clicks dropdown** to expand address details
  - Detects CMRA field in expanded USPS results using proper DOM traversal
  - Sends CMRA result back to background script

### 2. Background Script Integration
- **Location**: `core/background_email_search.js`
- **Functionality**:
  - Receives CMRA results from USPS launcher
  - Stores results in chrome.storage.local
  - Broadcasts results to all sidebar tabs (Gmail and DB)

### 3. Sidebar Icon Updates
- **Location**: `core/utils.js`
- **Functionality**:
  - Updates USPS icons based on CMRA results
  - ✅ Green check for residential address (NOT CMRA - good for delivery)
  - ⚠️ Yellow warning for CMRA detected (Commercial Mail Receiving Agency - may need special handling)
  - ✉️ Default envelope icon before validation

### 4. Google Search Integration
- **Location**: `core/utils.js` - `attachCommonListeners()` function
- **Functionality**:
  - Clicking any address (`.copilot-address`) opens Google search (NOT Google Maps)
  - Automatically copies address to clipboard
  - Opens search in new tab with proper URL encoding
  - Provides console logging for debugging
  - Works across all environments (Gmail, DB, Adyen)

## Technical Implementation Details

### CMRA Detection Algorithm
```javascript
function detectCMRAFromResults() {
    // First, try to click the dropdown if it's not already expanded
    const listGroupItem = document.querySelector('li.list-group-item');
    if (listGroupItem && !listGroupItem.classList.contains('active')) {
        listGroupItem.click();
        setTimeout(() => detectCMRAFromExpandedResults(), 500);
        return;
    }
    detectCMRAFromExpandedResults();
}

function detectCMRAFromExpandedResults() {
    // Search for "COMMERCIAL MAIL RECEIVING AGENCY" text
    // Find corresponding value in same row
    // Send result to background script
}
```

### Result Page Detection
```javascript
function waitForResultsAndDetectCMRA() {
    const resultsContainer = document.querySelector('.results-container, .zip-results, [class*="result"]');
    const hasZipResult = document.querySelector('.zipcode-result-address');
    const hasListGroup = document.querySelector('.list-group-item');
    
    if (resultsContainer || hasZipResult || hasListGroup) {
        // Wait 1 second for full page load, then detect CMRA
    }
}
```

## User Workflow

1. **Navigate to sidebar** with addresses
2. **Click the USPS icon (✉️)** next to any address
3. **Wait for USPS page to load** and form to be filled automatically
4. **Wait for results page** and automatic dropdown expansion
5. **Wait for CMRA detection** in expanded details
6. **Return to sidebar** and verify icon has changed:
   - ✅ Green check for residential address (NOT CMRA - good for delivery)
   - ⚠️ Yellow warning for CMRA detected (Commercial Mail Receiving Agency - may need special handling)

## Error Handling

- **Form not found**: Retries up to 3 times with 500ms delays
- **CMRA field not found**: Logs warning and continues
- **Invalid selectors**: Uses fallback selectors
- **Network errors**: Graceful degradation with user feedback
- **Dropdown not expanded**: Automatically clicks to expand

## Debug Information

The system provides detailed console logging:
- Form field detection and filling
- Result page detection
- Dropdown expansion
- CMRA detection attempts and results
- Element structure analysis

---
*Implementation completed: December 19, 2024*
*Last updated: December 19, 2024 - Added automatic dropdown click functionality*
