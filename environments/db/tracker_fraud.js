(function() {
    if (window.top !== window) return;
    const bg = fennecMessenger;
    chrome.storage.local.get({ extensionEnabled: true, lightMode: false, fennecReviewMode: false }, opts => {
        if (!opts.extensionEnabled) return;
        if (opts.lightMode) {
            document.body.classList.add('fennec-light-mode');
        } else {
            document.body.classList.remove('fennec-light-mode');
        }
        
        // Only inject if REVIEW MODE is enabled
        if (!opts.fennecReviewMode) {
            console.log('[FENNEC (POO)] Fraud tracker: REVIEW MODE is disabled, skipping injection');
            return;
        }
        
        const SIDEBAR_WIDTH = 340;
        const trialFloater = new TrialFloater();
        // Opening the fraud tracker manually should reset any pending floater
        // from previous sessions so the sidebar starts clean.
        sessionStorage.removeItem('fennecShowTrialFloater');
        let subDetectSeq = 0;
        let floaterRefocusDone = false;
        const queueScan = new URLSearchParams(location.search).get('fennec_queue_scan') === '1';
        if (queueScan) collectAllFraudOrders();
        
        // Only set REVIEW MODE if it's not already set
        if (!opts.fennecReviewMode) {
            chrome.storage.local.set({ fennecReviewMode: true });
            chrome.storage.sync.set({ fennecReviewMode: true });
        }
        
        // Only display the trial floater after the XRAY flow is manually
        // triggered. Avoid restoring it automatically when reloading the
        // fraud tracker.
        chrome.storage.local.get({ fraudXrayFinished: null }, ({ fraudXrayFinished }) => {
            if (fraudXrayFinished === '1') {
                chrome.storage.local.remove('fraudXrayFinished');
            }
        });



        function injectSidebar() {
            if (document.getElementById('copilot-sidebar')) return;

            document.body.style.transition = 'margin-right 0.2s';
            document.body.style.marginRight = SIDEBAR_WIDTH + 'px';

            if (!document.getElementById('copilot-db-padding')) {
                const style = document.createElement('style');
                style.id = 'copilot-db-padding';
                style.textContent = `
                    #frm-search-order { margin-right: ${SIDEBAR_WIDTH}px !important; }
                    .modal-fullscreen { width: calc(100% - ${SIDEBAR_WIDTH}px); }
                `;
                document.head.appendChild(style);
            }

            const sidebar = document.createElement('div');
            sidebar.id = 'copilot-sidebar';
            sidebar.innerHTML = buildStandardizedReviewModeSidebar(true, false);
            document.body.appendChild(sidebar);
            chrome.storage.sync.get({
                sidebarFontSize: 13,
                sidebarFont: "'Inter', sans-serif",
                sidebarBgColor: '#212121',
                sidebarBoxColor: '#2e2e2e'
            }, o => applySidebarDesign(sidebar, o));
            const closeBtn = sidebar.querySelector('#copilot-close');
            if (closeBtn) closeBtn.onclick = () => {
                sidebar.remove();
                document.body.style.marginRight = '';
                const style = document.getElementById('copilot-db-padding');
                if (style) style.remove();
            };
            const clearBtn = sidebar.querySelector('#copilot-clear-tabs');
            if (clearBtn) {
                clearBtn.onclick = () => {
                    bg.closeOtherTabs();
                };
            }
            
            // Initialize quick summary to be fully hidden
            const qsToggle = sidebar.querySelector('#qs-toggle');
            if (qsToggle) {
                const initQuickSummary = () => {
                    const box = sidebar.querySelector('#quick-summary');
                    if (!box) return;
                    box.style.maxHeight = '0px';
                    box.classList.add('quick-summary-collapsed');
                };
                initQuickSummary();
            }
        }

        function runXray(orderId) {
            const dbUrl = `https://db.incfile.com/incfile/order/detail/${orderId}?fraud_xray=1`;
            sessionStorage.setItem('fennecShowTrialFloater', '1');
            localStorage.removeItem('fraudXrayFinished');
            chrome.storage.local.set({
                fraudReviewSession: orderId,
                sidebarFreezeId: orderId,
                sidebarDb: [],
                sidebarOrderId: null,
                sidebarOrderInfo: null,
                adyenDnaInfo: null,
                kountInfo: null,
                xrayOpenedTabs: [] // Track tabs opened during XRAY flow
            }, () => {
                bg.openOrReuseTab({ url: dbUrl, active: true, refocus: true });
            });
        }

        function addXrayIcon(el, orderId) {
            if (el.dataset.xrayInjected) return;
            el.dataset.xrayInjected = '1';
            const btn = document.createElement('span');
            btn.textContent = '🩻';
            btn.className = 'copilot-xray';
            btn.style.cursor = 'pointer';
            btn.style.marginLeft = '4px';
            btn.title = 'XRAY';
            btn.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                const box = document.getElementById('fraud-summary-box');
                if (box) box.remove();
                runXray(orderId);
            });
            el.insertAdjacentElement('afterend', btn);
        }

        let scanTimeout = null;

        function scanOrders() {
            const anchors = Array.from(document.querySelectorAll('a[href*="/order/detail/"]'));
            anchors.forEach(a => {
                const m = a.href.match(/order\/detail\/(\d+)/);
                if (m) addXrayIcon(a, m[1]);
            });
            const re = /22\d{10}/g;
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            const nodes = [];
            while (walker.nextNode()) nodes.push(walker.currentNode);
            nodes.forEach(node => {
                const text = node.textContent;
                if (!re.test(text)) return;
                const frag = document.createDocumentFragment();
                let last = 0;
                text.replace(re, (match, idx) => {
                    frag.appendChild(document.createTextNode(text.slice(last, idx)));
                    const span = document.createElement('span');
                    span.textContent = match;
                    addXrayIcon(span, match);
                    frag.appendChild(span);
                    last = idx + match.length;
                });
                frag.appendChild(document.createTextNode(text.slice(last)));
                node.parentNode.replaceChild(frag, node);
            });

            insertFraudSummary();
        }

        function computeFraudSummary() {
            const rows = Array.from(document.querySelectorAll('tr[data-order-id]'));
            const dateCounts = {};
            let vipDecline = 0;
            let noMames = 0;
            const prices = [];
            rows.forEach(row => {
                const link = row.querySelector('a[href*="/order/detail/"]');
                if (link) {
                    const digits = (link.textContent || '').replace(/\D/g, '');
                    if (digits.length >= 7) {
                        const first7 = digits.slice(0,7);
                        const year = 2000 + parseInt(first7.slice(0,3), 10);
                        const month = first7.slice(3,5);
                        const day = first7.slice(5,7);
                        const dateKey = `${year}-${month}-${day}`;
                        dateCounts[dateKey] = (dateCounts[dateKey] || 0) + 1;
                    }
                }
                const html = row.innerHTML || '';
                if (/VIP\s*Decline/i.test(html)) vipDecline++;
                if (/No mames/i.test(html)) noMames++;
                const amount = parseFloat(row.getAttribute('data-amount') || '');
                if (!isNaN(amount)) prices.push(amount);
            });
            return { dateCounts, vipDecline, noMames, prices };
        }

        function drawPriceChart(prices) {
            const canvas = document.getElementById('fraud-price-chart');
            if (!canvas || !prices.length) return;
            const ctx = canvas.getContext('2d');
            const bins = [0,0,0,0];
            prices.forEach(p => {
                if (p < 200) bins[0]++; else if (p < 300) bins[1]++; else if (p < 400) bins[2]++; else bins[3]++;
            });
            const max = Math.max(...bins, 1);
            const labels = ['$<200','200-299','300-399','$400+'];
            ctx.clearRect(0,0,canvas.width,canvas.height);
            bins.forEach((count,i) => {
                const x = i*65 + 10;
                const h = Math.round(count / max * 80);
                ctx.fillStyle = '#2cabe3';
                ctx.fillRect(x, 90 - h, 60, h);
                ctx.fillStyle = '#fff';
                ctx.font = '10px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(labels[i], x + 30, 97);
            });
        }

        function collectAllFraudOrders() {
            const icon = document.querySelector('#copilot-sidebar .copilot-icon');
            if (icon) icon.classList.add('fennec-flash');
            function gather() {
                const select = document.querySelector('select[name="fraud_order_list_table_length"]');
                if (select && select.value !== '-1') {
                    select.value = '-1';
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    setTimeout(gather, 500);
                    return;
                }
                const table = document.getElementById('fraud_order_list_table');
                if (!table) { setTimeout(gather, 500); return; }
                const rows = table.querySelectorAll('tbody tr');
                if (!rows.length) { setTimeout(gather, 500); return; }
                const ids = Array.from(rows).map(r => {
                    const link = r.querySelector('a[href*="/order/detail/"]');
                    return link ? link.textContent.replace(/\D+/g, '') : null;
                }).filter(Boolean);
                chrome.storage.local.set({ fennecFraudOrders: ids }, () => {
                    if (icon) icon.classList.remove('fennec-flash');
                    bg.closeTab();
                });
            }
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', gather);
            } else {
                gather();
            }
        }

        let activeFilter = null;

        function applyFilter() {
            const rows = Array.from(document.querySelectorAll('tr[data-order-id]'));
            rows.forEach(row => {
                let show = true;
                if (activeFilter) {
                    const html = row.innerHTML || '';
                    if (activeFilter.date) {
                        const link = row.querySelector('a[href*="/order/detail/"]');
                        if (link) {
                            const digits = (link.textContent || '').replace(/\D/g, '');
                            if (digits.length >= 7) {
                                const first7 = digits.slice(0,7);
                                const dKey = `${2000 + parseInt(first7.slice(0,3),10)}-${first7.slice(3,5)}-${first7.slice(5,7)}`;
                                if (dKey !== activeFilter.date) show = false;
                            }
                        }
                    }
                    if (activeFilter.vip && !/VIP\s*Decline/i.test(html)) show = false;
                    if (activeFilter.nomames && !/No mames/i.test(html)) show = false;
                }
                row.style.display = show ? '' : 'none';
            });
        }

        function toggleDateFilter(date) {
            if (activeFilter && activeFilter.date === date) {
                activeFilter = null;
            } else {
                activeFilter = { date };
            }
            applyFilter();
        }

        function toggleVipFilter() {
            if (activeFilter && activeFilter.vip) {
                activeFilter = null;
            } else {
                activeFilter = { vip: true };
            }
            applyFilter();
        }

        function toggleNmFilter() {
            if (activeFilter && activeFilter.nomames) {
                activeFilter = null;
            } else {
                activeFilter = { nomames: true };
            }
            applyFilter();
        }

        function formatSummaryDate(d) {
            const parts = d.split('-');
            const dt = new Date(parts[0], parseInt(parts[1],10)-1, parts[2]);
            return dt.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
        }

        function getClientLtv() {
            const row = document.querySelector('#vclient table tbody tr');
            if (row) {
                const cells = row.querySelectorAll('td');
                if (cells[2]) return (cells[2].innerText || cells[2].textContent || '').trim();
            }
            return '';
        }

        function insertFraudSummary() {
            const container = document.getElementById('fraud-summary-section');
            if (!container) return;
            const summary = computeFraudSummary();
            const dateItems = Object.keys(summary.dateCounts)
                .sort()
                .map(d => `<li class="fraud-date-item" data-date="${d}" style="cursor:pointer">${formatSummaryDate(d)}: <b>${summary.dateCounts[d]}</b></li>`)
                .join('');
            const html = `
                <div class="white-box" id="fraud-summary-box" style="text-align:center">
                    <h4 style="margin-top:0; text-align:center"><b>SUMMARY</b></h4>
                    <div><b>ORDERS:</b><ul style="list-style:none;padding:0;margin:0;">${dateItems}</ul></div>
                    <div class="vip-declines" style="cursor:pointer"><b>DECLINE:</b> ${summary.vipDecline}</div>
                    <div class="nm-mames" style="cursor:pointer"><b>NO MAMES:</b> ${summary.noMames}</div>
                </div>`;
            const changed = container.dataset.prevHtml !== html;
            container.dataset.prevHtml = html;
            if (changed) {
                container.innerHTML = html;
            }
            container.querySelectorAll('.fraud-date-item').forEach(li => {
                li.addEventListener('click', () => toggleDateFilter(li.dataset.date));
            });
            const vip = container.querySelector('.vip-declines');
            if (vip) vip.addEventListener('click', toggleVipFilter);
            const nm = container.querySelector('.nm-mames');
            if (nm) nm.addEventListener('click', toggleNmFilter);
        }

        function buildDnaHtml(info) {
            if (!info || !info.payment) return null;
            const p = info.payment;
            const card = p.card || {};
            const shopper = p.shopper || {};
            const proc = p.processing || {};
            const parts = [];
            if (card['Card holder']) {
                parts.push(`<div><b>${escapeHtml(card['Card holder'])}</b></div>`);
            }
            const cardLine = [];
            if (card['Payment method']) cardLine.push(escapeHtml(card['Payment method']));
            if (card['Card number']) {
                const digits = card['Card number'].replace(/\D+/g, '').slice(-4);
                if (digits) cardLine.push(escapeHtml(digits));
            }
            function formatExpiry(d) {
                if (!d) return '';
                const digits = d.replace(/\D+/g, '');
                if (digits.length >= 4) return `${digits.slice(0,2)}/${digits.slice(-2)}`;
                return d;
            }
            if (card['Expiry date']) cardLine.push(escapeHtml(formatExpiry(card['Expiry date'])));
            if (card['Funding source']) cardLine.push(escapeHtml(card['Funding source']));
            if (cardLine.length) parts.push(`<div>${cardLine.join(' \u2022 ')}</div>`);
            if (shopper['Billing address']) {
                parts.push(`<div class="dna-address">${escapeHtml(shopper['Billing address'])}</div>`);
                if (card['Issuer name'] || card['Issuer country/region']) {
                    let bank = (card['Issuer name'] || '').trim();
                    if (bank.length > 25) bank = bank.slice(0,22) + '...';
                    const country = (card['Issuer country/region'] || '').trim();
                    let cinit = '';
                    if (country) {
                        cinit = country.split(/\s+/).map(w => w.charAt(0)).join('').toUpperCase();
                        cinit = ` (<span class="dna-country"><b>${escapeHtml(cinit)}</b></span>)`;
                    }
                    parts.push(`<div class="dna-issuer">${escapeHtml(bank)}${cinit}</div>`);
                }
            }
            const cvv = proc['CVC/CVV'];
            const avs = proc['AVS'];
            function colorFor(res) {
                if (res === 'green') return 'copilot-tag-green';
                if (res === 'purple') return 'copilot-tag-purple';
                return 'copilot-tag-black';
            }
            function formatCvv(t) {
                t = (t || '').toLowerCase();
                if ((/\bmatch(es|ed)?\b/.test(t) || /\(m\)/.test(t)) && !/not\s+match/.test(t)) return { label: 'CVV: MATCH', result: 'green' };
                if (/not\s+match/.test(t) || /\(n\)/.test(t)) return { label: 'CVV: NO MATCH', result: 'purple' };
                if (/not provided|not checked|error|not supplied|unknown/.test(t)) return { label: 'CVV: UNKNOWN', result: 'black' };
                return { label: 'CVV: UNKNOWN', result: 'black' };
            }
            function formatAvs(t) {
                t = (t || '').toLowerCase();
                if (/both\s+postal\s+code\s+and\s+address\s+match/.test(t) || /^7\b/.test(t) || t.includes('both match')) return { label: 'AVS: MATCH', result: 'green' };
                if (/^6\b/.test(t) || (t.includes('postal code matches') && t.includes("address doesn't"))) return { label: 'AVS: PARTIAL (STREET✖️)', result: 'purple' };
                if (/^1\b/.test(t) || (t.includes('address matches') && t.includes("postal code doesn't"))) return { label: 'AVS: PARTIAL (ZIP✖️)', result: 'purple' };
                if (/^2\b/.test(t) || t.includes('neither matches') || /\bw\b/.test(t)) return { label: 'AVS: NO MATCH', result: 'purple' };
                if (/^0\b/.test(t) || /^3\b/.test(t) || /^4\b/.test(t) || /^5\b/.test(t) || t.includes('unavailable') || t.includes('not supported') || t.includes('no avs') || t.includes('unknown')) return { label: 'AVS: UNKNOWN', result: 'black' };
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
            if (parts.length) parts.push('<hr style="border:none;border-top:1px solid #555;margin:6px 0"/>');
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
                    return `<tr><td><span class="dna-label ${cls}">${label}${count}</span></td><td>${escapeHtml(amount)}${escapeHtml(pctText)}</td></tr>`;
                }).join("");

                return `<table class="dna-tx-table"><thead><tr><th>Type</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>`;
            }

            const txTable = buildTransactionTable(info.transactions || {});
            if (txTable) parts.push(txTable);
            if (!parts.length) return null;
            return `<div class="section-label">ADYEN'S DNA</div><div class="white-box" style="margin-bottom:10px">${parts.join('')}</div>`;
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

       function loadDnaSummary() {
           const container = document.getElementById('dna-summary');
           if (!container) return;
           chrome.storage.local.get({ adyenDnaInfo: null, sidebarOrderInfo: null }, ({ adyenDnaInfo, sidebarOrderInfo }) => {
               if (adyenDnaInfo) adyenDnaInfo.dbBilling = sidebarOrderInfo ? sidebarOrderInfo.billing : null;
               const html = buildDnaHtml(adyenDnaInfo);
               container.innerHTML = html || '';
               attachCommonListeners(container);
           });
       }

        // Make callable from page scripts
        window.loadDnaSummary = loadDnaSummary;

       function loadKountSummary() {
           const container = document.getElementById('kount-summary');
           if (!container) return;
           chrome.storage.local.get({ kountInfo: null }, ({ kountInfo }) => {
               const html = buildKountHtml(kountInfo);
               container.innerHTML = html || '';
               attachCommonListeners(container);
           });
       }

        window.loadKountSummary = loadKountSummary;

        // Displays the floating TRIAL SUMMARY once XRAY data is available.
        // Allow a few extra retries in case Kount or Adyen info is delayed.
        // DNA info may take a while to load for very large records.
        // Increase retries so the trial floater still appears. Always
        // display the floater even if some values are missing so the
        // user sees a LOADING state.
        function showTrialFloater(retries = 60, force = false) {
            const flag = sessionStorage.getItem('fennecShowTrialFloater');
            const overlayExists = trialFloater.exists();
            if ((!flag && !force && !overlayExists) || retries <= 0) return;
            const summary = document.getElementById("fraud-summary-box");
            if (summary) summary.remove();
            chrome.storage.local.get({ adyenDnaInfo: null, kountInfo: null, sidebarOrderInfo: null }, data => {
                const html = buildTrialHtml(data.adyenDnaInfo, data.kountInfo, data.sidebarOrderInfo);
                sessionStorage.removeItem('fennecShowTrialFloater');
                if (data.sidebarOrderInfo && data.sidebarOrderInfo.orderId) {
                    localStorage.setItem('fraudXrayCompleted', String(data.sidebarOrderInfo.orderId));
                } else {
                    localStorage.setItem('fraudXrayCompleted', '1');
                }
                localStorage.setItem('fraudXrayFinished', '1');
                // Always return focus to the Fraud queue once DNA and search
                // data are ready so the user sees the trial summary in the
                // correct tab. Clearing the stored return tab prevents focusing
                // Adyen again when the search tab hasn't reported back yet.
                chrome.storage.local.set({ fennecReturnTab: null }, () => {
                    bg.refocusTab();
                });
                floaterRefocusDone = true;
                trialFloater.ensure();
                const overlay = trialFloater.element;
                const title = trialFloater.header;
                overlay.innerHTML = html;
                const txHeader = overlay.querySelector('.trial-tx-header');
                if (txHeader) txHeader.addEventListener('click', () => bg.send('focusDnaTab'));
                const close = overlay.querySelector('.trial-close');
                if (close) close.addEventListener('click', () => {
                    overlay.remove();
                    title.remove();
                    endFraudSession();
                    chrome.storage.local.set({ fennecReturnTab: null }, () => {
                        bg.refocusTab();
                    });
                });
                const subBtn = overlay.querySelector('#sub-detection-btn');
                if (subBtn) {
                    subBtn.addEventListener('click', () => {
                        subBtn.disabled = true;
                        const req = ++subDetectSeq;
                        const dna = data.adyenDnaInfo;
                        const kount = data.kountInfo;
                        const order = data.sidebarOrderInfo;
                        const dbCol = overlay.querySelector('.trial-col');
                        let loadingLine = null;
                        if (dbCol) {
                            loadingLine = document.createElement('div');
                            loadingLine.className = 'trial-line';
                            loadingLine.textContent = 'Orders: LOADING...';
                            const raVa = dbCol.querySelector('.ra-va-line');
                            if (raVa && raVa.nextSibling) dbCol.insertBefore(loadingLine, raVa.nextSibling);
                            else dbCol.appendChild(loadingLine);
                        }
                        bg.send('detectSubscriptions', {
                            email: (order && order.clientEmail) || '',
                            ltv: (order && order.clientLtv) || ''
                        }, resp => {
                            if (req !== subDetectSeq) return;
                            subBtn.disabled = false;
                            if (!resp) return;
                            const col = overlay.querySelector('.trial-col');
                            if (!col) return;
                            if (loadingLine) loadingLine.textContent = `Orders: ${resp.orderCount}`;
                            else {
                                const line1 = document.createElement('div');
                                line1.className = 'trial-line';
                                line1.textContent = `Orders: ${resp.orderCount}`;
                                const raVa = col.querySelector('.ra-va-line');
                                if (raVa && raVa.nextSibling) col.insertBefore(line1, raVa.nextSibling);
                                else col.appendChild(line1);
                                loadingLine = line1;
                            }
                            let line2 = null;
                            if (resp.ltv) {
                                const ratio = resp.orderCount && parseFloat(resp.ltv) ? (resp.orderCount / parseFloat(resp.ltv)).toFixed(2) : 'N/A';
                                line2 = document.createElement('div');
                                line2.className = 'trial-line';
                                line2.textContent = `Orders/LTV: ${ratio}`;
                                dbCol.insertBefore(line2, line1.nextSibling);
                            }
                            const line3 = document.createElement('div');
                            line3.className = 'trial-line';
                            line3.textContent = 'Active Subs: ' + (resp.activeSubs.length ? resp.activeSubs.join(', ') : 'None');
                            const insertPoint = line2 ? line2.nextSibling : line1.nextSibling;
                            dbCol.insertBefore(line3, insertPoint);
                        });
                    });
                }
                const orderId = data.sidebarOrderInfo && data.sidebarOrderInfo.orderId;
                function clickDbAction(selector) {
                    if (!orderId) return;
                    const targets = [];
                    const link = document.querySelector(`a[href*="/order/detail/${orderId}"]`);
                    if (link) {
                        const row = link.closest('tr');
                        if (row) targets.push(row);
                    }
                    document.querySelectorAll(`tr[data-order-id="${orderId}"]`).forEach(r => targets.push(r));
                    for (const row of targets) {
                        const btn = row && row.querySelector(selector);
                        if (btn) {
                            btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                            return;
                        }
                    }
                }
                function showTrialSuccess() {
                    const msg = document.createElement('div');
                    msg.className = 'trial-success-msg';
                    msg.textContent = 'Decision saved';
                    document.body.appendChild(msg);
                    setTimeout(() => { msg.remove(); }, 2000);
                }

                function handleTrialAction(selector) {
                    clickDbAction(selector);
                    overlay.remove();
                    title.remove();
                    endFraudSession();
                    showTrialSuccess();
                }

                const crBtn = overlay.querySelector('#trial-btn-cr');
                if (crBtn) crBtn.addEventListener('click', () => handleTrialAction('.cancel-and-refund-potential-fraud'));
                const idBtn = overlay.querySelector('#trial-btn-id');
                if (idBtn) idBtn.addEventListener('click', () => handleTrialAction('.confirm-fraud-potential-fraud'));
                const relBtn = overlay.querySelector('#trial-btn-release');
                if (relBtn) relBtn.addEventListener('click', () => handleTrialAction('.remove-potential-fraud'));

                const crossCountTotal = overlay.querySelectorAll('.db-adyen-cross').length;
                let crossCount = crossCountTotal;
                if (crossCountTotal > 0) {
                    const labels = ['AVS:', 'CLIENT:', 'EMAIL:', 'EMAIL AGE:'];
                    let excl = 0;
                    labels.forEach(l => {
                        const line = Array.from(overlay.querySelectorAll('.trial-line')).find(div => {
                            const t = div.querySelector('.trial-tag');
                            return t && t.textContent.trim() === l;
                        });
                        if (line) excl += line.querySelectorAll('.db-adyen-cross').length;
                    });
                    if (crossCountTotal === excl) crossCount = 0;
                }
                const bigSpot = overlay.querySelector('#trial-big-button');
                let headerCls = 'trial-header-green';
                if (crossCount > 4) headerCls = 'trial-header-red';
                else if (crossCount > 0) headerCls = 'trial-header-purple';
                title.className = headerCls;
                overlay.classList.remove('trial-header-green','trial-header-purple','trial-header-red');
                overlay.classList.add(headerCls);
                const orderHeader = overlay.querySelector('.trial-order');
                if (orderHeader) {
                    orderHeader.classList.remove('trial-header-green','trial-header-purple','trial-header-red');
                    orderHeader.classList.add(headerCls);
                }
                if (bigSpot) {
                    let label = 'RELEASE';
                    let selector = '.remove-potential-fraud';
                    if (crossCount > 4) {
                        label = 'C&R';
                        selector = '.cancel-and-refund-potential-fraud';
                    } else if (crossCount > 0) {
                        label = 'ID CONFIRM';
                        selector = '.confirm-fraud-potential-fraud';
                    }
                    const bigBtn = document.createElement('button');
                    bigBtn.textContent = label;
                    bigBtn.className = 'sub-detect-btn big-trial-btn';
                    bigBtn.addEventListener('click', () => handleTrialAction(selector));
                    bigSpot.innerHTML = '';
                    bigSpot.appendChild(bigBtn);
                }
                if (data.sidebarOrderInfo && data.sidebarOrderInfo.clientEmail) {
                    const dna = data.adyenDnaInfo;
                    const kount = data.kountInfo;
                    const order = data.sidebarOrderInfo;
                    const cols = overlay.querySelectorAll('.trial-columns .trial-col');
                    const dbCol = cols && cols[0];
                    const fetchStats = (attempts = 8) => {
                        const req = ++subDetectSeq;
                        bg.send('countEmailOrders', {
                            email: order.clientEmail,
                            ltv: order.clientLtv || ''
                        }, resp => {
                            if (req !== subDetectSeq) return;
                            if (!resp) {
                                if (attempts > 0) {
                                    setTimeout(() => fetchStats(attempts - 1), 1500);
                                }
                                return;
                            }
                            if (resp.statusCounts && (resp.statusCounts.total === 0 || resp.statusCounts.total >= 100) && attempts > 0) {
                                setTimeout(() => fetchStats(attempts - 1), 1500);
                                return;
                            }
                            if (!dbCol) return;
                            const extraInfo = dbCol.querySelector('#db-extra-info');
                            const addLine = html => {
                                if (!extraInfo) return;
                                const div = document.createElement('div');
                                div.className = 'trial-line trial-two-col';
                                div.innerHTML = html;
                                extraInfo.appendChild(div);
                            };
                            const addCenter = html => {
                                if (!extraInfo) return;
                                const div = document.createElement('div');
                                div.className = 'trial-line trial-center';
                                div.innerHTML = html;
                                extraInfo.appendChild(div);
                            };
                            const addSep = () => {
                                if (!extraInfo) return;
                                const div = document.createElement('div');
                                div.className = 'trial-line trial-sep';
                                extraInfo.appendChild(div);
                            };
                            const addFour = pairs => {
                                if (!extraInfo) return;
                                const div = document.createElement('div');
                                div.className = 'trial-line trial-four-col';
                                div.innerHTML = pairs.map(([t,v]) => `<span class="trial-tag">${t}:</span><span class="trial-value">${v}</span>`).join('');
                                extraInfo.appendChild(div);
                            };
                            if (resp.statusCounts) {
                                const pairs = [];
                                if (parseInt(resp.statusCounts.cxl, 10) > 0) pairs.push(['CXL', resp.statusCounts.cxl]);
                                if (parseInt(resp.statusCounts.pending, 10) > 0) pairs.push(['PENDING', resp.statusCounts.pending]);
                                if (parseInt(resp.statusCounts.shipped, 10) > 0) pairs.push(['SHIPPED', resp.statusCounts.shipped]);
                                if (parseInt(resp.statusCounts.transferred, 10) > 0) pairs.push(['TRANSFER', resp.statusCounts.transferred]);
                                for (let i = 0; i < pairs.length; i += 2) {
                                    addFour(pairs.slice(i, i + 2));
                                }
                                const goodTotal = resp.statusCounts.total >= resp.statusCounts.cxl * 2;
                                addCenter(`TOTAL: <b>${resp.statusCounts.total}</b> <span class="${goodTotal ? 'db-adyen-check' : 'db-adyen-cross'}">${goodTotal ? '✔' : '✖'}</span>`);
                                addSep();
                                if (resp.ltv) {
                                    const openOrders = (parseInt(resp.statusCounts.total, 10) || 0) -
                                                        (parseInt(resp.statusCounts.cxl, 10) || 0);
                                    const ltvNum = Math.round(parseFloat(String(resp.ltv).replace(/[^0-9.]/g, '')) || 0);
                                    const ratio = openOrders > 0 ? `$${(ltvNum / openOrders).toFixed(2)}` : '$0.00';
                                    addFour([['LTV', resp.ltv], ['P/ORDER', ratio]]);
                                }
                                const states = collectStates(order, dna, kount);
                                const countries = collectCountries(order, dna, kount);
                                if ((states.length || countries.length) && extraInfo && !extraInfo.querySelector('.trial-country-state-line')) {
                                    const blank = document.createElement('div');
                                    blank.className = 'trial-line';
                                    blank.innerHTML = '&nbsp;';
                                    extraInfo.appendChild(blank);
                                    const div = document.createElement('div');
                                    if (states.length && countries.length) {
                                        div.className = 'trial-line trial-four-col trial-country-state-line';
                                        div.innerHTML = `<span class="trial-tag">COUNTRY:</span><span class="trial-value">${countries.join(', ')}</span><span class="trial-tag">STATE:</span><span class="trial-value">${states.join(', ')}</span>`;
                                    } else if (countries.length) {
                                        div.className = 'trial-line trial-two-col trial-country-state-line';
                                        div.innerHTML = `<span class="trial-tag">COUNTRY:</span><span class="trial-value">${countries.join(', ')}</span>`;
                                    } else if (states.length) {
                                        div.className = 'trial-line trial-two-col trial-country-state-line';
                                        div.innerHTML = `<span class="trial-tag">STATE:</span><span class="trial-value">${states.join(', ')}</span>`;
                                    }
                                    if (div.innerHTML) extraInfo.appendChild(div);
                                }
                            }
                        });
                    };
                    fetchStats();
                }
            });
        }

        function buildTrialHtml(dna, kount, order) {
            const dbLines = [];
            const adyenLines = [];
            const kountLines = [];
            if (!order) dbLines.push('<div class="trial-line">LOADING...</div>');
            if (!dna) adyenLines.push('<div class="trial-line">LOADING...</div>');
            if (!kount) kountLines.push('<div class="trial-line">LOADING...</div>');
            const green = [];
            const red = [];

            let dbDigits = '';
            let dbExp = '';
            let dnaDigits = '';
            let dnaExp = '';

            const dbName = order && order.billing ? order.billing.cardholder || '' : '';
            const adyenName = dna && dna.payment && dna.payment.card ? dna.payment.card['Card holder'] || '' : '';
            const kountName = kount && kount.ekata ? kount.ekata.residentName || '' : '';
            const names = [dbName, adyenName, kountName];
            let matchNames = false;
            for (let i = 0; i < names.length; i++) {
                for (let j = i + 1; j < names.length; j++) {
                    if (namesMatch(names[i], names[j])) { matchNames = true; break; }
                }
                if (matchNames) break;
            }
            const iconHtml = matchNames
                ? '<span class="name-match check">✔</span>'
                : '<span class="name-match cross">✖</span>';

            function colorFor(res) {
                if (res === 'green') return 'copilot-tag-green';
                if (res === 'purple') return 'copilot-tag-purple';
                return 'copilot-tag-black';
            }
            function pushFlag(html) {
                if (/copilot-tag-green/.test(html)) green.push(html);
                if (/copilot-tag-purple/.test(html)) red.push(html);
            }
            function formatCvv(t) {
                t = (t || '').toLowerCase();
                if ((/\bmatch(es|ed)?\b/.test(t) || /\(m\)/.test(t)) && !/not\s+match/.test(t)) return { label: 'CVV: MATCH', result: 'green' };
                if (/not\s+match/.test(t) || /\(n\)/.test(t)) return { label: 'CVV: NO MATCH', result: 'purple' };
                if (/not provided|not checked|error|not supplied|unknown/.test(t)) return { label: 'CVV: UNKNOWN', result: 'black' };
                return { label: 'CVV: UNKNOWN', result: 'black' };
            }
            function formatAvs(t) {
                t = (t || '').toLowerCase();
                if (/both\s+postal\s+code\s+and\s+address\s+match/.test(t) || /^7\b/.test(t) || t.includes('both match')) return { label: 'AVS: MATCH', result: 'green' };
                if (/^6\b/.test(t) || (t.includes('postal code matches') && t.includes("address doesn't"))) return { label: 'AVS: PARTIAL (STREET✖️)', result: 'purple' };
                if (/^1\b/.test(t) || (t.includes('address matches') && t.includes("postal code doesn't"))) return { label: 'AVS: PARTIAL (ZIP✖️)', result: 'purple' };
                if (/^2\b/.test(t) || t.includes('neither matches') || /\bw\b/.test(t)) return { label: 'AVS: NO MATCH', result: 'purple' };
                if (/^0\b/.test(t) || /^3\b/.test(t) || /^4\b/.test(t) || /^5\b/.test(t) || t.includes('unavailable') || t.includes('not supported') || t.includes('no avs') || t.includes('unknown')) return { label: 'AVS: UNKNOWN', result: 'black' };
                return { label: 'AVS: UNKNOWN', result: 'black' };
            }
            function parseAmount(str) {
                if (!str) return 0;
                const n = parseFloat(str.replace(/[^0-9.]/g, ''));
                return isNaN(n) ? 0 : n;
            }

            function formatExpShort(text) {
                if (!text) return '';
                const digits = String(text).replace(/[^0-9]/g, '');
                if (digits.length >= 4) {
                    const mm = digits.slice(0,2).padStart(2, '0');
                    const yy = digits.slice(-2);
                    return `${mm}/${yy}`;
                }
                return text;
            }

            const STATE_ABBRS = 'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
            const STATE_NAMES = [
                'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'
            ];
            function guessCountry(text) {
                if (!text) return null;
                const t = String(text).toUpperCase();
                if (/UNITED STATES|USA\b|US\b/.test(t)) return 'US';
                if (/CANADA|\bCA\b/.test(t)) return 'CA';
                if (/MEXICO|\bMX\b/.test(t)) return 'MX';
                if (/UNITED KINGDOM|\bUK\b|\bGB\b/.test(t)) return 'GB';
                if (/AUSTRALIA|\bAU\b/.test(t)) return 'AU';
                const seg = t.split(',').pop().trim();
                if (seg.length === 2 && !STATE_ABBRS.includes(seg)) return seg;
                if (seg.length > 2 && /^[A-Z ]+$/.test(seg) && !STATE_ABBRS.includes(seg)) {
                    return seg.replace(/\s+/g, '').slice(0, 2);
                }
                return null;
            }

            function guessState(text) {
                if (!text) return null;
                const t = String(text).toUpperCase();
                const abbr = STATE_ABBRS.find(a => new RegExp('\\b' + a + '\\b').test(t));
                if (abbr) return abbr;
                for (let i = 0; i < STATE_NAMES.length; i++) {
                    if (new RegExp('\\b' + STATE_NAMES[i].toUpperCase() + '\\b').test(t)) {
                        return STATE_ABBRS[i];
                    }
                }
                return null;
            }

            function collectStates(order, dna, kount) {
                const set = new Set();
                const add = a => { const s = guessState(a); if (s) set.add(s); };
                if (order) {
                    if (order.billing && order.billing.address) add(order.billing.address);
                    if (order.registeredAgent && order.registeredAgent.address) add(order.registeredAgent.address);
                    if (Array.isArray(order.members)) order.members.forEach(m => add(m.address));
                }
                if (dna && dna.payment && dna.payment.shopper && dna.payment.shopper['Billing address']) add(dna.payment.shopper['Billing address']);
                if (kount && kount.deviceLocation) add(kount.deviceLocation);
                return Array.from(set);
            }

            function collectCountries(order, dna, kount) {
                const set = new Set();
                const add = a => { const c = guessCountry(a); if (c) set.add(c); };
                if (order) {
                    if (order.billing && order.billing.address) add(order.billing.address);
                    if (order.registeredAgent && order.registeredAgent.address) add(order.registeredAgent.address);
                    if (Array.isArray(order.members)) order.members.forEach(m => add(m.address));
                }
                if (dna && dna.payment && dna.payment.shopper && dna.payment.shopper['Billing address']) add(dna.payment.shopper['Billing address']);
                if (kount && kount.deviceLocation) add(kount.deviceLocation);
                return Array.from(set);
            }

            function normName(name) {
                return (name || '').toLowerCase().replace(/[^a-z]+/g, ' ').trim();
            }

function namesMatch(a, b) {
    a = normName(a); b = normName(b);
    if (!a || !b) return false;
    if (a === b) return true;
    const pa = a.split(' ');
    const pb = b.split(' ');
    return pa[0] === pb[0] && pa[pa.length - 1] === pb[pb.length - 1];
}

            function namesPartialMatch(a, b) {
                a = normName(a); b = normName(b);
                if (!a || !b) return false;
                return a.includes(b) || b.includes(a);
            }

            function namesSharePart(a, b) {
                a = normName(a); b = normName(b);
                if (!a || !b) return false;
                const pa = a.split(' ');
                const pb = b.split(' ');
                const firstA = pa[0];
                const lastA = pa[pa.length - 1];
                const firstB = pb[0];
                const lastB = pb[pb.length - 1];
                return firstA === firstB || firstA === lastB || lastA === firstB || lastA === lastB;
            }

            function emailMatches(email, names = [], company = '') {
                const norm = t => (t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
                const user = norm((email || '').split('@')[0]);
                if (!user) return false;
                const tokens = [];
                const addTokens = txt => {
                    norm(txt).split(' ').forEach(w => { if (w.length > 2) tokens.push(w); });
                };
                names.forEach(addTokens);
                addTokens(company);
                return tokens.some(tok => user.includes(tok));
            }
            function buildCardMatchTag(dbBilling, card) {
                const db = dbBilling || {};
                const dna = card || {};
                const dbName = (db.cardholder || '').toLowerCase();
                const dnaName = (dna['Card holder'] || '').toLowerCase();
                const dbDigits = (db.last4 || '').replace(/\D+/g, '');
                const dnaDigits = (dna['Card number'] || '').replace(/\D+/g, '').slice(-4);
                const dbExp = (db.expiry || '').replace(/\D+/g, '');
                const dnaExp = (dna['Expiry date'] || '').replace(/\D+/g, '');
                if (!dbName && !dbDigits && !dbExp) return '';
                const match = dbName && dnaName && dbName === dnaName && dbDigits && dnaDigits && dbDigits === dnaDigits && dbExp && dnaExp && dbExp === dnaExp;
                const cls = match ? 'copilot-tag-green' : 'copilot-tag-purple';
                const text = match ? 'DB MATCH' : 'DB MISMATCH';
                return `<span class="copilot-tag ${cls}">${text}</span>`;
            }

            if (order && order.billing) {
                dbLines.push(`<div class="trial-line trial-name">${escapeHtml(order.billing.cardholder || '')} ${iconHtml}</div>`);
                dbDigits = (order.billing.last4 || '').replace(/\D+/g, '');
                dnaDigits = (dna && dna.payment && dna.payment.card ? dna.payment.card['Card number'] : '').replace(/\D+/g, '').slice(-4);
                dbExp = (order.billing.expiry || '').replace(/\D+/g, '');
                dnaExp = (dna && dna.payment && dna.payment.card ? dna.payment.card['Expiry date'] : '').replace(/\D+/g, '');
                if (order.billing.expiry || order.billing.last4) {
                    const parts = [];
                    if (order.billing.expiry) parts.push(`<span class="copilot-tag copilot-tag-white">${escapeHtml(formatExpShort(order.billing.expiry))}</span>`);
                    if (order.billing.last4) parts.push(`<span class="copilot-tag copilot-tag-white">${escapeHtml(order.billing.last4)}</span>`);
                    dbLines.push(`<div class="trial-line trial-card-info">${parts.join(' ')}</div>`);
                    dbLines.push('<div class="trial-line trial-sep db-extra-start"></div>');
                }
                const dbName = (order.billing.cardholder || '').toLowerCase();
                const dnaName = (dna && dna.payment && dna.payment.card ? dna.payment.card['Card holder'] : '').toLowerCase();
                const cardOk = dbName && dnaName && dbName === dnaName && dbDigits && dnaDigits && dbDigits === dnaDigits && dbExp && dnaExp && dbExp === dnaExp;
                const tag = dna && dna.payment ? buildCardMatchTag(order.billing, dna.payment.card || {}) : '';
                if (tag) pushFlag(tag);
                const clientInfo = typeof getClientInfo === 'function' ? getClientInfo() : { name: '', email: '' };
                const clientName = order.clientName || clientInfo.name || '';
                const email = order.clientEmail || clientInfo.email || '';
                const emailOk = emailMatches(email, [order.billing.cardholder, clientName], order.companyName);
                dbLines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">EMAIL:</span><span class="trial-value">${escapeHtml(email)} <span class="${emailOk ? 'db-adyen-check' : 'db-adyen-cross'}">${emailOk ? '✔' : '✖'}</span></span></div>`);
                if (clientName) {
                    let cOk = namesMatch(clientName, order.billing.cardholder) ||
                               namesPartialMatch(clientName, order.billing.cardholder);
                    if (!cOk && Array.isArray(order.members)) {
                        cOk = order.members.some(m => namesMatch(clientName, m.name) ||
                                                     namesPartialMatch(clientName, m.name));
                    }
                    dbLines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">CLIENT:</span><span class="trial-value">${escapeHtml(clientName)} <span class="${cOk ? 'db-adyen-check' : 'db-adyen-cross'}">${cOk ? '✔' : '✖'}</span></span></div>`);
                }
                if (Array.isArray(order.members) && order.members.length) {
                    const items = order.members.map(m => {
                        const ok = namesMatch(m.name, order.billing.cardholder) ||
                                   namesPartialMatch(m.name, order.billing.cardholder) ||
                                   namesMatch(m.name, clientInfo.name) ||
                                   namesPartialMatch(m.name, clientInfo.name);
                        return `<li>${escapeHtml(m.name)}${ok ? ' <span class="db-adyen-check">✔</span>' : ''}</li>`;
                    }).join('');
                    dbLines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">MEMBERS:</span><span class="trial-value"><ul class="member-list">${items}</ul></span></div>`);
                }
                dbLines.push('<div class="trial-line trial-sep"></div>');
                dbLines.push('<div class="trial-line" style="text-align:center;font-weight:bold;">ORDERS:</div>');
                dbLines.push('<div id="db-extra-info"></div>');
                const btn = `<button id="sub-detection-btn" class="sub-detect-btn">SUB DETECTION</button>`;
                dbLines.push(`<div class="trial-line">${btn}</div>`);
                const states = collectStates(order, dna, kount);
                const countries = collectCountries(order, dna, kount);
                if (states.length || countries.length) {
                    if (states.length && countries.length) {
                        dbLines.push(`<div class="trial-line trial-four-col trial-country-state-line"><span class="trial-tag">COUNTRY:</span><span class="trial-value">${countries.join(', ')}</span><span class="trial-tag">STATE:</span><span class="trial-value">${states.join(', ')}</span></div>`);
                    } else if (countries.length) {
                        dbLines.push(`<div class="trial-line trial-two-col trial-country-state-line"><span class="trial-tag">COUNTRY:</span><span class="trial-value">${countries.join(', ')}</span></div>`);
                    } else {
                        dbLines.push(`<div class="trial-line trial-two-col trial-country-state-line"><span class="trial-tag">STATE:</span><span class="trial-value">${states.join(', ')}</span></div>`);
                    }
                }
                if (order.billing.cardholder) {
                    const card = order.billing.cardholder;
                    const names = [];
                    if (Array.isArray(order.members)) names.push(...order.members.map(m => m.name));
                    if (order.registeredAgent && order.registeredAgent.name) names.push(order.registeredAgent.name);
                    const match = names.some(n => namesMatch(n, card));
                    const ftag = `<span class="copilot-tag ${match ? 'copilot-tag-green' : 'copilot-tag-purple'}">${match ? 'CARD MATCH' : 'CARD MISMATCH'}</span>`;
                    pushFlag(ftag);
                }
            }

            if (dna && dna.payment) {
                const proc = dna.payment.processing || {};
                const card = dna.payment.card || {};
                if (card['Card holder']) adyenLines.push(`<div class="trial-line trial-name">${escapeHtml(card['Card holder'])} ${iconHtml}</div>`);
                const adDigits = card['Card number'] ? card['Card number'].replace(/\D+/g, '').slice(-4) : '';
                const cardParts = [];
                if (card['Expiry date']) cardParts.push(`<span class="copilot-tag copilot-tag-white">${escapeHtml(formatExpShort(card['Expiry date']))}</span>`);
                if (adDigits) cardParts.push(`<span class="copilot-tag copilot-tag-white">${escapeHtml(adDigits)}</span>`);
                if (cardParts.length) {
                    adyenLines.push(`<div class="trial-line trial-card-info">${cardParts.join(' ')}</div>`);
                    adyenLines.push('<div class="trial-line trial-sep"></div>');
                }
                if (proc['CVC/CVV']) {
                    const r = formatCvv(proc['CVC/CVV']);
                    const ok = r.result === 'green';
                    adyenLines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">CVV:</span><span class="trial-value">${escapeHtml(proc['CVC/CVV'])} <span class="${ok ? 'db-adyen-check' : 'db-adyen-cross'}">${ok ? '✔' : '✖'}</span></span></div>`);
                    if (ok) {
                        const tag = `<span class="copilot-tag ${colorFor(r.result)}">${escapeHtml(r.label)}</span>`;
                        pushFlag(tag);
                    }
                }
                if (proc['AVS']) {
                    const r = formatAvs(proc['AVS']);
                    const ok = r.result === 'green';
                    adyenLines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">AVS:</span><span class="trial-value">${escapeHtml(proc['AVS'])} <span class="${ok ? 'db-adyen-check' : 'db-adyen-cross'}">${ok ? '✔' : '✖'}</span></span></div>`);
                    if (ok) {
                        const tag = `<span class="copilot-tag ${colorFor(r.result)}">${escapeHtml(r.label)}</span>`;
                        pushFlag(tag);
                    }
                }
                adyenLines.push('<div class="trial-line trial-sep"></div>');
                adyenLines.push('<div class="trial-line trial-tx-header" style="text-align:center;font-weight:bold;cursor:pointer;">TRANSACTIONS</div>');
                const tx = dna.transactions || {};
                const settledCount = parseInt((tx['Settled'] || tx['Authorised / Settled'] || {}).count || '0', 10);
                const totalCount = parseInt((tx['Total'] || tx['Total transactions'] || {}).count || '0', 10);
                const settledAmt = parseAmount((tx['Settled'] || tx['Authorised / Settled'] || {}).amount);
                const totalAmt = parseAmount((tx['Total'] || tx['Total transactions'] || {}).amount);
                if (totalCount) {
                    adyenLines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">ATTEMPTS:</span><span class="trial-value">${totalCount}</span></div>`);
                    const pct = Math.round(settledCount / totalCount * 100);
                    const ok = pct >= 65;
                    adyenLines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">SETTLED:</span><span class="trial-value">${pct}% <span class="${ok ? 'db-adyen-check' : 'db-adyen-cross'}">${ok ? '✔' : '✖'}</span></span></div>`);
                    const failed = totalCount - settledCount;
                    adyenLines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">FAILED:</span><span class="trial-value">${failed}</span></div>`);
                    if (!ok) red.push('<span class="copilot-tag copilot-tag-purple">APPROVED %</span>');
                } else if (totalAmt) {
                    const pct = Math.round(settledAmt / totalAmt * 100);
                    const ok = pct >= 65;
                    adyenLines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">SETTLED:</span><span class="trial-value">${pct}% <span class="${ok ? 'db-adyen-check' : 'db-adyen-cross'}">${ok ? '✔' : '✖'}</span></span></div>`);
                    if (!ok) red.push('<span class="copilot-tag copilot-tag-purple">APPROVED %</span>');
                }
                const cb = parseInt((tx['Chargebacks'] || tx['Chargeback'] || {}).count || '0', 10);
                const okCb = cb === 0;
                if (okCb) {
                    adyenLines.push('<div class="trial-line trial-center"><b>NO PREVIOUS CB\'s <span class="db-adyen-check">✔</span></b></div>');
                } else {
                    adyenLines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">CB:</span><span class="trial-value">${cb} <span class="db-adyen-cross">✖</span></span></div>`);
                    red.push('<span class="copilot-tag copilot-tag-purple">CB</span>');
                }
            }

            if (kount) {
                if (kount.ekata && kount.ekata.residentName) {
                    const otherNames = [];
                    if (order && order.billing && order.billing.cardholder) otherNames.push(order.billing.cardholder);
                    if (order && order.clientName) otherNames.push(order.clientName);
                    if (Array.isArray(order.members)) otherNames.push(...order.members.map(m => m.name));
                    if (order && order.registeredAgent && order.registeredAgent.name) otherNames.push(order.registeredAgent.name);
                    if (adyenName) otherNames.push(adyenName);
                    const match = otherNames.some(n => namesSharePart(kount.ekata.residentName, n));
                    const kIcon = `<span class="${match ? 'db-adyen-check' : 'db-adyen-cross'}">${match ? '✔' : '✖'}</span>`;
                    kountLines.push(`<div class="trial-line trial-name">${escapeHtml(kount.ekata.residentName)} ${kIcon}</div>`);
                }
                if (kount.ekata && kount.ekata.proxyRisk) {
                    const ok = /^no$/i.test(kount.ekata.proxyRisk);
                    kountLines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">PROXY:</span><span class="trial-value">${escapeHtml(kount.ekata.proxyRisk)} <span class="${ok ? 'db-adyen-check' : 'db-adyen-cross'}">${ok ? '✔' : '✖'}</span></span></div>`);
                    if (!ok) red.push('<span class="copilot-tag copilot-tag-purple">PROXY YES</span>');
                }
                if (kount.emailAge) {
                    const num = parseInt(String(kount.emailAge).replace(/\D+/g, ''), 10) || 0;
                    const ok = num > 1;
                    kountLines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">EMAIL AGE:</span><span class="trial-value">${escapeHtml(kount.emailAge)} <span class="${ok ? 'db-adyen-check' : 'db-adyen-cross'}">${ok ? '✔' : '✖'}</span></span></div>`);
                    kountLines.push('<div class="trial-line trial-sep"></div>');
                }
                if (Array.isArray(kount.declines)) {
                    const count = kount.declines.length;
                    kountLines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">DECLINE:</span><span class="trial-value">${count} <span class="${count === 0 ? 'db-adyen-check' : 'db-adyen-cross'}">${count === 0 ? '✔' : '✖'}</span></span></div>`);
                }

                if (kount.linked) {
                    const map = [
                        ['email', 'Email'],
                        ['ip', 'IP Address'],
                        ['custId', 'Cust. ID'],
                        ['payment', 'Payment'],
                        ['billAddr', 'Bill Addr'],
                        ['shipAddr', 'Ship Addr'],
                        ['deviceId', 'Device ID']
                    ];
                    const counts = map.map(([k]) => parseInt(kount.linked[k] || 0, 10));
                    const total = counts.reduce((sum, n) => sum + n, 0);
                    const lines = [];
                    map.forEach(([k, label], idx) => {
                        const n = counts[idx];
                        if (n > 1) lines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">${label}:</span><span class="trial-value">${n}</span></div>`);
                    });
                    if (total === 0 || lines.length === 0) {
                        kountLines.push('<div class="trial-line trial-center"><b>NO LINKED ORDERS</b></div>');
                    } else {
                        lines.forEach(html => kountLines.push(html));
                    }
                }
            }

            const actions = `
                <div class="trial-actions">
                    <button id="trial-btn-cr" class="trial-action-btn trial-btn-cr">C&R</button>
                    <button id="trial-btn-id" class="trial-action-btn trial-btn-id">ID CONFIRM</button>
                    <button id="trial-btn-release" class="trial-action-btn trial-btn-release">RELEASE</button>
                </div>`;

            const orderLines = [];
            if (order) {
                if (order.companyName) {
                    orderLines.push(`<div class="trial-line trial-company-name">${escapeHtml(order.companyName)}</div>`);
                }
                const tags2 = [];
                if (order.type) {
                    const cleanType = String(order.type).replace(/BUSINESS\s*FORMATION/gi, '').replace(/-\s*/g, '').trim();
                    if (cleanType) tags2.push(`<span class="copilot-tag copilot-tag-white">${escapeHtml(cleanType)}</span>`);
                }
                if (order.orderCost) tags2.push(`<span class="copilot-tag copilot-tag-white">${escapeHtml(order.orderCost)}</span>`);
                if (tags2.length) {
                    orderLines.push(`<div class="trial-line no-highlight trial-tags">${tags2.join(' ')}</div>`);
                }
                const line3 = [];
                if (typeof order.expedited === 'boolean') {
                    const expText = order.expedited ? 'EXPEDITED' : 'NON EXPEDITED';
                    line3.push(`<span class="copilot-tag copilot-tag-white">${expText}</span>`);
                }
                if (typeof order.hasRA === 'boolean') {
                    const txt = order.raExpired ? 'EXPIRED' : (order.hasRA ? 'YES' : 'NO');
                    line3.push(`<span class="copilot-tag copilot-tag-white">RA: ${txt}</span>`);
                }
                if (typeof order.hasVA === 'boolean') {
                    line3.push(`<span class="copilot-tag copilot-tag-white">VA: ${order.hasVA ? 'YES' : 'NO'}</span>`);
                }
                if (line3.length) orderLines.push(`<div class="trial-line no-highlight trial-exp-va">${line3.join(' ')}</div>`);
            }

            const orderHeaderHtml = `<div class="trial-order"><div class="trial-info">${orderLines.join('')}</div><div class="trial-action"><span id="trial-big-button"></span></div></div>`;

            const html = `
                <div class="trial-close">✕</div>
                ${orderHeaderHtml}
                <div class="trial-columns">
                    <div class="trial-col-wrap"><div class="trial-col-title">DB</div><div class="trial-col">${dbLines.join('')}</div></div>
                    <div class="trial-col-wrap"><div class="trial-col-title">ADYEN</div><div class="trial-col">${adyenLines.join('')}</div></div>
                    <div class="trial-col-wrap"><div class="trial-col-title">KOUNT</div><div class="trial-col">${kountLines.join('')}</div></div>
                </div>
                ${actions}
            `;

            return html;
        }

        function formatIssueText(text) {
            if (!text) return '';
            const norm = text.toLowerCase().replace(/\s+/g, ' ').trim();
            if (norm.includes('a clear photo of the card used to pay for the order') &&
                norm.includes('selfie holding your id')) {
                return 'ID CONFIRMATION ISSUE';
            }
            let formatted = text.replace(/\s*(\d+\s*[).])/g, (m,g)=>'\n'+g+' ');
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
        }

        function hideIssueBox() {
            const section = document.getElementById('issue-summary-section');
            const box = document.getElementById('issue-summary-box');
            const content = document.getElementById('issue-summary-content');
            const label = document.getElementById('issue-status-label');
            if (!section || !box || !content || !label) return;
            content.innerHTML = 'No issue data yet.';
            label.textContent = '';
            label.className = 'issue-status-label';
            section.style.display = 'none';
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
                    fillIssueBox(null, orderId);
                    return;
                }
                fillIssueBox(resp && resp.issueInfo, orderId);
            });
        }

        const insertDnaAfterCompany = window.insertDnaAfterCompany;

        function loadDbSummary() {
            const container = document.getElementById('db-summary-section');
            const fraud = document.getElementById('fraud-summary-section');
            if (!container) return;
            chrome.storage.local.get({ sidebarDb: [], sidebarOrderId: null, sidebarOrderInfo: null }, ({ sidebarDb, sidebarOrderId, sidebarOrderInfo }) => {
                if (Array.isArray(sidebarDb) && sidebarDb.length) {
                    container.innerHTML = sidebarDb.join('');
                    attachCommonListeners(container);
                    const qbox = container.querySelector('#quick-summary');
                    if (qbox) { 
                        qbox.classList.add('quick-summary-collapsed'); 
                        qbox.style.maxHeight = '0px'; 
                    }
                    insertDnaAfterCompany();
                    if (typeof applyStandardSectionOrder === 'function') {
                        applyStandardSectionOrder(container);
                    }
                    checkLastIssue(sidebarOrderId);
                    if (fraud) fraud.innerHTML = '';
                } else {
                    container.innerHTML = '';
                    hideIssueBox();
                    if (fraud) insertFraudSummary();
                }
            });
        }

        function clearSidebar(resetDna = true) {
            const data = { sidebarDb: [], sidebarOrderId: null, sidebarOrderInfo: null, sidebarFreezeId: null };
            if (resetDna) data.adyenDnaInfo = null;
            chrome.storage.local.set(data);
            const db = document.getElementById('db-summary-section');
            const dna = document.getElementById('dna-summary');
            const fraud = document.getElementById('fraud-summary-section');
            const issueSection = document.getElementById('issue-summary-section');
            if (db) db.innerHTML = '';
            if (dna && resetDna) dna.innerHTML = '';
            if (fraud) fraud.innerHTML = '';
            if (issueSection) {
                const content = issueSection.querySelector('#issue-summary-content');
                const label = issueSection.querySelector('#issue-status-label');
                if (content) content.innerHTML = 'No issue data yet.';
                if (label) { label.textContent = ''; label.className = 'issue-status-label'; }
                issueSection.style.display = 'none';
            }
            insertFraudSummary();
        }

        function endFraudSession() {
            console.log('[FENNEC (POO)] Ending fraud session - closing all XRAY flow tabs and clearing storage');
            
            // Clear sidebar and local storage
            clearSidebar(false);
            
            // Get the current fraud review session to identify which tabs to close
            chrome.storage.local.get({ fraudReviewSession: null }, ({ fraudReviewSession }) => {
                const orderId = fraudReviewSession;
                
                // Clear all XRAY-related storage
                const storageKeysToClear = [
                    'fraudReviewSession',
                    'sidebarFreezeId',
                    'sidebarDb',
                    'sidebarOrderId', 
                    'sidebarOrderInfo',
                    'adyenDnaInfo',
                    'kountInfo',
                    'fennecFraudAdyen',
                    'fennecReturnTab',
                    'fennecDbSearchTab',
                    'intStorageLoaded',
                    'intStorageOrderId',
                    'xrayOpenedTabs',
                    'intStorageCache'
                ];
                
                chrome.storage.local.remove(storageKeysToClear);
                
                // Clear localStorage flags
                localStorage.removeItem('fraudXrayCompleted');
                localStorage.removeItem('fraudXrayFinished');
                
                // Clear session storage
                sessionStorage.removeItem('fennecShowTrialFloater');
                sessionStorage.removeItem('fennec_order');
                
                // Clear flow completion flags for this order
                if (orderId) {
                    localStorage.removeItem(`fennecAdyenFlowCompleted_${orderId}`);
                    localStorage.removeItem(`fennecKountFlowCompleted_${orderId}`);
                }
                
                // Close all tabs opened during the XRAY flow using tracked tab IDs
                chrome.storage.local.get({ xrayOpenedTabs: [], fraudReviewSession: null }, ({ xrayOpenedTabs, fraudReviewSession }) => {
                    if (xrayOpenedTabs && xrayOpenedTabs.length > 0) {
                        console.log('[FENNEC (POO)] Closing tracked XRAY flow tabs:', xrayOpenedTabs.length, 'tabs');
                        
                        // Use background controller to close tracked tabs
                        bg.send('closeTabsByIds', { tabIds: xrayOpenedTabs }, (response) => {
                            if (response && response.success) {
                                console.log('[FENNEC (POO)] Successfully closed tracked XRAY flow tabs');
                            } else {
                                console.log('[FENNEC (POO)] Failed to close tracked tabs, trying fallback');
                                closeTabsByUrlPatterns();
                            }
                        });
                    } else {
                        console.log('[FENNEC (POO)] No tracked XRAY tabs found - using URL pattern fallback');
                        closeTabsByUrlPatterns();
                    }
                });
                
                function closeTabsByUrlPatterns() {
                    // Use background controller to close tabs by URL patterns
                    const urlPatterns = [
                        'db.incfile.com/incfile/order/detail/',
                        'db.incfile.com/order-tracker/orders/order-search',
                        'awc.kount.net/workflow/',
                        'ca-live.adyen.com'
                    ];
                    
                    bg.send('closeTabsByUrlPatterns', { 
                        patterns: urlPatterns,
                        fraudReviewSession: fraudReviewSession 
                    }, (response) => {
                        if (response && response.success) {
                            console.log('[FENNEC (POO)] Successfully closed XRAY flow tabs by URL patterns');
                        } else {
                            console.log('[FENNEC (POO)] Failed to close tabs by URL patterns, trying title-based matching');
                            closeTabsByTitles();
                        }
                    });
                }
                
                function closeTabsByTitles() {
                    // Use background controller to close tabs by titles
                    const titlePatterns = ['[DB]', '[KOUNT]', '[EKATA]', '[ADYEN]', 'Order Search'];
                    
                    bg.send('closeTabsByTitles', { 
                        patterns: titlePatterns 
                    }, (response) => {
                        if (response && response.success) {
                            console.log('[FENNEC (POO)] Successfully closed XRAY flow tabs by titles');
                        } else {
                            console.log('[FENNEC (POO)] Failed to close tabs by titles');
                        }
                    });
                }
                
                // Reset state and show initial status
                floaterRefocusDone = false;
                showInitialStatus();
                
                // Focus back to the fraud tracker
                chrome.storage.local.set({ fennecReturnTab: null }, () => {
                    bg.refocusTab();
                });
            });
        }

        function showInitialStatus() {
            const db = document.getElementById('db-summary-section');
            const dna = document.getElementById('dna-summary');
            const kount = document.getElementById('kount-summary');
            const fraud = document.getElementById('fraud-summary-section');
            const issueSection = document.getElementById('issue-summary-section');
            if (db) db.innerHTML = '';
            if (dna) dna.innerHTML = '';
            if (kount) kount.innerHTML = '';
            if (issueSection) hideIssueBox();
            if (fraud) insertFraudSummary();
        }

        injectSidebar();
        scanOrders();
        chrome.storage.local.get({ fraudReviewSession: null }, () => {
            if (!sessionStorage.getItem('fennecShowTrialFloater')) {
                chrome.storage.local.set({ sidebarDb: [], sidebarOrderId: null, sidebarOrderInfo: null, adyenDnaInfo: null, kountInfo: null, sidebarFreezeId: null });
                showInitialStatus();
            } else {
                loadDbSummary();
                loadDnaSummary();
                loadKountSummary();
                showTrialFloater(60, true);
            }
        });
        const clearBtn = document.getElementById('copilot-clear');
        if (clearBtn) clearBtn.onclick = clearSidebar;

        new MutationObserver(() => {
            if (scanTimeout) return;
            scanTimeout = setTimeout(() => {
                scanTimeout = null;
                scanOrders();
            }, 500);
        }).observe(document.body, { childList: true, subtree: true });
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && (changes.sidebarDb || changes.sidebarOrderId)) {
                loadDbSummary();
            }
            if (area === 'local' && changes.adyenDnaInfo) {
                loadDnaSummary();
            }
            if (area === 'local' && changes.kountInfo) {
                loadKountSummary();
            }
            if (area === 'local' && changes.adyenDnaInfo) {
                if (sessionStorage.getItem('fennecShowTrialFloater') || trialFloater.exists()) {
                    showTrialFloater(60, true);
                }
            }
            if (area === 'local' && changes.fraudXrayFinished && changes.fraudXrayFinished.newValue === '1') {
                chrome.storage.local.remove('fraudXrayFinished');
                if (sessionStorage.getItem('fennecShowTrialFloater') || trialFloater.exists()) {
                    showTrialFloater(60, true);
                }
            }
        });
        window.addEventListener('focus', () => {
            loadDnaSummary();
            loadKountSummary();
            if (localStorage.getItem('fraudXrayFinished') === '1') {
                localStorage.removeItem('fraudXrayFinished');
                if (sessionStorage.getItem('fennecShowTrialFloater') || trialFloater.exists()) {
                    showTrialFloater(60, true);
                }
            } else {
                chrome.storage.local.get({ fraudXrayFinished: null }, ({ fraudXrayFinished }) => {
                    if (fraudXrayFinished === '1') {
                        chrome.storage.local.remove('fraudXrayFinished');
                        if (sessionStorage.getItem('fennecShowTrialFloater') || trialFloater.exists()) {
                            showTrialFloater(60, true);
                        }
                    } else {
                        if (sessionStorage.getItem('fennecShowTrialFloater') || trialFloater.exists()) {
                            showTrialFloater(60, true);
                        }
                    }
                });
            }
        });

        // React to XRAY completion even if this tab never regained focus
        window.addEventListener('storage', (e) => {
            if (e.key === 'fraudXrayFinished' && e.newValue === '1') {
                localStorage.removeItem('fraudXrayFinished');
                if (sessionStorage.getItem('fennecShowTrialFloater') || trialFloater.exists()) {
                    showTrialFloater(60, true);
                }
            }
        });
    });
})();
