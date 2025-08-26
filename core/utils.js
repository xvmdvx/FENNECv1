// Common utilities for FENNEC (MVP) content scripts.
// Provides escapeHtml and attachCommonListeners helpers.

// Global USPS click detection - this will catch ALL clicks on USPS elements
// This is a backup listener that works even if attachCommonListeners fails
document.addEventListener('click', function(e) {
    // Check if the clicked element or its parent has the copilot-usps class
    const uspsElement = e.target.closest('.copilot-usps');
    if (uspsElement) {
        // Check if this element already has a listener attached
        const hasListener = uspsElement.dataset.uspsListenerAdded === 'true';
        
        if (!hasListener) {
            // Mark this element as having a listener to prevent double handling
            uspsElement.dataset.uspsListenerAdded = 'true';
            
            // Let the primary listener handle the click
            console.log('🔍 [FENNEC GLOBAL] USPS element clicked, marked for primary handler');
            
            // Give the primary listener a chance to execute
            setTimeout(() => {
                // If the primary listener didn't execute, we'll handle it
                if (uspsElement.dataset.uspsListenerAdded === 'true' || uspsElement.dataset.uspsListenerAdded !== 'executed') {
                    console.log('🔍 [FENNEC GLOBAL] Primary handler didn\'t execute, handling click now');
                    
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const address = uspsElement.dataset.address;
                    console.log('🔍 [FENNEC GLOBAL] USPS element clicked! Address:', address);
                    
                    if (!address) {
                        console.error('❌ [FENNEC GLOBAL] No address data found in USPS element');
                        return;
                    }
                    
                    // Always open URL directly since chrome.runtime is not available
                    console.log('🔍 [FENNEC GLOBAL] Opening USPS URL directly (chrome.runtime not available)');
                    const url = 'https://tools.usps.com/zip-code-lookup.htm?byaddress&fennec_addr=' + encodeURIComponent(address);
                    
                    // Store source tab info for focus return
                    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.tabs) {
                        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                            if (tabs.length > 0) {
                                const sourceTab = tabs[0];
                                const uspsKey = `usps_source_${address}`;
                                
                                chrome.storage.local.set({ [uspsKey]: { tabId: sourceTab.id, url: sourceTab.url } }, () => {
                                    console.log('🔍 [FENNEC GLOBAL] Stored source tab info for address:', address, 'tabId:', sourceTab.id);
                                });
                            }
                        });
                    }
                    
                    try {
                        const newWindow = window.open(url, '_blank');
                        if (newWindow) {
                            console.log('✅ [FENNEC GLOBAL] USPS URL opened successfully:', url);
                        } else {
                            console.error('❌ [FENNEC GLOBAL] USPS URL failed to open (popup blocked?)');
                            // Fallback: try to open in same window
                            window.location.href = url;
                        }
                    } catch (error) {
                        console.error('❌ [FENNEC GLOBAL] Error opening USPS URL:', error.message);
                        // Fallback: try to open in same window
                        window.location.href = url;
                    }
                }
            }, 100); // 100ms delay
            
            return;
        } else {
            // If primary listener didn't handle it, we'll handle it here
            console.log('🔍 [FENNEC GLOBAL] USPS element already has listener, but primary handler didn\'t execute - handling here');
            
            e.preventDefault();
            e.stopPropagation();
            
            const address = uspsElement.dataset.address;
            console.log('🔍 [FENNEC GLOBAL] USPS element clicked! Address:', address);
            
            if (!address) {
                console.error('❌ [FENNEC GLOBAL] No address data found in USPS element');
                return;
            }
            
            // Always open URL directly since chrome.runtime is not available
            console.log('🔍 [FENNEC GLOBAL] Opening USPS URL directly (chrome.runtime not available)');
            const url = 'https://tools.usps.com/zip-code-lookup.htm?byaddress&fennec_addr=' + encodeURIComponent(address);
            
            // Store source tab info for focus return
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.tabs) {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs.length > 0) {
                        const sourceTab = tabs[0];
                        const uspsKey = `usps_source_${address}`;
                        
                        chrome.storage.local.set({ [uspsKey]: { tabId: sourceTab.id, url: sourceTab.url } }, () => {
                            console.log('🔍 [FENNEC GLOBAL] Stored source tab info for address:', address, 'tabId:', sourceTab.id);
                        });
                    }
                });
            }
            
            try {
                const newWindow = window.open(url, '_blank');
                if (newWindow) {
                    console.log('✅ [FENNEC GLOBAL] USPS URL opened successfully:', url);
                } else {
                    console.error('❌ [FENNEC GLOBAL] USPS URL failed to open (popup blocked?)');
                    // Fallback: try to open in same window
                    window.location.href = url;
                }
            } catch (error) {
                console.error('❌ [FENNEC GLOBAL] Error opening USPS URL:', error.message);
                // Fallback: try to open in same window
                window.location.href = url;
            }
        }
    }
}, true); // Use capture phase to catch all clicks

// Additional DOM ready listener to ensure USPS elements are detected
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        console.log('🔍 [FENNEC GLOBAL] DOM loaded, checking for USPS elements...');
        const uspsElements = document.querySelectorAll('.copilot-usps');
        console.log('🔍 [FENNEC GLOBAL] Found', uspsElements.length, 'USPS elements on DOM load');
        
        uspsElements.forEach((el, index) => {
            console.log(`🔍 [FENNEC GLOBAL] USPS Element ${index + 1}:`, {
                address: el.dataset.address,
                innerHTML: el.innerHTML,
                className: el.className
            });
        });
    });
} else {
    // DOM is already loaded
    console.log('🔍 [FENNEC GLOBAL] DOM already loaded, checking for USPS elements...');
    const uspsElements = document.querySelectorAll('.copilot-usps');
    console.log('🔍 [FENNEC GLOBAL] Found', uspsElements.length, 'USPS elements');
}

// Mutation observer to detect when new USPS elements are added dynamically
const uspsObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // Check if the added node is a USPS element
                    if (node.classList && node.classList.contains('copilot-usps')) {
                        console.log('🔍 [FENNEC GLOBAL] New USPS element detected:', {
                            address: node.dataset.address,
                            innerHTML: node.innerHTML
                        });
                    }
                    
                    // Check if the added node contains USPS elements
                    const uspsElements = node.querySelectorAll ? node.querySelectorAll('.copilot-usps') : [];
                    uspsElements.forEach(function(el) {
                        console.log('🔍 [FENNEC GLOBAL] New USPS element found in added node:', {
                            address: el.dataset.address,
                            innerHTML: el.innerHTML
                        });
                    });
                }
            });
        }
    });
});

// Start observing
uspsObserver.observe(document.body, {
    childList: true,
    subtree: true
});

console.log('🔍 [FENNEC GLOBAL] Mutation observer started for USPS elements');

// Mute tagged console output without affecting control flow
// (e.g., `return console.warn(...)` still returns undefined).
if (!self.__fennecLogSilencerInstalled) {
    try {
        const TAGS_TO_MUTE = ["[FENNEC (MVP)]", "[FENNEC (MVP) DB SB]"];
        const originalConsole = {
            log: console.log.bind(console),
            info: console.info ? console.info.bind(console) : console.log.bind(console),
            warn: console.warn ? console.warn.bind(console) : console.log.bind(console),
            error: console.error ? console.error.bind(console) : console.log.bind(console),
            debug: console.debug ? console.debug.bind(console) : console.log.bind(console)
        };
        const shouldMute = (args) => {
            const first = args && args[0];
            return typeof first === 'string' && TAGS_TO_MUTE.some(tag => first.startsWith(tag));
        };
        ["log", "info", "warn", "error", "debug"].forEach(method => {
            console[method] = function(...args) {
                if (shouldMute(args)) return;
                return originalConsole[method](...args);
            };
        });
        self.__fennecLogSilencerInstalled = true;
    } catch (e) {
        // If anything goes wrong, do not block execution.
    }
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function applySidebarDesign(sidebar, opts) {
    if (!sidebar || !opts) return;
    if (opts.sidebarBgColor) {
        sidebar.style.setProperty('--sb-bg', opts.sidebarBgColor);
    }
    if (opts.sidebarBoxColor) {
        sidebar.style.setProperty('--sb-box-bg', opts.sidebarBoxColor);
    }
    const fs = parseInt(opts.sidebarFontSize, 10);
    if (fs) {
        sidebar.style.setProperty('--sb-font-size', fs + 'px');
    }
    if (opts.sidebarFont) {
        sidebar.style.setProperty('--sb-font-family', opts.sidebarFont);
    }
}
window.applySidebarDesign = applySidebarDesign;

function buildSidebarHeader() {
    return `
        <div class="copilot-header">
            <span id="qa-toggle" class="quick-actions-toggle">☰</span>
            <div class="copilot-title">
                <img src="${chrome.runtime.getURL('fennec_icon.png')}" class="copilot-icon" alt="FENNEC (MVP)" />
                <span>FENNEC (MVP)</span>
            </div>
            <button id="copilot-clear-tabs">🗑</button>
            <button id="copilot-close">✕</button>
        </div>`;
}
window.buildSidebarHeader = buildSidebarHeader;

function getFennecSessionId() {
    let id = sessionStorage.getItem('fennecSessionId');
    if (!id) {
        id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        sessionStorage.setItem('fennecSessionId', id);
    }
    return id;
}
window.getFennecSessionId = getFennecSessionId;

// Handle reset messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'fennecReset' && message.clearStorage) {
        console.log('[FENNEC (MVP)] Clearing all storage for reset...');
        
        // Clear session storage
        sessionStorage.clear();
        
        // Clear local storage
        localStorage.clear();
        
        // Clear any FENNEC-related items specifically
        const fennecKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.includes('fennec')) {
                fennecKeys.push(key);
            }
        }
        fennecKeys.forEach(key => localStorage.removeItem(key));
        
        console.log('[FENNEC (MVP)] Storage cleared successfully');
        sendResponse({ success: true });
    }
});

function sessionSet(data, cb) {
    const obj = Object.assign({}, data, { sidebarSessionId: getFennecSessionId() });
    chrome.storage.local.set(obj, cb);
}
window.sessionSet = sessionSet;

function insertDnaAfterCompany() {
    const dnaBox = document.querySelector('.copilot-dna');
    const compBox = document.querySelector('#copilot-sidebar .company-box');
    if (!dnaBox || !compBox) return;
    const parent = compBox.parentElement;
    if (dnaBox.parentElement !== parent || dnaBox.previousElementSibling !== compBox) {
        parent.insertBefore(dnaBox, compBox.nextSibling);
    }
}
window.insertDnaAfterCompany = insertDnaAfterCompany;

