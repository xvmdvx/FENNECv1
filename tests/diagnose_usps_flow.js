// Diagnostic script to identify USPS flow issues
// Run this in the browser console to diagnose the exact problem

console.log('🔍 === USPS FLOW DIAGNOSTIC ===');

// Step 1: Check environment
console.log('\n1. ENVIRONMENT CHECK:');
console.log('URL:', window.location.href);
console.log('Chrome available:', typeof chrome !== 'undefined');
console.log('Chrome runtime available:', typeof chrome !== 'undefined' && chrome.runtime);
console.log('Chrome storage available:', typeof chrome !== 'undefined' && chrome.storage);

// Step 2: Check USPS elements
console.log('\n2. USPS ELEMENTS CHECK:');
const uspsElements = document.querySelectorAll('.copilot-usps');
console.log('USPS elements found:', uspsElements.length);

if (uspsElements.length > 0) {
    const firstUsps = uspsElements[0];
    console.log('First USPS element details:', {
        address: firstUsps.dataset.address,
        hasListener: firstUsps.dataset.uspsListenerAdded,
        innerHTML: firstUsps.innerHTML,
        className: firstUsps.className,
        style: {
            cursor: firstUsps.style.cursor,
            pointerEvents: firstUsps.style.pointerEvents
        }
    });
}

// Step 3: Test chrome.runtime communication
console.log('\n3. CHROME RUNTIME TEST:');
if (typeof chrome !== 'undefined' && chrome.runtime) {
    console.log('Testing background script communication...');
    
    chrome.runtime.sendMessage({
        action: 'testMessage',
        test: 'USPS diagnostic test'
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.error('❌ Background script error:', chrome.runtime.lastError);
        } else {
            console.log('✅ Background script response:', response);
        }
    });
    
    // Test specific USPS message
    setTimeout(() => {
        console.log('Testing USPS-specific message...');
        chrome.runtime.sendMessage({
            action: 'openUspsAndStoreSource',
            url: 'https://tools.usps.com/zip-code-lookup.htm?byaddress&fennec_addr=TEST',
            address: 'TEST ADDRESS'
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('❌ USPS message error:', chrome.runtime.lastError);
            } else {
                console.log('✅ USPS message response:', response);
            }
        });
    }, 1000);
} else {
    console.error('❌ Chrome runtime not available');
}

// Step 4: Test chrome.storage
console.log('\n4. CHROME STORAGE TEST:');
if (typeof chrome !== 'undefined' && chrome.storage) {
    const testKey = 'usps_diagnostic_test';
    
    chrome.storage.local.set({ [testKey]: 'test_value' }, () => {
        if (chrome.runtime.lastError) {
            console.error('❌ Storage set error:', chrome.runtime.lastError);
        } else {
            console.log('✅ Storage set successful');
            
            chrome.storage.local.get({ [testKey]: null }, (result) => {
                if (chrome.runtime.lastError) {
                    console.error('❌ Storage get error:', chrome.runtime.lastError);
                } else {
                    console.log('✅ Storage get successful:', result[testKey]);
                    
                    // Clean up
                    chrome.storage.local.remove(testKey);
                }
            });
        }
    });
} else {
    console.error('❌ Chrome storage not available');
}

// Step 5: Test window.open
console.log('\n5. WINDOW.OPEN TEST:');
try {
    const testUrl = 'https://tools.usps.com/zip-code-lookup.htm?byaddress&fennec_addr=TEST';
    console.log('Testing URL:', testUrl);
    
    const newWindow = window.open(testUrl, '_blank');
    if (newWindow) {
        console.log('✅ Window.open successful');
        // Close the test window
        setTimeout(() => {
            newWindow.close();
            console.log('✅ Test window closed');
        }, 2000);
    } else {
        console.error('❌ Window.open failed (popup blocked?)');
    }
} catch (error) {
    console.error('❌ Window.open error:', error.message);
}

// Step 6: Test event listener attachment
console.log('\n6. EVENT LISTENER TEST:');
if (uspsElements.length > 0) {
    const testElement = uspsElements[0];
    
    // Test if element is clickable
    console.log('Testing element clickability...');
    
    // Add a test listener
    const testListener = () => {
        console.log('✅ Test click listener executed');
    };
    
    testElement.addEventListener('click', testListener);
    console.log('✅ Test listener added');
    
    // Simulate click
    console.log('Simulating click...');
    testElement.click();
    
    // Remove test listener
    testElement.removeEventListener('click', testListener);
    console.log('✅ Test listener removed');
}

// Step 7: Check for any console errors
console.log('\n7. CONSOLE ERROR CHECK:');
console.log('Check the console above for any error messages');
console.log('Look for:');
console.log('- Chrome runtime errors');
console.log('- Storage errors');
console.log('- Message passing errors');
console.log('- Window.open errors');

// Step 8: Summary
console.log('\n8. DIAGNOSTIC SUMMARY:');
console.log('Based on the tests above:');
console.log('- If chrome.runtime errors: Background script issue');
console.log('- If storage errors: Extension permissions issue');
console.log('- If window.open fails: Popup blocker or security issue');
console.log('- If no click listeners: Event attachment issue');
console.log('- If all tests pass but USPS doesn\'t work: Logic flow issue');

console.log('\n🔍 === END USPS FLOW DIAGNOSTIC ===');
