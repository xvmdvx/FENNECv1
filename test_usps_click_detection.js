// Test script to verify USPS click detection
// Run this in the browser console after reloading the extension

console.log('🧪 === USPS CLICK DETECTION TEST ===');

// Test 1: Check if global listener is working
console.log('1. Testing global click detection...');

// Create a test USPS element
const testUspsElement = document.createElement('span');
testUspsElement.className = 'copilot-usps';
testUspsElement.dataset.address = 'TEST ADDRESS - 123 Test St, Test City, TX 12345';
testUspsElement.innerHTML = ' ✉️';
testUspsElement.style.cursor = 'pointer';
testUspsElement.style.padding = '5px';
testUspsElement.style.border = '1px solid red';
testUspsElement.style.backgroundColor = 'yellow';

// Add it to the page temporarily
document.body.appendChild(testUspsElement);

console.log('✅ Test USPS element created and added to page');
console.log('💡 Click the yellow envelope icon to test click detection');

// Test 2: Check for existing USPS elements
console.log('\n2. Checking for existing USPS elements...');
const existingUspsElements = document.querySelectorAll('.copilot-usps');
console.log(`Found ${existingUspsElements.length} existing USPS elements`);

existingUspsElements.forEach((el, index) => {
    console.log(`USPS Element ${index + 1}:`, {
        address: el.dataset.address,
        innerHTML: el.innerHTML,
        className: el.className
    });
});

// Test 3: Simulate click on test element
console.log('\n3. Simulating click on test element...');
setTimeout(() => {
    console.log('Clicking test USPS element...');
    testUspsElement.click();
}, 2000);

// Test 4: Clean up test element
setTimeout(() => {
    console.log('\n4. Cleaning up test element...');
    if (testUspsElement.parentNode) {
        testUspsElement.parentNode.removeChild(testUspsElement);
        console.log('✅ Test element removed');
    }
}, 5000);

console.log('\n🧪 === END USPS CLICK DETECTION TEST ===');
console.log('📋 Expected behavior:');
console.log('- You should see console logs when clicking envelope icons');
console.log('- The test element should trigger a click detection');
console.log('- Existing USPS elements should also work');