function applyStandardSectionOrder(container = document.getElementById('db-summary-section')) {
    if (!container) return;
    const pairFor = label => {
        const lbl = Array.from(container.querySelectorAll('.section-label'))
            .find(el => el.textContent.trim().toUpperCase() === label);
        return lbl ? [lbl, lbl.nextElementSibling] : null;
    };
    const order = [
        pairFor('COMPANY:'),
        pairFor('BILLING:'),
        pairFor('CLIENT:'),
        pairFor('AGENT:'),
        pairFor('MEMBERS:') || pairFor('DIRECTORS:'),
        pairFor('SHAREHOLDERS:'),
        pairFor('OFFICERS:')
    ].filter(Boolean);
    order.forEach(([lbl, box]) => {
        container.appendChild(lbl);
        if (box) container.appendChild(box);
    });
}
window.applyStandardSectionOrder = applyStandardSectionOrder;

function abbreviateOrderType(type) {
    // Normalize and strip optional leading state prefix like "NY Good Standing"
    const raw = (type || '').toString();
    const normalized = raw.trim();
    // If string begins with two letters and a space, drop the state to evaluate order type
    const stateStripped = normalized.replace(/^[A-Za-z]{2}\s+/, '');
    const t = stateStripped.toLowerCase();
    if (t.includes('annual report')) return 'AR';
    if (t.includes('state filings bundle')) return 'SFB';
    if (t.includes('foreign qualification')) return 'FQ';
    if (t.includes('assumed business name')) return 'ABN';
    if (t.includes('sales tax registration')) return 'SALES TAX';
    if (t.includes('registered agent change')) return 'RA CHANGE';
    if (t.includes('change of agent')) return 'COA';
    if (t.includes('trade name search')) return 'TRADENAME';
    if (t.includes('certificate of good standing') || t.includes('good standing')) return 'COGS';
    if (t.includes('beneficial ownership information report')) return 'BOIR';
    return type;
}

function extractStateFromOrderType(type) {
    const t = (type || '').toUpperCase();
    // Extract state abbreviation (2 letters) followed by space and word
    const stateMatch = t.match(/^([A-Z]{2})\s+(.+)$/);
    if (stateMatch) {
        return {
            state: stateMatch[1],
            orderType: stateMatch[2]
        };
    }
    return null;
}
window.abbreviateOrderType = abbreviateOrderType;

function storeSidebarSnapshot(sidebar) {
    if (!sidebar) return;
    sessionSet({ sidebarSnapshot: sidebar.innerHTML });
}
window.storeSidebarSnapshot = storeSidebarSnapshot;

function loadSidebarSnapshot(sidebar, cb) {
    if (!sidebar) { if (typeof cb === 'function') cb(); return; }
    chrome.storage.local.get({ sidebarSnapshot: null, sidebarSessionId: null },
        ({ sidebarSnapshot, sidebarSessionId }) => {
        if (sidebarSnapshot && sidebarSessionId === getFennecSessionId()) {
            sidebar.innerHTML = sidebarSnapshot;
            attachCommonListeners(sidebar);
        }
        if (typeof cb === 'function') cb();
    });
}
window.loadSidebarSnapshot = loadSidebarSnapshot;

// Function to parse address into components
function parseAddressForSmartCopy(str) {
    const result = { line1: '', line2: '', city: '', state: '', zip: '' };
    if (!str) return result;

    // Clean the input string
    let cleanStr = str.trim();
    
    // Remove any potential labels like "Physical:" or "Mailing:" that might have been included
    cleanStr = cleanStr.replace(/^(physical|mailing|principal):\s*/i, '');
    
    // Remove any country codes that might still be present
    cleanStr = cleanStr.replace(/,\s*(US|USA|United States)\s*$/i, '');
    
    // Split by commas and clean up
    const parts = cleanStr.split(',').map(p => p.trim()).filter(Boolean);
    
    if (parts.length === 0) return result;
    
    // Handle street address (first part)
    let streetPart = parts.shift();
    
    // Check if street part contains line2 information (like "Apt 4B", "Suite 100", etc.)
    const line2Match = streetPart.match(/^(.*?)\s+(apt|suite|unit|#|ste|floor|fl|room|rm|apartment|building|bldg|office|ofc)\s+(.+)$/i);
    if (line2Match) {
        result.line1 = line2Match[1].trim();
        result.line2 = (line2Match[2] + ' ' + line2Match[3]).trim();
    } else {
        result.line1 = streetPart;
    }
    
    // Check if second part is line2 information (like "Unit 203", "Suite 125", etc.)
    if (parts.length >= 1) {
        const secondPart = parts[0];
        const line2Match = secondPart.match(/^(apt|suite|unit|#|ste|floor|fl|room|rm|apartment|building|bldg|office|ofc)\s+(.+)$/i);
        if (line2Match) {
            result.line2 = (line2Match[1] + ' ' + line2Match[2]).trim();
            parts.shift(); // Remove the line2 part from the remaining parts
        }
    }
    
    // Handle the remaining parts (city, state, zip)
    if (parts.length === 0) return result;
    
    // Find the last part that contains a ZIP code
    let zipPart = '';
    let cityStateParts = [];
    
    for (let i = parts.length - 1; i >= 0; i--) {
        const part = parts[i];
        const zipMatch = part.match(/(\d{5}(?:-\d{4})?)\s*$/);
        if (zipMatch) {
            zipPart = zipMatch[1];
            // Remove ZIP from this part
            const withoutZip = part.replace(zipMatch[0], '').trim();
            if (withoutZip) {
                cityStateParts.unshift(withoutZip);
            }
            // Add remaining parts before this one
            cityStateParts.unshift(...parts.slice(0, i));
            break;
        } else {
            cityStateParts.unshift(part);
        }
    }
    
    // If no ZIP found, use all remaining parts
    if (!zipPart && parts.length > 0) {
        cityStateParts = parts;
    }
    
    // Extract state from the last part
    let stateCode = '';
    let cityParts = [];
    
    for (let i = cityStateParts.length - 1; i >= 0; i--) {
        const part = cityStateParts[i];
        const stateMatch = part.match(/([A-Z]{2})\s*$/i);
        if (stateMatch) {
            stateCode = stateMatch[1].toUpperCase();
            // Remove state from this part
            const withoutState = part.replace(stateMatch[0], '').trim();
            if (withoutState) {
                cityParts.unshift(withoutState);
            }
            // Add remaining parts before this one
            cityParts.unshift(...cityStateParts.slice(0, i));
            break;
        } else {
            cityParts.unshift(part);
        }
    }
    
    // If no state found, use all city parts
    if (!stateCode && cityStateParts.length > 0) {
        cityParts = cityStateParts;
    }
    
    // Set the results
    result.city = cityParts.join(', ').replace(/,\s*$/, '').trim();
    result.state = stateCode;
    result.zip = zipPart;
    
    console.log('[FENNEC (MVP)] Parsed address:', { original: str, parsed: result });
    
    return result;
}

// Function to perform smart copy of address
function smartCopyAddress(address) {
    const parsed = parseAddressForSmartCopy(address);
    
    // Create a structured clipboard data
    const clipboardData = {
        fullAddress: address,
        components: parsed,
        timestamp: Date.now()
    };
    
    // Store in chrome.storage for form auto-fill (using sync for cross-tab persistence)
    chrome.storage.sync.set({ 
        smartCopyAddress: clipboardData 
    }, () => {
        console.log('[FENNEC (MVP)] Smart copy stored (sync):', clipboardData);
    });
    
    // Add to address history (keep last 5 addresses) - using sync for cross-tab persistence
    chrome.storage.sync.get({ addressHistory: [] }, (result) => {
        let addressHistory = result.addressHistory || [];
        
        // Remove duplicate if exists
        addressHistory = addressHistory.filter(item => 
            item.fullAddress !== address
        );
        
        // Add new address to beginning
        addressHistory.unshift(clipboardData);
        
        // Keep only last 5 addresses
        addressHistory = addressHistory.slice(0, 5);
        
        // Save updated history using sync storage for cross-tab persistence
        chrome.storage.sync.set({ addressHistory: addressHistory }, () => {
            console.log('[FENNEC (MVP)] Address history updated (sync):', addressHistory);
        });
    });
    
    // Also copy the full address to clipboard for regular use
    navigator.clipboard.writeText(address).catch(err => 
        console.warn('[FENNEC (MVP)] Clipboard error:', err));
    
    // Show notification
    showSmartCopyNotification(parsed);
}

// Function to show smart copy notification
function showSmartCopyNotification(parsed) {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 15px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 999999;
        font-family: Arial, sans-serif;
        font-size: 14px;
        max-width: 300px;
        animation: slideIn 0.3s ease-out;
    `;
    
    notification.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 8px;">✅ Smart Copy Ready!</div>
        <div style="font-size: 12px; margin-bottom: 5px;"><strong>Street:</strong> ${parsed.line1}</div>
        ${parsed.line2 ? `<div style="font-size: 12px; margin-bottom: 5px;"><strong>Line 2:</strong> ${parsed.line2}</div>` : ''}
        <div style="font-size: 12px; margin-bottom: 5px;"><strong>City:</strong> ${parsed.city}</div>
        <div style="font-size: 12px; margin-bottom: 5px;"><strong>State:</strong> ${parsed.state}</div>
        <div style="font-size: 12px;"><strong>ZIP:</strong> ${parsed.zip}</div>
        <div style="font-size: 11px; margin-top: 8px; opacity: 0.8;">Click in any form field to auto-fill</div>
    `;
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// Function to update USPS icons based on CMRA results
function updateUspsIconsFromCmraResults() {
    chrome.storage.local.get({ uspsCmraResults: {} }, ({ uspsCmraResults }) => {
        Object.entries(uspsCmraResults).forEach(([address, result]) => {
            // Find all USPS icons for this address
            const uspsIcons = document.querySelectorAll(`.copilot-usps[data-address="${address}"]`);
            uspsIcons.forEach(icon => {
                if (result.isCMRA) {
                    // CMRA detected - show yellow warning
                    icon.innerHTML = ' ⚠️';
                    icon.title = 'USPS: CMRA Detected (Commercial Mail Receiving Agency)';
                    icon.style.color = '#ffc107';
                } else {
                    // Not CMRA - show green check (residential address)
                    icon.innerHTML = ' ✅';
                    icon.title = 'USPS: Residential Address (Not CMRA)';
                    icon.style.color = '#28a745';
                }
            });
        });
    });
}

// Function to handle CMRA results from USPS
function handleUspsCmraResult(address, isCMRA, cmraValue) {
    console.log('[FENNEC (MVP)] Handling USPS CMRA result:', { address, isCMRA, cmraValue });
    
    // Find all USPS icons for this address
    const uspsIcons = document.querySelectorAll(`.copilot-usps[data-address="${address}"]`);
    uspsIcons.forEach(icon => {
        if (isCMRA) {
            // CMRA detected - show yellow warning
            icon.innerHTML = ' ⚠️';
            icon.title = 'USPS: CMRA Detected (Commercial Mail Receiving Agency)';
            icon.style.color = '#ffc107';
        } else {
            // Not CMRA - show green check (residential address)
            icon.innerHTML = ' ✅';
            icon.title = 'USPS: Residential Address (Not CMRA)';
            icon.style.color = '#28a745';
        }
    });
}

// Listen for CMRA results from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'uspsCmraResult') {
        handleUspsCmraResult(message.address, message.isCMRA, message.cmraValue);
    }
});

// Listen for smart copy data from USPS context menu
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.smartCopyAddress) {
        const data = changes.smartCopyAddress.newValue;
        if (data && data.source === 'usps_context_menu') {
            console.log('[FENNEC (MVP)] Smart copy data received from USPS context menu:', data);
            
            // Parse the address components
            const parsed = parseAddressForSmartCopy(data.fullAddress);
            
            // Update the stored data with parsed components
            chrome.storage.sync.set({ 
                smartCopyAddress: {
                    ...data,
                    components: parsed
                }
            }, () => {
                console.log('[FENNEC (MVP)] Smart copy data updated with parsed components');
                
                // Show smart copy notification
                showSmartCopyNotification(parsed);
            });
        }
    }
});

