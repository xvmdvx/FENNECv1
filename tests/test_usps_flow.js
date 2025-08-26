// Test script to verify USPS validation flow
// Run this in the browser console to test the complete USPS flow

console.log('🧪 === USPS FLOW TEST ===');

// Test 1: Check chrome.runtime availability
console.log('\n1. Testing chrome.runtime availability...');
if (typeof chrome !== 'undefined' && chrome.runtime) {
    console.log('✅ Chrome runtime is available');
    console.log('Chrome runtime ID:', chrome.runtime.id);
    
    // Test background script communication
    console.log('Testing background script communication...');
    chrome.runtime.sendMessage({
        action: 'testMessage',
        test: 'USPS flow test'
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.error('❌ Background script communication failed:', chrome.runtime.lastError);
        } else {
            console.log('✅ Background script communication successful:', response);
        }
    });
} else {
    console.error('❌ Chrome runtime is NOT available');
}

// Test 2: Check USPS elements and their listeners
console.log('\n2. Testing USPS elements...');
const uspsElements = document.querySelectorAll('.copilot-usps');
console.log(`Found ${uspsElements.length} USPS elements`);

uspsElements.forEach((el, index) => {
    console.log(`USPS Element ${index + 1}:`, {
        address: el.dataset.address,
        hasListener: el.dataset.uspsListenerAdded,
        innerHTML: el.innerHTML,
        className: el.className
    });
});

// Test 3: Test direct USPS URL opening
console.log('\n3. Testing direct USPS URL opening...');
if (uspsElements.length > 0) {
    const testAddress = uspsElements[0].dataset.address;
    console.log('Test address:', testAddress);
    
    const testUrl = 'https://tools.usps.com/zip-code-lookup.htm?byaddress&fennec_addr=' + encodeURIComponent(testAddress);
    console.log('Test URL:', testUrl);
    
    try {
        const newWindow = window.open(testUrl, '_blank');
        if (newWindow) {
            console.log('✅ USPS URL opened successfully');
        } else {
            console.error('❌ USPS URL failed to open (popup blocked?)');
        }
    } catch (error) {
        console.error('❌ Error opening USPS URL:', error.message);
    }
}

// Test 4: Test chrome.storage functionality
console.log('\n4. Testing chrome.storage functionality...');
if (typeof chrome !== 'undefined' && chrome.storage) {
    const testKey = 'usps_test_key';
    const testValue = { test: 'data', timestamp: Date.now() };
    
    chrome.storage.local.set({ [testKey]: testValue }, () => {
        if (chrome.runtime.lastError) {
            console.error('❌ Error setting storage:', chrome.runtime.lastError);
        } else {
            console.log('✅ Storage set successfully');
            
            chrome.storage.local.get({ [testKey]: null }, (result) => {
                if (chrome.runtime.lastError) {
                    console.error('❌ Error getting storage:', chrome.runtime.lastError);
                } else {
                    console.log('✅ Storage retrieved successfully:', result[testKey]);
                    
                    // Clean up
                    chrome.storage.local.remove(testKey, () => {
                        console.log('✅ Test storage cleaned up');
                    });
                }
            });
        }
    });
} else {
    console.error('❌ Chrome storage not available');
}

// Test 5: Simulate USPS click with detailed logging
console.log('\n5. Simulating USPS click with detailed logging...');
if (uspsElements.length > 0) {
    const testElement = uspsElements[0];
    console.log('Test element:', testElement);
    console.log('Test element address:', testElement.dataset.address);
    
    // Create a detailed click simulation
    const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
    });
    
    console.log('Dispatching click event...');
    const result = testElement.dispatchEvent(clickEvent);
    console.log('Click event result:', result);
    
    // Check if any event listeners were triggered
    setTimeout(() => {
        console.log('Click simulation completed');
    }, 1000);
}

// Test 6: Check for any existing event listeners
console.log('\n6. Checking for existing event listeners...');
if (uspsElements.length > 0) {
    const testElement = uspsElements[0];
    
    // Try to check if there are any click handlers
    const originalOnClick = testElement.onclick;
    let clickHandlerFound = false;
    
    testElement.onclick = () => {
        clickHandlerFound = true;
        console.log('✅ Click handler executed during test');
    };
    
    testElement.click();
    testElement.onclick = originalOnClick;
    
    if (clickHandlerFound) {
        console.log('✅ Element has click handlers');
    } else {
        console.log('❌ Element has no click handlers');
    }
}

console.log('\n🧪 === END USPS FLOW TEST ===');
console.log('📋 Check the console above for any errors or issues');
console.log('💡 If USPS URL opened, check if the page loads correctly');
console.log('🔍 Look for any error messages in the console');
