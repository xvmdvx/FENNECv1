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
                const firstPart = parts.shift();
                // Check if the first part contains line2 information (like "Apt 4B", "Suite 100", etc.)
                const line2Match = firstPart.match(/^(.*?)\s+(apt|suite|unit|#|ste|floor|fl|room|rm|apartment|building|bldg|office|ofc)\s+(.+)$/i);
                if (line2Match) {
                    result.line1 = line2Match[1].trim();
                    result.line2 = (line2Match[2] + ' ' + line2Match[3]).trim();
                } else {
                    result.line1 = firstPart;
                }
            }
            
            // Check if the second part is line2 information (like "Unit 203", "Suite 125", etc.)
            if (parts.length >= 1) {
                const secondPart = parts[0];
                const line2Match = secondPart.match(/^(apt|suite|unit|#|ste|floor|fl|room|rm|apartment|building|bldg|office|ofc)\s+(.+)$/i);
                if (line2Match) {
                    result.line2 = (line2Match[1] + ' ' + line2Match[2]).trim();
                    parts.shift(); // Remove the line2 part from the remaining parts
                }
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
                console.log('[FENNEC USPS] Line2 data:', parsed.line2);
                console.log('[FENNEC USPS] Line2 length:', parsed.line2 ? parsed.line2.length : 0);

                const addressInput = document.querySelector('#tAddress');
                if (addressInput) {
                    addressInput.focus();
                    addressInput.value = parsed.line1;
                    console.log('[FENNEC USPS] Set address line 1:', parsed.line1);
                } else {
                    console.warn('[FENNEC USPS] Address input not found');
                }

                // Try multiple selectors for address line 2 field
                let address2Input = document.querySelector('#tAddress2');
                if (!address2Input) {
                    address2Input = document.querySelector('#address2');
                }
                if (!address2Input) {
                    address2Input = document.querySelector('#street2');
                }
                if (!address2Input) {
                    address2Input = document.querySelector('input[name="address2"]');
                }
                if (!address2Input) {
                    address2Input = document.querySelector('input[name="street2"]');
                }
                if (!address2Input) {
                    address2Input = document.querySelector('input[name="apt"]');
                }
                if (!address2Input) {
                    address2Input = document.querySelector('input[name="suite"]');
                }
                if (!address2Input) {
                    address2Input = document.querySelector('input[name="unit"]');
                }
                if (!address2Input) {
                    address2Input = document.querySelector('input[placeholder*="apt"]');
                }
                if (!address2Input) {
                    address2Input = document.querySelector('input[placeholder*="Apt"]');
                }
                if (!address2Input) {
                    address2Input = document.querySelector('input[placeholder*="suite"]');
                }
                if (!address2Input) {
                    address2Input = document.querySelector('input[placeholder*="Suite"]');
                }
                if (!address2Input) {
                    address2Input = document.querySelector('input[placeholder*="unit"]');
                }
                if (!address2Input) {
                    address2Input = document.querySelector('input[placeholder*="Unit"]');
                }
                if (!address2Input) {
                    address2Input = document.querySelector('input[placeholder*="Address Line 2"]');
                }
                if (!address2Input) {
                    address2Input = document.querySelector('input[placeholder*="address line 2"]');
                }
                if (!address2Input) {
                    address2Input = document.querySelector('input[placeholder*="Additional"]');
                }
                if (!address2Input) {
                    address2Input = document.querySelector('input[placeholder*="additional"]');
                }
                if (!address2Input) {
                    address2Input = document.querySelector('input[placeholder*="Other"]');
                }
                if (!address2Input) {
                    address2Input = document.querySelector('input[placeholder*="other"]');
                }
                
                // Last resort: try to find any input field that might be for address line 2
                if (!address2Input && parsed.line2) {
                    const allInputs = document.querySelectorAll('input[type="text"]');
                    for (let input of allInputs) {
                        const placeholder = (input.placeholder || '').toLowerCase();
                        const id = (input.id || '').toLowerCase();
                        const name = (input.name || '').toLowerCase();
                        
                        // Look for any field that might be related to address line 2
                        if (placeholder.includes('apt') || placeholder.includes('suite') || placeholder.includes('unit') ||
                            placeholder.includes('additional') || placeholder.includes('other') ||
                            id.includes('address2') || id.includes('street2') || id.includes('apt') || id.includes('suite') ||
                            name.includes('address2') || name.includes('street2') || name.includes('apt') || name.includes('suite')) {
                            address2Input = input;
                            console.log('[FENNEC USPS] Found potential address line 2 field:', input.id || input.name || input.placeholder);
                            break;
                        }
                    }
                }
                
                if (address2Input && parsed.line2) {
                    address2Input.value = parsed.line2;
                    console.log('[FENNEC USPS] Set address line 2:', parsed.line2, 'in field:', address2Input.id || address2Input.name || address2Input.placeholder);
                } else if (parsed.line2) {
                    console.warn('[FENNEC USPS] Address line 2 field not found, but have line2 data:', parsed.line2);
                    // Debug: log all input fields to help identify the correct field
                    console.log('[FENNEC USPS] Available input fields:');
                    document.querySelectorAll('input').forEach((input, index) => {
                        if (input.type !== 'hidden' && input.type !== 'submit' && input.type !== 'button') {
                            console.log(`  ${index + 1}. ID: "${input.id}" | Name: "${input.name}" | Type: "${input.type}" | Placeholder: "${input.placeholder}"`);
                        }
                    });
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

        function tryFillForm(retries = 3) {
            const attemptFill = () => {
                const addressInput = document.querySelector('#tAddress');
                if (!addressInput) {
                    if (retries > 0) {
                        console.log(`[FENNEC USPS] Form not ready, retrying in 500ms... (${retries} attempts left)`);
                        setTimeout(() => tryFillForm(retries - 1), 500);
                        return;
                    } else {
                        console.warn('[FENNEC USPS] Form not found after all retries');
                        return;
                    }
                }
                fillAndSubmit();
            };
            
            attemptFill();
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => tryFillForm());
        } else {
            tryFillForm();
        }
    } catch (e) {
        console.error('[FENNEC (POO) USPS] Launcher error:', e);
    }
    });
    }
}

new UspsLauncher().init();