// Function to setup context menu for smart paste
function setupContextMenu() {
    // Remove existing context menu if present
    const existingMenu = document.getElementById('fennec-context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    // Create context menu
    const contextMenu = document.createElement('div');
    contextMenu.id = 'fennec-context-menu';
    contextMenu.style.cssText = `
        position: fixed;
        background: white;
        border: 1px solid #ccc;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 999999;
        font-family: Arial, sans-serif;
        font-size: 14px;
        min-width: 200px;
        display: none;
        padding: 8px 0;
    `;
    
    document.body.appendChild(contextMenu);
    
    // Listen for right-click on address fields
    document.addEventListener('contextmenu', (e) => {
        const target = e.target;
        
        // Check if right-clicked on an address field
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
            const fieldName = (target.name || target.id || target.placeholder || '').toLowerCase();
            
            // More specific detection to avoid triggering on non-address fields
            if ((fieldName.includes('street1') || fieldName.includes('street2') || fieldName.includes('city') || 
                 (fieldName.includes('state') && !fieldName.includes('id') && !fieldName.includes('status')) || 
                 (fieldName.includes('zip') || fieldName.includes('postal'))) &&
                !fieldName.includes('id') && !fieldName.includes('tracking') && !fieldName.includes('code')) {
                
                e.preventDefault();
                showContextMenu(e.clientX, e.clientY, target);
            }
        }
    });
    
    // Hide context menu when clicking elsewhere
    document.addEventListener('click', () => {
        contextMenu.style.display = 'none';
    });
}

// Function to show context menu with address history
function showContextMenu(x, y, targetField) {
    const contextMenu = document.getElementById('fennec-context-menu');
    if (!contextMenu) return;
    
    // Get address history from storage (using sync for cross-tab persistence)
    chrome.storage.sync.get({ addressHistory: [] }, (result) => {
        const addressHistory = result.addressHistory || [];
        
        // Build menu content
        let menuContent = `
            <div style="padding: 8px 12px; border-bottom: 1px solid #eee; font-weight: bold; color: #333;">
                FENNEC Smart Paste
            </div>
        `;
        
        if (addressHistory.length === 0) {
            menuContent += `
                <div style="padding: 8px 12px; color: #666; font-style: italic;">
                    No addresses in history. Copy an address first.
                </div>
            `;
        } else {
            // Show up to 5 most recent addresses
            const recentAddresses = addressHistory.slice(0, 5);
            
            recentAddresses.forEach((addressData, index) => {
                const components = addressData.components;
                const displayText = `${components.line1}${components.line2 ? ', ' + components.line2 : ''}, ${components.city}, ${components.state} ${components.zip}`;
                
                menuContent += `
                    <div class="fennec-menu-item" data-index="${index}" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f5f5f5;">
                        <div style="font-weight: bold; font-size: 12px;">${displayText}</div>
                        <div style="font-size: 11px; color: #666; margin-top: 2px;">
                            ${components.line1} | ${components.city}, ${components.state} ${components.zip}
                        </div>
                    </div>
                `;
            });
        }
        
        contextMenu.innerHTML = menuContent;
        
        // Position menu
        contextMenu.style.left = x + 'px';
        contextMenu.style.top = y + 'px';
        contextMenu.style.display = 'block';
        
        // Add click handlers for menu items
        contextMenu.querySelectorAll('.fennec-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                const selectedAddress = addressHistory[index];
                
                if (selectedAddress) {
                    smartPasteAddress(selectedAddress.components, targetField);
                }
                
                contextMenu.style.display = 'none';
            });
            
            // Add hover effects
            item.addEventListener('mouseenter', () => {
                item.style.backgroundColor = '#f0f8ff';
            });
            
            item.addEventListener('mouseleave', () => {
                item.style.backgroundColor = '';
            });
        });
    });
}

// Function to smart paste address to fields in the same form section
function smartPasteAddress(components, triggerField) {
    console.log('[FENNEC (MVP)] Smart pasting address:', components);
    
    // Find the form section containing the trigger field
    const formSection = findFormSection(triggerField);
    console.log('[FENNEC (MVP)] Form section found:', formSection);
    
    // Find address-related fields only within the same form section
    const sectionFields = formSection ? formSection.querySelectorAll('input, textarea, select') : [];
    let filledCount = 0;
    
    sectionFields.forEach(field => {
        const fieldName = (field.name || field.id || field.placeholder || '').toLowerCase();
        
        // More specific detection to avoid filling non-address fields
        if (fieldName.includes('street1') || (fieldName.includes('street') && !fieldName.includes('street2'))) {
            // Exclude fields that are not actually address fields
            if (!fieldName.includes('id') && !fieldName.includes('tracking') && !fieldName.includes('code')) {
                // Always replace, even if content is the same
                field.value = components.line1 || '';
                field.dispatchEvent(new Event('input', { bubbles: true }));
                field.dispatchEvent(new Event('change', { bubbles: true }));
                filledCount++;
                console.log('[FENNEC (MVP)] Filled street1:', components.line1);
            }
            
        } else if (fieldName.includes('street2') || fieldName.includes('suite') || fieldName.includes('apt')) {
            // Only fill line2 if it has actual data, don't duplicate line1
            if (!fieldName.includes('id') && !fieldName.includes('tracking') && !fieldName.includes('code')) {
                // Always replace line2, even if content is the same
                if (components.line2 && components.line2.trim()) {
                    field.value = components.line2;
                    field.dispatchEvent(new Event('input', { bubbles: true }));
                    field.dispatchEvent(new Event('change', { bubbles: true }));
                    filledCount++;
                    console.log('[FENNEC (MVP)] Filled street2:', components.line2);
                } else {
                    // Clear line2 if it's empty in the source data
                    field.value = '';
                    field.dispatchEvent(new Event('input', { bubbles: true }));
                    field.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log('[FENNEC (MVP)] Cleared street2 (empty in source)');
                }
            }
            
        } else if (fieldName.includes('city')) {
            // Exclude fields that are not actually city fields
            if (!fieldName.includes('id') && !fieldName.includes('tracking') && !fieldName.includes('code')) {
                // Always replace, even if content is the same
                field.value = components.city || '';
                field.dispatchEvent(new Event('input', { bubbles: true }));
                field.dispatchEvent(new Event('change', { bubbles: true }));
                filledCount++;
                console.log('[FENNEC (MVP)] Filled city:', components.city);
            }
            
        } else if (fieldName.includes('state') && !fieldName.includes('id') && !fieldName.includes('status')) {
            // Handle state fields (including dropdowns)
            if (field.tagName === 'SELECT') {
                // For dropdowns, find and select the option that matches the state
                const stateValue = components.state || '';
                if (stateValue) {
                    console.log('[FENNEC (MVP)] Attempting to select state:', stateValue, 'in dropdown:', field.name || field.id);
                    
                    // Log all available options for debugging
                    const allOptions = Array.from(field.options).map(opt => ({
                        value: opt.value,
                        text: opt.textContent.trim(),
                        selected: opt.selected
                    }));
                    console.log('[FENNEC (MVP)] Available dropdown options:', allOptions);
                    
                    // Try multiple matching strategies
                    let option = null;
                    
                    // Strategy 1: Exact value match
                    option = field.querySelector(`option[value="${stateValue}"]`);
                    if (option) {
                        console.log('[FENNEC (MVP)] Found by exact value match');
                    }
                    
                    // Strategy 2: Exact text match
                    if (!option) {
                        option = Array.from(field.options).find(opt => 
                            opt.textContent.trim().toUpperCase() === stateValue.toUpperCase()
                        );
                        if (option) {
                            console.log('[FENNEC (MVP)] Found by exact text match');
                        }
                    }
                    
                    // Strategy 3: Partial text match (for cases like "New York" vs "NY")
                    if (!option) {
                        option = Array.from(field.options).find(opt => 
                            opt.textContent.trim().toUpperCase().includes(stateValue.toUpperCase()) ||
                            stateValue.toUpperCase().includes(opt.textContent.trim().toUpperCase())
                        );
                        if (option) {
                            console.log('[FENNEC (MVP)] Found by partial text match');
                        }
                    }
                    
                    // Strategy 4: State abbreviation mapping
                    if (!option) {
                        const stateMap = {
                            'NY': 'New York',
                            'CA': 'California',
                            'TX': 'Texas',
                            'FL': 'Florida',
                            'IL': 'Illinois',
                            'PA': 'Pennsylvania',
                            'OH': 'Ohio',
                            'GA': 'Georgia',
                            'NC': 'North Carolina',
                            'MI': 'Michigan',
                            'NJ': 'New Jersey',
                            'VA': 'Virginia',
                            'WA': 'Washington',
                            'AZ': 'Arizona',
                            'MA': 'Massachusetts',
                            'TN': 'Tennessee',
                            'IN': 'Indiana',
                            'MO': 'Missouri',
                            'MD': 'Maryland',
                            'CO': 'Colorado',
                            'MN': 'Minnesota',
                            'WI': 'Wisconsin',
                            'AL': 'Alabama',
                            'SC': 'South Carolina',
                            'LA': 'Louisiana',
                            'KY': 'Kentucky',
                            'OR': 'Oregon',
                            'OK': 'Oklahoma',
                            'CT': 'Connecticut',
                            'UT': 'Utah',
                            'IA': 'Iowa',
                            'NV': 'Nevada',
                            'AR': 'Arkansas',
                            'MS': 'Mississippi',
                            'KS': 'Kansas',
                            'NM': 'New Mexico',
                            'NE': 'Nebraska',
                            'ID': 'Idaho',
                            'WV': 'West Virginia',
                            'HI': 'Hawaii',
                            'NH': 'New Hampshire',
                            'ME': 'Maine',
                            'RI': 'Rhode Island',
                            'MT': 'Montana',
                            'DE': 'Delaware',
                            'SD': 'South Dakota',
                            'ND': 'North Dakota',
                            'AK': 'Alaska',
                            'VT': 'Vermont',
                            'WY': 'Wyoming'
                        };
                        
                        const fullStateName = stateMap[stateValue.toUpperCase()];
                        if (fullStateName) {
                            option = Array.from(field.options).find(opt => 
                                opt.textContent.trim().toUpperCase() === fullStateName.toUpperCase()
                            );
                            if (option) {
                                console.log('[FENNEC (MVP)] Found by state abbreviation mapping:', fullStateName);
                            }
                        }
                    }
                    
                    if (option) {
                        field.value = option.value;
                        field.dispatchEvent(new Event('change', { bubbles: true }));
                        filledCount++;
                        console.log('[FENNEC (MVP)] Successfully selected state in dropdown:', stateValue, '->', option.textContent.trim());
                    } else {
                        console.log('[FENNEC (MVP)] State option not found in dropdown after all strategies:', stateValue);
                    }
                }
            } else {
                // For text inputs, set the value directly
                field.value = components.state || '';
                field.dispatchEvent(new Event('input', { bubbles: true }));
                field.dispatchEvent(new Event('change', { bubbles: true }));
                filledCount++;
                console.log('[FENNEC (MVP)] Filled state text field:', components.state);
            }
            
        } else if ((fieldName.includes('zip') || fieldName.includes('postal')) && !fieldName.includes('id')) {
            // Only fill zip fields, exclude zip id
            // Always replace, even if content is the same
            field.value = components.zip || '';
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
            filledCount++;
            console.log('[FENNEC (MVP)] Filled zip:', components.zip);
        }
    });
    
    // Show success notification
    showSmartPasteNotification(filledCount, components);
}

