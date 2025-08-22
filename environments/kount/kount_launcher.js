class KountLauncher extends Launcher {
    init() {
        console.log('[EKATA] KOUNT launcher init');
    if (window.top !== window) return;
        
        // Set tab title immediately to ensure it's tagged
        const url = window.location.href;
        const isKount360 = url.includes('app.kount.com') || url.includes('/event-analysis/order/');
        if (isKount360) {
            // Set initial title
            document.title = '[KOUNT 360] ' + document.title;
                console.log('[EKATA] KOUNT 360 tab title set');
            
            // Create a persistent title observer to maintain the prefix
            let titleObserver = null;
            const maintainTitle = () => {
                if (!document.title.startsWith('[KOUNT 360]')) {
                    document.title = '[KOUNT 360] ' + document.title;
                    console.log('[EKATA] KOUNT 360 tab title restored');
                }
            };
            
            // Set up a MutationObserver to watch for title changes
            if (typeof MutationObserver !== 'undefined') {
                titleObserver = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'childList' && mutation.target.tagName === 'TITLE') {
                            setTimeout(maintainTitle, 100);
                        }
                    });
                });
                
                // Observe the title element
                const titleElement = document.querySelector('title');
                if (titleElement) {
                    titleObserver.observe(titleElement, { childList: true, subtree: true });
                    
                } else {
                    // If title element doesn't exist yet, wait for it
                    const waitForTitle = () => {
                        const titleEl = document.querySelector('title');
                        if (titleEl) {
                            titleObserver.observe(titleEl, { childList: true, subtree: true });
                            
                        } else {
                            setTimeout(waitForTitle, 100);
                        }
                    };
                    waitForTitle();
                }
            }
            
            // Also set up periodic checks as a fallback
            const titleCheckInterval = setInterval(maintainTitle, 2000);
            
            // Override document.title setter to maintain prefix
            const originalTitleDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'title');
            if (originalTitleDescriptor && originalTitleDescriptor.configurable) {
                Object.defineProperty(document, 'title', {
                    get: originalTitleDescriptor.get,
                    set: function(value) {
                        if (!value.startsWith('[KOUNT 360]')) {
                            value = '[KOUNT 360] ' + value;
                        }
                        originalTitleDescriptor.set.call(this, value);
                    },
                    configurable: true
                });
                
            }
            
            // Clean up observer when page unloads
            window.addEventListener('beforeunload', () => {
                if (titleObserver) {
                    titleObserver.disconnect();
                }
                clearInterval(titleCheckInterval);
            });
            
            // Also try to run the EKATA flow immediately if this is a KOUNT 360 page
            // This ensures the flow runs even if chrome.storage fails
            setTimeout(() => {
                console.log('[EKATA] Start immediate EKATA flow');
                runKount360Flow();
            }, 3000);
        }
        
    const bg = fennecMessenger;
        
        // Define KOUNT 360 flow function that can be called independently
        function runKount360Flow() {
            console.log('[EKATA] Run KOUNT 360 flow');
            
            const waitForPageLoad = () => {
                return new Promise((resolve) => {
                    if (document.readyState === 'complete') {
                        setTimeout(resolve, 5000); // Increased from 2000 to 5000ms
                    } else {
                        window.addEventListener('load', () => {
                            setTimeout(resolve, 5000); // Increased from 2000 to 5000ms
                        });
                    }
                });
            };
            
            const waitForEkataWidget = (maxAttempts = 10, interval = 2000) => {
                return new Promise((resolve, reject) => {
                    let attempts = 0;
                    
                    const checkWidget = () => {
                        attempts++;
                        console.log(`[FENNEC (MVP)] EKATA widget check attempt ${attempts}/${maxAttempts}`);
                        
                        const ekataWidget = document.querySelector('ekata-widget');
                        if (ekataWidget) {
                            console.log('[FENNEC (MVP)] EKATA widget found!');
                            resolve(ekataWidget);
                            return;
                        }
                        
                        if (attempts >= maxAttempts) {
                            console.warn('[FENNEC (MVP)] EKATA widget not found after maximum attempts');
                            reject(new Error('EKATA widget not found'));
                            return;
                        }
                        
                        setTimeout(checkWidget, interval);
                    };
                    
                    checkWidget();
                });
            };
            
            const waitForRequestDataButton = (ekataWidget, maxAttempts = 15, interval = 2000) => {
                return new Promise((resolve, reject) => {
                    let attempts = 0;
                    
                    const checkButton = () => {
                        attempts++;
                        console.log(`[FENNEC (MVP)] Request Data button check attempt ${attempts}/${maxAttempts}`);
                        
                        const requestDataBtn = ekataWidget.querySelector('[data-test-id="load-ekata-data-button"]');
                        if (requestDataBtn) {
                            console.log('[FENNEC (MVP)] Request Data button found!');
                            resolve(requestDataBtn);
                            return;
                        }
                        
                        if (attempts >= maxAttempts) {
                            console.warn('[FENNEC (MVP)] Request Data button not found after maximum attempts');
                            reject(new Error('Request Data button not found'));
                            return;
                        }
                        
                        setTimeout(checkButton, interval);
                    };
                    
                    checkButton();
                });
            };
            
            const waitForExpandButton = (maxAttempts = 20, interval = 2000) => {
                return new Promise((resolve, reject) => {
                    let attempts = 0;
                    
                    const checkExpandButton = () => {
                        attempts++;
                        
                        
                        const expandBtn = document.querySelector('[data-test-id="open-ekata-modal-button"]');
                        if (expandBtn) {
                            console.log('[FENNEC (MVP)] Expand button found!');
                            console.log('[FENNEC (MVP)] Expand button details:', {
                                tagName: expandBtn.tagName,
                                className: expandBtn.className,
                                dataTestId: expandBtn.getAttribute('data-test-id'),
                                attributes: Array.from(expandBtn.attributes).map(attr => `${attr.name}="${attr.value}"`).join(', '),
                                textContent: expandBtn.textContent.trim(),
                                disabled: expandBtn.disabled,
                                offsetParent: expandBtn.offsetParent !== null,
                                matRippleUninitialized: expandBtn.hasAttribute('mat-ripple-loader-uninitialized')
                            });
                            resolve(expandBtn);
                            return;
                        }
                        
                        if (attempts >= maxAttempts) {
                            console.warn('[FENNEC (MVP)] Expand button not found after maximum attempts');
                            reject(new Error('Expand button not found'));
                            return;
                        }
                        
                        setTimeout(checkExpandButton, interval);
                    };
                    
                    checkExpandButton();
                });
            };
            
            const completeEkataFlow = (ekataData) => {
                console.log('[EKATA] Data summary', ekataData);
                
                // Save the complete data using chrome.storage directly
                chrome.storage.local.get({ kountInfo: {} }, ({ kountInfo }) => {
                    const updated = Object.assign({}, kountInfo, { ekata: ekataData });
                    sessionSet({ kountInfo: updated });
                    
                    // Mark KOUNT flow as completed
                    chrome.storage.local.get({ fraudReviewSession: null }, ({ fraudReviewSession }) => {
                        const order = sessionStorage.getItem('fennec_order') || fraudReviewSession;
                        if (order) {
                            const flowKey = `fennecKountFlowCompleted_${order}`;
                            localStorage.setItem(flowKey, '1');
                            console.log('[FENNEC (MVP)] KOUNT flow completed for order:', order);
                            
                            // Check if ADYEN flow is also completed to mark overall XRAY as finished
                            const adyenFlowKey = `fennecAdyenFlowCompleted_${order}`;
                            if (localStorage.getItem(adyenFlowKey)) {
                                // Both flows are complete, mark XRAY as finished and trigger trial floater
                                localStorage.setItem('fraudXrayFinished', '1');
                                sessionSet({ fraudXrayFinished: '1' });
                                sessionStorage.setItem('fennecShowTrialFloater', '1');
                                console.log('[FENNEC (MVP)] Both ADYEN and KOUNT flows completed, marking XRAY as finished and triggering trial floater for order:', order);
                            }
                        }
                    });
                    
                    // Navigate to ADYEN after EKATA is complete
                    console.log('[FENNEC (MVP)] EKATA completed, navigating to ADYEN...');
                    chrome.storage.local.get({ fennecFraudAdyen: null, fraudReviewSession: null }, ({ fennecFraudAdyen, fraudReviewSession }) => {
                        if (fennecFraudAdyen) {
                            console.log('[FENNEC (MVP)] Opening ADYEN URL:', fennecFraudAdyen);
                            chrome.storage.local.remove('fennecFraudAdyen');
                            chrome.storage.local.remove('fennecFraudKount');
                            sessionStorage.removeItem('fennecKountOpened');
                            bg.openOrReuseTab({ url: fennecFraudAdyen, active: true });
                        } else {
                            console.log('[FENNEC (MVP)] No ADYEN URL found, refocusing to fraud tracker');
                            chrome.storage.local.remove('fennecFraudKount');
                            sessionStorage.removeItem('fennecKountOpened');
                            bg.refocusTab();
                        }
                    });
                });
            };
            
            waitForPageLoad().then(() => {
                
                
                // Extract basic KOUNT data
                let emailAge = '';
                let deviceLocation = '';
                let ip = '';
                
                // Try to find IP address in the page
                const allText = document.body.textContent;
                const ipMatch = allText.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
                if (ipMatch) {
                    ip = ipMatch[0];
                }
                
                console.log('[EKATA] Basic K360', { emailAge, deviceLocation, ip });
                
                // Enhanced EKATA flow with retry logic
                // Block downstream navigation until EKATA extraction is done
                try { sessionStorage.setItem('fennecEkataAwaiting', '1'); } catch (e) {}
                waitForEkataWidget()
                    .then((ekataWidget) => {
                        // First check if EKATA report already exists
                        console.log('[FENNEC (MVP)] Checking for existing EKATA report in KOUNT 360...');
                        
                        // Look for existing report data indicators
                        const existingReportIndicators = [
                            'Resident Name:',
                            'Is Commercial:',
                            'Is Forwarder:',
                            'Type:',
                            'Distance from Shipping',
                            'Linked to Shipping'
                        ];
                        
                        const hasExistingReport = existingReportIndicators.some(indicator => 
                            document.body.textContent.includes(indicator)
                        );
                        
                        if (hasExistingReport) {
                            console.log('[FENNEC (MVP)] Found existing EKATA report in KOUNT 360, checking for refresh/expansion...');
                            
                            // Check if we need to refresh the report
                            const refreshBtn = document.querySelector('[data-test-id="load-ekata-data-button"]');
                            if (refreshBtn && !sessionStorage.getItem('fennecEkataRefreshClicked')) {
                                console.log('[FENNEC (MVP)] Found refresh button in KOUNT 360, clicking to update report...');
                                console.log('[FENNEC (MVP)] Refresh button details:', {
                                    tagName: refreshBtn.tagName,
                                    className: refreshBtn.className,
                                    dataTestId: refreshBtn.getAttribute('data-test-id'),
                                    attributes: Array.from(refreshBtn.attributes).map(attr => `${attr.name}="${attr.value}"`).join(', '),
                                    textContent: refreshBtn.textContent.trim(),
                                    disabled: refreshBtn.disabled,
                                    offsetParent: refreshBtn.offsetParent !== null,
                                    matRippleUninitialized: refreshBtn.hasAttribute('mat-ripple-loader-uninitialized')
                                });
                                sessionStorage.setItem('fennecEkataRefreshClicked', '1');
                                refreshBtn.click();
                                
                                // Wait for refresh to complete, then look for expand button
                                return new Promise((resolve) => {
                                    setTimeout(() => {
                                        sessionStorage.removeItem('fennecEkataRefreshClicked');
                                        console.log('[FENNEC (MVP)] Refresh completed, looking for expand button...');
                                        resolve({ type: 'refresh', ekataWidget });
                                    }, 5000);
                                });
                            } else {
                                console.log('[FENNEC (MVP)] No refresh needed, looking for expand button...');
                                return Promise.resolve({ type: 'existing', ekataWidget });
                            }
                        } else {
                            console.log('[FENNEC (MVP)] No existing EKATA report found, proceeding with generation...');
                        return waitForRequestDataButton(ekataWidget);
                        }
                    })
                    .then((result) => {
                        // If result is from generation flow, it's the requestDataBtn
                        // If result is from refresh/existing flow, it's an object with type and ekataWidget
                        if (typeof result === 'object' && result.type) {
                            // This is from refresh/existing flow, look for expand button
                            return waitForExpandButton();
                        } else {
                            // This is from generation flow, result is the requestDataBtn
                            const requestDataBtn = result;
                        console.log('[FENNEC (MVP)] Found Request Data button, attempting to click...');
                        
                        // Try multiple click strategies
                        const clickStrategies = [
                            () => requestDataBtn.click(),
                            () => {
                                const labelSpan = requestDataBtn.querySelector('.mdc-button__label');
                                if (labelSpan) labelSpan.click();
                            },
                            () => {
                                const clickEvent = new MouseEvent('click', {
                                    bubbles: true,
                                    cancelable: true,
                                    view: window
                                });
                                requestDataBtn.dispatchEvent(clickEvent);
                            }
                        ];
                        
                        for (let i = 0; i < clickStrategies.length; i++) {
                            try {
                                console.log(`[FENNEC (MVP)] Trying click strategy ${i + 1}...`);
                                clickStrategies[i]();
                                console.log(`[FENNEC (MVP)] Click strategy ${i + 1} executed successfully`);
                                break;
                            } catch (error) {
                                console.warn(`[FENNEC (MVP)] Click strategy ${i + 1} failed:`, error);
                            }
                        }
                        
                        console.log('[FENNEC (MVP)] EKATA button click attempted');
                        
                        // Wait for expand button to appear
                        return waitForExpandButton();
                        }
                    })
                    .then((expandBtn) => {
                        console.log('[FENNEC (MVP)] Found EKATA expand button, clicking...');
                        console.log('[FENNEC (MVP)] Expand button to click details:', {
                            tagName: expandBtn.tagName,
                            className: expandBtn.className,
                            dataTestId: expandBtn.getAttribute('data-test-id'),
                            attributes: Array.from(expandBtn.attributes).map(attr => `${attr.name}="${attr.value}"`).join(', '),
                            textContent: expandBtn.textContent.trim(),
                            disabled: expandBtn.disabled,
                            offsetParent: expandBtn.offsetParent !== null,
                            matRippleUninitialized: expandBtn.hasAttribute('mat-ripple-loader-uninitialized')
                        });
                        
                        // Try multiple click strategies for the expand button
                        console.log('[FENNEC (MVP)] Attempting multiple click strategies for expand button...');
                        let clickSuccess = false;
                        
                        // Strategy 1: Direct click
                        try {
                            console.log('[FENNEC (MVP)] Expand button - Strategy 1: Direct click');
                        expandBtn.click();
                            clickSuccess = true;
                            console.log('[FENNEC (MVP)] Expand button - Strategy 1: Success');
                        } catch (error) {
                            console.warn('[FENNEC (MVP)] Expand button - Strategy 1: Failed', error);
                        }
                        
                        // Strategy 2: Event dispatch
                        if (!clickSuccess) {
                            try {
                                console.log('[FENNEC (MVP)] Expand button - Strategy 2: Event dispatch');
                                expandBtn.dispatchEvent(new Event('click', { bubbles: true }));
                                clickSuccess = true;
                                console.log('[FENNEC (MVP)] Expand button - Strategy 2: Success');
                            } catch (error) {
                                console.warn('[FENNEC (MVP)] Expand button - Strategy 2: Failed', error);
                            }
                        }
                        
                        // Strategy 3: MouseEvent
                        if (!clickSuccess) {
                            try {
                                console.log('[FENNEC (MVP)] Expand button - Strategy 3: MouseEvent');
                                expandBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                                clickSuccess = true;
                                console.log('[FENNEC (MVP)] Expand button - Strategy 3: Success');
                            } catch (error) {
                                console.warn('[FENNEC (MVP)] Expand button - Strategy 3: Failed', error);
                            }
                        }
                        
                        console.log('[FENNEC (MVP)] Expand button click attempts completed. Success:', clickSuccess);
                        
                        // Wait for modal to open and extract detailed EKATA data (polling)
                        return new Promise((resolve) => {
                            const modalSelectors = [
                                '.modal',
                                '.dialog',
                                '[role="dialog"]',
                                '.ekata-modal',
                                '.mat-dialog-container',
                                '.cdk-overlay-pane',
                                '.modal-content',
                                '.dialog-content'
                            ];
                            let attempts = 0;
                            const maxAttempts = 20; // ~20 seconds
                            const intervalMs = 1000;
                            const poll = () => {
                                attempts++;
                                let modalFound = false;
                                let modalEl = null;
                                for (const selector of modalSelectors) {
                                    const m = document.querySelector(selector);
                                    if (m) { modalFound = true; modalEl = m; break; }
                                }
                                if (modalFound) {
                                    try { sessionStorage.setItem('fennecEkataModalDetected', '1'); } catch (e) {}
                                    console.log('[FENNEC (MVP)] EKATA modal detected (attempt ' + attempts + ')');
                                    // Try to extract; if empty, keep polling a bit
                                const proxyInfo = extractProxyInfo();
                                const residentInfo = extractResidentInfo();
                                    const hasResident = residentInfo && (residentInfo.residentName || residentInfo.addressToName) && (String(residentInfo.residentName||'').trim() !== '' || String(residentInfo.addressToName||'').trim() !== '');
                                    const hasProxy = proxyInfo && (proxyInfo.ipValid || proxyInfo.proxyRisk);
                                    if (hasResident || hasProxy || attempts >= maxAttempts) {
                                console.log('[EKATA] detailed extracted');
                                const ipInfo = (proxyInfo && proxyInfo.ipInfo) ? proxyInfo.ipInfo : {
                                    proxyRisk: typeof proxyInfo.proxyRisk === 'boolean' ? proxyInfo.proxyRisk : undefined,
                                    isValid: typeof proxyInfo.ipValid === 'boolean' ? proxyInfo.ipValid : undefined,
                                    subdivision: '',
                                    country: ''
                                };
                                const emailInfo = extractEmailInfo();
                                const ekataData = {
                                    ipValid: typeof ipInfo.isValid === 'boolean' ? ipInfo.isValid : (proxyInfo.ipValid || ''),
                                    proxyRisk: typeof ipInfo.proxyRisk === 'boolean' ? ipInfo.proxyRisk : (proxyInfo.proxyRisk || ''),
                                    addressToName: residentInfo.addressToName || '',
                                    residentName: residentInfo.residentName || '',
                                    scores: {
                                        identityCheckScore: extractScore('Identity Check Score'),
                                        identityNetworkScore: extractScore('Identity Network Score')
                                    },
                                    proxyDetails: proxyInfo,
                                    residentDetails: residentInfo,
                                    billingInfo: residentInfo.billingInfo || {},
                                    shippingInfo: residentInfo.shippingInfo || {},
                                    ipInfo,
                                    email: {
                                        billing: emailInfo.billing,
                                        shipping: emailInfo.shipping
                                    }
                                };
                                        return resolve(ekataData);
                                    }
                                } else {
                                    if (attempts === 1) {
                                        console.log('[EKATA] Waiting for modal');
                                    }
                                }
                                if (attempts < maxAttempts) {
                                    setTimeout(poll, intervalMs);
                                } else {
                                    console.warn('[EKATA] Modal not detected; best-effort extraction');
                                    const proxyInfo = extractProxyInfo();
                                    const residentInfo = extractResidentInfo();
                                    const ipInfo = (proxyInfo && proxyInfo.ipInfo) ? proxyInfo.ipInfo : {
                                        proxyRisk: typeof proxyInfo.proxyRisk === 'boolean' ? proxyInfo.proxyRisk : undefined,
                                        isValid: typeof proxyInfo.ipValid === 'boolean' ? proxyInfo.ipValid : undefined,
                                        subdivision: '',
                                        country: ''
                                    };
                                    const emailInfo = extractEmailInfo();
                                    const ekataData = {
                                        ipValid: typeof ipInfo.isValid === 'boolean' ? ipInfo.isValid : (proxyInfo.ipValid || ''),
                                        proxyRisk: typeof ipInfo.proxyRisk === 'boolean' ? ipInfo.proxyRisk : (proxyInfo.proxyRisk || ''),
                                        addressToName: residentInfo.addressToName || '',
                                        residentName: residentInfo.residentName || '',
                                        scores: {
                                            identityCheckScore: extractScore('Identity Check Score'),
                                            identityNetworkScore: extractScore('Identity Network Score')
                                        },
                                        proxyDetails: proxyInfo,
                                        residentDetails: residentInfo,
                                        billingInfo: residentInfo.billingInfo || {},
                                        shippingInfo: residentInfo.shippingInfo || {},
                                        ipInfo,
                                        email: {
                                            billing: emailInfo.billing,
                                            shipping: emailInfo.shipping
                                        }
                                    };
                                resolve(ekataData);
                                }
                            };
                            setTimeout(poll, intervalMs);
                        });
                    })
                    .then((ekataData) => {
                        // Mark EKATA as completed before navigating away
                        try { sessionStorage.removeItem('fennecEkataAwaiting'); } catch (e) {}
                        completeEkataFlow(ekataData);
                    })
                    .catch((error) => {
                        console.error('[FENNEC (MVP)] EKATA flow failed:', error);
                        
                        // Even if EKATA fails, complete the flow with basic data
                        const basicEkataData = {
                            ipValid: '',
                            proxyRisk: '',
                            addressToName: '',
                            residentName: '',
                            scores: {},
                            proxyDetails: {},
                            residentDetails: {},
                            error: error.message
                        };
                        
                        console.log('[FENNEC (MVP)] Completing flow with basic data due to EKATA failure');
                        completeEkataFlow(basicEkataData);
                    });
            });
        }
        
        // Helper functions for extracting EKATA data
        function extractScore(scoreName) {
            const scoreElements = document.querySelectorAll('[data-test-id*="ekata-score-"]');
            for (const el of scoreElements) {
                const testId = el.getAttribute('data-test-id');
                if (testId && testId.includes(scoreName.toLowerCase().replace(/\s+/g, ''))) {
                    return el.textContent.trim();
                }
            }
            return '';
        }
        
        function extractProxyInfo() {
            // Target the specific EKATA section titled "IP Checks"
            const section = Array.from(document.querySelectorAll('.section'))
                .find(s => {
                    const t = s.querySelector('.section-title span');
                    return t && t.textContent.trim().toLowerCase() === 'ip checks';
                });
            const out = { ipInfo: { proxyRisk: undefined, isValid: undefined, subdivision: '', country: '' } };
            if (!section) return out;
            const getVal = (key) => {
                const el = section.querySelector(`[data-test-id="ekata.${key}section-column-field-value"]`);
                return el ? el.textContent.trim() : '';
            };
            const proxyTxt = getVal('proxyRisk');
            const validTxt = getVal('isValid');
            out.ipInfo.proxyRisk = /^(true|yes)$/i.test(proxyTxt) ? true : /^(false|no)$/i.test(proxyTxt) ? false : undefined;
            out.ipInfo.isValid = /^(true|yes)$/i.test(validTxt) ? true : /^(false|no)$/i.test(validTxt) ? false : undefined;
            out.ipInfo.subdivision = getVal('subdivision') || getVal('state') || '';
            out.ipInfo.country = getVal('country') || '';
            // Keep legacy fields for consumers that read plain values
            out.proxyRisk = out.ipInfo.proxyRisk;
            out.ipValid = out.ipInfo.isValid;
            return out;
        }
        
        function extractResidentInfo() {
            // Scope to Address section, then parse Billing/Shipping columns by title
            const section = Array.from(document.querySelectorAll('.section'))
                .find(s => {
                    const t = s.querySelector('.section-title span');
                    return t && t.textContent.trim().toLowerCase() === 'address';
                });
            const out = { billingInfo: {}, shippingInfo: {}, residentName: '', addressToName: '' };
            if (!section) return out;
            const parseColumn = (col, kind) => {
                const get = (key) => {
                    const el = col.querySelector(`[data-test-id=\"ekata.${key}section-column-field-value\"]`);
                    return el ? el.textContent.trim() : '';
                };
                const info = {
                    warnings: get('warnings'),
                    errors: get('errors'),
                    isValid: get('isValid'),
                    inputCompleteness: get('inputCompleteness'),
                    matchToName: get('matchToName'),
                    residentName: get('residentName'),
                    isCommercial: get('isCommercial'),
                    isForwarder: get('isForwarder'),
                    type: get('type')
                };
                if (kind === 'billing') {
                    info.distanceFromShipping = get('distanceFromShipping');
                    info.linkedToShippingResident = get('linkedToShippingResident');
                }
                return info;
            };
            section.querySelectorAll('.section-column').forEach(col => {
                const title = (col.querySelector('.section-column-title span') || {}).textContent || '';
                const norm = title.trim().toLowerCase();
                if (norm === 'billing info') out.billingInfo = parseColumn(col, 'billing');
                if (norm === 'shipping info') out.shippingInfo = parseColumn(col, 'shipping');
            });
            out.residentName = (out.shippingInfo.residentName || out.billingInfo.residentName || '').trim();
            return out;
        }

        // Extract EMAIL section (Billing Email / Shipping Email)
        function extractEmailInfo() {
            const section = Array.from(document.querySelectorAll('.section'))
                .find(s => {
                    const t = s.querySelector('.section-title span');
                    return t && t.textContent.trim().toLowerCase() === 'email';
                });
            const out = { billing: {}, shipping: {} };
            if (!section) return out;
            const parseColumn = (col) => {
                const get = (key) => {
                    const el = col.querySelector(`[data-test-id="ekata.${key}section-column-field-value"]`);
                    return el ? el.textContent.trim() : '';
                };
                return {
                    emailFirstSeenDays: get('emailFirstSeenDays'),
                    registeredOwnerName: get('registeredOwnerName'),
                    isValid: get('isValid'),
                    isAutoGenerated: get('isAutoGenerated'),
                    isDisposable: get('isDisposable')
                };
            };
            section.querySelectorAll('.section-column').forEach(col => {
                const title = (col.querySelector('.section-column-title span') || {}).textContent || '';
                const norm = title.trim().toLowerCase();
                if (norm === 'billing email') out.billing = parseColumn(col);
                if (norm === 'shipping email') out.shipping = parseColumn(col);
            });
            return out;
        }
    
    // Check if extension is enabled and get review mode status
    chrome.storage.local.get({ extensionEnabled: true, fennecReviewMode: false, fennecActiveSession: null, fraudReviewSession: null }, ({ extensionEnabled, fennecReviewMode, fennecActiveSession, fraudReviewSession }) => {
        if (!extensionEnabled) return;
        
        // Check if this is a flow-triggered open or manual open
        const params = new URLSearchParams(window.location.search);
        const orderParam = params.get('fennec_order');
        
        // Check for flow indicators
        const hasOrderParam = orderParam && fennecReviewMode;
        const hasFraudSession = fraudReviewSession && fennecReviewMode;
        const isFlowTriggered = hasOrderParam || hasFraudSession;
        const isManualOpen = !hasOrderParam && !hasFraudSession;
        
        console.log('[FENNEC (MVP)] KOUNT flow detection:', { 
            orderParam, 
            fraudReviewSession, 
            fennecReviewMode, 
            hasOrderParam, 
            hasFraudSession, 
            isFlowTriggered, 
            isManualOpen 
        });
        
        // If not in review mode and not manually opened, don't initialize
        if (!fennecReviewMode && !isManualOpen) {
            console.log('[FENNEC (MVP)] Kount opened outside review mode and not manually opened, skipping initialization.');
            return;
        }
        
        // If manually opened in review mode, don't inject sidebar (just open tab)
        if (isManualOpen && fennecReviewMode) {
            console.log('[FENNEC (MVP)] Kount manually opened in review mode, tab only (no sidebar).');
            return;
        }
        
        console.log('[FENNEC (MVP)] KOUNT initialization proceeding - will inject sidebar and run flow');
        
        // If flow-triggered, check if flow is already completed
        if (isFlowTriggered) {
            const orderId = orderParam || fraudReviewSession;
            const flowKey = `fennecKountFlowCompleted_${orderId}`;
            const adyenFlowKey = `fennecAdyenFlowCompleted_${orderId}`;
            
            // Check if this is a fresh flow (no ADYEN completion yet)
            const adyenCompleted = localStorage.getItem(adyenFlowKey);
            const kountCompleted = localStorage.getItem(flowKey);
            
            // If both flows are completed, skip initialization
            if (adyenCompleted && kountCompleted) {
                console.log('[FENNEC (MVP)] Both ADYEN and KOUNT flows already completed, skipping initialization.');
                return;
            }
            
            // If only KOUNT is completed but ADYEN is not, clear the KOUNT flag to restart
            if (kountCompleted && !adyenCompleted) {
                console.log('[FENNEC (MVP)] KOUNT completed but ADYEN not completed, clearing KOUNT flag to restart flow.');
                localStorage.removeItem(flowKey);
            }
            
            console.log('[FENNEC (MVP)] Flow status:', { 
                orderId, 
                adyenCompleted: !!adyenCompleted, 
                kountCompleted: !!kountCompleted,
                willInitialize: true 
            });
        }
        
        if (fennecActiveSession) {
            sessionStorage.setItem('fennecSessionId', fennecActiveSession);
        }
        getFennecSessionId();
        let reviewMode = fennecReviewMode;
        const SIDEBAR_WIDTH = 340;

        function updateReviewDisplay() {
            const label = document.getElementById('review-mode-label');
            if (label) label.style.display = reviewMode ? 'block' : 'none';
            const cLabel = document.getElementById('client-section-label');
            const cBox = document.getElementById('client-section-box');
            if (cLabel && cBox) {
                cLabel.style.display = reviewMode ? '' : 'none';
                cBox.style.display = reviewMode ? '' : 'none';
            }
            const bLabel = document.getElementById('billing-section-label');
            const bBox = document.getElementById('billing-section-box');
            if (bLabel && bBox) {
                bLabel.style.display = reviewMode ? '' : 'none';
                bBox.style.display = reviewMode ? '' : 'none';
            }
        }

        const insertDnaAfterCompany = window.insertDnaAfterCompany;

        function buildDnaHtml(info) {
            if (!info || !info.payment) return null;
            const p = info.payment;
            const card = p.card || {};
            const shopper = p.shopper || {};
            const proc = p.processing || {};
            const parts = [];
            if (card['Card holder']) {
                const holder = `<b>${escapeHtml(card['Card holder'])}</b>`;
                parts.push(`<div>${holder}</div>`);
            }
            const cardLine = [];
            if (card['Payment method']) cardLine.push(escapeHtml(card['Payment method']));
            if (card['Card number']) {
                const digits = card['Card number'].replace(/\D+/g, '').slice(-4);
                if (digits) cardLine.push(escapeHtml(digits));
            }
            if (card['Expiry date']) cardLine.push(escapeHtml(card['Expiry date']));
            if (card['Funding source']) cardLine.push(escapeHtml(card['Funding source']));
            if (cardLine.length) parts.push(`<div>${cardLine.join(' \u2022 ')}</div>`);
            if (shopper['Billing address']) {
                parts.push(`<div class="dna-address">${renderBillingAddress(shopper['Billing address'])}</div>`);
                if (card['Issuer name'] || card['Issuer country/region']) {
                    let bank = (card['Issuer name'] || '').trim();
                    if (bank.length > 25) bank = bank.slice(0, 22) + '...';
                    const country = (card['Issuer country/region'] || '').trim();
                    let countryInit = '';
                    if (country) {
                        countryInit = country.split(/\s+/).map(w => w.charAt(0)).join('').toUpperCase();
                        countryInit = ` (<span class="dna-country"><b>${escapeHtml(countryInit)}</b></span>)`;
                    }
                    parts.push(`<div class="dna-issuer">${escapeHtml(bank)}${countryInit}</div>`);
                }
            }
            const cvv = proc['CVC/CVV'];
            const avs = proc['AVS'];
            function colorFor(result) {
                if (result === 'green') return 'copilot-tag-green';
                if (result === 'purple') return 'copilot-tag-purple';
                return 'copilot-tag-black';
            }
            function formatCvv(text) {
                const t = (text || '').toLowerCase();
                if ((/\bmatch(es|ed)?\b/.test(t) || /\(m\)/.test(t)) && !/not\s+match/.test(t)) {
                    return { label: 'CVV: MATCH', result: 'green' };
                }
                if (/not\s+match/.test(t) || /\(n\)/.test(t)) {
                    return { label: 'CVV: NO MATCH', result: 'purple' };
                }
                if (/not provided|not checked|error|not supplied|unknown/.test(t)) {
                    return { label: 'CVV: UNKNOWN', result: 'black' };
                }
                return { label: 'CVV: UNKNOWN', result: 'black' };
            }
            function formatAvs(text) {
                const t = (text || '').toLowerCase();
                if (/both\s+postal\s+code\s+and\s+address\s+match/.test(t) || /^7\b/.test(t) || t.includes('both match')) {
                    return { label: 'AVS: MATCH', result: 'green' };
                }
                if (/^6\b/.test(t) || (t.includes('postal code matches') && t.includes("address doesn't"))) {
                    return { label: 'AVS: PARTIAL (STREET✖️)', result: 'purple' };
                }
                if (/^1\b/.test(t) || (t.includes('address matches') && t.includes("postal code doesn't"))) {
                    return { label: 'AVS: PARTIAL (ZIP✖️)', result: 'purple' };
                }
                if (/^2\b/.test(t) || t.includes('neither matches') || /\bw\b/.test(t)) {
                    return { label: 'AVS: NO MATCH', result: 'purple' };
                }
                if (/^0\b/.test(t) || /^3\b/.test(t) || /^4\b/.test(t) || /^5\b/.test(t) || t.includes('unavailable') || t.includes('not supported') || t.includes('no avs') || t.includes('unknown')) {
                    return { label: 'AVS: UNKNOWN', result: 'black' };
                }
                return { label: 'AVS: UNKNOWN', result: 'black' };
            }
            if (cvv || avs) {
                const tags = [];
                if (cvv) {
                    const { label, result } = formatCvv(cvv);
                    tags.push(`<span class="copilot-tag ${colorFor(result)}">${escapeHtml(label)}</span>`);
                }
                if (avs) {
                    const { label, result } = formatAvs(avs);
                    tags.push(`<span class="copilot-tag ${colorFor(result)}">${escapeHtml(label)}</span>`);
                }
                if (tags.length) parts.push(`<div>${tags.join(' ')}</div>`);
            }
            if (proc['Fraud scoring']) parts.push(`<div><b>Fraud scoring:</b> ${escapeHtml(proc['Fraud scoring'])}</div>`);
            if (parts.length) {
                parts.push('<hr style="border:none;border-top:1px solid #555;margin:6px 0"/>');
            }
            const txTable = buildTransactionTable(info.transactions || {});
            if (txTable) parts.push(txTable);
            if (!parts.length) return null;
            return `<div class="section-label">ADYEN'S DNA</div><div class="white-box" style="margin-bottom:10px">${parts.join('')}</div>`;
        }

        function loadDnaSummary(cb) {
            const container = document.getElementById('dna-summary');
            if (!container) { if (typeof cb === 'function') cb(); return; }
            chrome.storage.local.get({ adyenDnaInfo: null }, ({ adyenDnaInfo }) => {
                const html = buildDnaHtml(adyenDnaInfo);
                container.innerHTML = html || '';
                attachCommonListeners(container);
                insertDnaAfterCompany();
                if (typeof cb === 'function') cb();
            });
        }

        function buildKountHtml(info) {
            if (!info) return null;
            const parts = [];
            if (info.emailAge) parts.push(`<div><b>Email age:</b> ${escapeHtml(info.emailAge)}</div>`);
            if (info.deviceLocation || info.ip) {
                const loc = escapeHtml(info.deviceLocation || '');
                const ip = escapeHtml(info.ip || '');
                parts.push(`<div><b>Device:</b> ${loc} ${ip}</div>`);
            }
            if (Array.isArray(info.declines) && info.declines.length) {
                parts.push(`<div><b>DECLINE LIST</b><br>${info.declines.map(escapeHtml).join('<br>')}</div>`);
            }
            if (info.ekata) {
                const e = info.ekata;
                
                // Display EKATA scores
                if (e.scores && typeof e.scores === 'object') {
                    const scoreParts = [];
                    Object.entries(e.scores).forEach(([key, value]) => {
                        if (value && value !== '--') {
                            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                            scoreParts.push(`<div><b>${label}:</b> ${escapeHtml(value)}</div>`);
                        }
                    });
                    if (scoreParts.length) {
                        parts.push(`<div><b>EKATA SCORES</b><br>${scoreParts.join('')}</div>`);
                    }
                }
                
                // Display basic EKATA data
                const ipLine = e.ipValid || e.proxyRisk ? `<div><b>IP Valid:</b> ${escapeHtml(e.ipValid || '')} <b>Proxy:</b> ${escapeHtml(e.proxyRisk || '')}</div>` : '';
                const addrLine = e.addressToName || e.residentName ? `<div><b>Address to Name:</b> ${escapeHtml(e.addressToName || '')}<br><b>Resident Name:</b> ${escapeHtml(e.residentName || '')}</div>` : '';
                if (ipLine) parts.push(ipLine);
                if (addrLine) parts.push(addrLine);
                
                // Display detailed EKATA information if available
                if (e.proxyDetails && Object.keys(e.proxyDetails).length > 0) {
                    const proxyParts = [];
                    Object.entries(e.proxyDetails).forEach(([key, value]) => {
                        if (value) {
                            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                            proxyParts.push(`<div><b>${label}:</b> ${escapeHtml(value)}</div>`);
                        }
                    });
                    if (proxyParts.length) {
                        parts.push(`<div><b>PROXY DETAILS</b><br>${proxyParts.join('')}</div>`);
                    }
                }
                
                if (e.residentDetails && Object.keys(e.residentDetails).length > 0) {
                    const residentParts = [];
                    Object.entries(e.residentDetails).forEach(([key, value]) => {
                        if (value) {
                            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                            residentParts.push(`<div><b>${label}:</b> ${escapeHtml(value)}</div>`);
                        }
                    });
                    if (residentParts.length) {
                        parts.push(`<div><b>RESIDENT DETAILS</b><br>${residentParts.join('')}</div>`);
                    }
                }
            }
            if (!parts.length) return null;
            return `<div class="section-label">KOUNT</div><div class="white-box" style="margin-bottom:10px">${parts.join('')}</div>`;
        }

        function loadKountSummary(cb) {
            const container = document.getElementById('kount-summary');
            if (!container) { if (typeof cb === 'function') cb(); return; }
            chrome.storage.local.get({ kountInfo: null }, ({ kountInfo }) => {
                const html = buildKountHtml(kountInfo);
                container.innerHTML = html || '';
                attachCommonListeners(container);
                insertDnaAfterCompany();
                if (typeof cb === 'function') cb();
            });
        }

        function loadDbSummary(cb) {
            const container = document.getElementById('db-summary-section');
            if (!container) { if (typeof cb === 'function') cb(); return; }
            chrome.storage.local.get({ sidebarDb: [], sidebarOrderId: null }, ({ sidebarDb }) => {
                if (Array.isArray(sidebarDb) && sidebarDb.length) {
                    container.innerHTML = sidebarDb.join('');
                    container.style.display = 'block';
                    attachCommonListeners(container);
                    const qbox = container.querySelector('#quick-summary');
                    if (qbox) {
                        qbox.classList.remove('quick-summary-collapsed');
                        qbox.style.maxHeight = 'none';
                    }
                    insertDnaAfterCompany();
                    if (typeof applyStandardSectionOrder === 'function') {
                        applyStandardSectionOrder(container);
                    }
                } else {
                    container.innerHTML = '';
                    container.style.display = 'none';
                }
                if (typeof cb === 'function') cb();
            });
        }

        function injectSidebar() {
            if (document.getElementById('copilot-sidebar')) return;
            document.body.style.transition = 'margin-right 0.2s';
            document.body.style.marginRight = SIDEBAR_WIDTH + 'px';
            const sb = new Sidebar();
            
            sb.build(buildStandardizedReviewModeSidebar(true, false));
            sb.attach();
            
            // Setup INT STORAGE click handler
            const order = sessionStorage.getItem('fennec_order') || fraudReviewSession;
            if (order) {
                setupIntStorageClickHandler(order);
            }
            chrome.storage.sync.get({
                sidebarFontSize: 13,
                sidebarFont: "'Inter', sans-serif",
                sidebarBgColor: '#212121',
                sidebarBoxColor: '#2e2e2e'
            }, opts => applySidebarDesign(sb.element, opts));
            loadSidebarSnapshot(sb.element, () => {
                insertDnaAfterCompany();
                if (typeof applyStandardSectionOrder === 'function') {
                    applyStandardSectionOrder(sb.element.querySelector('#db-summary-section'));
                }
                loadDbSummary(() => {
                    loadDnaSummary(() => {
                        loadKountSummary(() => {
                            // Only display INT STORAGE if it was already loaded in DB
                            chrome.storage.local.get({ 
                                fraudReviewSession: null, 
                                intStorageLoaded: false, 
                                intStorageOrderId: null 
                            }, ({ fraudReviewSession, intStorageLoaded, intStorageOrderId }) => {
                                if (intStorageLoaded && intStorageOrderId) {
                                    const order = sessionStorage.getItem('fennec_order') || fraudReviewSession;
                                    if (order === intStorageOrderId && typeof loadIntStorage === 'function') {
                                        loadIntStorage(order);
                                    }
                                }
                            });
                            updateReviewDisplay();
                        });
                    });
                });
            });

            const qsToggle = sb.element.querySelector('#qs-toggle');
            if (qsToggle) {
                const initQuickSummary = () => {
                    const box = sb.element.querySelector('#quick-summary');
                    if (!box) return;
                    box.style.maxHeight = '0';
                    box.classList.add('quick-summary-collapsed');
                };
                initQuickSummary();
                qsToggle.addEventListener('click', () => {
                    const box = sb.element.querySelector('#quick-summary');
                    if (!box) return;
                    if (box.style.maxHeight && box.style.maxHeight !== '0px') {
                        box.style.maxHeight = '0';
                        box.classList.add('quick-summary-collapsed');
                    } else {
                        box.classList.remove('quick-summary-collapsed');
                        box.style.maxHeight = box.scrollHeight + 'px';
                    }
                });
            }

            const closeBtn = sb.element.querySelector('#copilot-close');
            if (closeBtn) closeBtn.onclick = () => {
                sb.remove();
                document.body.style.marginRight = '';
            };
            const clearTabsBtn = sb.element.querySelector('#copilot-clear-tabs');
            if (clearTabsBtn) clearTabsBtn.onclick = () => bg.closeOtherTabs();
            const clearSb = sb.element.querySelector('#copilot-clear');
            if (clearSb) clearSb.onclick = () => {
                console.log('[FENNEC (MVP) KOUNT SB] Clearing all storage and resetting sidebar to brand new state');
                
                // Clear all session data
                sessionSet({
                    sidebarDb: [],
                    sidebarOrderId: null,
                    sidebarOrderInfo: null,
                    adyenDnaInfo: null,
                    kountInfo: null,
                    sidebarFreezeId: null,
                    fraudReviewSession: null,
                    forceFraudXray: null,
                    fennecFraudAdyen: null,
                    sidebarSnapshot: null,
                    fennecActiveSession: null
                });
                
                // Clear session storage
                sessionStorage.removeItem('fennecSidebarClosed');
                sessionStorage.removeItem('fennecShowTrialFloater');
                sessionStorage.removeItem('fennecCancelPending');
                
                // Clear localStorage
                localStorage.removeItem('fraudXrayFinished');
                localStorage.removeItem('fennecShowTrialFloater');
                
                // Clear all chrome.storage.local data
                chrome.storage.local.remove([
                    'fennecPendingComment',
                    'fennecPendingUpload',
                    'fennecUpdateRequest',
                    'fennecQuickResolveDone',
                    'fennecUploadDone',
                    'intStorageData',
                    'intStorageLoaded',
                    'intStorageOrderId',
                    'sidebarOrderInfo',
                    'sidebarOrderId',
                    'sidebarDb',
                    'adyenDnaInfo',
                    'kountInfo',
                    'sidebarFreezeId',
                    'fraudReviewSession',
                    'forceFraudXray',
                    'fennecFraudAdyen',
                    'sidebarSnapshot',
                    'fennecActiveSession'
                ], () => {
                    console.log('[FENNEC (MVP) KOUNT SB] Cleared all storage data during sidebar clear');
                });
                
                // Clear any INT STORAGE data
                window.currentIntStorageOrderId = null;
                
                // Clear sidebar content
                sb.element.querySelector('#db-summary-section').innerHTML = '';
                sb.element.querySelector('#dna-summary').innerHTML = '';
                sb.element.querySelector('#kount-summary').innerHTML = '';
                
                // Clear INT STORAGE section if it exists
                const intStorageBox = sb.element.querySelector('#int-storage-box');
                if (intStorageBox) {
                    intStorageBox.innerHTML = '<div style="text-align:center;color:#aaa">No INT STORAGE data.</div>';
                }
                
                console.log('[FENNEC (MVP) KOUNT SB] Sidebar cleared and reset to brand new state');
            };
        }
        
        // INT STORAGE loading function for KOUNT launcher
        function loadIntStorage(orderId) {
            if (!orderId) return;
            const setLoading = () => {
                const section = document.getElementById('int-storage-section');
                const box = document.getElementById('int-storage-box');
                if (section) section.style.display = 'block';
                if (box) box.innerHTML = '<div style="text-align:center;color:#aaa">Loading<span class="loading-dots">...</span></div>';
            };
            setLoading();
            console.log('[FENNEC (MVP)] Requesting INT STORAGE for', orderId);
            bg.send('fetchIntStorage', { orderId }, resp => {
                const box = document.getElementById('int-storage-box');
                if (!box) return;
                const files = resp && Array.isArray(resp.files) ? resp.files : null;
                if (!files) {
                    console.warn('[FENNEC (MVP)] INT STORAGE load failed', resp);
                    box.innerHTML = '<div style="text-align:center;color:#aaa">Failed to load</div>';
                    return;
                }
                console.log('[FENNEC (MVP)] INT STORAGE loaded', files.length);
                const list = files.map((file, idx) => {
                    let shortName = file.name.length > 24 ? file.name.slice(0, 21) + '...' : file.name;
                    const nameDiv = `<div class="int-doc-name" title="${escapeHtml(file.name)}">${escapeHtml(shortName)}</div>`;
                    const uploaderDiv = `<div class="int-doc-uploader">${escapeHtml(file.uploadedBy || 'Unknown')}</div>`;
                    
                    let dateDiv = '';
                    if (file.date) {
                        let dateObj = new Date(file.date);
                        if (!isNaN(dateObj.getTime())) {
                            let mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                            let dd = String(dateObj.getDate()).padStart(2, '0');
                            let yy = String(dateObj.getFullYear()).slice(-2);
                            let time = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                            dateDiv = `<div class="int-doc-date">${mm}/${dd}/${yy}<br><span class="int-doc-time">${time}</span></div>`;
                        } else {
                            dateDiv = `<div class="int-doc-date">--/--/--<br><span class="int-doc-time">--:--</span></div>`;
                        }
                    } else {
                        dateDiv = `<div class="int-doc-date">--/--/--<br><span class="int-doc-time">--:--</span></div>`;
                    }
                    
                    const clip = `<span class="int-doc-clip" data-idx="${idx}" title="Remove">📎</span>`;
                    const openBtn = `<button class="copilot-button int-open" style="font-size:11px;padding:5px 8px;" data-url="${escapeHtml(file.url)}">OPEN</button>`;
                    return `<div class="int-row" style="display:flex;align-items:center;gap:8px;margin:4px 0;">${clip}<div class="int-doc-info">${nameDiv}${uploaderDiv}</div>${dateDiv}${openBtn}</div>`;
                }).join('');
                const filesHtml = list || '<div style="text-align:center;color:#aaa">No files</div>';
                box.innerHTML = filesHtml;
                box.querySelectorAll('.int-open').forEach(b => {
                    b.addEventListener('click', () => { const u = b.dataset.url; if (u) window.open(u, '_blank'); });
                });
            });
        }
        
        try {
            function saveData(part) {
                chrome.storage.local.get({ kountInfo: {} }, ({ kountInfo }) => {
                    const updated = Object.assign({}, kountInfo, part);
                    sessionSet({ kountInfo: updated });
                    
                    // Mark KOUNT flow as completed if this is a flow-triggered session
                    chrome.storage.local.get({ fraudReviewSession: null }, ({ fraudReviewSession }) => {
                        const order = sessionStorage.getItem('fennec_order') || fraudReviewSession;
                        if (order) {
                            const flowKey = `fennecKountFlowCompleted_${order}`;
                            localStorage.setItem(flowKey, '1');
                            console.log('[FENNEC (MVP)] KOUNT flow completed for order:', order);
                            
                            // Check if ADYEN flow is also completed to mark overall XRAY as finished
                            const adyenFlowKey = `fennecAdyenFlowCompleted_${order}`;
                            if (localStorage.getItem(adyenFlowKey)) {
                                // Both flows are complete, mark XRAY as finished and trigger trial floater
                                localStorage.setItem('fraudXrayFinished', '1');
                                sessionSet({ fraudXrayFinished: '1' });
                                sessionStorage.setItem('fennecShowTrialFloater', '1');
                                console.log('[FENNEC (MVP)] Both ADYEN and KOUNT flows completed, marking XRAY as finished and triggering trial floater for order:', order);
                            }
                        }
                    });
                });
            }

            const path = window.location.pathname;
            const url = window.location.href;
            
            // Check if this is the new KOUNT 360 environment
            const isKount360 = url.includes('app.kount.com') || url.includes('/event-analysis/order/');
            
            // Set tab title immediately
            if (isKount360) {
                document.title = '[KOUNT 360] ' + document.title;
                console.log('[FENNEC (MVP)] KOUNT 360 tab title set');
            } else if (path.includes('/workflow/ekata') || path.includes('/workflow/ekata.html')) {
                document.title = '[EKATA] ' + document.title;
            } else {
                document.title = '[KOUNT] ' + document.title;
            }
            
            // Check if this tab is part of a fraud review flow
            chrome.storage.local.get({ fennecFraudKount: null, fraudReviewSession: null }, ({ fennecFraudKount, fraudReviewSession }) => {
                const isFraudFlow = fennecFraudKount && url.includes(fennecFraudKount.split('/').pop());
                const order = sessionStorage.getItem('fennec_order') || fraudReviewSession;
                
                if (isKount360 && isFraudFlow && order) {
                    console.log('[FENNEC (MVP)] KOUNT 360 tab identified as part of fraud flow for order:', order);
                    sessionSet({ fraudReviewSession: order });
                }
            });
            
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', injectSidebar);
            } else {
                injectSidebar();
            }

            function findVal(label) {
                const cell = Array.from(document.querySelectorAll('table th, table td'))
                    .find(el => el.textContent.trim() === label);
                return cell && cell.nextElementSibling ? cell.nextElementSibling.textContent.trim() : '';
            }

            // Handle new KOUNT 360 environment
            if (isKount360) {
                const run = () => {
                    console.log('[FENNEC (MVP)] On KOUNT 360 page, extracting data...');
                    
                    // Wait for page to be fully loaded and stable
                    const waitForPageLoad = () => {
                        return new Promise((resolve) => {
                            // Check if page is already loaded
                            if (document.readyState === 'complete') {
                                // Wait a bit more for dynamic content
                                setTimeout(resolve, 2000);
                            } else {
                                // Wait for page to complete loading
                                window.addEventListener('load', () => {
                                    setTimeout(resolve, 2000);
                                });
                            }
                        });
                    };
                    
                    waitForPageLoad().then(() => {
                        
                        
                        // Check for error states that might prevent data extraction
                        const errorIndicators = [
                            '403 Forbidden',
                            'Access Denied',
                            'Unauthorized',
                            'Error loading',
                            'Failed to load'
                        ];
                        
                        const hasErrors = errorIndicators.some(error => 
                            document.body.textContent.includes(error)
                        );
                        
                        if (hasErrors) {
                            console.warn('[FENNEC (MVP)] Error detected on page, proceeding with basic data extraction only');
                        }
                        
                        // Extract basic KOUNT data from the new environment
                        // Look for email age, device location, IP address in the new structure
                        let emailAge = '';
                        let deviceLocation = '';
                        let ip = '';
                        
                        // Try multiple selectors for email age
                        const emailAgeSelectors = [
                            '[data-test-id*="email"]',
                            '[title*="email"]',
                            '.email-age',
                            '[data-test-id*="Email"]',
                            'span[title*="email address was first seen"]'
                        ];
                        for (const selector of emailAgeSelectors) {
                            const el = document.querySelector(selector);
                            if (el && el.textContent.trim()) {
                                emailAge = el.textContent.trim();
                                break;
                            }
                        }
                        
                        // Try multiple selectors for device location
                        const locationSelectors = [
                            '[data-test-id*="location"]',
                            '[title*="location"]',
                            '.device-location',
                            '[data-test-id*="Location"]',
                            'th[title="Device Location"] + td span'
                        ];
                        for (const selector of locationSelectors) {
                            const el = document.querySelector(selector);
                            if (el && el.textContent.trim()) {
                                deviceLocation = el.textContent.trim();
                                break;
                            }
                        }
                        
                        // Try multiple selectors for IP address
                        const ipSelectors = [
                            '[data-test-id*="ip"]',
                            '[title*="ip"]',
                            '.ip-address',
                            '[data-test-id*="IP"]',
                            'th[title*="IP Address"] + td'
                        ];
                        for (const selector of ipSelectors) {
                            const el = document.querySelector(selector);
                            if (el && el.textContent.trim()) {
                                const text = el.textContent.trim();
                                // Extract IP address from text if it contains one
                                const ipMatch = text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
                                if (ipMatch) {
                                    ip = ipMatch[0];
                                    break;
                                } else if (text && !text.includes('--')) {
                                    ip = text;
                                    break;
                                }
                            }
                        }
                        
                        // If still no IP found, try searching the entire document
                        if (!ip) {
                            const allText = document.body.textContent;
                            const ipMatch = allText.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
                            if (ipMatch) {
                                ip = ipMatch[0];
                            }
                        }

                        console.log('[EKATA] Basic K360', { emailAge, deviceLocation, ip });

                        // Function to complete the flow and navigate to ADYEN
                        const completeFlow = (ekataData = null) => {
                            console.log('[FENNEC (MVP)] Completing KOUNT 360 flow with data:', { emailAge, deviceLocation, ip, hasEkataData: !!ekataData });
                            
                            const dataToSave = { emailAge, deviceLocation, ip };
                            if (ekataData) {
                                dataToSave.ekata = ekataData;
                            }
                            
                            saveData(dataToSave);
                            
                            // Navigate to ADYEN after KOUNT is complete
                            console.log('[FENNEC (MVP)] KOUNT 360 completed, navigating to ADYEN...');
                            chrome.storage.local.get({ fennecFraudAdyen: null, fraudReviewSession: null }, ({ fennecFraudAdyen, fraudReviewSession }) => {
                                console.log('[FENNEC (MVP)] ADYEN URL check:', { fennecFraudAdyen, fraudReviewSession });
                                if (fennecFraudAdyen) {
                                    console.log('[FENNEC (MVP)] Opening ADYEN URL:', fennecFraudAdyen);
                                    chrome.storage.local.remove('fennecFraudAdyen');
                                    chrome.storage.local.remove('fennecFraudKount'); // Clean up KOUNT URL
                                    sessionStorage.removeItem('fennecKountOpened'); // Clear KOUNT opened flag
                                    bg.openOrReuseTab({ url: fennecFraudAdyen, active: true });
                                } else {
                                    console.log('[FENNEC (MVP)] No ADYEN URL found, refocusing to fraud tracker');
                                    chrome.storage.local.remove('fennecFraudKount'); // Clean up KOUNT URL
                                    sessionStorage.removeItem('fennecKountOpened'); // Clear KOUNT opened flag
                                    bg.refocusTab();
                                }
                            });
                        };

                        // Look for EKATA widget and click "Request Data" button
                        const ekataWidget = document.querySelector('ekata-widget');
                        console.log('[FENNEC (MVP)] EKATA widget search result:', !!ekataWidget);
                        
                        if (ekataWidget) {
                            console.log('[FENNEC (MVP)] Found EKATA widget, looking for Request Data button...');
                            
                            // Check if EKATA data is already loaded
                            const checkEkataData = () => {
                                const scoreElements = ekataWidget.querySelectorAll('[data-test-id*="ekata-score-"]');
                                const hasData = Array.from(scoreElements).some(el => {
                                    const value = el.textContent.trim();
                                    return value && value !== '--' && value !== '';
                                });
                                return hasData;
                            };
                            
                            // Look for the "Request Data" button in the EKATA widget
                            const requestDataBtn = ekataWidget.querySelector('[data-test-id="load-ekata-data-button"]');
                            console.log('[FENNEC (MVP)] Request Data button search result:', !!requestDataBtn);
                            
                            if (requestDataBtn && !checkEkataData()) {
                                console.log('[FENNEC (MVP)] Found Request Data button, checking if clickable...');
                                
                                // Check if button is clickable (not disabled, visible, etc.)
                                const isClickable = () => {
                                    const isDisabled = requestDataBtn.disabled || 
                                                     requestDataBtn.classList.contains('disabled') ||
                                                     requestDataBtn.classList.contains('mat-mdc-button-disabled');
                                    const isVisible = requestDataBtn.offsetParent !== null;
                                    const hasText = requestDataBtn.textContent.trim().includes('Request Data');
                                    return !isDisabled && isVisible && hasText;
                                };
                                
                                if (!isClickable()) {
                                    console.warn('[FENNEC (MVP)] Request Data button is not clickable, waiting...');
                                    // Wait for button to become clickable
                                    let waitCount = 0;
                                    const maxWait = 20; // Increased wait time
                                    const waitForClickable = () => {
                                        if (isClickable() || waitCount >= maxWait) {
                                            if (isClickable()) {
                                                console.log('[FENNEC (MVP)] Request Data button is now clickable');
                                                attemptClick();
                                            } else {
                                                console.warn('[FENNEC (MVP)] Request Data button never became clickable, trying anyway...');
                                                // Try clicking anyway as Angular Material buttons can be tricky
                                                attemptClick();
                                            }
                                        } else {
                                            waitCount++;
                                            console.log(`[FENNEC (MVP)] Waiting for button to be clickable... (${waitCount}/${maxWait})`);
                                            setTimeout(waitForClickable, 1000);
                                        }
                                    };
                                    waitForClickable();
                                    return;
                                }
                                
                                attemptClick();
                                
                                                                // Try multiple click strategies for Angular Material buttons
                                const clickStrategies = [
                                    // Strategy 1: Direct click with delay
                                    () => {
                                        console.log('[FENNEC (MVP)] Strategy 1: Direct click');
                                        requestDataBtn.click();
                                    },
                                    // Strategy 2: Click on the label span
                                    () => {
                                        console.log('[FENNEC (MVP)] Strategy 2: Click on label span');
                                        const labelSpan = requestDataBtn.querySelector('.mdc-button__label');
                                        if (labelSpan) {
                                            console.log('[FENNEC (MVP)] Found label span, clicking...');
                                            labelSpan.click();
                                        } else {
                                            console.warn('[FENNEC (MVP)] Label span not found');
                                        }
                                    },
                                    // Strategy 3: Trigger mousedown and mouseup events
                                    () => {
                                        console.log('[FENNEC (MVP)] Strategy 3: Mouse events');
                                        const mousedownEvent = new MouseEvent('mousedown', {
                                            bubbles: true,
                                            cancelable: true,
                                            view: window
                                        });
                                        const mouseupEvent = new MouseEvent('mouseup', {
                                            bubbles: true,
                                            cancelable: true,
                                            view: window
                                        });
                                        const clickEvent = new MouseEvent('click', {
                                            bubbles: true,
                                            cancelable: true,
                                            view: window
                                        });
                                        requestDataBtn.dispatchEvent(mousedownEvent);
                                        setTimeout(() => {
                                            requestDataBtn.dispatchEvent(mouseupEvent);
                                            setTimeout(() => {
                                                requestDataBtn.dispatchEvent(clickEvent);
                                            }, 50);
                                        }, 50);
                                    },
                                    // Strategy 4: Focus and press Enter
                                    () => {
                                        console.log('[FENNEC (MVP)] Strategy 4: Focus and Enter');
                                        requestDataBtn.focus();
                                        const enterEvent = new KeyboardEvent('keydown', {
                                            key: 'Enter',
                                            code: 'Enter',
                                            keyCode: 13,
                                            which: 13,
                                            bubbles: true,
                                            cancelable: true
                                        });
                                        requestDataBtn.dispatchEvent(enterEvent);
                                    },
                                    // Strategy 5: Trigger Angular Material button events
                                    () => {
                                        console.log('[FENNEC (MVP)] Strategy 5: Angular Material events');
                                        const touchStartEvent = new TouchEvent('touchstart', {
                                            bubbles: true,
                                            cancelable: true
                                        });
                                        const touchEndEvent = new TouchEvent('touchend', {
                                            bubbles: true,
                                            cancelable: true
                                        });
                                        requestDataBtn.dispatchEvent(touchStartEvent);
                                        setTimeout(() => {
                                            requestDataBtn.dispatchEvent(touchEndEvent);
                                        }, 100);
                                    }
                                ];
                                
                                // Try each strategy
                                let clickSuccessful = false;
                                for (let i = 0; i < clickStrategies.length; i++) {
                                    try {
                                        console.log(`[FENNEC (MVP)] Trying click strategy ${i + 1}...`);
                                        clickStrategies[i]();
                                        console.log(`[FENNEC (MVP)] Click strategy ${i + 1} executed successfully`);
                                        
                                        // Wait a moment to see if the button state changes
                                        setTimeout(() => {
                                            const buttonText = requestDataBtn.textContent.trim();
                                            const isDisabled = requestDataBtn.disabled || requestDataBtn.classList.contains('disabled');
                                            console.log('[FENNEC (MVP)] Button state after click:', { buttonText, isDisabled });
                                            
                                            // Check if EKATA data started loading
                                            const scoreElements = ekataWidget.querySelectorAll('[data-test-id*="ekata-score-"]');
                                            const hasData = Array.from(scoreElements).some(el => {
                                                const value = el.textContent.trim();
                                                return value && value !== '--' && value !== '';
                                            });
                                            console.log('[FENNEC (MVP)] EKATA data loading status:', { hasData, scoreCount: scoreElements.length });
                                        }, 1000);
                                        
                                        clickSuccessful = true;
                                        break;
                                    } catch (error) {
                                        console.warn(`[FENNEC (MVP)] Click strategy ${i + 1} failed:`, error);
                                    }
                                }
                                
                                if (!clickSuccessful) {
                                    // Do not navigate away; proceed to polling/extraction without relying on the click
                                }
                                
                                // Wait for EKATA data to load with retry mechanism
                                let retryCount = 0;
                                const maxRetries = 3;
                                const checkAndExtractData = () => {
                                // Poll for EKATA data
                                    
                                    if (checkEkataData() || retryCount >= maxRetries) {
                                        // Extract EKATA data from KOUNT 360 widget
                                        
                                        // Extract EKATA data from the new structure
                                        const ekataScores = {};
                                        const scoreElements = ekataWidget.querySelectorAll('[data-test-id*="ekata-score-"]');
                                        scoreElements.forEach(el => {
                                            const testId = el.getAttribute('data-test-id');
                                            const value = el.textContent.trim();
                                            if (testId && value && value !== '--') {
                                                // Extract the actual score value (remove "ekata-score-" prefix)
                                                const scoreKey = testId.replace('ekata-score-', '');
                                                ekataScores[scoreKey] = value;
                                            }
                                        });
                                        
                                        // Extract other EKATA data
                                        const ipValid = ekataWidget.querySelector('[data-test-id*="ipValid"]')?.textContent.trim() || '';
                                        const proxyRisk = ekataWidget.querySelector('[data-test-id*="proxyRisk"]')?.textContent.trim() || '';
                                        const addressToName = ekataWidget.querySelector('[data-test-id*="addressToName"]')?.textContent.trim() || '';
                                        const residentName = ekataWidget.querySelector('[data-test-id*="residentName"]')?.textContent.trim() || '';
                                        
                                        // Minimal log for troubleshooting
                                        console.log('[FENNEC (MVP)] EKATA extracted');
                                        
                                        const ekataData = { 
                                            ipValid, 
                                            proxyRisk, 
                                            addressToName, 
                                            residentName,
                                            scores: ekataScores
                                        };
                                        
                                        completeFlow(ekataData);
                                    } else {
                                        retryCount++;
                                        setTimeout(checkAndExtractData, 2000);
                                    }
                                };
                                
                                setTimeout(checkAndExtractData, 3000);
                            } else {
                                // EKATA already present; extract immediately
                                
                                // Extract existing EKATA data
                                const ekataScores = {};
                                const scoreElements = ekataWidget.querySelectorAll('[data-test-id*="ekata-score-"]');
                                scoreElements.forEach(el => {
                                    const testId = el.getAttribute('data-test-id');
                                    const value = el.textContent.trim();
                                    if (testId && value && value !== '--') {
                                        const scoreKey = testId.replace('ekata-score-', '');
                                        ekataScores[scoreKey] = value;
                                    }
                                });
                                
                                const ipValid = ekataWidget.querySelector('[data-test-id*="ipValid"]')?.textContent.trim() || '';
                                const proxyRisk = ekataWidget.querySelector('[data-test-id*="proxyRisk"]')?.textContent.trim() || '';
                                const addressToName = ekataWidget.querySelector('[data-test-id*="addressToName"]')?.textContent.trim() || '';
                                const residentName = ekataWidget.querySelector('[data-test-id*="residentName"]')?.textContent.trim() || '';
                                
                                const ekataData = { 
                                    ipValid, 
                                    proxyRisk, 
                                    addressToName, 
                                    residentName,
                                    scores: ekataScores
                                };
                                
                                completeFlow(ekataData);
                            }
                        } else {
                            // If widget not found, keep the tab; rely on earlier modal-based path
                        }
                        
                        // Removed fallback timeouts to ensure we do not navigate before EKATA extraction
                    });
                };
                
                // Start the process immediately
                run();
            }
            // Handle old KOUNT environment (legacy support)
            else if (path.includes('/workflow/detail')) {
                const run = () => {
                    console.log('[FENNEC (MVP)] On KOUNT workflow detail page, extracting data...');
                    
                    const emailAgeEl = document.querySelector('span[title*="email address was first seen"]');
                    const emailAge = emailAgeEl ? emailAgeEl.textContent.trim() : '';
                    const locEl = document.querySelector('th[title="Device Location"] + td span');
                    const deviceLocation = locEl ? locEl.textContent.trim() : '';
                    const ipEl = document.querySelector('th[title*="IP Address"] + td');
                    const ip = ipEl ? ipEl.textContent.trim() : '';

                    console.log('[FENNEC (MVP)] Basic KOUNT data extracted:', { emailAge, deviceLocation, ip });

                    const vipBtn = Array.from(document.querySelectorAll('a,button'))
                        .find(el => /VIP Lists/i.test(el.textContent));
                    if (vipBtn) {
                        console.log('[FENNEC (MVP)] Found VIP Lists button, clicking...');
                        vipBtn.click();
                    } else {
                        console.warn('[FENNEC (MVP)] VIP Lists button not found');
                    }
                    
                    setTimeout(() => {
                        console.log('[FENNEC (MVP)] Extracting VIP declines and linked data...');
                        
                        const declines = Array.from(document.querySelectorAll('#vip-lists tr'))
                            .filter(row => row.querySelector('input[value="decline"]')?.checked)
                            .map(row => {
                                const label = row.querySelector('th')?.textContent.trim() || '';
                                const valEl = row.querySelector('td.value, td.truncated.value');
                                const val = valEl ? (valEl.getAttribute('title') || valEl.textContent).trim() : '';
                                return label && val ? `${label}: ${val}` : '';
                            })
                            .filter(Boolean);

                        const linked = {};
                        document.querySelectorAll('#link-analysis tbody tr').forEach(row => {
                            const th = row.querySelector('th');
                            const countEl = row.querySelector('.count');
                            if (!th || !countEl) return;
                            const label = th.textContent.replace(/:\s*$/, '').trim();
                            const num = parseInt(countEl.textContent.replace(/[^0-9]/g, ''), 10) || 0;
                            switch (label) {
                                case 'Email': linked.email = num; break;
                                case 'IP Address': linked.ip = num; break;
                                case 'Cust. ID': linked.custId = num; break;
                                case 'Payment': linked.payment = num; break;
                                case 'Bill Addr': linked.billAddr = num; break;
                                case 'Ship Addr': linked.shipAddr = num; break;
                                case 'Device ID': linked.deviceId = num; break;
                                default: break;
                            }
                        });

                        console.log('[FENNEC (MVP)] KOUNT data extracted:', { declines, linked });
                        saveData({ emailAge, deviceLocation, ip, declines, linked });

                        const ekataLink = document.querySelector('a[href*="/workflow/ekata"]');
                        if (ekataLink) {
                            console.log('[FENNEC (MVP)] Found EKATA link, navigating to:', ekataLink.href);
                            const url = ekataLink.href.startsWith('http') ? ekataLink.href : location.origin + ekataLink.getAttribute('href');
                            bg.openOrReuseTab({ url, active: true });
                        } else {
                            console.warn('[FENNEC (MVP)] EKATA link not found, trying alternative selectors...');
                            // Try alternative selectors for EKATA link
                            const alternativeLinks = [
                                'a[href*="ekata"]',
                                'a[href*="Ekata"]',
                                'a[href*="EKATA"]',
                                'a[href*="/workflow/ekata.html"]',
                                'a[href*="/workflow/ekata"]'
                            ];
                            
                            for (const selector of alternativeLinks) {
                                const link = document.querySelector(selector);
                                if (link) {
                                    console.log('[FENNEC (MVP)] Found EKATA link with alternative selector:', selector);
                                    const url = link.href.startsWith('http') ? link.href : location.origin + link.getAttribute('href');
                                    bg.openOrReuseTab({ url, active: true });
                                    break;
                                }
                            }
                            
                            // If still not found, try to find any link containing "ekata" in text
                            const allLinks = Array.from(document.querySelectorAll('a'));
                            const ekataTextLink = allLinks.find(link => 
                                link.textContent.toLowerCase().includes('ekata') || 
                                link.textContent.toLowerCase().includes('ekata report')
                            );
                            
                            if (ekataTextLink) {
                                console.log('[FENNEC (MVP)] Found EKATA link by text content:', ekataTextLink.textContent);
                                const url = ekataTextLink.href.startsWith('http') ? ekataTextLink.href : location.origin + ekataTextLink.getAttribute('href');
                                bg.openOrReuseTab({ url, active: true });
                            } else {
                                console.error('[FENNEC (MVP)] EKATA link not found with any method');
                            }
                        }
                    }, 500);
                };
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', run);
                } else run();
            } else if (path.includes('/workflow/ekata') || path.includes('/workflow/ekata.html')) {
                const run = () => {
                    console.log('[FENNEC (MVP)] On EKATA page, looking for report generation...');
                    
                    // Check if report is already generated and needs refresh/expansion
                    const checkForExistingReport = () => {
                        // Look for existing report data or expandable sections
                        const existingReportIndicators = [
                            'Resident Name:',
                            'Is Commercial:',
                            'Is Forwarder:',
                            'Type:',
                            'Distance from Shipping',
                            'Linked to Shipping'
                        ];
                        
                        const hasExistingReport = existingReportIndicators.some(indicator => 
                            document.body.textContent.includes(indicator)
                        );
                        
                        if (hasExistingReport) {
                            console.log('[FENNEC (MVP)] Found existing EKATA report, checking for refresh/expansion...');
                            
                            // First check if we need to refresh the report
                            const refreshBtn = document.querySelector('[data-test-id="load-ekata-data-button"], input.simple-submit[value="Update Report"], input[value="Refresh"], button[onclick*="refresh"], a[onclick*="refresh"]');
                            if (refreshBtn && !sessionStorage.getItem('fennecEkataRefreshClicked')) {
                                console.log('[FENNEC (MVP)] Found refresh button, clicking to update report...');
                                console.log('[FENNEC (MVP)] Refresh button details:', {
                                    tagName: refreshBtn.tagName,
                                    className: refreshBtn.className,
                                    dataTestId: refreshBtn.getAttribute('data-test-id'),
                                    attributes: Array.from(refreshBtn.attributes).map(attr => `${attr.name}="${attr.value}"`).join(', '),
                                    textContent: refreshBtn.textContent.trim(),
                                    disabled: refreshBtn.disabled,
                                    offsetParent: refreshBtn.offsetParent !== null,
                                    matRippleUninitialized: refreshBtn.hasAttribute('mat-ripple-loader-uninitialized')
                                });
                                sessionStorage.setItem('fennecEkataRefreshClicked', '1');
                                refreshBtn.click();
                                
                                // Wait for refresh to complete, then check for expansion
                                setTimeout(() => {
                                    sessionStorage.removeItem('fennecEkataRefreshClicked');
                                    checkForExpansion();
                                }, 5000);
                                return true;
                            }
                            
                            // Check for expansion if no refresh needed
                            return checkForExpansion();
                        }
                        
                        function checkForExpansion() {
                            // First, look for the specific EKATA expand button
                            const ekataExpandBtn = document.querySelector('[data-test-id="open-ekata-modal-button"]');
                            if (ekataExpandBtn) {
                                console.log('[FENNEC (MVP)] Found EKATA expand button, checking initialization...');
                                console.log('[FENNEC (MVP)] Expand button details:', {
                                    tagName: ekataExpandBtn.tagName,
                                    className: ekataExpandBtn.className,
                                    attributes: Array.from(ekataExpandBtn.attributes).map(attr => `${attr.name}="${attr.value}"`).join(', '),
                                    textContent: ekataExpandBtn.textContent.trim(),
                                    disabled: ekataExpandBtn.disabled,
                                    offsetParent: ekataExpandBtn.offsetParent !== null,
                                    matRippleUninitialized: ekataExpandBtn.hasAttribute('mat-ripple-loader-uninitialized')
                                });
                                
                                // Check if button is properly initialized
                                const isInitialized = !ekataExpandBtn.hasAttribute('mat-ripple-loader-uninitialized') && 
                                                    !ekataExpandBtn.disabled &&
                                                    ekataExpandBtn.offsetParent !== null;
                                
                                console.log('[FENNEC (MVP)] Button initialization status:', {
                                    matRippleUninitialized: ekataExpandBtn.hasAttribute('mat-ripple-loader-uninitialized'),
                                    disabled: ekataExpandBtn.disabled,
                                    offsetParent: ekataExpandBtn.offsetParent !== null,
                                    isInitialized: isInitialized
                                });
                                
                                if (!isInitialized) {
                                    console.log('[FENNEC (MVP)] Button not fully initialized, waiting for initialization...');
                                    
                                    // Wait for button to be properly initialized
                                    const waitForInitialization = () => {
                                        return new Promise((resolve) => {
                                            let attempts = 0;
                                            const maxAttempts = 20;
                                            
                                            const checkInit = () => {
                                                attempts++;
                                                const btn = document.querySelector('[data-test-id="open-ekata-modal-button"]');
                                                
                                                if (btn && !btn.hasAttribute('mat-ripple-loader-uninitialized') && 
                                                    !btn.disabled && btn.offsetParent !== null) {
                                                    console.log(`[FENNEC (MVP)] Button initialized after ${attempts} attempts`);
                                                    console.log('[FENNEC (MVP)] Initialized button details:', {
                                                        tagName: btn.tagName,
                                                        className: btn.className,
                                                        attributes: Array.from(btn.attributes).map(attr => `${attr.name}="${attr.value}"`).join(', '),
                                                        textContent: btn.textContent.trim()
                                                    });
                                                    resolve(btn);
                                                } else if (attempts >= maxAttempts) {
                                                    console.log('[FENNEC (MVP)] Button initialization timeout, proceeding anyway...');
                                                    console.log('[FENNEC (MVP)] Final button state:', {
                                                        exists: !!btn,
                                                        matRippleUninitialized: btn?.hasAttribute('mat-ripple-loader-uninitialized'),
                                                        disabled: btn?.disabled,
                                                        offsetParent: btn?.offsetParent !== null
                                                    });
                                                    resolve(ekataExpandBtn);
                                                } else {
                                                    setTimeout(checkInit, 500);
                                                }
                                            };
                                            
                                            checkInit();
                                        });
                                    };
                                    
                                    waitForInitialization().then((initializedBtn) => {
                                        attemptExpandButtonClick(initializedBtn);
                                    });
                                } else {
                                    attemptExpandButtonClick(ekataExpandBtn);
                                }
                                
                                return true;
                            }
                            
                            function attemptExpandButtonClick(button) {
                                console.log('[FENNEC (MVP)] Attempting to click initialized expand button...');
                                console.log('[FENNEC (MVP)] Button to click details:', {
                                    tagName: button.tagName,
                                    className: button.className,
                                    dataTestId: button.getAttribute('data-test-id'),
                                    attributes: Array.from(button.attributes).map(attr => `${attr.name}="${attr.value}"`).join(', '),
                                    textContent: button.textContent.trim(),
                                    disabled: button.disabled,
                                    offsetParent: button.offsetParent !== null
                                });
                                
                                // Try multiple click strategies for Angular buttons
                                const clickStrategies = [
                                    () => {
                                        console.log('[FENNEC (MVP)] Strategy 1: Standard click()');
                                        button.click();
                                    },
                                    () => {
                                        console.log('[FENNEC (MVP)] Strategy 2: Event dispatch');
                                        button.dispatchEvent(new Event('click', { bubbles: true }));
                                    },
                                    () => {
                                        console.log('[FENNEC (MVP)] Strategy 3: MouseEvent dispatch');
                                        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                                    },
                                    () => {
                                        console.log('[FENNEC (MVP)] Strategy 4: Angular triggerHandler');
                                        // Try to trigger Angular's click handler directly
                                        if (window.angular && angular.element) {
                                            const angularElement = angular.element(button);
                                            if (angularElement && angularElement.scope) {
                                                angularElement.triggerHandler('click');
                                            }
                                        }
                                    },
                                    () => {
                                        console.log('[FENNEC (MVP)] Strategy 5: Click handler execution');
                                        // Try to find and trigger the button's click handler
                                        const clickHandlers = button.onclick || button.getAttribute('onclick');
                                        if (clickHandlers) {
                                            eval(clickHandlers);
                                        }
                                    }
                                ];
                                
                                let clickSuccess = false;
                                for (let i = 0; i < clickStrategies.length; i++) {
                                    try {
                                        console.log(`[FENNEC (MVP)] Trying click strategy ${i + 1}...`);
                                        clickStrategies[i]();
                                        clickSuccess = true;
                                        console.log(`[FENNEC (MVP)] Click strategy ${i + 1} executed successfully`);
                                        break;
                                    } catch (e) {
                                        console.log(`[FENNEC (MVP)] Click strategy ${i + 1} failed:`, e);
                                    }
                                }
                                
                                if (!clickSuccess) {
                                    console.log('[FENNEC (MVP)] All click strategies failed, trying fallback...');
                                    // Fallback: try to trigger the button programmatically
                                    try {
                                        console.log('[FENNEC (MVP)] Fallback: Advanced MouseEvent');
                                        const event = new MouseEvent('click', {
                                            view: window,
                                            bubbles: true,
                                            cancelable: true
                                        });
                                        button.dispatchEvent(event);
                                        console.log('[FENNEC (MVP)] Fallback click executed');
                                    } catch (e) {
                                        console.log('[FENNEC (MVP)] Fallback click also failed:', e);
                                    }
                                } else {
                                    console.log('[FENNEC (MVP)] Click attempt completed successfully');
                                }
                                
                                // Wait for modal to open and data to load
                    setTimeout(() => {
                                    console.log('[FENNEC (MVP)] Checking if EKATA modal opened...');
                                    
                                    // Check if modal is open by looking for modal-specific content
                                    const modalContent = document.querySelector('.modal, .dialog, [role="dialog"], .ekata-modal, .mat-dialog-container, .cdk-overlay-pane');
                                    if (modalContent) {
                                        console.log('[FENNEC (MVP)] EKATA modal detected, extracting data...');
                                        extractEkataData();
                                    } else {
                                        console.log('[FENNEC (MVP)] Modal not detected, trying alternative approach...');
                                        
                                        // Alternative: check if the button state changed or if we can extract data directly
                                        const buttonState = button.getAttribute('aria-expanded') || 
                                                          button.getAttribute('aria-pressed') ||
                                                          button.classList.contains('expanded') ||
                                                          button.classList.contains('active');
                                        
                                        if (buttonState) {
                                            console.log('[FENNEC (MVP)] Button state indicates expansion, extracting data...');
                                            extractEkataData();
                                        } else {
                                            console.log('[FENNEC (MVP)] Button click may have failed, trying direct extraction...');
                                            // Try to extract data even if modal didn't open
                                            setTimeout(() => {
                                                extractEkataData();
                                            }, 2000);
                                        }
                                    }
                                }, 3000);
                            }
                            
                            // Fallback: Look for other expandable sections that need to be clicked
                            const expandableSections = Array.from(document.querySelectorAll('a.link, button, .expandable, [onclick*="expand"], [onclick*="show"], .collapsible, .toggle'))
                                .filter(el => {
                                    const text = el.textContent.toLowerCase();
                                    return text.includes('expand') || 
                                           text.includes('show') || 
                                           text.includes('details') ||
                                           text.includes('more') ||
                                           text.includes('view') ||
                                           el.getAttribute('onclick')?.includes('expand') ||
                                           el.getAttribute('onclick')?.includes('show') ||
                                           el.getAttribute('onclick')?.includes('toggle');
                                });
                            
                            if (expandableSections.length > 0) {
                                console.log('[FENNEC (MVP)] Found expandable sections, clicking to expand...');
                                expandableSections.forEach(section => {
                                    if (section.click) {
                                        console.log('[FENNEC (MVP)] Clicking expandable section:', section.textContent);
                                        section.click();
                                    }
                                });
                                
                                // Wait for expansion to complete, then extract data
                                setTimeout(() => {
                                    extractEkataData();
                                }, 3000);
                                return true;
                            } else {
                                // No expansion needed, extract data directly
                                console.log('[FENNEC (MVP)] No expansion needed, extracting data directly...');
                                extractEkataData();
                                return true;
                            }
                        }
                        return false;
                    };
                    
                    // Helper: extract address info from a column node
                    const extractAddressFromColumn = (columnNode, kind /* 'billing' | 'shipping' */) => {
                        const get = (key) => {
                            const el = columnNode.querySelector(`[data-test-id="ekata.${key}section-column-field-value"]`);
                            return el ? el.textContent.trim() : '';
                        };
                        return {
                            warnings: get('warnings'),
                            errors: get('errors'),
                            isValid: get('isValid'),
                            inputCompleteness: get('inputCompleteness'),
                            matchToName: get('matchToName'),
                            residentName: get('residentName'),
                            isCommercial: get('isCommercial'),
                            isForwarder: get('isForwarder'),
                            type: get('type'),
                            distanceFromShipping: kind === 'billing' ? get('distanceFromShipping') : '',
                            linkedToShippingResident: kind === 'billing' ? get('linkedToShippingResident') : ''
                        };
                    };
                    
                    const extractEkataData = async () => {
                        console.log('[FENNEC (MVP)] Extracting EKATA data...');
                        
                        // Wait briefly for the EKATA modal Address section to render
                        const waitFor = async (predicate, timeoutMs = 8000, stepMs = 200) => {
                            const start = Date.now();
                            while (Date.now() - start < timeoutMs) {
                                try { if (predicate()) return true; } catch (_) {}
                                await new Promise(r => setTimeout(r, stepMs));
                            }
                            return false;
                        };
                        
                        // Enhanced data extraction for expanded reports
                        const extractFromTable = (label) => {
                            const cell = Array.from(document.querySelectorAll('table th, table td'))
                                .find(el => el.textContent.trim() === label);
                            return cell && cell.nextElementSibling ? cell.nextElementSibling.textContent.trim() : '';
                        };
                        
                        // Extract basic data
                        const ipValid = extractFromTable('Is Valid');
                        const proxyRisk = extractFromTable('Proxy Risk');
                        const addressToName = extractFromTable('Address to Name');
                        const residentName = extractFromTable('Resident Name');
                        
                        // Enhanced extraction for detailed EKATA Address section
                        let residentDetails = '';
                        let billingInfo = {};
                        let shippingInfo = {};
                        let ipInfo = {};
                        
                        // Wait for the Address section to be present
                        await waitFor(() => Array.from(document.querySelectorAll('.section .section-title span')).some(n => n.textContent.trim().toLowerCase() === 'address'));
                        
                        // Find Address section by title text to scope selectors (strict)
                        const addressSection = Array.from(document.querySelectorAll('.section'))
                            .find(s => {
                                const t = s.querySelector('.section-title span');
                                return t && t.textContent && t.textContent.trim().toLowerCase() === 'address';
                            });
                        if (addressSection) {
                            const columns = addressSection.querySelectorAll('.section-column');
                            columns.forEach(col => {
                                const title = (col.querySelector('.section-column-title span') || {}).textContent || '';
                                const titleNorm = title.trim().toLowerCase();
                                if (titleNorm === 'billing info') billingInfo = extractAddressFromColumn(col, 'billing');
                                if (titleNorm === 'shipping info') shippingInfo = extractAddressFromColumn(col, 'shipping');
                            });
                        } else {
                            console.log('[FENNEC] EKATA Address section not found');
                        }
                        
                        // Extract IP Checks section (Proxy Risk, Is Valid, Subdivision, Country)
                        const ipSection = Array.from(document.querySelectorAll('.section'))
                            .find(s => {
                                const t = s.querySelector('.section-title span');
                                return t && t.textContent && t.textContent.trim().toLowerCase() === 'ip checks';
                            });
                        if (ipSection) {
                            const getVal = (key) => {
                                const el = ipSection.querySelector(`[data-test-id="ekata.${key}section-column-field-value"]`);
                                return el ? el.textContent.trim() : '';
                            };
                            const proxyRiskText = getVal('proxyRisk');
                            const validText = getVal('isValid');
                            ipInfo = {
                                proxyRisk: /^(true|yes)$/i.test(proxyRiskText) ? true : /^(false|no)$/i.test(proxyRiskText) ? false : proxyRiskText || '',
                                isValid: /^(true|yes)$/i.test(validText) ? true : /^(false|no)$/i.test(validText) ? false : validText || '',
                                subdivision: getVal('subdivision') || getVal('state') || '',
                                country: getVal('country') || ''
                            };
                        }

                        // Save a compact residentDetails JSON for downstream consumers
                        residentDetails = JSON.stringify({ billing: billingInfo, shipping: shippingInfo });
                        
                        // Extract proxy details if available
                        let proxyDetails = '';
                        const proxySection = Array.from(document.querySelectorAll('div, section, table'))
                            .find(el => el.textContent.includes('Proxy Risk') && 
                                       (el.textContent.includes('Is Commercial') || el.textContent.includes('Is Forwarder')));
                        
                        if (proxySection) {
                            proxyDetails = proxySection.textContent;
                        }
                        
                        // If no proxy details found, try to extract from the page body
                        if (!proxyDetails) {
                            const bodyText = document.body.textContent;
                            const proxyMatch = bodyText.match(/Proxy Risk[:\s]+([^\n\r]+?)(?=\s+(Is Commercial|Is Forwarder|Type:|Distance|Linked|Warnings:|Errors:|Is Valid|Input Completeness|Match to Name)|$)/gi);
                            if (proxyMatch && proxyMatch.length > 0) {
                                proxyDetails = proxyMatch.join('\n');
                            }
                        }
                        
                        // Prefer structured ipInfo over table values
                        if (ipInfo && (ipInfo.isValid !== undefined || ipInfo.proxyRisk !== undefined)) {
                            if (typeof ipInfo.isValid === 'boolean') ipValid = ipInfo.isValid;
                            if (typeof ipInfo.proxyRisk === 'boolean') proxyRisk = ipInfo.proxyRisk;
                        }

                        const ekataData = {
                            ipValid,
                            proxyRisk,
                            addressToName,
                            residentName,
                            residentDetails,
                            proxyDetails,
                            billingInfo,
                            shippingInfo,
                            ipInfo
                        };
                        
                        console.log('[FENNEC] EKATA extracted', {
                            billing: { name: ekataData.billingInfo && ekataData.billingInfo.residentName, match: ekataData.billingInfo && ekataData.billingInfo.matchToName, commercial: ekataData.billingInfo && ekataData.billingInfo.isCommercial },
                            shipping: { name: ekataData.shippingInfo && ekataData.shippingInfo.residentName, match: ekataData.shippingInfo && ekataData.shippingInfo.matchToName, commercial: ekataData.shippingInfo && ekataData.shippingInfo.isCommercial },
                            ip: { proxy: ekataData.ipInfo && ekataData.ipInfo.proxyRisk, valid: ekataData.ipInfo && ekataData.ipInfo.isValid, subdivision: ekataData.ipInfo && ekataData.ipInfo.subdivision, country: ekataData.ipInfo && ekataData.ipInfo.country }
                        });
                        saveData({ ekata: ekataData });
                        
                        // Do not mark XRAY as finished yet. The Adyen step will
                        // trigger the Trial floater once all data is collected.
                        sessionStorage.removeItem('fennecEkataUpdateClicked');
                        
                        console.log('[FENNEC (MVP)] EKATA completed, navigating to ADYEN...');
                        chrome.storage.local.get({ fennecFraudAdyen: null, fraudReviewSession: null }, ({ fennecFraudAdyen, fraudReviewSession }) => {
                            if (fennecFraudAdyen) {
                                console.log('[FENNEC (MVP)] Opening ADYEN URL:', fennecFraudAdyen);
                                chrome.storage.local.remove('fennecFraudAdyen');
                                bg.openOrReuseTab({ url: fennecFraudAdyen, active: true });
                            } else {
                                console.log('[FENNEC (MVP)] No ADYEN URL found, refocusing to fraud tracker');
                                bg.refocusTab();
                            }
                        });
                    };
                    
                    // First check if report already exists and needs expansion
                    console.log('[FENNEC (MVP)] Checking for existing EKATA report...');
                    if (checkForExistingReport()) {
                        console.log('[FENNEC (MVP)] Existing report found, flow handled by checkForExistingReport');
                        return;
                    }
                    console.log('[FENNEC (MVP)] No existing report found, proceeding with generation flow');
                    
                    // If no existing report, proceed with normal generation flow
                    const link = Array.from(document.querySelectorAll('a.link'))
                        .find(a => /Generate Ekata Report/i.test(a.textContent));
                    if (link) {
                        console.log('[FENNEC (MVP)] Found Generate Ekata Report link, clicking...');
                        link.click();
                        return;
                    }
                    
                    const btn = document.querySelector('input.simple-submit[value="Update Report"]');
                    if (btn && !sessionStorage.getItem('fennecEkataUpdateClicked')) {
                        console.log('[FENNEC (MVP)] Found Update Report button, clicking...');
                        sessionStorage.setItem('fennecEkataUpdateClicked', '1');
                        btn.click();
                        return;
                    }
                    
                    // Wait a bit longer for the report to be generated/updated
                    setTimeout(() => {
                        extractEkataData();
                    }, 2000); // Increased timeout to allow for report generation
                };
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', run);
                } else run();
            }

            chrome.storage.onChanged.addListener((changes, area) => {
                if (area === 'local' && changes.sidebarSessionId &&
                    changes.sidebarSessionId.newValue !== getFennecSessionId()) {
                    return;
                }
                if (area === 'local' && changes.sidebarDb) loadDbSummary();
                if (area === 'local' && changes.adyenDnaInfo) loadDnaSummary();
                if (area === 'local' && changes.kountInfo) loadKountSummary();
                if (area === 'local' && changes.sidebarSnapshot && changes.sidebarSnapshot.newValue) {
                    const sb = document.getElementById('copilot-sidebar');
                    if (sb) {
                        sb.innerHTML = changes.sidebarSnapshot.newValue;
                        attachCommonListeners(sb);
                    }
                }
            });
        } catch (e) {
            console.error('[FENNEC (MVP) Kount] Launcher error:', e);
        }
    });
    }
}

new KountLauncher().init();
