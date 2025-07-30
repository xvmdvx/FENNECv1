class KountLauncher extends Launcher {
    init() {
    if (window.top !== window) return;
    const bg = fennecMessenger;
    
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
        
        console.log('[FENNEC (POO)] KOUNT flow detection:', { 
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
            console.log('[FENNEC (POO)] Kount opened outside review mode and not manually opened, skipping initialization.');
            return;
        }
        
        // If manually opened in review mode, don't inject sidebar (just open tab)
        if (isManualOpen && fennecReviewMode) {
            console.log('[FENNEC (POO)] Kount manually opened in review mode, tab only (no sidebar).');
            return;
        }
        
        console.log('[FENNEC (POO)] KOUNT initialization proceeding - will inject sidebar and run flow');
        
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
                console.log('[FENNEC (POO)] Both ADYEN and KOUNT flows already completed, skipping initialization.');
                return;
            }
            
            // If only KOUNT is completed but ADYEN is not, clear the KOUNT flag to restart
            if (kountCompleted && !adyenCompleted) {
                console.log('[FENNEC (POO)] KOUNT completed but ADYEN not completed, clearing KOUNT flag to restart flow.');
                localStorage.removeItem(flowKey);
            }
            
            console.log('[FENNEC (POO)] Flow status:', { 
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
            
            sb.build(buildStandardizedReviewModeSidebar(true, false));
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
                sb.element.querySelector('#db-summary-section').innerHTML = '';
                sb.element.querySelector('#dna-summary').innerHTML = '';
                sb.element.querySelector('#kount-summary').innerHTML = '';
                sessionSet({ sidebarDb: [], adyenDnaInfo: null, kountInfo: null });
            };
        }
        
        // INT STORAGE loading function for KOUNT launcher
        function loadIntStorage(orderId) {
            if (!orderId) return;
            const setLoading = () => {
                const section = document.getElementById('int-storage-section');
                const box = document.getElementById('int-storage-box');
                if (section) section.style.display = 'block';
                if (box) box.innerHTML = '<div style="text-align:center;color:#aaa">Loading...</div>';
            };
            setLoading();
            console.log('[FENNEC (POO)] Requesting INT STORAGE for', orderId);
            bg.send('fetchIntStorage', { orderId }, resp => {
                const box = document.getElementById('int-storage-box');
                if (!box) return;
                const files = resp && Array.isArray(resp.files) ? resp.files : null;
                if (!files) {
                    console.warn('[FENNEC (POO)] INT STORAGE load failed', resp);
                    box.innerHTML = '<div style="text-align:center;color:#aaa">Failed to load</div>';
                    return;
                }
                console.log('[FENNEC (POO)] INT STORAGE loaded', files.length);
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
                            console.log('[FENNEC (POO)] KOUNT flow completed for order:', order);
                            
                            // Check if ADYEN flow is also completed to mark overall XRAY as finished
                            const adyenFlowKey = `fennecAdyenFlowCompleted_${order}`;
                            if (localStorage.getItem(adyenFlowKey)) {
                                // Both flows are complete, mark XRAY as finished
                                localStorage.setItem('fraudXrayFinished', '1');
                                sessionSet({ fraudXrayFinished: '1' });
                                console.log('[FENNEC (POO)] Both ADYEN and KOUNT flows completed, marking XRAY as finished for order:', order);
                            }
                        }
                    });
                });
            }

            const path = window.location.pathname;
            if (path.includes('/workflow/ekata') || path.includes('/workflow/ekata.html')) {
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
                    console.log('[FENNEC (POO)] On KOUNT workflow detail page, extracting data...');
                    
                    const emailAgeEl = document.querySelector('span[title*="email address was first seen"]');
                    const emailAge = emailAgeEl ? emailAgeEl.textContent.trim() : '';
                    const locEl = document.querySelector('th[title="Device Location"] + td span');
                    const deviceLocation = locEl ? locEl.textContent.trim() : '';
                    const ipEl = document.querySelector('th[title*="IP Address"] + td');
                    const ip = ipEl ? ipEl.textContent.trim() : '';

                    console.log('[FENNEC (POO)] Basic KOUNT data extracted:', { emailAge, deviceLocation, ip });

                    const vipBtn = Array.from(document.querySelectorAll('a,button'))
                        .find(el => /VIP Lists/i.test(el.textContent));
                    if (vipBtn) {
                        console.log('[FENNEC (POO)] Found VIP Lists button, clicking...');
                        vipBtn.click();
                    } else {
                        console.warn('[FENNEC (POO)] VIP Lists button not found');
                    }
                    
                    setTimeout(() => {
                        console.log('[FENNEC (POO)] Extracting VIP declines and linked data...');
                        
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

                        console.log('[FENNEC (POO)] KOUNT data extracted:', { declines, linked });
                        saveData({ emailAge, deviceLocation, ip, declines, linked });

                        const ekataLink = document.querySelector('a[href*="/workflow/ekata"]');
                        if (ekataLink) {
                            console.log('[FENNEC (POO)] Found EKATA link, navigating to:', ekataLink.href);
                            const url = ekataLink.href.startsWith('http') ? ekataLink.href : location.origin + ekataLink.getAttribute('href');
                            bg.openOrReuseTab({ url, active: true });
                        } else {
                            console.warn('[FENNEC (POO)] EKATA link not found, trying alternative selectors...');
                            // Try alternative selectors for EKATA link
                            const alternativeLinks = [
                                'a[href*="ekata"]',
                                'a[href*="Ekata"]',
                                'a[href*="EKATA"]',
                                'a[href*="/workflow/ekata.html"]',
                                'a[href*="/workflow/ekata"]',
                                'a:contains("Ekata")',
                                'a:contains("EKATA")'
                            ];
                            
                            for (const selector of alternativeLinks) {
                                const link = document.querySelector(selector);
                                if (link) {
                                    console.log('[FENNEC (POO)] Found EKATA link with alternative selector:', selector);
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
                                console.log('[FENNEC (POO)] Found EKATA link by text content:', ekataTextLink.textContent);
                                const url = ekataTextLink.href.startsWith('http') ? ekataTextLink.href : location.origin + ekataTextLink.getAttribute('href');
                                bg.openOrReuseTab({ url, active: true });
                            } else {
                                console.error('[FENNEC (POO)] EKATA link not found with any method');
                            }
                        }
                    }, 500);
                };
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', run);
                } else run();
            } else if (path.includes('/workflow/ekata') || path.includes('/workflow/ekata.html')) {
                const run = () => {
                    console.log('[FENNEC (POO)] On EKATA page, looking for report generation...');
                    
                    const link = Array.from(document.querySelectorAll('a.link'))
                        .find(a => /Generate Ekata Report/i.test(a.textContent));
                    if (link) {
                        console.log('[FENNEC (POO)] Found Generate Ekata Report link, clicking...');
                        link.click();
                        return;
                    }
                    
                    const btn = document.querySelector('input.simple-submit[value="Update Report"]');
                    if (btn && !sessionStorage.getItem('fennecEkataUpdateClicked')) {
                        console.log('[FENNEC (POO)] Found Update Report button, clicking...');
                        sessionStorage.setItem('fennecEkataUpdateClicked', '1');
                        btn.click();
                        return;
                    }
                    
                    // Wait a bit longer for the report to be generated/updated
                    setTimeout(() => {
                        console.log('[FENNEC (POO)] Extracting EKATA data...');
                        const ipValid = findVal('Is Valid');
                        const proxyRisk = findVal('Proxy Risk');
                        const addressToName = findVal('Address to Name');
                        const residentName = findVal('Resident Name');
                        
                        console.log('[FENNEC (POO)] EKATA data extracted:', { ipValid, proxyRisk, addressToName, residentName });
                        saveData({ ekata: { ipValid, proxyRisk, addressToName, residentName } });
                        
                        // Do not mark XRAY as finished yet. The Adyen step will
                        // trigger the Trial floater once all data is collected.
                        sessionStorage.removeItem('fennecEkataUpdateClicked');
                        
                        console.log('[FENNEC (POO)] EKATA completed, navigating to ADYEN...');
                        chrome.storage.local.get({ fennecFraudAdyen: null, fraudReviewSession: null }, ({ fennecFraudAdyen, fraudReviewSession }) => {
                            if (fennecFraudAdyen) {
                                console.log('[FENNEC (POO)] Opening ADYEN URL:', fennecFraudAdyen);
                                chrome.storage.local.remove('fennecFraudAdyen');
                                bg.openOrReuseTab({ url: fennecFraudAdyen, active: true });
                            } else {
                                console.log('[FENNEC (POO)] No ADYEN URL found, refocusing to fraud tracker');
                                bg.refocusTab();
                            }
                        });
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
            console.error('[FENNEC (POO) Kount] Launcher error:', e);
        }
    });
    }
}

new KountLauncher().init();