// Function to find the form section containing a field
function findFormSection(field) {
    // Start from the field and work up the DOM tree
    let currentElement = field;
    
    while (currentElement && currentElement !== document.body) {
        // Check for specific Member sections first (highest priority)
        if (currentElement.id && currentElement.id.startsWith('tblMembers')) {
            console.log('[FENNEC (MVP)] Found Member section:', currentElement.id);
            return currentElement;
        }
        
        // Check for specific form sections
        if (currentElement.classList.contains('white-box')) {
            console.log('[FENNEC (MVP)] Found white-box section');
            return currentElement;
        }
        
        // Check for common form section containers
        const sectionSelectors = [
            'form',
            '.form-section',
            '.address-section',
            '.physical-address',
            '.company-info',
            '.member-info',
            '.agent-info'
        ];
        
        for (const selector of sectionSelectors) {
            if (currentElement.matches(selector)) {
                console.log('[FENNEC (MVP)] Found form section with selector:', selector);
                return currentElement;
            }
        }
        
        // Check if current element has address-related fields as children
        const hasAddressFields = currentElement.querySelector('input[name*="street"], input[name*="address"], input[name*="city"], input[name*="state"], input[name*="zip"]');
        if (hasAddressFields) {
            console.log('[FENNEC (MVP)] Found form section with address fields');
            return currentElement;
        }
        
        // Move up to parent
        currentElement = currentElement.parentElement;
    }
    
    // If no specific section found, return the closest form or div
    let fallbackElement = field;
    while (fallbackElement && fallbackElement !== document.body) {
        if (fallbackElement.tagName === 'FORM' || fallbackElement.tagName === 'DIV') {
            console.log('[FENNEC (MVP)] Using fallback form section:', fallbackElement.tagName);
            return fallbackElement;
        }
        fallbackElement = fallbackElement.parentElement;
    }
    
    console.log('[FENNEC (MVP)] No form section found, using document body');
    return document.body;
}

