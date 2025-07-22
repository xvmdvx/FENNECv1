class KountLauncher extends Launcher {
    init() {
    if (window.top !== window) return;
    const bg = fennecMessenger;
    chrome.storage.local.get({ extensionEnabled: true, fennecReviewMode: false }, ({ extensionEnabled, fennecReviewMode }) => {
        if (!extensionEnabled) return;
        const reviewMode = fennecReviewMode;
        const SIDEBAR_WIDTH = 340;

        function updateReviewDisplay() {
            const label = document.getElementById('review-mode-label');
            if (label) label.style.display = reviewMode ? 'block' : 'none';
        }

        function insertDnaAfterCompany() {
            const dnaBox = document.querySelector('.copilot-dna');
            const compBox = document.querySelector('#copilot-sidebar .company-box');
            if (!dnaBox || !compBox) return;
            const parent = compBox.parentElement;
            if (dnaBox.parentElement !== parent || dnaBox.previousElementSibling !== compBox) {
                parent.insertBefore(dnaBox, compBox.nextSibling);
            }
        }



        function injectSidebar() {
            if (document.getElementById('copilot-sidebar')) return;
            document.body.style.transition = 'margin-right 0.2s';
            document.body.style.marginRight = SIDEBAR_WIDTH + 'px';
            const sb = new Sidebar();
            sb.build(`
                <div class="copilot-header">
                    <span id="qa-toggle" class="quick-actions-toggle">☰</span>
                    <div class="copilot-title">
                        <img src="${chrome.runtime.getURL('fennec_icon.png')}" class="copilot-icon" alt="FENNEC (POO)" />
                        <span>FENNEC (POO)</span>
                    </div>
                    <button id="copilot-clear-tabs">🗑</button>
                    <button id="copilot-close">✕</button>
                </div>
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
            loadSidebarSnapshot(sb.element);
            insertDnaAfterCompany();
            updateReviewDisplay();

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
                    chrome.storage.local.set({ kountInfo: updated });
                    console.log('[FENNEC (POO) Kount] Data saved', part);
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
        } catch (e) {
            console.error('[FENNEC (POO) Kount] Launcher error:', e);
        }
    });
    }
}

new KountLauncher().init();
