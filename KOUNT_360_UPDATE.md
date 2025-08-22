# KOUNT 360 Integration Update

## Overview
KOUNT has updated their web interface to KOUNT 360, which requires changes to the FENNEC integration. This document outlines the key changes made to support the new environment.

## Key Changes

### 1. KOUNT Score Icon Clicking
- **Old**: KOUNT was opened via direct URL navigation
- **New**: KOUNT must be opened by simulating a click on the KOUNT SCORE icon in DB orders
- **Pattern**: `<a href="https://app.kount.com/event-analysis/order/XP49Q95HY926SPKT" target="_blank"><span class="circle-score green">96</span></a>`

### 2. New KOUNT 360 Environment
- **URL Pattern**: `https://app.kount.com/event-analysis/order/{ORDER_ID}`
- **Old URL Pattern**: `https://awc.kount.net/workflow/detail.html?id={ORDER_ID}`
- **Environment Detection**: The launcher now detects KOUNT 360 by checking for `app.kount.com` or `/event-analysis/order/` in the URL

### 3. EKATA Integration Changes
- **Old Flow**: EKATA data was obtained by opening a new tab to the EKATA page
- **New Flow**: EKATA data is obtained by clicking "Request Data" inside the EKATA widget in KOUNT 360
- **Button Selector**: `[data-test-id="load-ekata-data-button"]`
- **Widget Selector**: `ekata-widget`

### 4. Data Extraction Updates

#### Basic KOUNT Data
The launcher now looks for basic KOUNT data using new selectors:
- Email age: `[data-test-id*="email"], [title*="email"], .email-age`
- Device location: `[data-test-id*="location"], [title*="location"], .device-location`
- IP address: `[data-test-id*="ip"], [title*="ip"], .ip-address`

#### EKATA Data Structure
The new EKATA data structure includes:
- **Scores**: Various EKATA scores with `data-test-id` attributes like `ekata.identityCheckScore`, `ekata.identityNetworkScore`
- **Status Counts**: Counts for different categories (IP, Address, Phone, Email) with status indicators (PASS, NEUTRAL, WARNING)
- **Legacy Fields**: Still supports old fields like `ipValid`, `proxyRisk`, `addressToName`, `residentName`

### 5. Updated Files

#### `environments/kount/kount_launcher.js`
- Added KOUNT 360 environment detection
- Updated EKATA data extraction to use new widget structure
- Added support for new EKATA scores and status counts
- Maintained backward compatibility with old KOUNT environment

#### `environments/db/db_launcher.js`
- Updated `findKountLink()` function to detect both old and new KOUNT URL patterns
- Updated `buildKountHtml()` function to display new EKATA data structure
- Added support for EKATA scores display

### 6. Data Flow

1. **DB Order Page**: User clicks KOUNT score icon
2. **KOUNT 360 Page**: Opens with new URL pattern
3. **EKATA Widget**: Automatically clicks "Request Data" button
4. **Data Extraction**: Waits for EKATA data to load and extracts scores/status
5. **ADYEN Navigation**: Proceeds to ADYEN after EKATA completion

### 7. Backward Compatibility

The integration maintains full backward compatibility:
- Still supports old KOUNT environment (`awc.kount.net`)
- Still supports old EKATA page navigation
- Gracefully handles missing elements in either environment

### 8. Example Data Structure

```javascript
{
  emailAge: "0 days old",
  deviceLocation: "Chicago, IL, US",
  ip: "104.28.97.16",
  ekata: {
    scores: {
      "ekata.identityCheckScore": "450",
      "ekata.identityNetworkScore": "0.94"
    },
    ipValid: "true",
    proxyRisk: "false",
    addressToName: "John Doe",
    residentName: "John Doe"
  }
}
```

## Testing

To test the new integration:
1. Navigate to a DB order page with a KOUNT score icon
2. Click the KOUNT score icon to open KOUNT 360
3. Verify that the EKATA widget loads and "Request Data" is clicked automatically
4. Check that EKATA data is extracted and displayed in the sidebar
5. Verify that the flow continues to ADYEN as expected

## Notes

