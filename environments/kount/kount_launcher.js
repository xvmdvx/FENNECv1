class KountLauncher extends Launcher {
    init() {
    if (window.top !== window) return;
    const bg = fennecMessenger;
    
    // Check if extension is enabled and get review mode status
    chrome.storage.local.get({ extensionEnabled: true, fennecReviewMode: false, fennecActiveSession: null }, ({ extensionEnabled, fennecReviewMode, fennecActiveSession }) => {
        if (!extensionEnabled) return;
        
        // Check if this is a flow-triggered open or manual open
        const params = new URLSearchParams(window.location.search);
        const orderParam = params.get('fennec_order');
        const isFlowTriggered = orderParam && fennecReviewMode;
        const isManualOpen = !orderParam;
        
        // If not in review mode and not manually opened, don't initialize
        if (!fennecReviewMode && !isManualOpen) {
            console.log('[FENNEC (POO)] Kount opened outside review mode and not manually opened, skipping initialization.');
            return;
        }
        
        // If manually opened in review mode, don't inject sidebar (just open tab)
        if (isManualOpen && fennecReviewMode) {
            console.log('[FENNEC (POO)] Kount manually opened in review mode, tab only (no sidebar).');
            return;
        }
        
        // If flow-triggered, check if flow is already completed
        if (isFlowTriggered) {
            const flowKey = `fennecKountFlowCompleted_${orderParam}`;
            if (localStorage.getItem(flowKey)) {
                console.log('[FENNEC (POO)] Kount flow already completed, skipping initialization.');
                return;
            }
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
            sb.build(`
                ${buildSidebarHeader()}
                <div class="order-summary-header">ORDER SUMMARY <span id="qs-toggle" class="quick-summary-toggle">⚡</span></div>
                <div class="copilot-body" id="copilot-body-content">
                    <div id="db-summary-section"></div>
                    <div class="copilot-dna">
                        <div id="dna-summary" style="margin-top:16px"></div>
                        <div id="kount-summary" style="margin-top:10px"></div>
                    </div>
                    <div class="issue-summary-box" id="issue-summary-box" style="display:none; margin-top:10px;">
                        <strong>ISSUE <span id="issue-status-label" class="issue-status-label"></span></strong><br>
                        <div id="issue-summary-content" style="color:#ccc; font-size:13px; white-space:pre-line;">No issue data yet.</div>
                    </div>
                    <div id="review-mode-label" class="review-mode-label" style="display:none; margin-top:4px; text-align:center; font-size:11px;">REVIEW MODE</div>
                    <div class="copilot-footer"><button id="copilot-clear" class="copilot-button">🧹 CLEAR</button></div>
                </div>`);
            sb.attach();
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
                        loadKountSummary(updateReviewDisplay);
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
                sb.element.querySelector('#db-summary-section').innerHTML = '';
                sb.element.querySelector('#dna-summary').innerHTML = '';
                sb.element.querySelector('#kount-summary').innerHTML = '';
                sessionSet({ sidebarDb: [], adyenDnaInfo: null, kountInfo: null });
            };
        }
        try {
            function saveData(part) {
                chrome.storage.local.get({ kountInfo: {} }, ({ kountInfo }) => {
                    const updated = Object.assign({}, kountInfo, part);
                    sessionSet({ kountInfo: updated });
                    
                    // Mark KOUNT flow as completed if this is a flow-triggered session
                    const order = sessionStorage.getItem('fennec_order');
                    if (order) {
                        const flowKey = `fennecKountFlowCompleted_${order}`;
                        localStorage.setItem(flowKey, '1');
                        console.log('[FENNEC (POO)] KOUNT flow completed for order:', order);
                    }
                });
            }

            const path = window.location.pathname;
            if (path.includes('/workflow/ekata')) {
                document.title = '[EKATA] ' + document.title;
            } else {
                document.title = '[KOUNT] ' + document.title;
            }
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

            if (path.includes('/workflow/detail')) {
                const run = () => {
                    const emailAgeEl = document.querySelector('span[title*="email address was first seen"]');
                    const emailAge = emailAgeEl ? emailAgeEl.textContent.trim() : '';
                    const locEl = document.querySelector('th[title="Device Location"] + td span');
                    const deviceLocation = locEl ? locEl.textContent.trim() : '';
                    const ipEl = document.querySelector('th[title*="IP Address"] + td');
                    const ip = ipEl ? ipEl.textContent.trim() : '';

                    const vipBtn = Array.from(document.querySelectorAll('a,button'))
                        .find(el => /VIP Lists/i.test(el.textContent));
                    if (vipBtn) vipBtn.click();
                    setTimeout(() => {
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

                        saveData({ emailAge, deviceLocation, ip, declines, linked });

                        const ekataLink = document.querySelector('a[href*="/workflow/ekata"]');
                        if (ekataLink) {
                            const url = ekataLink.href.startsWith('http') ? ekataLink.href : location.origin + ekataLink.getAttribute('href');
                            bg.openOrReuseTab({ url, active: true });
                        }
                    }, 500);
                };
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', run);
                } else run();
            } else if (path.includes('/workflow/ekata')) {
                const run = () => {
                    const link = Array.from(document.querySelectorAll('a.link'))
                        .find(a => /Generate Ekata Report/i.test(a.textContent));
                    if (link) {
                        link.click();
                        return;
                    }
                    const btn = document.querySelector('input.simple-submit[value="Update Report"]');
                    if (btn && !sessionStorage.getItem('fennecEkataUpdateClicked')) {
                        sessionStorage.setItem('fennecEkataUpdateClicked', '1');
                        btn.click();
                        return;
                    }
                    setTimeout(() => {
                        const ipValid = findVal('Is Valid');
                        const proxyRisk = findVal('Proxy Risk');
                        const addressToName = findVal('Address to Name');
                        const residentName = findVal('Resident Name');
                        saveData({ ekata: { ipValid, proxyRisk, addressToName, residentName } });
                        // Do not mark XRAY as finished yet. The Adyen step will
                        // trigger the Trial floater once all data is collected.
                        sessionStorage.removeItem('fennecEkataUpdateClicked');
                        chrome.storage.local.get({ fennecFraudAdyen: null }, ({ fennecFraudAdyen }) => {
                            if (fennecFraudAdyen) {
                                chrome.storage.local.remove('fennecFraudAdyen');
                                bg.openOrReuseTab({ url: fennecFraudAdyen, active: true });
                            } else {
                                bg.refocusTab();
                            }
                        });
                    }, 1500);
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
            console.error('[FENNEC (POO) Kount] Launcher error:', e);
        }
    });
    }
}

new KountLauncher().init();