// Function to show smart paste notification
function showSmartPasteNotification(filledCount, components) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 15px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 999999;
        font-family: Arial, sans-serif;
        font-size: 14px;
        max-width: 300px;
        animation: slideIn 0.3s ease-out;
    `;
    
    const displayText = `${components.line1}${components.line2 ? ', ' + components.line2 : ''}, ${components.city}, ${components.state} ${components.zip}`;
    
    notification.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 8px;">✅ Smart Paste Complete!</div>
        <div style="font-size: 12px; margin-bottom: 5px;">${filledCount} field${filledCount > 1 ? 's' : ''} filled</div>
        <div style="font-size: 11px; opacity: 0.8; word-break: break-word;">${displayText}</div>
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 3000);
}

// Initialize context menu when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupContextMenu);
} else {
    setupContextMenu();
}

// Global delegated click handler as a safety net for sidebar interactions
// Ensures Google search and SMART COPY work even if per-element listeners were missed
if (!window.__fennecDelegatedListenerInstalled) {
    window.__fennecDelegatedListenerInstalled = true;
    document.addEventListener('click', function(event) {
        const target = event.target && event.target.closest('.copilot-address, .copilot-copy, .copilot-copy-icon');
        if (!target) return;
        
        // Only handle clicks originating inside the sidebar
        const sidebar = target.closest('#copilot-sidebar');
        const inSidebar = !!sidebar;
        if (!inSidebar) return;
        
        console.log('[FENNEC (MVP)] Global click handler triggered for:', target.className, 'in sidebar:', !!sidebar);
        
        event.preventDefault();
        event.stopPropagation();
        
        if (target.classList.contains('copilot-address')) {
            const addr = target.dataset.address || target.dataset.copy || (target.textContent || '').trim();
            if (!addr) {
                console.warn('[FENNEC (MVP)] No address data found in clicked element');
                return;
            }
            console.log('[FENNEC (MVP)] Address clicked via global handler:', addr);
            
            // Smart copy first
            try { smartCopyAddress(addr); } catch (e) { console.error('[FENNEC (MVP)] Smart copy error:', e); }
            
            // Open Google Search (not Maps)
            try {
                const googleSearchUrl = 'https://www.google.com/search?q=' + encodeURIComponent(addr);
                console.log('[FENNEC (MVP)] Opening Google search:', googleSearchUrl);
                window.open(googleSearchUrl, '_blank');
            } catch (e) { console.error('[FENNEC (MVP)] Google search error:', e); }
            return;
        }
        
        // Handle copy icons/text
        const text = target.dataset.copy || target.dataset.address || (target.textContent || '').trim();
        if (!text) return;
        const isAddress = /\b(street|st\.?|road|rd\.?|ave\.?|avenue|drive|dr\.?|lane|ln\.?|boulevard|blvd\.?|pkwy|parkway|court|ct\.?|hwy|highway|way|loop|circle|cir\.?|place|pl\.?|trail|trl\.?|point|pt\.?|falls?|fls?|bit)\b/i.test(text) && /\d/.test(text);
        if (isAddress) {
            try { smartCopyAddress(text); } catch (e) { console.error('[FENNEC (MVP)] Smart copy error:', e); }
        } else {
            try { navigator.clipboard.writeText(text).catch(() => {}); } catch (e) { console.error('[FENNEC (MVP)] Clipboard error:', e); }
        }
    }, true);
}

function attachCommonListeners(rootEl) {
    if (!rootEl) return;
    
    console.log('[FENNEC (MVP)] attachCommonListeners called for:', rootEl);
    
    const addressElements = rootEl.querySelectorAll('.copilot-address');
    console.log('[FENNEC (MVP)] Found', addressElements.length, 'address elements to attach listeners to');
    
    addressElements.forEach((el, index) => {
        console.log(`[FENNEC (MVP)] Attaching listener to address element ${index + 1}:`, {
            address: el.dataset.address,
            className: el.className,
            innerHTML: el.innerHTML.substring(0, 100) + '...'
        });
        
        // Remove any existing listeners to prevent duplicates
        el.removeEventListener('click', el._addressClickHandler);
        
        // Create a new handler function
        el._addressClickHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const addr = el.dataset.address;
            if (!addr) {
                console.warn('[FENNEC (MVP)] No address data found in clicked element');
                return;
            }
            
            console.log('[FENNEC (MVP)] Address clicked via direct listener:', addr);
            
            // Perform SMART COPY of address
            try {
                smartCopyAddress(addr);
            } catch (e) {
                console.error('[FENNEC (MVP)] Smart copy error:', e);
            }
            
            // Open Google search (NOT Google Maps) for the address
            try {
                const googleSearchUrl = 'https://www.google.com/search?q=' + encodeURIComponent(addr);
                console.log('[FENNEC (MVP)] Opening Google search for address:', addr);
                window.open(googleSearchUrl, '_blank');
            } catch (e) {
                console.error('[FENNEC (MVP)] Google search error:', e);
            }
        };
        
        // Add the new listener
        el.addEventListener('click', el._addressClickHandler);
        console.log(`[FENNEC (MVP)] Successfully attached listener to address element ${index + 1}`);
    });
    
    // Enhanced USPS event listener attachment with better debugging
    const uspsElements = rootEl.querySelectorAll('.copilot-usps');
    console.log('[FENNEC (MVP)] Found', uspsElements.length, 'USPS elements to attach listeners to');
    
    uspsElements.forEach((el, index) => {
        console.log(`[FENNEC (MVP)] Processing USPS element ${index + 1}:`, {
            element: el,
            address: el.dataset.address,
            hasListener: el.dataset.uspsListenerAdded,
            innerHTML: el.innerHTML,
            className: el.className
        });
        
        // Only add listener if it doesn't already have one
        if (!el.dataset.uspsListenerAdded) {
            el.dataset.uspsListenerAdded = 'true';
            
            // Ensure the element is clickable
            el.style.cursor = 'pointer';
            el.style.pointerEvents = 'auto';
            
            el.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const addr = el.dataset.address;
                console.log('[FENNEC (MVP)] USPS icon clicked for address:', addr, 'element:', el);
                
                if (!addr) {
                    console.warn('[FENNEC (MVP)] No address data found in USPS element');
                    return;
                }
                
                // Mark that the primary handler executed successfully
                el.dataset.uspsListenerAdded = 'executed';
                
                // Always open USPS URL directly since chrome.runtime is not available
                console.log('[FENNEC (MVP)] Opening USPS URL directly (chrome.runtime not available)');
                const url = 'https://tools.usps.com/zip-code-lookup.htm?byaddress&fennec_addr=' + encodeURIComponent(addr);
                
                // Store source tab info for focus return
                if (typeof chrome !== 'undefined' && chrome.runtime && chrome.tabs) {
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        if (tabs.length > 0) {
                            const sourceTab = tabs[0];
                            const uspsKey = `usps_source_${addr}`;
                            
                            chrome.storage.local.set({ [uspsKey]: { tabId: sourceTab.id, url: sourceTab.url } }, () => {
                                console.log('[FENNEC (MVP)] Stored source tab info for address:', addr, 'tabId:', sourceTab.id);
                            });
                        }
                    });
                }
                
                try {
                    const newWindow = window.open(url, '_blank');
                    if (newWindow) {
                        console.log('[FENNEC (MVP)] USPS URL opened successfully:', url);
                    } else {
                        console.error('[FENNEC (MVP)] USPS URL failed to open (popup blocked?)');
                        // Fallback: try to open in same window
                        window.location.href = url;
                    }
                } catch (error) {
                    console.error('[FENNEC (MVP)] Error opening USPS URL:', error.message);
                    // Fallback: try to open in same window
                    window.location.href = url;
                }

            });
            
            console.log(`[FENNEC (MVP)] Successfully attached USPS listener to element ${index + 1}`);
        } else {
            console.log(`[FENNEC (MVP)] USPS element ${index + 1} already has listener attached`);
        }
    });
    
    rootEl.querySelectorAll('.copilot-copy, .copilot-copy-icon').forEach(el => {
        el.addEventListener('click', () => {
            const text = el.dataset.copy;
            if (!text) return;
            
            // Check if this is an address (contains street indicators)
            const isAddress = /\b(street|st\.?|road|rd\.?|ave\.?|avenue|drive|dr\.?|lane|ln\.?|boulevard|blvd\.?|pkwy|parkway|court|ct\.?|hwy|highway|way|loop|circle|cir\.?|place|pl\.?|trail|trl\.?|point|pt\.?|falls?|fls?|bit)\b/i.test(text) && /\d/.test(text);
            
            if (isAddress) {
                // Use SMART COPY for addresses
                smartCopyAddress(text);
            } else {
                // Use regular copy for non-address text
                navigator.clipboard.writeText(text).catch(err => console.warn('[FENNEC (MVP)] Clipboard error:', err));
            }
        });
    });
    // Only attach SOS listeners if they don't already have them from ensureCompanyBoxListeners
    rootEl.querySelectorAll('.copilot-sos').forEach(el => {
        // Skip if this element already has a listener from ensureCompanyBoxListeners
        if (el._sosClickHandler) {
            console.log('[FENNEC (MVP)] Skipping SOS listener attachment - already has handler from ensureCompanyBoxListeners');
            return;
        }
        
        el.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('[FENNEC (MVP)] Copilot-SOS clicked via attachCommonListeners:', {
                url: el.dataset.url,
                query: el.dataset.query,
                type: el.dataset.type
            });
            
            const url = el.dataset.url;
            const query = el.dataset.query;
            const type = el.dataset.type || 'name';
            
            if (!url || !query) {
                console.error('[FENNEC (MVP)] Missing URL or query for SOS search');
                return;
            }
            
            // Apply deduplication logic BEFORE attempting to open the tab
            if (typeof tabDeduplication !== 'undefined' && !tabDeduplication.shouldOpenTab(url)) {
                console.log('[FENNEC (MVP)] Tab deduplication: Preventing opening of duplicate tab for URL:', url);
                return; // Stop here if it's a duplicate
            }
            
            // Copy query to clipboard
            navigator.clipboard.writeText(query).catch(err => console.warn('[FENNEC (MVP)] Clipboard error:', err));
            
            // Try to send message via chrome.runtime, with a fallback to window.open
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                console.log('[FENNEC (MVP)] Attempting to send SOS search message via chrome.runtime.sendMessage');
                chrome.runtime.sendMessage({ 
                    action: 'sosSearch', 
                    url, 
                    query, 
                    searchType: type 
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('[FENNEC (MVP)] Error sending SOS search message:', chrome.runtime.lastError);
                        console.log('[FENNEC (MVP)] Falling back to window.open for URL:', url);
                        // If sendMessage fails, window.open will be called.
                        // The window.open override already has the deduplication logic,
                        // but since we already passed it once, it will open.
                        // This is fine as the initial check prevented the first duplicate.
                        window.open(url, '_blank');
                    } else {
                        console.log('[FENNEC (MVP)] SOS search message sent successfully');
                    }
                });
            } else {
                console.log('[FENNEC (MVP)] chrome.runtime.sendMessage not available, falling back to window.open for URL:', url);
                window.open(url, '_blank');
            }
        });
    });
    rootEl.querySelectorAll('.copilot-kb').forEach(el => {
        el.addEventListener('click', e => {
            e.preventDefault();
            const state = el.dataset.state;
            const otype = el.dataset.otype || '';
            if (!state) return;
            if (typeof window.openKbWindow === 'function') {
                window.openKbWindow(state, otype);
            } else {
                chrome.runtime.sendMessage({ action: 'openKnowledgeBaseWindow', state, orderType: otype });
            }
        });
    });
    rootEl.querySelectorAll('.company-purpose .copilot-copy').forEach(el => {
        el.addEventListener('click', () => {
            const text = el.dataset.copy;
            if (!text) return;
            window.open('https://www.google.com/search?q=' + encodeURIComponent(text), '_blank');
        });
    });
    rootEl.querySelectorAll('.copilot-name').forEach(el => {
        el.addEventListener('click', e => {
            e.preventDefault();
            const text = el.dataset.copy;
            if (!text) return;
            navigator.clipboard.writeText(text).catch(err => console.warn('[Copilot] Clipboard', err));
        });
    });
    
    // Company search toggle handling - only attach if not already handled by ensureCompanyBoxListeners
    const companySearchToggles = rootEl.querySelectorAll('.company-search-toggle');
    console.log('[FENNEC (MVP)] Found company search toggles:', companySearchToggles.length);
    
    companySearchToggles.forEach(el => {
        // Skip if this element already has a listener from ensureCompanyBoxListeners
        if (el._searchClickHandler) {
            console.log('[FENNEC (MVP)] Skipping search toggle listener attachment - already has handler from ensureCompanyBoxListeners');
            return;
        }
        
        // Remove any existing listeners to prevent duplicates
        el.removeEventListener('click', el._companySearchToggleHandler);
        
        // Create a new handler function
        el._companySearchToggleHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('[FENNEC (MVP)] Company search toggle clicked via attachCommonListeners');
            const box = el.closest('.white-box');
            if (box && typeof toggleCompanySearch === 'function') {
                console.log('[FENNEC (MVP)] Calling toggleCompanySearch for box:', box);
                toggleCompanySearch(box);
            } else {
                console.error('[FENNEC (MVP)] Could not find white-box or toggleCompanySearch function');
                console.log('[FENNEC (MVP)] Box found:', !!box);
                console.log('[FENNEC (MVP)] toggleCompanySearch available:', typeof toggleCompanySearch === 'function');
            }
        };
        
        // Add the new listener
        el.addEventListener('click', el._companySearchToggleHandler);
        console.log('[FENNEC (MVP)] Added click listener to company search toggle via attachCommonListeners');
    });

    // Update USPS icons based on CMRA results
    updateUspsIconsFromCmraResults();
    
    // Quick Summary Toggle Handler
    const qsToggle = rootEl.querySelector('#qs-toggle') || document.getElementById('qs-toggle');
    if (qsToggle && !qsToggle.dataset.listenerAttached) {
        qsToggle.dataset.listenerAttached = 'true';
        qsToggle.addEventListener('click', () => {
            console.log('[FENNEC (MVP)] Quick Summary toggle clicked');
            const box = document.getElementById('quick-summary');
            if (!box) return;
            if (box.style.maxHeight && parseInt(box.style.maxHeight) > 0) {
                box.style.maxHeight = '0px';
                box.classList.add('quick-summary-collapsed');
            } else {
                box.classList.remove('quick-summary-collapsed');
                box.style.maxHeight = box.scrollHeight + 'px';
            }
        });
    }
    
    // Family Tree Handler
    const ftIcon = rootEl.querySelector('#family-tree-icon') || document.getElementById('family-tree-icon');
    
    if (ftIcon && !ftIcon.dataset.listenerAttached) {
        ftIcon.dataset.listenerAttached = 'true';
        console.log('[FENNEC (MVP)] Attaching click listener to family tree icon');
        
        // Add a test click listener first to see if events are working
        ftIcon.addEventListener('click', (event) => {
            console.log('[FENNEC (MVP)] TEST: Any click event detected on family tree icon');
        });
        
        ftIcon.addEventListener('click', (event) => {
            console.log('[FENNEC (MVP)] Family Tree icon clicked - handler triggered!', {
                event: event,
                target: event.target,
                currentTarget: event.currentTarget
            });
            let container = document.getElementById('family-tree-orders');
            if (!container) {
                const qs = document.getElementById('quick-summary');
                if (qs) {
                    container = document.createElement('div');
                    container.id = 'family-tree-orders';
                    container.className = 'ft-collapsed';
                    qs.insertAdjacentElement('afterend', container);
                } else {
                    return;
                }
            }
            if (container.style.maxHeight && parseInt(container.style.maxHeight) > 0) {
                container.style.maxHeight = '0';
                container.classList.add('ft-collapsed');
                return;
            }
            container.classList.remove('ft-collapsed');
            if (container.dataset.loaded === 'true') {
                requestAnimationFrame(() => {
                    container.style.maxHeight = container.scrollHeight + 'px';
                });
                return;
            }
            console.log('[FENNEC (MVP)] getParentOrderId function available:', typeof getParentOrderId === 'function');
            const parentId = typeof getParentOrderId === 'function' ? getParentOrderId() : null;
            console.log('[FENNEC (MVP)] Detected parent order ID:', parentId);
            if (!parentId) {
                console.warn('[FENNEC (MVP)] Parent order not found');
                alert('Parent order not found');
                return;
            }
            
            console.log('[FENNEC (MVP)] Family tree - Setting icon to loading state');
            ftIcon.style.opacity = '0.5';
            ftIcon.style.pointerEvents = 'none';
            
            console.log('[FENNEC (MVP)] Family tree - Sending fetchChildOrders message for parentId:', parentId);
            
            // Set flag to extract state info when parent order loads
            chrome.storage.local.set({ fennecPendingStateUpdate: parentId }, () => {
                console.log('[FENNEC (MVP)] Set pending state update for parent order:', parentId);
                // Proactively extract state on the current (parent) page
                try {
                    const info = getBasicOrderInfo();
                    console.log('[FENNEC (MVP)] Triggered getBasicOrderInfo() after setting pending state:', info);
                } catch (e) { /* noop */ }
            });
            
            // Add timeout to detect if background script isn't responding
            let timeoutId = setTimeout(() => {
                console.error('[FENNEC (MVP)] Family tree - TIMEOUT: fetchChildOrders request took longer than 15 seconds');
                ftIcon.style.opacity = '1';
                ftIcon.style.pointerEvents = 'auto';
                alert('Family tree loading timed out. Check console for details.');
            }, 15000);
            
            chrome.runtime.sendMessage({ action: 'fetchChildOrders', orderId: parentId }, (resp) => {
                clearTimeout(timeoutId);
                
                if (chrome.runtime.lastError) {
                    console.error('[FENNEC (MVP)] Family tree - Chrome runtime error:', chrome.runtime.lastError.message);
                    ftIcon.style.opacity = '1';
                    ftIcon.style.pointerEvents = 'auto';
                    alert('Family tree error: ' + chrome.runtime.lastError.message);
                    return;
                }
                
                console.log('[FENNEC (MVP)] Family tree - Received fetchChildOrders response:', resp);
                ftIcon.style.opacity = '1';
                ftIcon.style.pointerEvents = 'auto';
                
                if (!resp || !resp.childOrders || !resp.parentInfo) {
                    console.warn('[FENNEC (MVP)] Family tree - Invalid response received:', {
                        hasResp: !!resp,
                        hasChildOrders: resp ? !!resp.childOrders : false,
                        hasParentInfo: resp ? !!resp.parentInfo : false
                    });
                    return;
                }
                
                console.log('[FENNEC (MVP)] Family tree - Valid response received, building family tree UI');
                const box = document.createElement('div');
                box.className = 'white-box';
                box.style.marginBottom = '10px';
                let html = '';
                const parent = resp.parentInfo;

                // Determine duplicate orders by type when status is REVIEW/PROCESSING/HOLD
                const allOrders = [parent].concat(resp.childOrders);
                const dupMap = {};
                allOrders.forEach(o => {
                    if (/review|processing|hold/i.test(o.status || '')) {
                        const key = (abbreviateOrderType(o.type) || '').toLowerCase();
                        if (!dupMap[key]) dupMap[key] = [];
                        dupMap[key].push(o);
                    }
                });
                const dupIds = new Set();
                Object.values(dupMap).forEach(list => {
                    if (list.length > 1) list.forEach(o => dupIds.add(String(o.orderId)));
                });

                const pStatusClass =
                    /shipped/i.test(parent.status) ? 'copilot-tag copilot-tag-shipped' :
                    /review/i.test(parent.status) ? 'copilot-tag copilot-tag-review' :
                    /processing/i.test(parent.status) ? 'copilot-tag copilot-tag-processing' :
                    /hold/i.test(parent.status) ? 'copilot-tag copilot-tag-hold' :
                    /forwarded/i.test(parent.status) ? 'copilot-tag copilot-tag-forwarded' :
                    /canceled|cancelled/i.test(parent.status) ? 'copilot-tag copilot-tag-canceled' : 'copilot-tag';
                html += `<div class="section-label">PARENT</div>`;
                const parentStateInfo = extractStateFromOrderType(parent.type);
                const parentOrderType = abbreviateOrderType(parent.type);
                const parentStateTag = parentStateInfo ? `<span class="copilot-tag copilot-tag-black">${escapeHtml(parentStateInfo.state)}</span> ` : '';
                // Show state tag immediately if present
                html += `<div class="ft-grid" data-parent-id="${escapeHtml(parent.orderId)}">` +
                    `<div><b><a href="#" class="ft-link" data-id="${escapeHtml(parent.orderId)}">${escapeHtml(parent.orderId)}</a></b>` +
                    `${dupIds.has(String(parent.orderId)) ? ` <span class="ft-cancel" data-id="${escapeHtml(parent.orderId)}">❌</span>` : ''}</div>` +
                    `<div class="ft-type">${escapeHtml(parentOrderType).toUpperCase()}</div>` +
                    `<div class="ft-date" data-parent-date="${escapeHtml(parent.date)}">${parentStateTag}${escapeHtml(parent.date)}</div>` +
                    `<div><span class="${pStatusClass} ft-status" data-id="${escapeHtml(parent.orderId)}">${escapeHtml(parent.status)}</span></div>` +
                    `</div>`;
                html += `<div class="section-label">CHILD</div>`;
                html += resp.childOrders.map(o => {
                    const cls =
                        /shipped/i.test(o.status) ? 'copilot-tag copilot-tag-shipped' :
                        /review/i.test(o.status) ? 'copilot-tag copilot-tag-review' :
                        /processing/i.test(o.status) ? 'copilot-tag copilot-tag-processing' :
                        /hold/i.test(o.status) ? 'copilot-tag copilot-tag-hold' :
                        /forwarded/i.test(o.status) ? 'copilot-tag copilot-tag-forwarded' :
                        /canceled|cancelled/i.test(o.status) ? 'copilot-tag copilot-tag-canceled' : 'copilot-tag';
                    const childStateInfo = extractStateFromOrderType(o.type);
                    const childOrderType = abbreviateOrderType(o.type);
                    const childStateTag = childStateInfo ? `<span class="copilot-tag copilot-tag-black">${escapeHtml(childStateInfo.state)}</span>` : '';
                    return `
                            <div class="ft-grid">
                                <div><b><a href="#" class="ft-link" data-id="${escapeHtml(o.orderId)}">${escapeHtml(o.orderId)}</a></b>` +
                                `${dupIds.has(String(o.orderId)) ? ` <span class="ft-cancel" data-id="${escapeHtml(o.orderId)}">❌</span>` : ''}</div>
                                <div class="ft-type">${escapeHtml(childOrderType).toUpperCase()}</div>
                                <div class="ft-date">${childStateTag} ${escapeHtml(o.date)}</div>
                                <div><span class="${cls} ft-status" data-id="${escapeHtml(o.orderId)}">${escapeHtml(o.status)}</span></div>
                            </div>`;
                }).join('');
                html += `<div style="text-align:center; margin-top:8px;">
                            <button id="ar-diagnose-btn" class="copilot-button">🩺 DIAGNOSE</button>
                        </div>`;
                box.innerHTML = html;
                container.innerHTML = '';
                container.appendChild(box);
                container.dataset.loaded = 'true';
                const extra = parseInt(box.style.marginBottom) || 0;
                requestAnimationFrame(() => {
                    container.style.maxHeight = (container.scrollHeight + extra) + 'px';
                    container.classList.remove('ft-collapsed');
                });

                // If state was already extracted and stored before the listener attached, render it now
                try {
                    chrome.storage.local.get({ fennecOrderStateInfo: null }, ({ fennecOrderStateInfo }) => {
                        const data = fennecOrderStateInfo || null;
                        if (data && data.orderId && data.state) {
                            const parentGrid = container.querySelector(`.ft-grid[data-parent-id="${data.orderId}"]`);
                            if (parentGrid) {
                                const dateDiv = parentGrid.querySelector('.ft-date');
                                if (dateDiv && !dateDiv.querySelector('.copilot-tag-black')) {
                                    const originalDate = dateDiv.getAttribute('data-parent-date') || dateDiv.textContent;
                                    const stateTag = `<span class="copilot-tag copilot-tag-black">${data.state}</span> `;
                                    dateDiv.innerHTML = stateTag + originalDate;
                                }
                            }
                        }
                    });
                } catch (e) { /* noop */ }
                container.querySelectorAll('.ft-link').forEach(a => {
                    a.addEventListener('click', e => {
                        e.preventDefault();
                        const id = a.dataset.id;
                        if (id) {
                            // Store the order ID to update state info when the order loads
                            chrome.storage.local.set({ fennecPendingStateUpdate: id }, () => {
                                chrome.runtime.sendMessage({
                                    action: 'openOrReuseTab',
                                    url: `${location.origin}/incfile/order/detail/${id}`,
                                    active: false
                                });
                            });
                        }
                    });
                });
                container.querySelectorAll('.ft-cancel').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const id = btn.dataset.id;
                        if (!id) return;
                        if (!confirm('Cancel and refund order ' + id + '?')) return;
                        chrome.storage.local.set({ fennecDupCancel: id }, () => {
                            chrome.runtime.sendMessage({
                                action: 'openOrReuseTab',
                                url: `${location.origin}/incfile/order/detail/${id}`,
                                active: true
                            });
                        });
                    });
                });

                if (!window.ftDupListener) {
                    chrome.storage.onChanged.addListener((changes, area) => {
                        if (area === 'local' && changes.fennecDupCancelDone) {
                            const data = changes.fennecDupCancelDone.newValue || {};
                            const span = container.querySelector(`.ft-status[data-id="${data.orderId}"]`);
                            if (span) {
                                span.textContent = 'CANCELED';
                                span.className = 'copilot-tag copilot-tag-canceled ft-status';
                            }
                        }
                        // Listen for state updates from opened orders
                        if (area === 'local' && changes.fennecOrderStateInfo) {
                            const data = changes.fennecOrderStateInfo.newValue || {};
                            if (data.orderId && data.state) {
                                // Find the parent order in the family tree and update its state tag
                                const parentGrid = container.querySelector(`.ft-grid[data-parent-id="${data.orderId}"]`);
                                if (parentGrid) {
                                    const dateDiv = parentGrid.querySelector('.ft-date');
                                    if (dateDiv && !dateDiv.querySelector('.copilot-tag-black')) {
                                        const originalDate = dateDiv.getAttribute('data-parent-date') || dateDiv.textContent;
                                        const stateTag = `<span class="copilot-tag copilot-tag-black">${data.state}</span> `;
                                        dateDiv.innerHTML = stateTag + originalDate;
                                        console.log('[FENNEC (MVP)] Updated parent order state in family tree:', data.state);
                                    }
                                } else {
                                    // Fallback: try to find by link
                                    const parentLink = container.querySelector('.ft-link[data-id="' + data.orderId + '"]');
                                    if (parentLink) {
                                        const parentGrid = parentLink.closest('.ft-grid');
                                        if (parentGrid) {
                                            const dateDiv = parentGrid.querySelector('.ft-date');
                                            if (dateDiv && !dateDiv.querySelector('.copilot-tag-black')) {
                                                const originalDate = dateDiv.getAttribute('data-parent-date') || dateDiv.textContent;
                                                const stateTag = `<span class="copilot-tag copilot-tag-black">${data.state}</span> `;
                                                dateDiv.innerHTML = stateTag + originalDate;
                                                console.log('[FENNEC (MVP)] Updated parent order state in family tree (fallback):', data.state);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    });
                    window.ftDupListener = true;
                }
                const diagBtn = container.querySelector('#ar-diagnose-btn');
                if (diagBtn && typeof diagnoseHoldOrders === 'function') {
                    diagBtn.addEventListener('click', () => {
                        const relevant = resp.childOrders.filter(o => {
                            const status = o.status || '';
                            const type = o.type || '';
                            return /hold/i.test(status) ||
                                ((/amendment/i.test(type) || /reinstat/i.test(type)) && /review/i.test(status));
                        });
                        if (!relevant.length) {
                            alert('No applicable orders found');
                            return;
                        }
                        const current = typeof getBasicOrderInfo === 'function'
                            ? getBasicOrderInfo().orderId
                            : null;
                        const typeText = typeof currentOrderTypeText !== 'undefined' ? currentOrderTypeText : null;
                        diagnoseHoldOrders(relevant, parent.orderId, current, typeText);
                    });
                }
            });
        });
    }
}

function toggleCompanySearch(box) {
    if (!box) return;
    const mode = box.dataset.mode || 'info';
    const state = box.dataset.state || '';
    
    console.log('[FENNEC (MVP)] toggleCompanySearch called:', { mode, state, box });
    
    if (mode === 'search') {
        box.innerHTML = box.dataset.infoHtml || '';
        box.dataset.mode = 'info';
        attachCommonListeners(box);
        return;
    }
    
    box.dataset.infoHtml = box.innerHTML;
    box.dataset.mode = 'search';
    
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Search name';
    nameInput.style.cssText = 'width: 100%; margin-bottom: 5px; padding: 5px; border: 1px solid #ccc; border-radius: 3px;';
    
    const idInput = document.createElement('input');
    idInput.type = 'text';
    idInput.placeholder = 'Search ID';
    idInput.style.cssText = 'width: 100%; margin-bottom: 5px; padding: 5px; border: 1px solid #ccc; border-radius: 3px;';
    
    const form = document.createElement('div');
    form.className = 'company-search-form';
    form.style.cssText = 'margin-bottom: 10px;';
    form.appendChild(nameInput);
    form.appendChild(idInput);
    
    box.innerHTML = '';
    box.appendChild(form);
    
    const searchIcon = document.createElement('span');
    searchIcon.className = 'company-search-toggle';
    searchIcon.textContent = '🔍';
    searchIcon.style.cssText = 'cursor: pointer; float: right;';
    box.appendChild(searchIcon);
    
    const doSearch = (type) => {
        const q = type === 'name' ? nameInput.value.trim() : idInput.value.trim();
        if (!q) {
            console.log('[FENNEC (MVP)] Search query is empty');
            return;
        }
        
        console.log('[FENNEC (MVP)] Attempting SOS search:', { type, query: q, state });
        
        // Check if buildSosUrl function is available
        let buildSosUrlFunc = null;
        
        if (typeof buildSosUrl === 'function') {
            buildSosUrlFunc = buildSosUrl;
        } else if (window.buildSosUrl) {
            buildSosUrlFunc = window.buildSosUrl;
            console.log('[FENNEC (MVP)] Found buildSosUrl in window scope');
        }
        
        if (!buildSosUrlFunc) {
            console.error('[FENNEC (MVP)] buildSosUrl function is not available');
            alert('SOS search is not available for this state. Please check if the state information is properly loaded.');
            return;
        }
        
        // Use the found function
        const url = buildSosUrlFunc(state, null, type);
        if (!url) {
            console.error('[FENNEC (MVP)] Could not build SOS URL for state:', state);
            alert(`SOS search is not available for state: ${state}`);
            return;
        }
        
        console.log('[FENNEC (MVP)] Sending SOS search message:', { url, query: q, searchType: type });
        
        // Try to send message via chrome.runtime, fallback to direct URL opening
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ 
                action: 'sosSearch', 
                url, 
                query: q, 
                searchType: type 
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('[FENNEC (MVP)] Chrome runtime error, opening URL directly:', chrome.runtime.lastError);
                    window.open(url, '_blank');
                } else {
                    console.log('[FENNEC (MVP)] SOS search message sent successfully');
                }
            });
        } else {
            console.log('[FENNEC (MVP)] Chrome runtime not available, opening URL directly');
            window.open(url, '_blank');
        }
        return;
    };
    
    // Add event listeners for Enter key
    nameInput.addEventListener('keydown', e => { 
        if (e.key === 'Enter') {
            console.log('[FENNEC (MVP)] Name search triggered by Enter key');
            doSearch('name'); 
        }
    });
    
    idInput.addEventListener('keydown', e => { 
        if (e.key === 'Enter') {
            console.log('[FENNEC (MVP)] ID search triggered by Enter key');
            doSearch('id'); 
        }
    });
    
    // Add click listeners for search icon to toggle back
    searchIcon.addEventListener('click', () => {
        console.log('[FENNEC (MVP)] Search icon clicked, toggling back to info mode');
        toggleCompanySearch(box);
    });
    
    // Focus on the name input for better UX
    setTimeout(() => nameInput.focus(), 100);
    
    attachCommonListeners(box);
}
window.toggleCompanySearch = toggleCompanySearch;

// Tab deduplication system
const tabDeduplication = {
    lastOpenedUrl: null,
    lastOpenedTime: 0,
    deduplicationWindow: 1000, // 1 second window
    
    shouldOpenTab: function(url) {
        const now = Date.now();
        const isDuplicate = this.lastOpenedUrl === url && 
                           (now - this.lastOpenedTime) < this.deduplicationWindow;
        
        if (isDuplicate) {
            console.log('[FENNEC (MVP)] Tab deduplication: Preventing duplicate tab for URL:', url);
            return false;
        }
        
        this.lastOpenedUrl = url;
        this.lastOpenedTime = now;
        return true;
    },
    
    reset: function() {
        this.lastOpenedUrl = null;
        this.lastOpenedTime = 0;
    }
};

// Override window.open to prevent duplicates
const originalWindowOpen = window.open;
window.open = function(url, target, features) {
    if (tabDeduplication.shouldOpenTab(url)) {
        console.log('[FENNEC (MVP)] Opening tab with deduplication:', url);
        return originalWindowOpen.call(this, url, target, features);
    } else {
        console.log('[FENNEC (MVP)] Tab deduplication: Blocked duplicate tab for:', url);
        return null;
    }
};

// Make deduplication system globally available
window.tabDeduplication = tabDeduplication;
window.resetTabDeduplication = function() {
    tabDeduplication.reset();
    console.log('[FENNEC (MVP)] Tab deduplication system reset');
};

// Debug function to test SOS search functionality
window.debugSosSearch = function() {
    console.log('[FENNEC (MVP)] Debugging SOS search functionality...');
    
    // Check if buildSosUrl is available
    if (typeof buildSosUrl === 'function') {
        console.log('[FENNEC (MVP)] buildSosUrl function is available');
        
        // Test with a few states
        const testStates = ['California', 'Texas', 'New York', 'Florida'];
        testStates.forEach(state => {
            const nameUrl = buildSosUrl(state, null, 'name');
            const idUrl = buildSosUrl(state, null, 'id');
            console.log(`[FENNEC (MVP)] ${state}:`, { nameUrl, idUrl });
        });
    } else {
        console.error('[FENNEC (MVP)] buildSosUrl function is NOT available');
        
        // Check if it's in window scope
        if (window.buildSosUrl) {
            console.log('[FENNEC (MVP)] buildSosUrl found in window scope');
        } else {
            console.error('[FENNEC (MVP)] buildSosUrl not found in window scope either');
        }
    }
    
    // Check if chrome.runtime is available
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        console.log('[FENNEC (MVP)] chrome.runtime is available');
    } else {
        console.error('[FENNEC (MVP)] chrome.runtime is NOT available');
    }
    
    // Check for company search toggles
    const toggles = document.querySelectorAll('.company-search-toggle');
    console.log('[FENNEC (MVP)] Found company search toggles:', toggles.length);
    
    // Check for company boxes with state data
    const companyBoxes = document.querySelectorAll('.white-box.company-box');
    console.log('[FENNEC (MVP)] Found company boxes:', companyBoxes.length);
    companyBoxes.forEach((box, index) => {
        const state = box.dataset.state;
        console.log(`[FENNEC (MVP)] Company box ${index}: state = "${state}"`);
    });
};

// Standardized sidebar template for REVIEW MODE across all environments
function buildStandardizedReviewModeSidebar(reviewMode = false, devMode = false, includeXrayButton = false) {
    return `
        ${buildSidebarHeader()}
        <div class="order-summary-header">
            ${includeXrayButton ? `<button id="btn-xray" class="copilot-button">🩻 XRAY</button>` : ''}
            <span id="family-tree-icon" class="family-tree-icon" style="display:none">🌳</span> 
            ORDER SUMMARY 
            <span id="qs-toggle" class="quick-summary-toggle">⚡</span>
        </div>
        <div class="copilot-body" id="copilot-body-content">
            <div id="db-summary-section">
                <div style="text-align:center; color:#888; margin-top:20px;">Cargando resumen...</div>
            </div>
            ${reviewMode ? `<div class="copilot-dna">
                <div id="dna-summary" style="margin-top:16px"></div>
                <div id="kount-summary" style="margin-top:10px"></div>
            </div>` : ''}
            <div id="fraud-summary-section"></div>
            <div id="issue-summary-section" style="display:none; margin-top:10px;">
                <div class="section-label">ISSUES:</div>
                <div class="issue-summary-box" id="issue-summary-box">
                    <strong>ISSUE <span id="issue-status-label" class="issue-status-label"></span></strong><br>
                    <div id="issue-summary-content" style="color:#ccc; font-size:13px; white-space:pre-line;">No issue data yet.</div>
                </div>
            </div>
            <div id="int-storage-section" style="display:none; margin-top:10px;">
                <div class="section-label" style="cursor:pointer;" title="Click to open INT STORAGE tab">INT STORAGE:</div>
                <div id="int-storage-box" class="white-box" style="margin-bottom:10px">
                    <div style="text-align:center;color:#aaa">Loading<span class="loading-dots">...</span></div>
                </div>
            </div>
            ${devMode ? `<div class="copilot-footer"><button id="copilot-refresh" class="copilot-button">🔄 REFRESH</button></div>` : ''}
            <div class="copilot-footer"><button id="copilot-clear" class="copilot-button">🧹 CLEAR</button></div>
            ${devMode ? `
            <div id="mistral-chat" class="mistral-box">
                <div id="mistral-log" class="mistral-log"></div>
                <div class="mistral-input-row">
                    <input id="mistral-input" type="text" placeholder="Ask Mistral..." />
                    <button id="mistral-send" class="copilot-button">Send</button>
                </div>
            </div>` : ''}
            <div id="review-mode-label" class="review-mode-label" style="display:none; margin-top:4px; text-align:center; font-size:11px;">REVIEW MODE</div>
        </div>
    `;
}

// Function to setup INT STORAGE click functionality
function setupIntStorageClickHandler(orderId) {
    const intStorageLabel = document.querySelector('#int-storage-section .section-label');
    if (intStorageLabel && intStorageLabel.textContent.includes('INT STORAGE')) {
        intStorageLabel.style.cursor = 'pointer';
        intStorageLabel.title = 'Click to open INT STORAGE tab';
        intStorageLabel.addEventListener('click', () => {
            openIntStorageTab(orderId);
        });
    }
}

// Global function to open INT STORAGE tab
function openIntStorageTab(orderId) {
    console.log('[FENNEC] Opening INT STORAGE tab for order:', orderId);
    
    // Send message to background script to find and activate INT STORAGE tab
    chrome.runtime.sendMessage({
        action: 'openIntStorageTab',
        orderId: orderId
    }, (response) => {
        if (response && response.success) {
            console.log('[FENNEC] INT STORAGE tab opened/activated successfully');
        } else {
            console.warn('[FENNEC] Failed to open INT STORAGE tab:', response);
        }
    });
}

// Utility function to ensure USPS event listeners are attached to all USPS elements
function ensureUspsListenersAttached(rootElement = document) {
    console.log('[FENNEC (MVP)] Ensuring USPS listeners are attached to:', rootElement);
    
    const uspsElements = rootElement.querySelectorAll('.copilot-usps');
    console.log('[FENNEC (MVP)] Found', uspsElements.length, 'USPS elements to check');
    
    uspsElements.forEach((el, index) => {
        if (!el.dataset.uspsListenerAdded) {
            console.log(`[FENNEC (MVP)] Re-attaching USPS listener to element ${index + 1}`);
            attachCommonListeners(el.parentElement || el);
        }
    });
}

// Make the function globally available
window.ensureUspsListenersAttached = ensureUspsListenersAttached;

// Debug function to test USPS validation functionality
window.debugUspsValidation = function() {
    console.log('[FENNEC (MVP)] === USPS VALIDATION DEBUG ===');
    
    // Check for USPS elements
    const uspsElements = document.querySelectorAll('.copilot-usps');
    console.log('[FENNEC (MVP)] USPS elements found:', uspsElements.length);
    
    if (uspsElements.length === 0) {
        console.warn('[FENNEC (MVP)] No USPS elements found on page');
        return;
    }
    
    // Check each USPS element
    uspsElements.forEach((el, index) => {
        console.log(`[FENNEC (MVP)] USPS Element ${index + 1}:`, {
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
    
    // Check if attachCommonListeners is available
    if (typeof attachCommonListeners === 'function') {
        console.log('[FENNEC (MVP)] attachCommonListeners function is available');
    } else {
        console.error('[FENNEC (MVP)] attachCommonListeners function is NOT available');
    }
    
    // Check if chrome.runtime is available
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        console.log('[FENNEC (MVP)] chrome.runtime is available');
        
        // Test background script communication
        chrome.runtime.sendMessage({
            action: 'testMessage',
            test: 'USPS validation test'
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('[FENNEC (MVP)] Background script communication error:', chrome.runtime.lastError);
            } else {
                console.log('[FENNEC (MVP)] Background script communication successful:', response);
            }
        });
    } else {
        console.error('[FENNEC (MVP)] chrome.runtime is NOT available');
    }
    
    // Test clicking first USPS element
    const firstUsps = uspsElements[0];
    if (firstUsps) {
        console.log('[FENNEC (MVP)] Testing click on first USPS element:', firstUsps.dataset.address);
        firstUsps.click();
    }
    
    console.log('[FENNEC (MVP)] === END USPS VALIDATION DEBUG ===');
};

// Debug function to test SOS search functionality
window.debugSosSearch = function() {
    console.log('[FENNEC (MVP)] Debugging SOS search functionality...');
    
    // Check if buildSosUrl is available
    if (typeof buildSosUrl === 'function') {
        console.log('[FENNEC (MVP)] buildSosUrl function is available');
        
        // Test with a few states
        const testStates = ['California', 'Texas', 'New York', 'Florida'];
        testStates.forEach(state => {
            const nameUrl = buildSosUrl(state, null, 'name');
            const idUrl = buildSosUrl(state, null, 'id');
            console.log(`[FENNEC (MVP)] ${state}:`, { nameUrl, idUrl });
        });
    } else {
        console.error('[FENNEC (MVP)] buildSosUrl function is NOT available');
        
        // Check if it's in window scope
        if (window.buildSosUrl) {
            console.log('[FENNEC (MVP)] buildSosUrl found in window scope');
        } else {
            console.error('[FENNEC (MVP)] buildSosUrl not found in window scope either');
        }
    }
    
    // Check if chrome.runtime is available
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        console.log('[FENNEC (MVP)] chrome.runtime is available');
    } else {
        console.error('[FENNEC (MVP)] chrome.runtime is NOT available');
    }
    
    // Check if company boxes exist
    const companyBoxes = document.querySelectorAll('.company-box');
    console.log('[FENNEC (MVP)] Company boxes found:', companyBoxes.length);
    
    companyBoxes.forEach((box, index) => {
        console.log(`[FENNEC (MVP)] Company box ${index + 1}:`, {
            state: box.dataset.state,
            sosLinks: box.querySelectorAll('.copilot-sos').length,
            searchToggles: box.querySelectorAll('.company-search-toggle').length
        });
    });
};

// Function to ensure company box listeners are properly attached
window.ensureCompanyBoxListeners = function() {
    console.log('[FENNEC (MVP)] Ensuring company box listeners are attached...');
    
    const sidebar = document.getElementById('copilot-sidebar');
    if (sidebar && typeof attachCommonListeners === 'function') {
        console.log('[FENNEC (MVP)] Re-attaching common listeners to sidebar');
        attachCommonListeners(sidebar);
    } else {
        console.error('[FENNEC (MVP)] Could not find sidebar or attachCommonListeners function');
    }
    
    // Also try to attach listeners directly to company boxes
    const companyBoxes = document.querySelectorAll('.company-box');
    console.log('[FENNEC (MVP)] Found company boxes for direct listener attachment:', companyBoxes.length);
    
    companyBoxes.forEach((box, index) => {
        console.log(`[FENNEC (MVP)] Attaching listeners to company box ${index + 1}`);
        
        // Attach listeners to copilot-sos links
        const sosLinks = box.querySelectorAll('.copilot-sos');
        sosLinks.forEach((link, linkIndex) => {
            console.log(`[FENNEC (MVP)] Attaching listener to SOS link ${linkIndex + 1}`);
            
            // Remove existing listeners
            link.removeEventListener('click', link._sosClickHandler);
            
            // Create new handler
            link._sosClickHandler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                console.log('[FENNEC (MVP)] SOS link clicked via direct listener');
                
                const url = link.dataset.url;
                const query = link.dataset.query;
                const type = link.dataset.type || 'name';
                
                if (!url || !query) {
                    console.error('[FENNEC (MVP)] Missing URL or query for SOS search');
                    return;
                }
                
                // Apply deduplication logic BEFORE attempting to open the tab
                if (typeof tabDeduplication !== 'undefined' && !tabDeduplication.shouldOpenTab(url)) {
                    console.log('[FENNEC (MVP)] Tab deduplication: Preventing opening of duplicate tab for URL:', url);
                    return; // Stop here if it's a duplicate
                }
                
                // Copy query to clipboard
                navigator.clipboard.writeText(query).catch(err => console.warn('[FENNEC (MVP)] Clipboard error:', err));
                
                // Open URL directly
                console.log('[FENNEC (MVP)] Opening SOS URL directly:', url);
                window.open(url, '_blank');
            };
            
            // Add listener
            link.addEventListener('click', link._sosClickHandler);
        });
        
        // Attach listeners to search toggles
        const searchToggles = box.querySelectorAll('.company-search-toggle');
        searchToggles.forEach((toggle, toggleIndex) => {
            console.log(`[FENNEC (MVP)] Attaching listener to search toggle ${toggleIndex + 1}`);
            
            // Remove existing listeners
            toggle.removeEventListener('click', toggle._searchClickHandler);
            
            // Create new handler
            toggle._searchClickHandler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                console.log('[FENNEC (MVP)] Search toggle clicked via direct listener');
                
                if (typeof toggleCompanySearch === 'function') {
                    console.log('[FENNEC (MVP)] Calling toggleCompanySearch');
                    toggleCompanySearch(box);
                } else {
                    console.error('[FENNEC (MVP)] toggleCompanySearch function not available');
                }
            };
            
            // Add listener
            toggle.addEventListener('click', toggle._searchClickHandler);
        });
    });
};

// Function to open files in a popup window covering 70% of the original space
function openFileInPopup(url) {
    if (!url) {
        console.error('[FENNEC] No URL provided to openFileInPopup');
        return;
    }
    
    // Calculate 70% of current window dimensions
    const width = Math.floor(window.screen.width * 0.7);
    const height = Math.floor(window.screen.height * 0.7);
    
    // Calculate center position
    const left = Math.floor((window.screen.width - width) / 2);
    const top = Math.floor((window.screen.height - height) / 2);
    
    // Window features for popup
    const features = [
        `width=${width}`,
        `height=${height}`,
        `left=${left}`,
        `top=${top}`,
        'scrollbars=yes',
        'resizable=yes',
        'toolbar=no',
        'menubar=no',
        'location=no',
        'status=no'
    ].join(',');
    
    try {
        const popup = window.open(url, '_blank', features);
        if (popup) {
            popup.focus();
            console.log('[FENNEC] File opened in popup window:', url);
        } else {
            console.warn('[FENNEC] Popup blocked, falling back to regular window.open');
            window.open(url, '_blank');
        }
    } catch (error) {
        console.error('[FENNEC] Error opening popup:', error);
        // Fallback to regular window.open
        window.open(url, '_blank');
    }
}

// Add to global scope for use across environments
window.openFileInPopup = openFileInPopup;