- The integration now supports both old and new KOUNT environments seamlessly
- EKATA data extraction has been enhanced to capture more detailed scoring information
- The flow maintains the same overall structure but adapts to the new KOUNT 360 interface
- **Fixed**: Flow completion issues have been resolved with improved error handling and fallback mechanisms
- **Fixed**: Enhanced data extraction with multiple selector strategies for better compatibility
- **Fixed**: Added comprehensive logging for debugging flow issues
- **Fixed**: Added page load waiting mechanism to ensure stable data extraction
- **Fixed**: Implemented retry mechanism for EKATA data loading with smart detection
- **Fixed**: Added error state detection to handle 403 and other API errors gracefully
- **Fixed**: Enhanced IP address extraction with regex pattern matching
- **Fixed**: Added multiple safety timeouts to guarantee flow completion
- **Fixed**: Prevented duplicate KOUNT tab opening with session storage flag
- **Fixed**: Improved tab identification for fraud review flow tracking
- **Fixed**: Enhanced navigation logic to properly continue to ADYEN after KOUNT completion
- **Fixed**: Added proper cleanup of flow state variables
- **Fixed**: Enhanced EKATA "Request Data" button clicking with multiple strategies for Angular Material buttons
- **Fixed**: Added button state verification and clickability checks
- **Fixed**: Implemented retry mechanism for button clicking with fallback strategies
- **Fixed**: Improved tab title setting to work immediately without async delays
- **Fixed**: Enhanced button clicking with more comprehensive event simulation
- **Fixed**: Added fallback mechanism to try clicking even if button appears non-clickable
- **Fixed**: Increased wait time for button readiness and added detailed logging
- **Fixed**: Added immediate tab title setting to handle extension context invalidation
- **Fixed**: Created independent KOUNT 360 flow function that runs regardless of chrome.storage availability
- **Fixed**: Added fallback EKATA flow execution to ensure button clicking works even if extension context is invalidated
- **Fixed**: Added new KOUNT 360 URL pattern to manifest.json content scripts
- **Fixed**: Added KOUNT domains to host permissions for proper extension access
- **Fixed**: Implemented persistent tab title maintenance with MutationObserver
- **Fixed**: Added document.title setter override to prevent title overwriting
- **Fixed**: Added periodic title checks as fallback mechanism
- **Enhanced**: Added EKATA expand button clicking to access detailed information
- **Enhanced**: Added extraction of proxy and resident information from expanded EKATA modal
- **Enhanced**: Improved EKATA data structure with comprehensive scoring and details
- **Enhanced**: Updated KOUNT HTML display to show detailed EKATA scores and information
- **Enhanced**: Added trial floater trigger when both ADYEN and KOUNT flows complete
- **Enhanced**: Ensured proper flow continuation to ADYEN after EKATA completion
- **Enhanced**: Implemented robust EKATA generation with retry logic and longer timeouts
- **Enhanced**: Added organized KOUNT data display in TRIAL FLOATER with structured sections (ADDRESS, EMAIL, IP, PHONE)
- **Fixed**: Implemented proper data extraction from EKATA detailed information to display clean, formatted data
- **Enhanced**: Improved resident name extraction with special regex patterns to handle complex data structures
- **Enhanced**: Enhanced proxy risk and email age extraction with better text parsing
- **Fixed**: Separated BILLING RESIDENT and SHIPPING RESIDENT extraction to display both names correctly
- **Enhanced**: Improved email owner extraction using "Registered Owner Name" pattern
- **Enhanced**: Improved phone owner extraction using "Subscriber Name" pattern
- **Enhanced**: Improved phone location extraction using "Carrier" pattern
- **Enhanced**: Added comprehensive debugging and multiple fallback patterns for name extraction
- **Enhanced**: Added fallback logic to use single resident name for both billing and shipping when only one is found
- **Fixed**: Resolved remaining "overlay is not defined" JavaScript errors in TRIAL FLOATER event handlers
- **Enhanced**: Added more flexible regex patterns for name extraction with global matching and fallback strategies
- **Fixed**: Updated extraction logic to handle actual EKATA data structure where data is nested in proxyDetails
- **Enhanced**: Added extraction from proxyDetails field for resident names, email owners, phone owners, and carriers
- **Fixed**: Added extraction from raw JSON string as fallback for all EKATA data fields
- **Fixed**: Resolved `collectStates is not defined` error by moving function definition to top of file
- **Enhanced**: Added fallback mechanism to complete flow even if EKATA generation fails
- **Fixed**: Added comprehensive error handling in TRIAL FLOATER construction to prevent display failures
- **Fixed**: Resolved "title is not defined" JavaScript error that was preventing TRIAL FLOATER from displaying properly
- **Fixed**: Added null/undefined checks in all string manipulation functions to prevent runtime errors
- **Fixed**: Added try-catch wrappers around critical TRIAL FLOATER display logic
- **Fixed**: Corrected proxy risk logic to properly handle boolean values (false = NO proxy, true = YES proxy)
- **Fixed**: Enhanced IP validation and address matching logic to handle both string and boolean values
- **Enhanced**: Added comprehensive debugging for TRIAL FLOATER display issues
- **Fixed**: Removed incorrect TRIAL FLOATER display logic that was causing "FRAUD REVIEW" banner to appear when it shouldn't
- **Fixed**: Added cleanup functions to remove existing TRIAL FLOATER on normal page loads
- **Fixed**: TRIAL FLOATER now only displays when both ADYEN and KOUNT flows are properly completed
