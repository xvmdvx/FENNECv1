// USPS Issue Diagnostic Script
// Run this in the browser console to diagnose the USPS validation issue

console.log('🔍 === USPS ISSUE DIAGNOSTIC ===');

// Test 1: Check if we're in the right context
console.log('\n1. CONTEXT CHECK:');
console.log('Current URL:', window.location.href);
console.log('Is incfile.com:', window.location.href.includes('incfile.com'));
console.log('Is in iframe:', window !== window.top);

// Test 2: Check if extension scripts are loaded
console.log('\n2. SCRIPT LOADING CHECK:');
console.log('window.FENNEC available:', typeof window.FENNEC !== 'undefined');
console.log('window.fennecMessenger available:', typeof window.fennecMessenger !== 'undefined');

// Test 3: Check for USPS elements
console.log('\n3. USPS ELEMENTS CHECK:');
const uspsElements = document.querySelectorAll('.copilot-usps');
console.log('USPS elements found:', uspsElements.length);

if (uspsElements.length > 0) {
    uspsElements.forEach((el, index) => {
        console.log(`USPS Element ${index + 1}:`, {
            address: el.dataset.address,
            hasListener: el.dataset.uspsListenerAdded,
            innerHTML: el.innerHTML,
            className: el.className,
            style: {
                cursor: el.style.cursor,
                pointerEvents: el.style.pointerEvents
            }
        });
    });
}

// Test 4: Check for function availability
console.log('\n4. FUNCTION AVAILABILITY CHECK:');
const functionsToCheck = [
    'attachCommonListeners',
    'ensureUspsListenersAttached',
    'debugUspsValidation',
    'smartCopyAddress'
];

functionsToCheck.forEach(funcName => {
    const isAvailable = typeof window[funcName] === 'function';
    console.log(`${funcName}: ${isAvailable ? '✅' : '❌'}`);
});

// Test 5: Check chrome.runtime
console.log('\n5. CHROME RUNTIME CHECK:');
console.log('chrome available:', typeof chrome !== 'undefined');
if (typeof chrome !== 'undefined') {
    console.log('chrome.runtime available:', typeof chrome.runtime !== 'undefined');
    console.log('chrome.runtime.id:', chrome.runtime?.id);
    console.log('chrome.runtime.getURL available:', typeof chrome.runtime?.getURL === 'function');
}

// Test 6: Check for any existing event listeners
console.log('\n6. EVENT LISTENER CHECK:');
if (uspsElements.length > 0) {
    const firstUsps = uspsElements[0];
    console.log('First USPS element event listeners:');
    
    // Try to check if there are any click handlers
    const originalClick = firstUsps.onclick;
    let clickHandlerFound = false;
    
    try {
        // Test if element is clickable
        firstUsps.onclick = () => {
            clickHandlerFound = true;
            console.log('✅ Click handler executed');
        };
        firstUsps.click();
        firstUsps.onclick = originalClick;
        
        if (clickHandlerFound) {
            console.log('✅ Element is clickable');
        } else {
            console.log('❌ Element click handler not triggered');
        }
    } catch (error) {
        console.log('❌ Error testing click:', error.message);
    }
}

// Test 7: Check for any console errors
console.log('\n7. CONSOLE ERROR CHECK:');
console.log('Check the console above for any error messages');

// Test 8: Manual USPS test
console.log('\n8. MANUAL USPS TEST:');
if (uspsElements.length > 0) {
    const firstUsps = uspsElements[0];
    console.log('Testing manual USPS click on:', firstUsps.dataset.address);
    
    // Create a simple test function
    const testUspsClick = () => {
        console.log('🔍 Testing USPS click manually...');
        
        // Check if the element has the right data
        if (!firstUsps.dataset.address) {
            console.error('❌ No address data found');
            return;
        }
        
        console.log('✅ Address data found:', firstUsps.dataset.address);
        
        // Try to simulate the USPS flow manually
        const address = firstUsps.dataset.address;
        const url = 'https://tools.usps.com/zip-code-lookup.htm?byaddress&fennec_addr=' + encodeURIComponent(address);
        
        console.log('🔗 USPS URL would be:', url);
        
        // Try to open the URL
        try {
            window.open(url, '_blank');
            console.log('✅ URL opened successfully');
        } catch (error) {
            console.error('❌ Error opening URL:', error.message);
        }
    };
    
    // Add a temporary click handler for testing
    firstUsps.addEventListener('click', testUspsClick, { once: true });
    console.log('✅ Temporary click handler added for testing');
    console.log('💡 Click the envelope icon now to test');
}

// Test 9: Check for any global variables that might help
console.log('\n9. GLOBAL VARIABLES CHECK:');
const globalVars = [
    'FENNEC',
    'fennecMessenger',
    'fennecBackground',
    'attachCommonListeners',
    'ensureUspsListenersAttached'
];

globalVars.forEach(varName => {
    const exists = typeof window[varName] !== 'undefined';
    console.log(`${varName}: ${exists ? '✅' : '❌'}`);
});

console.log('\n🔍 === END USPS ISSUE DIAGNOSTIC ===');

// Instructions
console.log('\n📋 DIAGNOSTIC RESULTS:');
console.log('1. If functions are missing (❌), reload the extension');
console.log('2. If chrome.runtime is missing, check extension permissions');
console.log('3. If USPS elements exist but no listeners, run manual test');
console.log('4. Check for any console errors above');

// Quick fix attempt
console.log('\n🔧 QUICK FIX ATTEMPT:');
if (uspsElements.length > 0 && typeof chrome !== 'undefined' && chrome.runtime) {
    console.log('Attempting to manually trigger USPS validation...');
    
    const firstUsps = uspsElements[0];
    const address = firstUsps.dataset.address;
    
    if (address) {
        console.log('Sending USPS message for address:', address);
        
        chrome.runtime.sendMessage({
            action: 'openUspsAndStoreSource',
            url: 'https://tools.usps.com/zip-code-lookup.htm?byaddress&fennec_addr=' + encodeURIComponent(address),
            address: address
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('❌ USPS message failed:', chrome.runtime.lastError);
            } else {
                console.log('✅ USPS message sent successfully:', response);
            }
        });
    }
}
