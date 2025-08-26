// Injects the FENNEC (MVP) sidebar into USPS pages.
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
            return;
        }
        try {
        const params = new URLSearchParams(window.location.search);
        const addr = params.get('fennec_addr');
        if (!addr) return;
        
        // Clear USPS flag when page loads (prevents multiple opens)
        const uspsKey = `usps_${addr}`;
        const sourceKey = `usps_source_${addr}`;
        
        chrome.storage.local.remove(uspsKey, () => {
            console.log('[FENNEC (MVP) USPS] Cleared USPS flag for address:', addr);
        });
        
        // Only clear USPS flag when page is about to unload, keep source tab info for focus return
        window.addEventListener('beforeunload', () => {
            chrome.storage.local.remove(uspsKey, () => {
                console.log('[FENNEC (MVP) USPS] Cleared USPS flag on page unload for address:', addr);
            });
            // Don't clear source tab info here - it's needed for focus return
        });

        function parseAddress(str) {
            const result = { line1: '', line2: '', city: '', state: '', zip: '' };
            if (!str) return result;
            let s = String(str).trim();
            s = s.replace(/\s{2,}/g, ' ').replace(/[\t\r\n]+/g, ' ');
            s = s.replace(/^(physical|mailing|principal|address):\s*/i, '');
            s = s.replace(/,\s*(US|USA|United States)\s*$/i, '');

            // Fast path: “Street[, Line2], City, ST ZIP”
            let m = s.match(/^(.+?)(?:,\s*(apt|suite|ste|unit|#|fl|floor|room|rm)\s*([\w-]+))?,\s*([^,]+?),\s*([A-Za-z]{2}|[A-Za-z][A-Za-z\s]+)\s+(\d{5}(?:-\d{4})?)$/i);
            if (m) {
                result.line1 = m[1].trim();
                if (m[2] && m[3]) result.line2 = (m[2] + ' ' + m[3]).toUpperCase();
                result.city = m[4].trim();
                result.state = /[A-Za-z]{2}/.test(m[5]) && m[5].length === 2 ? m[5].toUpperCase() : m[5].trim();
                result.zip = m[6];
                return result;
            }

            // Fallback: split by commas and infer pieces
            const parts = s.split(',').map(p => p.trim()).filter(Boolean);
            if (parts.length) {
                const first = parts.shift();
                const l2 = first.match(/^(.*?)\s+(apt|suite|ste|unit|#|fl|floor|room|rm)\s*([\w-]+)$/i);
                if (l2) {
                    result.line1 = l2[1].trim();
                    result.line2 = (l2[2] + ' ' + l2[3]).toUpperCase();
                } else {
                    result.line1 = first;
                }
            }
            const tail = parts.join(', ');
            const zipMatch = tail.match(/(\d{5}(?:-\d{4})?)\s*$/);
            if (zipMatch) result.zip = zipMatch[1];
            const stateMatch = tail.replace(/(\d{5}(?:-\d{4})?)\s*$/, '').match(/([A-Z]{2})\s*$/i);
            if (stateMatch) {
                result.state = stateMatch[1].toUpperCase();
                result.city = tail.replace(/(\d{5}(?:-\d{4})?)\s*$/, '').replace(stateMatch[0], '').replace(/,\s*$/, '').trim();
            } else {
                result.city = tail.replace(/,\s*$/, '').trim();
            }
            return result;
        }

        function fillAndSubmit() {
            try {
                const parsed = parseAddress(addr);
                
                // Debug logging

                // Helpers to get inputs robustly
                const pick = (...sels) => sels.map(s => {
                        try { return document.querySelector(s); } catch(_) { return null; }
                    }).find(Boolean);
                const visible = (el) => el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length);
                
                // Address input (Street Address)
                const addressInput = [
                    '#tAddress',
                    '#address-byaddress',
                    'input[name="tAddress"]',
                    'input[name="address-byaddress"]',
                    'input[aria-label*="Street Address" i]',
                    'input[placeholder*="Street Address" i]'
                ].map(pick).find(visible) || document.querySelector('#tAddress');
                
                if (addressInput) {
                    addressInput.focus();
                    addressInput.value = '';
                    addressInput.dispatchEvent(new Event('input', { bubbles: true }));
                    addressInput.value = parsed.line1;
                    addressInput.dispatchEvent(new Event('input', { bubbles: true }));
                    addressInput.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log('[FENNEC (MVP) USPS] Filled address line 1:', parsed.line1);
                } else {
                    console.warn('[FENNEC (MVP) USPS] Address input not found');
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
                            break;
                        }
                    }
                }
                
                if (address2Input && parsed.line2) {
                    address2Input.value = parsed.line2;
                    address2Input.dispatchEvent(new Event('input', { bubbles: true }));
                    console.log('[FENNEC (MVP) USPS] Filled address line 2:', parsed.line2);
                } else if (parsed.line2) {
                    console.warn('[FENNEC (MVP) USPS] Address line 2 field not found, but have line2 data:', parsed.line2);
                    // Debug: log all input fields to help identify the correct field
                    document.querySelectorAll('input').forEach((input, index) => {
                        if (input.type !== 'hidden' && input.type !== 'submit' && input.type !== 'button') {
                        }
                    });
                }

                // Try multiple selectors for city input
                const cityInput = [
                    '#tCity',
                    '#city-byaddress',
                    'input[name="tCity"]',
                    'input[name="city-byaddress"]',
                    'input[aria-label*="City" i]',
                    'input[placeholder*="City" i]'
                ].map(pick).find(visible);
                
                if (cityInput && parsed.city) {
                    cityInput.focus();
                    cityInput.value = '';
                    cityInput.dispatchEvent(new Event('input', { bubbles: true }));
                    cityInput.value = parsed.city;
                    cityInput.dispatchEvent(new Event('input', { bubbles: true }));
                    cityInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true }));
                    cityInput.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log('[FENNEC (MVP) USPS] Filled city:', parsed.city);
                } else {
                    console.warn('[FENNEC (MVP) USPS] City input not found or no city parsed');
                }

                // Try multiple selectors for state select
                const stateSelect = [
                    '#tState',
                    '#state-byaddress',
                    'select[name="tState"]',
                    'select[name="state-byaddress"]',
                    'select[aria-label*="State" i]'
                ].map(pick).find(visible) || document.querySelector('#tState');
                
                if (stateSelect && parsed.state) {
                    // Try by value (DE) or by visible text (Delaware)
                    const setState = (sel, code) => {
                        sel.value = code;
                        sel.dispatchEvent(new Event('change', { bubbles: true }));
                        if (sel.value !== code && sel.options) {
                            const opt = Array.from(sel.options).find(o => (o.text || '').trim().toUpperCase() === code);
                            if (opt) {
                                sel.value = opt.value;
                                sel.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        }
                    };
                    setState(stateSelect, parsed.state.toUpperCase());
                    // If not set, try matching by full state name
                    if (!stateSelect.value || stateSelect.value === '' || /select/i.test(stateSelect.value)) {
                        const STATE_FULL = {
                            'AL':'ALABAMA','AK':'ALASKA','AZ':'ARIZONA','AR':'ARKANSAS','CA':'CALIFORNIA','CO':'COLORADO','CT':'CONNECTICUT','DE':'DELAWARE','FL':'FLORIDA','GA':'GEORGIA','HI':'HAWAII','ID':'IDAHO','IL':'ILLINOIS','IN':'INDIANA','IA':'IOWA','KS':'KANSAS','KY':'KENTUCKY','LA':'LOUISIANA','ME':'MAINE','MD':'MARYLAND','MA':'MASSACHUSETTS','MI':'MICHIGAN','MN':'MINNESOTA','MS':'MISSISSIPPI','MO':'MISSOURI','MT':'MONTANA','NE':'NEBRASKA','NV':'NEVADA','NH':'NEW HAMPSHIRE','NJ':'NEW JERSEY','NM':'NEW MEXICO','NY':'NEW YORK','NC':'NORTH CAROLINA','ND':'NORTH DAKOTA','OH':'OHIO','OK':'OKLAHOMA','OR':'OREGON','PA':'PENNSYLVANIA','RI':'RHODE ISLAND','SC':'SOUTH CAROLINA','SD':'SOUTH DAKOTA','TN':'TENNESSEE','TX':'TEXAS','UT':'UTAH','VT':'VERMONT','VA':'VIRGINIA','WA':'WASHINGTON','WV':'WEST VIRGINIA','WI':'WISCONSIN','WY':'WYOMING','DC':'DISTRICT OF COLUMBIA'
                        };
                        const full = STATE_FULL[parsed.state.toUpperCase()];
                        if (full && stateSelect.options) {
                            const optByText = Array.from(stateSelect.options).find(o => (o.text || '').trim().toUpperCase() === full);
                            if (optByText) {
                                stateSelect.value = optByText.value;
                                stateSelect.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        }
                    }
                    console.log('[FENNEC (MVP) USPS] Filled state:', parsed.state, 'final:', stateSelect.value);
                } else {
                    console.warn('[FENNEC (MVP) USPS] State select not found or no state parsed');
                }

                // Try multiple selectors for ZIP input
                const zipInput = [
                    '#tZip-byaddress',
                    'input[name="tZip-byaddress"]',
                    '#zip-byaddress-input',
                    'input[aria-label*="ZIP" i]',
                    'input[placeholder*="ZIP" i]',
                    'input[placeholder*="Postal" i]'
                ].map(pick).find(visible);
                
                if (zipInput && parsed.zip) {
                    zipInput.focus();
                    zipInput.value = '';
                    zipInput.dispatchEvent(new Event('input', { bubbles: true }));
                    zipInput.value = parsed.zip;
                    zipInput.dispatchEvent(new Event('input', { bubbles: true }));
                    zipInput.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log('[FENNEC (MVP) USPS] Filled ZIP:', parsed.zip);
                } else {
                    console.warn('[FENNEC (MVP) USPS] ZIP input not found or no ZIP parsed');
                }

                // Try multiple selectors for submit button
                const findBtn = pick('#zip-by-address', 'button#zip-by-address', 'input[type="submit"]', 'button[type="submit"]', 'button[aria-label*="Find" i]', 'button');
                
                if (findBtn) {
                    console.log('[FENNEC (MVP) USPS] Clicking submit button');
                    findBtn.click();
                } else {
                    console.warn('[FENNEC (MVP) USPS] Find button not found');
                }
            } catch (err) {
                console.error('[FENNEC (MVP) USPS] Error filling form:', err);
            }
        }

        function tryFillForm(retries = 3) {
            const attemptFill = () => {
                // Try multiple possible selectors for the address input
                const addressInput = document.querySelector('#tAddress') || 
                                   document.querySelector('input[name="tAddress"]') ||
                                   document.querySelector('input[placeholder*="address"]') ||
                                   document.querySelector('input[type="text"]');
                
                if (!addressInput) {
                    if (retries > 0) {
                        console.log('[FENNEC (MVP) USPS] Address input not found, retrying...', retries);
                        setTimeout(() => tryFillForm(retries - 1), 500);
                        return;
                    } else {
                        console.warn('[FENNEC (MVP) USPS] Form not found after all retries');
                        return;
                    }
                }
                
                console.log('[FENNEC (MVP) USPS] Found address input:', addressInput);
                fillAndSubmit();
            };
            
            attemptFill();
        }

        // Function to detect CMRA from USPS results
        function detectCMRAFromResults() {
            console.log('[FENNEC (MVP) USPS] Checking for CMRA in results...');
            
            // First, try to click the dropdown if it's not already expanded
            const listGroupItem = document.querySelector('li.list-group-item');
            if (listGroupItem && !listGroupItem.classList.contains('active')) {
                console.log('[FENNEC (MVP) USPS] Clicking dropdown to expand details...');
                listGroupItem.click();
                
                // Wait a moment for the dropdown to expand
                setTimeout(() => {
                    const result = detectCMRAFromExpandedResults();
                    if (!result) {
                        console.log('[FENNEC (MVP) USPS] No CMRA found after expansion, starting auto-close sequence');
                        startAutoCloseSequence();
                    }
                }, 500);
                return false; // Return false while waiting for expansion
            }
            
            return detectCMRAFromExpandedResults();
        }
        
        // Function to detect CMRA from expanded results
        function detectCMRAFromExpandedResults() {
            console.log('[FENNEC (MVP) USPS] Checking for CMRA in expanded results...');
            
            // Look for the CMRA field in the expanded results
            let cmraValue = null;
            
            // First, find the specific address result container that matches our address
            const addressElements = document.querySelectorAll('.zipcode-result-address, .result-address, [class*="address"]');
            let targetContainer = null;
            
            for (let addrElement of addressElements) {
                const addrText = addrElement.textContent.trim();
                // Check if this element contains our target address
                if (addrText.includes(addr.split(',')[0].trim())) {
                    console.log('[FENNEC (MVP) USPS] Found matching address container:', addrText);
                    targetContainer = addrElement.closest('.list-group-item, .result-item, [class*="result"]');
                    break;
                }
            }
            
            if (!targetContainer) {
                console.log('[FENNEC (MVP) USPS] No matching address container found, using first result');
                targetContainer = document.querySelector('.list-group-item, .result-item, [class*="result"]');
            }
            
            if (targetContainer) {
                // Search for CMRA field only within this specific result container
                const cmraElements = targetContainer.querySelectorAll('p, span, div, td, th');
                let cmraLabel = null;
                
                for (let element of cmraElements) {
                    const text = element.textContent.trim();
                    if (text === 'COMMERCIAL MAIL RECEIVING AGENCY') {
                        cmraLabel = element;
                        console.log('[FENNEC (MVP) USPS] Found CMRA label in target container');
                        break;
                    }
                }
                
                if (cmraLabel) {
                    // Method 1: Look for value in the same row/container
                    const parent = cmraLabel.closest('.row, .col-lg-4, .col-md-4, .col-sm-4, .col-xs-12, .row-detail-wrapper');
                    if (parent) {
                        const valueElements = parent.querySelectorAll('p, span, div, td, th');
                        for (let valueEl of valueElements) {
                            const valueText = valueEl.textContent.trim();
                            if (/^(Y|N|Yes|No)$/i.test(valueText)) {
                                cmraValue = valueText;
                                console.log('[FENNEC (MVP) USPS] Found CMRA value in same container:', cmraValue);
                                break;
                            }
                        }
                    }
                    
                    // Method 2: Look for value in adjacent elements
                    if (!cmraValue) {
                        const nextElement = cmraLabel.nextElementSibling;
                        if (nextElement) {
                            const nextText = nextElement.textContent.trim();
                            if (/^(Y|N|Yes|No)$/i.test(nextText)) {
                                cmraValue = nextText;
                                console.log('[FENNEC (MVP) USPS] Found CMRA value in next element:', cmraValue);
                            }
                        }
                    }
                    
                    // Method 3: Look for value in the entire target container
                    if (!cmraValue) {
                        const allElements = targetContainer.querySelectorAll('p, span, div, td, th');
                        for (let element of allElements) {
                            const text = element.textContent.trim();
                            if (/^(Y|N|Yes|No)$/i.test(text)) {
                                cmraValue = text;
                                console.log('[FENNEC (MVP) USPS] Found CMRA value in container:', cmraValue);
                                break;
                            }
                        }
                    }
                }
            }
            
            if (cmraValue) {
                const isCMRA = /^(Y|Yes)$/i.test(cmraValue);
                console.log('[FENNEC (MVP) USPS] CMRA detected:', cmraValue, 'Is CMRA:', isCMRA);
                
                // Send CMRA result back to the sidebar
                bg.send('uspsCmraResult', {
                    address: addr,
                    isCMRA: isCMRA,
                    cmraValue: cmraValue
                });
                
                // Start auto-close sequence
                startAutoCloseSequence();
                return isCMRA;
            }
            
            console.log('[FENNEC (MVP) USPS] No CMRA field found in expanded results');
            // Still start auto-close sequence even if no CMRA found
            startAutoCloseSequence();
            return false;
        }

        // Function to wait for results and detect CMRA
        function waitForResultsAndDetectCMRA() {
            // Check if we're on the results page with multiple indicators
            const resultsContainer = document.querySelector('.results-container, .zip-results, [class*="result"]');
            const hasZipResult = document.querySelector('.zipcode-result-address');
            const hasListGroup = document.querySelector('.list-group-item');
            
            if (resultsContainer || hasZipResult || hasListGroup) {
                console.log('[FENNEC (MVP) USPS] Results page detected, checking for CMRA...');
                
                // Wait a bit for the page to fully load
                setTimeout(() => {
                    const cmraFound = detectCMRAFromResults();
                    
                    // If no CMRA was found, still start the auto-close sequence
                    if (!cmraFound) {
                        console.log('[FENNEC (MVP) USPS] No CMRA found, starting auto-close sequence anyway');
                        startAutoCloseSequence();
                    }
                }, 1000);
            } else {
                // Check again in a moment
                setTimeout(() => waitForResultsAndDetectCMRA(), 500);
            }
        }

        // Function to handle auto-close sequence
        function startAutoCloseSequence() {
            console.log('[FENNEC (MVP) USPS] Starting auto-close sequence for address:', addr);
            
            // Wait 1 second on the final USPS screen
            setTimeout(() => {
                console.log('[FENNEC (MVP) USPS] 1 second passed, attempting to return focus to DB tab');
                
                // Try to return focus to the DB tab
                chrome.runtime.sendMessage({
                    action: 'returnFocusToDB',
                    address: addr
                }, (response) => {
                    if (response && response.success) {
                        console.log('[FENNEC (MVP) USPS] Successfully returned focus to DB tab');
                        // Clear source tab info after successful focus return
                        chrome.storage.local.remove(sourceKey, () => {
                            console.log('[FENNEC (MVP) USPS] Cleared source tab info after focus return for address:', addr);
                        });
                    } else {
                        console.log('[FENNEC (MVP) USPS] Failed to return focus to DB tab:', response);
                    }
                });
                
                // Set up auto-close timer (3 seconds)
                setTimeout(() => {
                    console.log('[FENNEC (MVP) USPS] 3 seconds passed, checking if tab should be closed');
                    
                    // Check if this tab is still active (user hasn't manually activated it)
                    chrome.runtime.sendMessage({
                        action: 'checkTabActivity',
                        address: addr
                    }, (response) => {
                        console.log('[FENNEC (MVP) USPS] Tab activity check response:', response);
                        if (response && response.shouldClose) {
                            console.log('[FENNEC (MVP) USPS] Auto-closing USPS tab for address:', addr);
                            window.close();
                        } else {
                            console.log('[FENNEC (MVP) USPS] Tab was manually activated or check failed, not auto-closing');
                        }
                    });
                }, 3000); // 3 seconds after focus return
                
            }, 1000); // 1 second on USPS screen
        }

        // Safety timeout to ensure auto-close sequence starts even if CMRA detection fails
        setTimeout(() => {
            console.log('[FENNEC (MVP) USPS] Safety timeout reached, starting auto-close sequence');
            startAutoCloseSequence();
        }, 30000); // 30 seconds timeout

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                tryFillForm();
                waitForResultsAndDetectCMRA();
            });
        } else {
            tryFillForm();
            waitForResultsAndDetectCMRA();
        }
    } catch (e) {
        console.error('[FENNEC (MVP) USPS] Launcher error:', e);
    }
    });
    }
}

new UspsLauncher().init();
