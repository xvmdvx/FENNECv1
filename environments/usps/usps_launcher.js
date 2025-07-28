// Injects the FENNEC (POO) sidebar into USPS pages.
class UspsLauncher extends Launcher {
    init() {
    if (window.top !== window) return;
    const bg = fennecMessenger;
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === 'fennecToggle') {
            window.location.reload();
        }
    });
    chrome.storage.local.get({ extensionEnabled: true }, ({ extensionEnabled }) => {
        if (!extensionEnabled) {
            console.log('[FENNEC (POO)] Extension disabled, skipping USPS launcher.');
            return;
        }
        try {
        const params = new URLSearchParams(window.location.search);
        const addr = params.get('fennec_addr');
        if (!addr) return;

        function parseAddress(str) {
            const result = { line1: '', line2: '', city: '', state: '', zip: '' };
            if (!str) return result;

            // Clean the input string
            let cleanStr = str.trim();
            
            // Remove any potential labels like "Physical:" or "Mailing:" that might have been included
            cleanStr = cleanStr.replace(/^(physical|mailing|principal):\s*/i, '');
            
            // Remove any country codes that might still be present
            cleanStr = cleanStr.replace(/,\s*(US|USA|United States)\s*$/i, '');
            
            console.log('[FENNEC USPS] Cleaned address string:', cleanStr);
            
            const parts = cleanStr.split(',').map(p => p.trim()).filter(Boolean);

            if (parts.length) {
                result.line1 = parts.shift();
            }
            if (parts.length > 2) {
                result.line2 = parts.shift();
            }

            // Handle the remaining parts (city, state, zip)
            const remaining = parts.join(', ');
            console.log('[FENNEC USPS] Remaining parts for parsing:', remaining);
            
            // First, try to extract ZIP code from the end
            const zipMatch = remaining.match(/(\d{5}(?:-\d{4})?)\s*$/);
            let zipCode = '';
            let remainingWithoutZip = remaining;
            
            if (zipMatch) {
                zipCode = zipMatch[1];
                remainingWithoutZip = remaining.replace(zipMatch[0], '').trim();
                console.log('[FENNEC USPS] Extracted ZIP:', zipCode);
                console.log('[FENNEC USPS] Remaining without ZIP:', remainingWithoutZip);
            }
            
            // Now try to extract state from the remaining parts
            const stateMatch = remainingWithoutZip.match(/([A-Z]{2})\s*$/i);
            let stateCode = '';
            let cityPart = remainingWithoutZip;
            
            if (stateMatch) {
                stateCode = stateMatch[1].toUpperCase();
                cityPart = remainingWithoutZip.replace(stateMatch[0], '').trim();
                console.log('[FENNEC USPS] Extracted State:', stateCode);
                console.log('[FENNEC USPS] City part:', cityPart);
            }
            
            // Clean up city part (remove trailing commas)
            cityPart = cityPart.replace(/,\s*$/, '').trim();
            
            // Set the results
            result.city = cityPart;
            result.state = stateCode;
            result.zip = zipCode;
            
            console.log('[FENNEC USPS] Final parsed result:', result);
            
            return result;
        }

        function fillAndSubmit() {
            try {
                const parsed = parseAddress(addr);
                
                // Debug logging
                console.log('[FENNEC USPS] Original address:', addr);
                console.log('[FENNEC USPS] Parsed address:', parsed);

                const addressInput = document.querySelector('#tAddress');
                if (addressInput) {
                    addressInput.focus();
                    addressInput.value = parsed.line1;
                    console.log('[FENNEC USPS] Set address line 1:', parsed.line1);
                } else {
                    console.warn('[FENNEC USPS] Address input not found');
                }

                const address2Input = document.querySelector('#tAddress2');
                if (address2Input && parsed.line2) {
                    address2Input.value = parsed.line2;
                    console.log('[FENNEC USPS] Set address line 2:', parsed.line2);
                }

                const cityInput = document.querySelector('#tCity');
                if (cityInput && parsed.city) {
                    cityInput.value = parsed.city;
                    console.log('[FENNEC USPS] Set city:', parsed.city);
                } else {
                    console.warn('[FENNEC USPS] City input not found or no city parsed');
                }

                const stateSelect = document.querySelector('#tState');
                if (stateSelect && parsed.state) {
                    stateSelect.value = parsed.state.toUpperCase();
                    console.log('[FENNEC USPS] Set state:', parsed.state.toUpperCase());
                } else {
                    console.warn('[FENNEC USPS] State select not found or no state parsed');
                }

                const zipInput = document.querySelector('#tZip-byaddress');
                if (zipInput && parsed.zip) {
                    zipInput.value = parsed.zip;
                    console.log('[FENNEC USPS] Set ZIP:', parsed.zip);
                } else {
                    console.warn('[FENNEC USPS] ZIP input not found or no ZIP parsed');
                }

                const findBtn = document.querySelector('#zip-by-address');
                if (findBtn) {
                    console.log('[FENNEC USPS] Clicking Find button');
                    findBtn.click();
                } else {
                    console.warn('[FENNEC USPS] Find button not found');
                }
            } catch (err) {
                console.error('[FENNEC (POO) USPS] Error filling form:', err);
            }
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fillAndSubmit);
        } else {
            fillAndSubmit();
        }
    } catch (e) {
        console.error('[FENNEC (POO) USPS] Launcher error:', e);
    }
    });
    }
}

new UspsLauncher().init();
