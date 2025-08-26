// Auto-navigates to the DNA page and collects payment/transaction info when an
// order number is provided via ?fennec_order= in the URL or session storage.
class AdyenLauncher extends Launcher {
    init() {
    if (window.top !== window) return;
    const bg = fennecMessenger;
    
    // Check if extension is enabled and get review mode status
    chrome.storage.local.get({ extensionEnabled: true, fennecReviewMode: false, fennecActiveSession: null, fraudReviewSession: null }, ({ extensionEnabled, fennecReviewMode, fennecActiveSession, fraudReviewSession }) => {
        if (!extensionEnabled) {
            console.log('[FENNEC (MVP)] Extension disabled, skipping Adyen launcher.');
            return;
        }

        // Check if this is a flow-triggered open or manual open
        const params = new URLSearchParams(window.location.search);
        const orderParam = params.get('fennec_order');
        
        // Check for flow indicators - improved detection
        const hasOrderParam = orderParam && fennecReviewMode;
        const hasFraudSession = fraudReviewSession && fennecReviewMode;
        const isFlowTriggered = hasOrderParam || hasFraudSession;
        const isManualOpen = !hasOrderParam && !hasFraudSession;
        
        // Always tag ADYEN tabs when in review mode, regardless of how they were opened
        const shouldTag = fennecReviewMode;
        
        console.log('[FENNEC (MVP)] ADYEN flow detection:', { 
            orderParam, 
            fraudReviewSession, 
            fennecReviewMode, 
            hasOrderParam, 
            hasFraudSession, 
            isFlowTriggered, 
            isManualOpen,
            shouldTag
        });
        
        // If not in review mode and not manually opened, don't initialize
        if (!fennecReviewMode && !isManualOpen) {
            console.log('[FENNEC (MVP)] Adyen opened outside review mode and not manually opened, skipping initialization.');
            return;
        }
        
        // In REVIEW MODE, always inject sidebar for flow-triggered opens
        // Only skip sidebar injection for truly manual opens (no order param and no fraud session)
        if (isManualOpen && fennecReviewMode && !orderParam && !fraudReviewSession) {
            console.log('[FENNEC (MVP)] Adyen manually opened in review mode (no flow context), tab only (no sidebar).');
            // Still tag the tab even if manually opened in review mode
            if (shouldTag) {
                const path = window.location.pathname;
                if (path.includes('showOilSplashList.shtml')) {
                    document.title = '[ADYEN DNA] ' + document.title;
                } else {
                    document.title = '[ADYEN] ' + document.title;
                }
            }
            return;
        }
        
        // Additional check: if we have an order parameter but review mode is not set,
        // we should still proceed with the flow (this handles edge cases)
        if (orderParam && !fennecReviewMode) {
            console.log('[FENNEC (MVP)] ADYEN opened with order parameter but not in review mode, enabling review mode and proceeding with flow.');
            chrome.storage.local.set({ fennecReviewMode: true });
            chrome.storage.sync.set({ fennecReviewMode: true });
            fennecReviewMode = true;
        }
        
        // Clear stale completion flags for this order to ensure fresh flow
        const orderId = orderParam || fraudReviewSession;
        if (orderId) {
            const flowKey = `fennecAdyenFlowCompleted_${orderId}`;
            const wasCompleted = localStorage.getItem(flowKey);
            if (wasCompleted) {
                console.log('[FENNEC (MVP)] ADYEN: Clearing stale completion flag for order:', orderId);
                localStorage.removeItem(flowKey);
            }
        }
        
        // Additional debugging for flow detection
        console.log('[FENNEC (MVP)] ADYEN flow detection details:', {
            orderParam,
            fraudReviewSession,
            fennecReviewMode,
            hasOrderParam,
            hasFraudSession,
            isFlowTriggered,
            isManualOpen,
            shouldTag,
            willProceed: isFlowTriggered || (fennecReviewMode && !isManualOpen)
        });
        
        // If flow-triggered, check if flow is already completed
        if (isFlowTriggered) {
            const orderId = orderParam || fraudReviewSession;
            const flowKey = `fennecAdyenFlowCompleted_${orderId}`;
            const isCompleted = localStorage.getItem(flowKey);
            console.log('[FENNEC (MVP)] ADYEN flow completion check:', {
                orderId,
                flowKey,
                isCompleted,
                willSkip: isCompleted ? 'YES' : 'NO'
            });
            if (isCompleted) {
                console.log('[FENNEC (MVP)] Adyen flow already completed, skipping initialization.');
                // Still tag the tab even if flow is completed
                if (shouldTag) {
                    const path = window.location.pathname;
                    if (path.includes('showOilSplashList.shtml')) {
                        document.title = '[ADYEN DNA] ' + document.title;
                    } else {
                        document.title = '[ADYEN] ' + document.title;
                    }
                }
                return;
            }
        }

        chrome.storage.local.get({ fennecActiveSession: null }, ({ fennecActiveSession }) => {
            if (fennecActiveSession) {
                sessionStorage.setItem('fennecSessionId', fennecActiveSession);
            }
            getFennecSessionId();
        });

        try {
            // Always tag ADYEN tabs when in review mode
            const path = window.location.pathname;
            console.log('[FENNEC (MVP)] ADYEN: Tab tagging check:', {
                fennecReviewMode,
                path,
                isDnaPage: path.includes('showOilSplashList.shtml'),
                currentTitle: document.title
            });
            
            if (fennecReviewMode) {
                if (path.includes('showOilSplashList.shtml')) {
                    document.title = '[ADYEN DNA] ' + document.title;
                    console.log('[FENNEC (MVP)] ADYEN: Tagged as ADYEN DNA');
                } else {
                    document.title = '[ADYEN] ' + document.title;
                    console.log('[FENNEC (MVP)] ADYEN: Tagged as ADYEN');
                }
            } else {
                console.log('[FENNEC (MVP)] ADYEN: Not in review mode, skipping tab tagging');
            }
            
            if (orderParam) {
                sessionStorage.setItem('fennec_order', orderParam);
                console.log('[FENNEC (MVP)] ADYEN: Order parameter found and stored:', orderParam);
            }

            // Fallback: if no order parameter but we have a fraud session, use that
            if (!orderParam && fraudReviewSession && fennecReviewMode) {
                console.log('[FENNEC (MVP)] ADYEN: No order parameter but fraud session found, using fraud session as order:', fraudReviewSession);
                sessionStorage.setItem('fennec_order', fraudReviewSession);
            }
            
            // Determine the order ID for the flow
            const order = orderParam || fraudReviewSession;
            console.log('[FENNEC (MVP)] ADYEN: Final order ID for flow:', order);
            
            // Ensure we proceed with sidebar injection in REVIEW MODE
            console.log('[FENNEC (MVP)] ADYEN: Proceeding with sidebar injection in REVIEW MODE');

            // Store order in session storage for consistency
            if (order) {
                sessionStorage.setItem('fennec_order', order);
            }
            console.log('[FENNEC (MVP)] ADYEN: Order stored in session storage:', order);

            function waitForElement(selector, timeout = 10000) {
                return new Promise(resolve => {
                    const interval = 250;
                    let elapsed = 0;
                    const run = () => {
                        const el = document.querySelector(selector);
                        if (el) {
                            resolve(el);
                        } else if (elapsed >= timeout) {
                            resolve(null);
                        } else {
                            elapsed += interval;
                            setTimeout(run, interval);
                        }
                    };
                    run();
                });
            }

            function fillAndSubmit() {
                console.log('[FENNEC (MVP)] ADYEN: Starting fillAndSubmit with order:', order);
                waitForElement('.header-search__input, input[name="query"]').then(input => {
                    try {
                        if (!input) {
                            console.log('[FENNEC (MVP)] ADYEN: Search input not found');
                            return;
                        }
                        console.log('[FENNEC (MVP)] ADYEN: Found search input, filling with order:', order);
                        input.focus();
                        input.value = order;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        const payments = document.querySelector('input[type="radio"][value="payments"]');
                        if (payments) {
                            console.log('[FENNEC (MVP)] ADYEN: Found payments radio button, clicking');
                            payments.click();
                        }
                        waitForElement('button[type="submit"], input[type="submit"], button[aria-label*="search" i]').then(btn => {
                            if (btn) {
                                console.log('[FENNEC (MVP)] ADYEN: Found submit button, clicking');
                                btn.click();
                            } else {
                                console.log('[FENNEC (MVP)] ADYEN: Submit button not found');
                            }
                        });
                    } catch (err) {
                        console.error('[FENNEC (MVP) Adyen] Error filling form:', err);
                    }
                });
            }

            function openMostRecent() {
                waitForElement('a[href*="showTx.shtml?pspReference="]').then(link => {
                    try {
                        if (link) {
                            link.click();
                        }
                    } catch (err) {
                        console.error('[FENNEC (MVP) Adyen] Error opening result:', err);
                    }
                });
            }

            function saveData(part) {
                chrome.storage.local.get({ adyenDnaInfo: {} }, ({ adyenDnaInfo }) => {
                    const updated = Object.assign({}, adyenDnaInfo, part);
                    sessionSet({ adyenDnaInfo: updated });
                    
                    // Note: ADYEN flow completion is marked later in the DNA page handler
                    // to ensure the entire ADYEN flow (including DNA) is completed
                });
            }

            function buildTransactionTable(tx) {
                if (!tx) return "";
                const colors = {
                    "Total": "lightgray",
                    "Authorised / Settled": "green",
                    "Settled": "green",
                    "Refused": "purple",
                    "Refunded": "black",
                    "Chargebacks": "black",
                    "Chargeback": "black"
                };

                function parseAmount(str) {
                    if (!str) return 0;
                    const n = parseFloat(str.replace(/[^0-9.]/g, ""));
                    return isNaN(n) ? 0 : n;
                }

                const entries = Object.keys(tx).map(k => {
                    const t = tx[k];
                    let label = k;
                    if (label === "Authorised / Settled") label = "Settled";
                    else if (label === "Total transactions") label = "Total";
                    else if (label === "Refunded / Cancelled") label = "Refunded";
                    return { label, count: t.count || "", amount: t.amount || "" };
                });
                if (!entries.length) return "";

                const total = entries.find(e => e.label === "Total") || { amount: 0 };
                const totalVal = parseAmount(total.amount);

                entries.sort((a, b) => (a.label === "Total" ? -1 : b.label === "Total" ? 1 : 0));

                const rows = entries.map(e => {
                    const cls = "copilot-tag-" + (colors[e.label] || "white");
                    const amountVal = parseAmount(e.amount);
                    const pct = totalVal ? Math.round(amountVal / totalVal * 100) : 0;
                    const amount = (e.amount || "").replace("EUR", "€");
                    const pctText = totalVal ? ` (${pct}%)` : "";
                    const label = escapeHtml(e.label.toUpperCase() + ": ");
                    const count = `<span class="dna-count">${escapeHtml(e.count)}</span>`;
                    return `<tr><td><span class="copilot-tag dna-label ${cls}">${label}${count}</span></td><td>${escapeHtml(amount)}${escapeHtml(pctText)}</td></tr>`;
                }).join("");

                return `<table class="dna-tx-table"><thead><tr><th>Type</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>`;
            }

            function renderBillingAddress(addr) {
                if (!addr) return '<span style="color:#aaa">-</span>';
                let line1 = '';
                let line2 = '';
                if (typeof addr === 'object') {
                    const p1 = [];
                    if (addr.street1) p1.push(addr.street1.trim());
                    if (addr.street2) p1.push(addr.street2.trim());
                    line1 = p1.join(' ');

                    const p2 = [];
                    if (addr.city) p2.push(addr.city.trim());
                    if (addr.state) p2.push(addr.state.trim());
                    if (addr.zip) p2.push(addr.zip.trim());
                    if (addr.country) p2.push(addr.country.trim());
                    line2 = p2.join(', ');
                    addr = [line1, line2].filter(Boolean).join(', ');
                } else {
                    const parts = String(addr).split(/,\s*/);
                    line1 = parts.shift() || '';
                    line2 = parts.join(', ');
                }

                const lines = [];
                if (line1) lines.push(escapeHtml(line1));
                if (line2) lines.push(escapeHtml(line2));
                const esc = escapeHtml(addr);
                return `<span class="address-wrapper"><a href="#" class="copilot-address" data-address="${esc}">${lines.join('<br>')}</a><span class="copilot-usps" data-address="${esc}" title="USPS Lookup"> ✉️</span><span class="copilot-copy-icon" data-copy="${esc}" title="Copy">⧉</span></span>`;
            }

            function buildCardMatchTag(info) {
                const card = info.payment.card || {};
                const db = info.dbBilling || {};
                const nameMatch = db.cardholder && card["Card holder"] && db.cardholder.trim().toUpperCase() === card["Card holder"].trim().toUpperCase();
                const last4Match = db.last4 && card["Card number"] && db.last4.replace(/\D+/g, '').slice(-4) === card["Card number"].replace(/\D+/g, '').slice(-4);
                const expMatch = db.expiry && card["Expiry date"] && db.expiry.replace(/\D+/g, '').slice(0,4) === card["Expiry date"].replace(/\D+/g, '').slice(0,4);
                let compared = 0;
                let matches = 0;
                const mism = [];
                if (db.cardholder && card["Card holder"]) { compared++; if (nameMatch) matches++; else mism.push('NAME ✖️'); }
                if (db.last4 && card["Card number"]) { compared++; if (last4Match) matches++; else mism.push('LAST 4 ✖️'); }
                if (db.expiry && card["Expiry date"]) { compared++; if (expMatch) matches++; else mism.push('EXP DATE ✖️'); }
                if (!compared) return '';
                let text = '';
                let cls = 'copilot-tag copilot-tag-green';
                if (matches === compared) {
                    text = 'DB: MATCH';
                } else if (matches === 0) {
                    text = 'DB: NO MATCH';
                    cls = 'copilot-tag copilot-tag-purple';
                } else {
                    text = 'DB: PARTIAL (' + mism.join(' ') + ')';
                    cls = 'copilot-tag copilot-tag-purple';
                }
                return `<span class="${cls}">${escapeHtml(text)}</span>`;
            }

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
                        return { label: 'CVV: MATCH', result: 'green', reason: text };
                    }
                    if (/not\s+match/.test(t) || /\(n\)/.test(t)) {
                        return { label: 'CVV: NO MATCH', result: 'purple', reason: text };
                    }
                    if (/not provided|not checked|error|not supplied|unknown/.test(t)) {
                        return { label: 'CVV: UNKNOWN', result: 'black', reason: text };
                    }
                    return { label: 'CVV: UNKNOWN', result: 'black', reason: text };
                }

                function formatAvs(text) {
                    const t = (text || '').toLowerCase();
                    if (/both\s+postal\s+code\s+and\s+address\s+match/.test(t) || /^7\b/.test(t) || t.includes('both match')) {
                        return { label: 'AVS: MATCH', result: 'green', reason: text };
                    }
                    if (/^6\b/.test(t) || (t.includes('postal code matches') && t.includes("address doesn't"))) {
                        return { label: 'AVS: PARTIAL (STREET✖️)', result: 'purple', reason: text };
                    }
                    if (/^1\b/.test(t) || (t.includes('address matches') && t.includes("postal code doesn't"))) {
                        return { label: 'AVS: PARTIAL (ZIP✖️)', result: 'purple', reason: text };
                    }
                    if (/^2\b/.test(t) || t.includes('neither matches') || /\bw\b/.test(t)) {
                        return { label: 'AVS: NO MATCH', result: 'purple', reason: text };
                    }
                    if (/^0\b/.test(t) || /^3\b/.test(t) || /^4\b/.test(t) || /^5\b/.test(t) || t.includes('unavailable') || t.includes('not supported') || t.includes('no avs') || t.includes('unknown')) {
                        return { label: 'AVS: UNKNOWN', result: 'black', reason: text };
                    }
                    return { label: 'AVS: UNKNOWN', result: 'black', reason: text };
                }

                if (cvv || avs) {
                    const tags = [];
                    if (cvv) {
                        const { label, result, reason } = formatCvv(cvv);
                        tags.push(`<span class="copilot-tag ${colorFor(result)}" title="${escapeHtml(reason)}">${escapeHtml(label)}</span>`);
                    }
                    if (avs) {
                        const { label, result, reason } = formatAvs(avs);
                        tags.push(`<span class="copilot-tag ${colorFor(result)}" title="${escapeHtml(reason)}">${escapeHtml(label)}</span>`);
                    }
                    const cardTag = buildCardMatchTag(info);
                    if (cardTag) tags.push(cardTag);
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

            const insertDnaAfterCompany = window.insertDnaAfterCompany;

            function loadDnaSummary(cb) {
                const container = document.getElementById('dna-summary');
                if (!container) { if (typeof cb === 'function') cb(); return; }
                chrome.storage.local.get({ adyenDnaInfo: null }, ({ adyenDnaInfo }) => {
                    chrome.storage.local.get({ sidebarOrderInfo: null }, ({ sidebarOrderInfo }) => {
                        if (adyenDnaInfo) adyenDnaInfo.dbBilling = sidebarOrderInfo ? sidebarOrderInfo.billing : null;
                        const html = buildDnaHtml(adyenDnaInfo);
                        container.innerHTML = html || '';
                        attachCommonListeners(container);
                        if (isDnaPage) storeSidebarSnapshot(document.getElementById('copilot-sidebar'));
                        insertDnaAfterCompany();
                        if (typeof applyStandardSectionOrder === 'function') {
                            applyStandardSectionOrder(document.getElementById('db-summary-section'));
                        }
                        if (typeof cb === 'function') cb();
                    });
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
                    const ipLine = e.ipValid || e.proxyRisk ? `<div><b>IP Valid:</b> ${escapeHtml(e.ipValid || '')} <b>Proxy:</b> ${escapeHtml(e.proxyRisk || '')}</div>` : '';
                    const addrLine = e.addressToName || e.residentName ? `<div><b>Address to Name:</b> ${escapeHtml(e.addressToName || '')}<br><b>Resident Name:</b> ${escapeHtml(e.residentName || '')}</div>` : '';
                    if (ipLine) parts.push(ipLine);
                    if (addrLine) parts.push(addrLine);
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
                chrome.storage.local.get({ sidebarDb: [], sidebarOrderId: null }, ({ sidebarDb, sidebarOrderId }) => {
                    if (Array.isArray(sidebarDb) && sidebarDb.length) {
                        container.innerHTML = sidebarDb.join('');
                        container.style.display = 'block';
                        attachCommonListeners(container);
                        if (isDnaPage) storeSidebarSnapshot(document.getElementById('copilot-sidebar'));
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

            function formatIssueText(text) {
                if (!text) return '';
                const norm = text.toLowerCase().replace(/\s+/g, ' ').trim();
                if (norm.includes('a clear photo of the card used to pay for the order') &&
                    norm.includes('selfie holding your id')) {
                    return 'ID CONFIRMATION ISSUE';
                }
                let formatted = text.replace(/\s*(\d+\s*[).])/g, (m, g) => '\n' + g + ' ');
                return formatted.replace(/^\n/, '').trim();
            }

            function fillIssueBox(info, orderId) {
                const section = document.getElementById('issue-summary-section');
                const box = document.getElementById('issue-summary-box');
                const content = document.getElementById('issue-summary-content');
                const label = document.getElementById('issue-status-label');
                if (!section || !box || !content || !label) return;
                section.style.display = 'block';
                if (info && info.text) {
                    content.textContent = formatIssueText(info.text);
                    label.textContent = info.active ? 'ACTIVE' : 'RESOLVED';
                    label.className = 'issue-status-label ' + (info.active ? 'issue-status-active' : 'issue-status-resolved');
                } else {
                    const link = orderId ? `<a href="https://db.incfile.com/incfile/order/detail/${orderId}" target="_blank">${orderId}</a>` : '';
                    content.innerHTML = `NO ISSUE DETECTED FROM ORDER: ${link}`;
                    label.textContent = '';
                    label.className = 'issue-status-label';
                }
                if (isDnaPage) storeSidebarSnapshot(document.getElementById('copilot-sidebar'));
            }

            function checkLastIssue(orderId) {
                if (!orderId) return;
                const content = document.getElementById('issue-summary-content');
                const label = document.getElementById('issue-status-label');
                if (content && label) {
                    content.innerHTML = `<img src="${chrome.runtime.getURL('fennec_icon.png')}" class="loading-fennec"/>`;
                    label.textContent = '';
                    label.className = 'issue-status-label';
                }
                bg.send('checkLastIssue', { orderId }, (resp) => {
                    if (chrome.runtime.lastError) {
                        console.warn('[FENNEC (MVP)] Issue check failed:', chrome.runtime.lastError.message);
                        fillIssueBox(null, orderId);
                        return;
                    }
                    fillIssueBox(resp && resp.issueInfo, orderId);
                });
            }

            function showInitialStatus() {
                const db = document.getElementById('db-summary-section');
                const dna = document.getElementById('dna-summary');
                const issueSection = document.getElementById('issue-summary-section');
                if (db) { db.innerHTML = ''; db.style.display = 'none'; }
                if (dna) dna.innerHTML = '';
                if (issueSection) {
                    issueSection.style.display = 'none';
                    const content = issueSection.querySelector('#issue-summary-content');
                    const label = issueSection.querySelector('#issue-status-label');
                    if (content) content.innerHTML = '';
                    if (label) label.textContent = '';
                }
            }

            function clearSidebar() {
                console.log('[FENNEC (MVP) ADYEN SB] Clearing all storage and resetting sidebar to brand new state');
                
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
                    console.log('[FENNEC (MVP) ADYEN SB] Cleared all storage data during sidebar clear');
                });
                
                // Clear any INT STORAGE data
                window.currentIntStorageOrderId = null;
                
                // Reset sidebar to initial state
                showInitialStatus();
                
                console.log('[FENNEC (MVP) ADYEN SB] Sidebar cleared and reset to brand new state');
            }

            function injectSidebar() {
                console.log('[FENNEC (MVP)] ADYEN: Starting sidebar injection');
                if (document.getElementById('copilot-sidebar')) {
                    console.log('[FENNEC (MVP)] ADYEN: Sidebar already exists, skipping injection');
                    return;
                }
                console.log('[FENNEC (MVP)] ADYEN: Creating new sidebar');
                const sbObj = new Sidebar();
                
                sbObj.build(buildStandardizedReviewModeSidebar(true, false));
                sbObj.attach();
                
                // Setup INT STORAGE click handler
                if (order) {
                    setupIntStorageClickHandler(order);
                }
                const sidebar = sbObj.element;
                chrome.storage.sync.get({
                    sidebarFontSize: 13,
                    sidebarFont: "'Inter', sans-serif",
                    sidebarBgColor: '#212121',
                    sidebarBoxColor: '#2e2e2e'
                }, opts => applySidebarDesign(sidebar, opts));
                loadSidebarSnapshot(sidebar, () => {
                    insertDnaAfterCompany();
                    if (typeof applyStandardSectionOrder === 'function') {
                        applyStandardSectionOrder(sidebar.querySelector('#db-summary-section'));
                    }
                });
                document.body.style.marginRight = '340px';
                const qsToggle = sidebar.querySelector('#qs-toggle');
                if (qsToggle) {
                    const initQuickSummary = () => {
                        const box = sidebar.querySelector('#quick-summary');
                        if (!box) return;
                        box.style.maxHeight = '0';
                        box.classList.add('quick-summary-collapsed');
                    };
                    initQuickSummary();
                    qsToggle.addEventListener('click', () => {
                        const box = sidebar.querySelector('#quick-summary');
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
                const closeBtn = sidebar.querySelector('#copilot-close');
                if (closeBtn) {
                    closeBtn.onclick = () => {
                        sidebar.remove();
                        document.body.style.marginRight = '';
                    };
                }
                const clearTabsBtn = sidebar.querySelector('#copilot-clear-tabs');
                if (clearTabsBtn) {
                    clearTabsBtn.onclick = () => {
                        bg.closeOtherTabs();
                    };
                }
                const clearSb = sidebar.querySelector('#copilot-clear');
                if (clearSb) clearSb.onclick = clearSidebar;
                if (order) {
                    loadDbSummary(() => {
                        loadDnaSummary(() => {
                            loadKountSummary(() => {
                                // Only display INT STORAGE if it was already loaded in DB
                                chrome.storage.local.get({ 
                                    intStorageLoaded: false, 
                                    intStorageOrderId: null 
                                }, ({ intStorageLoaded, intStorageOrderId }) => {
                                    if (intStorageLoaded && intStorageOrderId === order && typeof loadIntStorage === 'function') {
                                        loadIntStorage(order);
                                    }
                                });
                                checkLastIssue(order);
                            });
                        });
                    });
                } else {
                    showInitialStatus();
                }
            }
            
            // INT STORAGE loading function for ADYEN launcher
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
                        b.addEventListener('click', () => { const u = b.dataset.url; if (u) openFileInPopup(u); });
                    });
                });
            }

            function extractSection(title) {
                const headings = Array.from(document.querySelectorAll('h3.adl-heading'));
                const heading = headings.find(h => h.textContent.trim() === title);
                if (!heading) return null;
                const card = heading.closest('section');
                if (!card) return null;
                const rows = card.querySelectorAll('.structured-list__item');
                const data = {};
                rows.forEach(r => {
                    const label = r.querySelector('.structured-list__label');
                    const val = r.querySelector('.structured-list__content');
                    if (label && val) {
                        data[label.textContent.trim()] = val.textContent.trim().replace(/\s+/g, ' ');
                    }
                });
                return data;
            }

            function handlePaymentPage() {
                const card = extractSection('Card details') || {};
                if (card['Card number']) {
                    card['Card number'] = card['Card number']
                        .replace(/\D+/g, '')
                        .slice(-4);
                }
                const shopper = extractSection('Shopper details') || {};
                const processing = extractSection('Processing') || {};
                saveData({ payment: { card, shopper, processing } });
            }

            function openDna() {
                waitForElement('a[href*="showOilSplashList.shtml"]').then(link => {
                    try {
                        if (link) {
                            window.open(link.href, '_blank');
                            sessionStorage.removeItem('fennec_order');
                        }
                    } catch (err) {
                        console.error('[FENNEC (MVP) Adyen] Error opening DNA:', err);
                    }
                });
            }

            function handleDnaPage() {
                // Stay on DNA until widgets are rendered and data is saved
                const waitForDnaReady = (timeoutMs = 45000) => new Promise(resolve => {
                    const start = Date.now();
                    const tick = () => {
                        const hasStats = document.querySelectorAll('.stats-bar-item').length > 0;
                        const hasBreakdown = document.querySelector('.data-breakdown .item');
                        if (hasStats && hasBreakdown) return resolve(true);
                        if (Date.now() - start >= timeoutMs) return resolve(true); // proceed best-effort
                        setTimeout(tick, 500);
                    };
                    tick();
                });

                waitForDnaReady().then(() => {
                    const stats = {};
                    document.querySelectorAll('.stats-bar-item').forEach(item => {
                        const label = item.querySelector('.stats-bar-item__label');
                        if (!label) return;
                        const count = item.querySelector('.stats-bar-item__text');
                        const amount = item.querySelector('.stats-bar-item__subtext');
                        stats[label.textContent.trim()] = {
                            count: count ? count.textContent.trim() : '',
                            amount: amount ? amount.textContent.trim() : ''
                        };
                    });

                    const extractNetworkTransactions = () => {
                        const netHeading = Array.from(document.querySelectorAll('.adl-heading'))
                            .find(h => h.textContent.trim() === 'Network');
                        if (!netHeading || !netHeading.parentElement) return null;
                        const txHeading = Array.from(netHeading.parentElement.querySelectorAll('.adl-heading'))
                            .find(h => h.textContent.trim() === 'Transactions');
                        if (!txHeading || !txHeading.parentElement) return null;
                        const data = {};
                        txHeading.parentElement.querySelectorAll('.item').forEach(item => {
                            const labelEl = item.querySelector('.u-display-flex div:first-child');
                            const amountEl = item.querySelector('.u-display-flex div:last-child');
                            const countEl = item.querySelector('.status');
                            if (labelEl) {
                                data[labelEl.textContent.trim()] = {
                                    count: countEl ? countEl.textContent.trim() : '',
                                    amount: amountEl ? amountEl.textContent.trim() : ''
                                };
                            }
                        });
                        return data;
                    };

                    const networkTx = extractNetworkTransactions();
                    const stamp = Date.now();
                    saveData({ transactions: stats, networkTransactions: networkTx, updated: stamp });

                    // Wait for storage to reflect the updated stamp to ensure injection consumers can read it
                    const confirmSaved = new Promise(resolve => {
                        let tries = 0;
                        const check = () => {
                            chrome.storage.local.get({ adyenDnaInfo: null }, ({ adyenDnaInfo }) => {
                                if (adyenDnaInfo && adyenDnaInfo.updated && adyenDnaInfo.updated >= stamp) return resolve(true);
                                if (++tries >= 40) return resolve(true);
                                setTimeout(check, 250);
                            });
                        };
                        check();
                    });

                    confirmSaved.then(() => {
                        const order = sessionStorage.getItem('fennec_order');
                        if (order) {
                            const adyenFlowKey = `fennecAdyenFlowCompleted_${order}`;
                            localStorage.setItem(adyenFlowKey, '1');
                            // Only refocus when both flows are completed
                            const kountFlowKey = `fennecKountFlowCompleted_${order}`;
                            const bothDone = !!localStorage.getItem(kountFlowKey);
                            if (bothDone) {
                                localStorage.setItem('fraudXrayFinished', '1');
                                sessionSet({ fraudXrayFinished: '1' });
                                sessionStorage.setItem('fennecShowTrialFloater', '1');
                                chrome.storage.local.set({ fennecReturnTab: null }, () => {
                                    bg.refocusTab();
                                });
                            }
                        }
                    });
                });
            }

            // Always tag ADYEN tabs when in review mode
            if (fennecReviewMode) {
                if (path.includes('showOilSplashList.shtml')) {
                    document.title = '[ADYEN DNA] ' + document.title;
                } else {
                    document.title = '[ADYEN] ' + document.title;
                }
            }
            const isDnaPage = path.includes('showOilSplashList.shtml');
            const ready = document.readyState === 'loading' ? 'DOMContentLoaded' : null;
            console.log('[FENNEC (MVP)] ADYEN: Sidebar injection timing:', {
                ready,
                documentReadyState: document.readyState,
                willWaitForDOM: ready === 'DOMContentLoaded',
                order,
                fennecReviewMode,
                isFlowTriggered,
                isManualOpen
            });
            
            if (ready) {
                console.log('[FENNEC (MVP)] ADYEN: Waiting for DOMContentLoaded to inject sidebar');
                document.addEventListener('DOMContentLoaded', injectSidebar);
            } else {
                console.log('[FENNEC (MVP)] ADYEN: DOM ready, injecting sidebar immediately');
                injectSidebar();
            }

            console.log('[FENNEC (MVP)] ADYEN: Flow execution check:', {
                order,
                path: window.location.pathname,
                ready,
                isOverviewPage: path.includes('/overview/default.shtml'),
                isPaymentsPage: path.includes('/payments/showList.shtml'),
                isShowTxPage: path.includes('/accounts/showTx.shtml'),
                isDnaPage: path.includes('showOilSplashList.shtml')
            });
            
            if (order && path.includes('/overview/default.shtml')) {
                console.log('[FENNEC (MVP)] ADYEN: Executing fillAndSubmit for overview page');
                if (ready) {
                    document.addEventListener('DOMContentLoaded', fillAndSubmit);
                } else {
                    fillAndSubmit();
                }
            } else if (order && path.includes('/payments/showList.shtml')) {
                console.log('[FENNEC (MVP)] ADYEN: Executing openMostRecent for payments page');
                if (ready) {
                    document.addEventListener('DOMContentLoaded', openMostRecent);
                } else {
                    openMostRecent();
                }
            } else if (path.includes('/accounts/showTx.shtml')) {
                console.log('[FENNEC (MVP)] ADYEN: Executing payment page handler');
                const run = () => {
                    Promise.all([
                        waitForElement('h3.adl-heading'),
                        waitForElement('a[href*="showOilSplashList.shtml"]')
                    ]).then(() => {
                        handlePaymentPage();
                        openDna();
                    });
                };
                if (ready) {
                    document.addEventListener('DOMContentLoaded', run);
                } else {
                    run();
                }
            } else if (path.includes('showOilSplashList.shtml')) {
                console.log('[FENNEC (MVP)] ADYEN: Executing DNA page handler');
                if (ready) {
                    document.addEventListener('DOMContentLoaded', handleDnaPage);
                } else {
                    handleDnaPage();
                }
            } else {
                console.log('[FENNEC (MVP)] ADYEN: No matching page type found for flow execution');
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
                        
                        // Ensure company box listeners are properly attached
                        if (typeof ensureCompanyBoxListeners === 'function') {
                            console.log('[FENNEC (MVP) ADYEN SB] Ensuring company box listeners are attached');
                            ensureCompanyBoxListeners();
                        }
                    }
                }
            });
        } catch (e) {
            console.error('[FENNEC (MVP) Adyen] Launcher error:', e);
        }
    });
    }
}

new AdyenLauncher().init();
