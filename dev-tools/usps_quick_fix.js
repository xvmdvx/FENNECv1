// USPS Quick Fix Script
// Run this in the browser console to immediately fix USPS validation
// This works even if the extension hasn't been reloaded

console.log('🚀 === USPS QUICK FIX ===');

// Step 1: Check if we have USPS elements
const uspsElements = document.querySelectorAll('.copilot-usps');
console.log(`Found ${uspsElements.length} USPS elements`);

if (uspsElements.length === 0) {
    console.error('❌ No USPS elements found. Make sure you are on a page with addresses.');
    return;
}

// Step 2: Create a simple USPS click handler
function createUspsClickHandler(element) {
    return function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const address = element.dataset.address;
        console.log('🚀 USPS clicked for address:', address);
        
        if (!address) {
            console.error('❌ No address data found');
            return;
        }
        
        // Create the USPS URL
        const url = 'https://tools.usps.com/zip-code-lookup.htm?byaddress&fennec_addr=' + encodeURIComponent(address);
        console.log('🔗 Opening USPS URL:', url);
        
        // Try to open the URL
        try {
            window.open(url, '_blank');
            console.log('✅ USPS tab opened successfully');
        } catch (error) {
            console.error('❌ Error opening USPS tab:', error.message);
        }
    };
}

// Step 3: Add click handlers to all USPS elements
console.log('🔧 Adding click handlers to USPS elements...');

uspsElements.forEach((element, index) => {
    // Remove any existing listeners to avoid duplicates
    element.replaceWith(element.cloneNode(true));
    
    // Get the fresh element
    const freshElement = document.querySelectorAll('.copilot-usps')[index];
    
    // Add the click handler
    freshElement.addEventListener('click', createUspsClickHandler(freshElement));
    
    // Make sure it's clickable
    freshElement.style.cursor = 'pointer';
    freshElement.style.pointerEvents = 'auto';
    
    console.log(`✅ Added click handler to USPS element ${index + 1}: ${freshElement.dataset.address}`);
});

// Step 4: Test the first element
console.log('\n🧪 Testing first USPS element...');
const firstUsps = document.querySelector('.copilot-usps');
if (firstUsps) {
    console.log('✅ First USPS element ready for testing');
    console.log('💡 Click any envelope icon (✉️) to test USPS validation');
} else {
    console.error('❌ No USPS elements found after setup');
}

// Step 5: Create a test function
window.testUspsValidation = function() {
    console.log('🧪 Testing USPS validation...');
    const firstUsps = document.querySelector('.copilot-usps');
    if (firstUsps) {
        console.log('Clicking first USPS element...');
        firstUsps.click();
    } else {
        console.error('No USPS elements found');
    }
};

// Step 6: Create a manual USPS trigger function
window.triggerUspsValidation = function(address) {
    console.log('🚀 Manually triggering USPS validation for:', address);
    
    if (!address) {
        console.error('❌ No address provided');
        return;
    }
    
    const url = 'https://tools.usps.com/zip-code-lookup.htm?byaddress&fennec_addr=' + encodeURIComponent(address);
    console.log('🔗 Opening USPS URL:', url);
    
    try {
        window.open(url, '_blank');
        console.log('✅ USPS tab opened successfully');
    } catch (error) {
        console.error('❌ Error opening USPS tab:', error.message);
    }
};

console.log('\n✅ === USPS QUICK FIX COMPLETE ===');
console.log('📋 Available functions:');
console.log('- testUspsValidation() - Test the first USPS element');
console.log('- triggerUspsValidation("address") - Manually trigger USPS for specific address');
console.log('💡 Click any envelope icon (✉️) to test USPS validation');

// Auto-test the first element
console.log('\n🧪 Auto-testing first USPS element...');
setTimeout(() => {
    const firstUsps = document.querySelector('.copilot-usps');
    if (firstUsps) {
        console.log('Auto-clicking first USPS element...');
        firstUsps.click();
    }
}, 1000);
