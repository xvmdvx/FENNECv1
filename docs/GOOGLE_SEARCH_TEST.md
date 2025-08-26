# Google Search Integration Test

## Overview
This document verifies that the Google search functionality is working correctly for addresses in the FENNEC (MVP) sidebar.

## Functionality Tested

### 1. Address Click Behavior
- **Location**: `core/utils.js` - `attachCommonListeners()` function
- **Selector**: `.copilot-address` elements
- **Action**: Click on any address in the sidebar
- **Expected Result**: 
  - Address copied to clipboard
  - Google search opens in new tab (NOT Google Maps)
  - Console log shows the action

### 2. URL Structure
- **Base URL**: `https://www.google.com/search?q=`
- **Address**: URL-encoded address from `data-address` attribute
- **Example**: `https://www.google.com/search?q=123%20Main%20St%2C%20New%20York%2C%20NY%2010001`

### 3. Implementation Details
```javascript
rootEl.querySelectorAll('.copilot-address').forEach(el => {
    el.addEventListener('click', e => {
        e.preventDefault();
        const addr = el.dataset.address;
        if (!addr) return;
        
        // Copy address to clipboard
        navigator.clipboard.writeText(addr).catch(err => 
            console.warn('[FENNEC (MVP)] Clipboard error:', err));
        
        // Open Google search (NOT Google Maps) for the address
        const googleSearchUrl = 'https://www.google.com/search?q=' + encodeURIComponent(addr);
        console.log('[FENNEC (MVP)] Opening Google search for address:', addr);
        window.open(googleSearchUrl, '_blank');
    });
});
```

## Test Cases

### Test Case 1: Basic Address
1. Navigate to sidebar with addresses
2. Click on any address link
3. **Expected**: Google search opens with address as query
4. **Expected**: Address copied to clipboard

### Test Case 2: Complex Address
1. Click on address with special characters
2. **Expected**: Address properly URL-encoded
3. **Expected**: Google search results show for the address

### Test Case 3: Multiple Addresses
1. Click on different addresses in the same sidebar
2. **Expected**: Each click opens new Google search tab
3. **Expected**: Correct address for each search

## Verification Steps

1. **Check Console**: Look for `[FENNEC (MVP)] Opening Google search for address:` logs
2. **Check Clipboard**: Verify address is copied to clipboard
3. **Check URL**: Ensure it's `google.com/search` not `google.com/maps`
4. **Check Results**: Verify Google search results are relevant to the address

## Error Handling

- **No address data**: Function returns early if `data-address` is missing
- **Clipboard error**: Logs warning but continues with search
- **Invalid address**: Google will handle malformed addresses gracefully

---
*Test created: December 19, 2024*
