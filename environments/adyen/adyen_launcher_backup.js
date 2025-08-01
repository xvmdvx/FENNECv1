// Auto-navigates to the DNA page and collects payment/transaction info when an
// order number is provided via ?fennec_order= in the URL or session storage.
class AdyenLauncher extends Launcher {
    init() {
    if (window.top !== window) return;
    const bg = fennecMessenger;
    
    // Check if extension is enabled and get review mode status
    chrome.storage.local.get({ extensionEnabled: true, fennecReviewMode: false }, ({ extensionEnabled, fennecReviewMode }) => {
        if (!extensionEnabled) {
            console.log('[FENNEC (POO)] Extension disabled, skipping Adyen launcher.');
            return;
        }

        // Check if this is a flow-triggered open or manual open
        const params = new URLSearchParams(window.location.search);
        const orderParam = params.get('fennec_order');
        const isFlowTriggered = orderParam && fennecReviewMode;
        const isManualOpen = !orderParam;
        
        // If not in review mode and not manually opened, don't initialize
        if (!fennecReviewMode && !isManualOpen) {
            console.log('[FENNEC (POO)] Adyen opened outside review mode and not manually opened, skipping initialization.');
            return;
        }
        
        // If manually opened in review mode, don't inject sidebar (just open tab)
        if (isManualOpen && fennecReviewMode) {
            console.log('[FENNEC (POO)] Adyen manually opened in review mode, tab only (no sidebar).');
            return;
        }
        
        // If flow-triggered, check if flow is already completed
        if (isFlowTriggered) {
            const flowKey = `fennecAdyenFlowCompleted_${orderParam}`;
            if (localStorage.getItem(flowKey)) {
                console.log('[FENNEC (POO)] Adyen flow already completed, skipping initialization.');
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
            if (orderParam) {
                sessionStorage.setItem('fennec_order', orderParam);
            }

            const order = sessionStorage.getItem('fennec_order');

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
                waitForElement('.header-search__input, input[name="query"]').then(input => {
                    try {
                        if (!input) return;
                        input.focus();
                        input.value = order;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        const payments = document.querySelector('input[type="radio"][value="payments"]');
                        if (payments) payments.click();
                        waitForElement('button[type="submit"], input[type="submit"], button[aria-label*="search" i]').then(btn => {
                            if (btn) btn.click();
                        });
                    } catch (err) {
                        console.error('[FENNEC (POO) Adyen] Error filling form:', err);
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
                        console.error('[FENNEC (POO) Adyen] Error opening result:', err);
                    }
                });
            }

            function saveData(part) {
                chrome.storage.local.get({ adyenDnaInfo: {} }, ({ adyenDnaInfo }) => {
                    const updated = Object.assign({}, adyenDnaInfo, part);
                    sessionSet({ adyenDnaInfo: updated });
                    
                    // Mark ADYEN flow as completed if this is a flow-triggered session
                    const order = sessionStorage.getItem('fennec_order');
                    if (order) {
                        const flowKey = `fennecAdyenFlowCompleted_${order}`;
                        localStorage.setItem(flowKey, '1');
                        console.log('[FENNEC (POO)] ADYEN flow completed for order:', order);
                    }
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
                const box = document.getElementById('issue-summary-box');
                const content = document.getElementById('issue-summary-content');
                const label = document.getElementById('issue-status-label');
                if (!box || !content || !label) return;
                box.style.display = 'block';
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
                        console.warn('[FENNEC (POO)] Issue check failed:', chrome.runtime.lastError.message);
                        fillIssueBox(null, orderId);
                        return;
                    }
                    fillIssueBox(resp && resp.issueInfo, orderId);
                });
            }

            function showInitialStatus() {
                const db = document.getElementById('db-summary-section');
                const dna = document.getElementById('dna-summary');
                const issueBox = document.getElementById('issue-summary-box');
                if (db) { db.innerHTML = ''; db.style.display = 'none'; }
                if (dna) dna.innerHTML = '';
                if (issueBox) {
                    issueBox.style.display = 'none';
                    const content = issueBox.querySelector('#issue-summary-content');
                    const label = issueBox.querySelector('#issue-status-label');
                    if (content) content.innerHTML = '';
                    if (label) label.textContent = '';
                }
            }

            function clearSidebar() {
                sessionSet({
                    sidebarDb: [],
                    sidebarOrderId: null,
                    sidebarOrderInfo: null,
                    adyenDnaInfo: null,
                    sidebarFreezeId: null,
                    sidebarSnapshot: null
                });
                showInitialStatus();
            }

            function injectSidebar() {
                if (document.getElementById('copilot-sidebar')) return;
                const sbObj = new Sidebar();
                sbObj.build(`
                    ${buildSidebarHeader()}
                    <div class="order-summary-header">ORDER SUMMARY <span id="qs-toggle" class="quick-summary-toggle">⚡</span></div>
                    <div class="copilot-body">
                        <div class="copilot-dna">
                            <div id="dna-summary" style="margin-top:16px"></div>
                            <div id="kount-summary" style="margin-top:10px"></div>
                        </div>
                        <div id="db-summary-section"></div>
                        <div class="issue-summary-box" id="issue-summary-box" style="display:none; margin-top:10px;">
                            <strong>ISSUE <span id="issue-status-label" class="issue-status-label"></span></strong><br>
                            <div id="issue-summary-content" style="color:#ccc; font-size:13px; white-space:pre-line;">No issue data yet.</div>
                        </div>
                        <div class="copilot-footer"><button id="copilot-clear" class="copilot-button">🧹 CLEAR</button></div>
                    </div>`);
                sbObj.attach();
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
                                checkLastIssue(order);
                            });
                        });
                    }
                } else {
                    showInitialStatus();
                }
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
                        console.error('[FENNEC (POO) Adyen] Error opening DNA:', err);
                    }
                });
            }

            function handleDnaPage() {
                // Large DNA pages can take a while to render all stats,
                // so allow a longer wait time before giving up.
                waitForElement('.data-breakdown .item', 30000).then(() => {
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

                    function extractNetworkTransactions() {
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
                    }

                    const networkTx = extractNetworkTransactions();
                    saveData({ transactions: stats, networkTransactions: networkTx, updated: Date.now() });
                    
                    // Mark ADYEN flow as completed
                    const order = sessionStorage.getItem('fennec_order');
                    if (order) {
                        const adyenFlowKey = `fennecAdyenFlowCompleted_${order}`;
                        localStorage.setItem(adyenFlowKey, '1');
                        console.log('[FENNEC (POO)] ADYEN flow completed for order:', order);
                        
                        // Check if KOUNT flow is also completed to mark overall XRAY as finished
                        const kountFlowKey = `fennecKountFlowCompleted_${order}`;
                        if (localStorage.getItem(kountFlowKey)) {
                            // Both flows are complete, mark XRAY as finished
                            localStorage.setItem('fraudXrayFinished', '1');
                            sessionSet({ fraudXrayFinished: '1' });
                            console.log('[FENNEC (POO)] Both ADYEN and KOUNT flows completed, marking XRAY as finished for order:', order);
                        }
                    }
                    
                    chrome.storage.local.get({ sidebarOrderInfo: null }, ({ sidebarOrderInfo }) => {
                        const email = sidebarOrderInfo ? sidebarOrderInfo.clientEmail : null;
                        bg.send('focusDbSearch', { email });
                    });
                });
            }

            const path = window.location.pathname;
            if (path.includes('showOilSplashList.shtml')) {
                document.title = '[ADYEN DNA] ' + document.title;
            } else {
                document.title = '[ADYEN] ' + document.title;
            }
            const isDnaPage = path.includes('showOilSplashList.shtml');
            const ready = document.readyState === 'loading' ? 'DOMContentLoaded' : null;
            if (ready) {
                document.addEventListener('DOMContentLoaded', injectSidebar);
            } else {
                injectSidebar();
            }

            if (order && path.includes('/overview/default.shtml')) {
                if (ready) {
                    document.addEventListener('DOMContentLoaded', fillAndSubmit);
                } else {
                    fillAndSubmit();
                }
            } else if (order && path.includes('/payments/showList.shtml')) {
                if (ready) {
                    document.addEventListener('DOMContentLoaded', openMostRecent);
                } else {
                    openMostRecent();
                }
            } else if (path.includes('/accounts/showTx.shtml')) {
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
                if (ready) {
                    document.addEventListener('DOMContentLoaded', handleDnaPage);
                } else {
                    handleDnaPage();
                }
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
            console.error('[FENNEC (POO) Adyen] Launcher error:', e);
        }
    });
    }
}

new AdyenLauncher().init();
