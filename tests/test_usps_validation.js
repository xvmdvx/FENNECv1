// USPS Validation Test Script
// Run this in the browser console to test USPS validation functionality

console.log('=== USPS VALIDATION TEST ===');

// Test 1: Check if debug function is available
console.log('1. Checking if debugUspsValidation function is available...');
if (typeof window.debugUspsValidation === 'function') {
    console.log('✅ debugUspsValidation function is available');
    window.debugUspsValidation();
} else {
    console.error('❌ debugUspsValidation function is NOT available');
    console.log('💡 This means the extension needs to be reloaded');
    console.log('   Go to chrome://extensions/ and reload the FENNEC extension');
}

// Test 2: Check for USPS elements
console.log('\n2. Checking for USPS elements...');
const uspsElements = document.querySelectorAll('.copilot-usps');
console.log(`Found ${uspsElements.length} USPS elements`);

if (uspsElements.length > 0) {
    console.log('✅ USPS elements found');
    
    // Check first USPS element
    const firstUsps = uspsElements[0];
    console.log('First USPS element:', {
        address: firstUsps.dataset.address,
        hasListener: firstUsps.dataset.uspsListenerAdded,
        innerHTML: firstUsps.innerHTML
    });
    
    // Test 3: Check if attachCommonListeners is available
    console.log('\n3. Checking if attachCommonListeners function is available...');
    if (typeof attachCommonListeners === 'function') {
        console.log('✅ attachCommonListeners function is available');
    } else {
        console.error('❌ attachCommonListeners function is NOT available');
    }
    
    // Test 4: Check if ensureUspsListenersAttached is available
    console.log('\n4. Checking if ensureUspsListenersAttached function is available...');
    if (typeof window.ensureUspsListenersAttached === 'function') {
        console.log('✅ ensureUspsListenersAttached function is available');
        
        // Try to re-attach listeners
        console.log('Attempting to re-attach USPS listeners...');
        window.ensureUspsListenersAttached();
    } else {
        console.error('❌ ensureUspsListenersAttached function is NOT available');
    }
    
    // Test 5: Check chrome.runtime availability
    console.log('\n5. Checking chrome.runtime availability...');
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        console.log('✅ chrome.runtime is available');
        
        // Test background script communication
        console.log('Testing background script communication...');
        chrome.runtime.sendMessage({
            action: 'testMessage',
            test: 'USPS validation test'
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('❌ Background script communication failed:', chrome.runtime.lastError);
            } else {
                console.log('✅ Background script communication successful:', response);
            }
        });
    } else {
        console.error('❌ chrome.runtime is NOT available');
    }
    
    // Test 6: Manual click test
    console.log('\n6. Testing manual click on first USPS element...');
    console.log('Clicking on address:', firstUsps.dataset.address);
    firstUsps.click();
    
} else {
    console.error('❌ No USPS elements found on this page');
    console.log('💡 Make sure you are on a page with addresses (Gmail, DB, etc.)');
}

console.log('\n=== END USPS VALIDATION TEST ===');

// Instructions for next steps
console.log('\n📋 NEXT STEPS:');
console.log('1. If any tests failed, reload the extension in chrome://extensions/');
console.log('2. Refresh this page');
console.log('3. Run this test again');
console.log('4. Try clicking an envelope icon (✉️) manually');
console.log('5. Check console for USPS validation logs');
