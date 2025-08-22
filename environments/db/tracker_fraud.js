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

        // Helper functions that need to be defined early
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

        // State and country utility functions and constants
        const STATE_ABBRS = 'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
        const STATE_NAMES = [
            'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'
        ];

        function guessCountry(text) {
            if (!text || typeof text !== 'string') return null;
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
            if (!text || typeof text !== 'string') return null;
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
            
            // Setup INT STORAGE click handler
            const orderId = sessionStorage.getItem('fennec_order') || localStorage.getItem('fraudReviewSession');
            if (orderId) {
                setupIntStorageClickHandler(orderId);
            }
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

                function formatCurrency(amount) {
                    if (!amount || amount === 0) return '$0.00';
                    return '$' + amount.toFixed(2);
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
        
        // Function to focus on ADYEN DNA tab
        function focusAdyenDnaTab() {
            const dnaElement = document.getElementById('dna-summary');
            if (dnaElement) {
                dnaElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                dnaElement.style.border = '2px solid #007bff';
                setTimeout(() => {
                    dnaElement.style.border = '';
                }, 2000);
            }
            
            // Also try to find and focus on the ADYEN DNA tab in the sidebar
            const sidebar = document.querySelector('.sidebar-content');
            if (sidebar) {
                const adyenTab = sidebar.querySelector('[data-tab="adyen"]') || 
                                 sidebar.querySelector('.tab-button[onclick*="adyen"]') ||
                                 sidebar.querySelector('.tab-button:contains("ADYEN")');
                if (adyenTab) {
                    adyenTab.click();
                }
            }
        }
        
        // Make callable from page scripts
        window.focusAdyenDnaTab = focusAdyenDnaTab;

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
            if ((!flag && !force && !overlayExists) || retries <= 0) {
                return;
            }
            const summary = document.getElementById("fraud-summary-box");
            if (summary) summary.remove();
            chrome.storage.local.get({ adyenDnaInfo: null, kountInfo: null, sidebarOrderInfo: null }, data => {
                let html = '';
                try {
                    html = buildTrialHtml(data.adyenDnaInfo, data.kountInfo, data.sidebarOrderInfo);
                } catch (error) {
                    console.error('[EKATA] buildTrialHtml error', error);
                    // Create a basic fallback HTML
                    html = `
                        <div class="trial-error">
                            <div class="trial-line trial-center"><b>TRIAL FLOATER ERROR</b></div>
                            <div class="trial-line trial-center">Data extraction completed successfully</div>
                            <div class="trial-line trial-center">but display encountered an error</div>
                            <div class="trial-line trial-center">Please check console for details</div>
                        </div>
                    `;
                }
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
                try {
                trialFloater.ensure();
                const overlay = trialFloater.element;
                const title = trialFloater.header;
                    if (overlay && html) {
                overlay.innerHTML = html;
                    } else {
                        console.error('[EKATA] floater overlay/HTML missing', { overlay: !!overlay, html: !!html });
                    }
                } catch (error) {
                    console.error('[EKATA] ensure floater error', error);
                }
                
                if (!trialFloater.element) {
                    console.error('[EKATA] floater overlay missing');
                    return;
                }
                
                const txHeader = trialFloater.element.querySelector('.trial-tx-header');
                if (txHeader) txHeader.addEventListener('click', () => bg.send('focusDnaTab'));
                const ordersHeader = trialFloater.element.querySelector('.trial-orders-header');
                if (ordersHeader) ordersHeader.addEventListener('click', () => {
                    const email = (data.sidebarOrderInfo && data.sidebarOrderInfo.clientEmail) || '';
                    const url = email ? `https://db.incfile.com/order-tracker/orders/order-search?fennec_email=${encodeURIComponent(email)}` : 'https://db.incfile.com/order-tracker/orders/order-search';
                    chrome.storage.local.set({ fennecReturnTab: null }, () => {
                        bg.openOrReuseTab({ url, active: true, refocus: true });
                    });
                });
                const close = trialFloater.element.querySelector('.trial-close');
                if (close) close.addEventListener('click', () => {
                    trialFloater.element.remove();
                    if (trialFloater.header) trialFloater.header.remove();
                    endFraudSession();
                    chrome.storage.local.set({ fennecReturnTab: null }, () => {
                        bg.refocusTab();
                    });
                });
                const subBtn = trialFloater.element.querySelector('#sub-detection-btn');
                if (subBtn) {
                    subBtn.addEventListener('click', () => {
                        subBtn.disabled = true;
                        const req = ++subDetectSeq;
                        const dna = data.adyenDnaInfo;
                        const kount = data.kountInfo;
                        const order = data.sidebarOrderInfo;
                        const dbCol = trialFloater.element.querySelector('.trial-col');
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
                            const col = trialFloater.element.querySelector('.trial-col');
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
                    if (title) title.remove();
                    endFraudSession();
                    showTrialSuccess();
                }

                const crBtn = trialFloater.element.querySelector('#trial-btn-cr');
                if (crBtn) crBtn.addEventListener('click', () => handleTrialAction('.cancel-and-refund-potential-fraud'));
                const idBtn = trialFloater.element.querySelector('#trial-btn-id');
                if (idBtn) idBtn.addEventListener('click', () => handleTrialAction('.confirm-fraud-potential-fraud'));
                const relBtn = trialFloater.element.querySelector('#trial-btn-release');
                if (relBtn) relBtn.addEventListener('click', () => handleTrialAction('.remove-potential-fraud'));

                const crossCountTotal = trialFloater.element.querySelectorAll('.db-adyen-cross').length;
                let crossCount = crossCountTotal;
                if (crossCountTotal > 0) {
                    const labels = ['AVS:', 'CLIENT:', 'EMAIL:', 'EMAIL AGE:'];
                    let excl = 0;
                    labels.forEach(l => {
                        const line = Array.from(trialFloater.element.querySelectorAll('.trial-line')).find(div => {
                            const t = div.querySelector('.trial-tag');
                            return t && t.textContent.trim() === l;
                        });
                        if (line) excl += line.querySelectorAll('.db-adyen-cross').length;
                    });
                    if (crossCountTotal === excl) crossCount = 0;
                }
                const bigSpot = trialFloater.element.querySelector('#trial-big-button');
                let headerCls = 'trial-header-green';
                if (crossCount > 4) headerCls = 'trial-header-red';
                else if (crossCount > 0) headerCls = 'trial-header-purple';
                if (trialFloater.header) trialFloater.header.className = headerCls;
                trialFloater.element.classList.remove('trial-header-green','trial-header-purple','trial-header-red');
                trialFloater.element.classList.add(headerCls);
                const orderHeader = trialFloater.element.querySelector('.trial-order');
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
                    const cols = trialFloater.element.querySelectorAll('.trial-columns .trial-col');
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
                                // Make each status label clickable with a tooltip of order IDs
                                const statusToOrders = { CXL: [], PENDING: [], SHIPPED: [], TRANSFER: [] };
                                if (Array.isArray(resp.orders)) {
                                    resp.orders.forEach(o => {
                                        const s = String(o.status || '').toUpperCase();
                                        const id = o.orderId || o.id;
                                        if (!id) return;
                                        if (/CANCEL/.test(s)) statusToOrders.CXL.push(id);
                                        else if (/TRANSFERRED/.test(s)) statusToOrders.TRANSFER.push(id);
                                        else if (/SHIPPED/.test(s)) statusToOrders.SHIPPED.push(id);
                                        else if (/PROCESSING|REVIEW|HOLD/.test(s)) statusToOrders.PENDING.push(id);
                                    });
                                }
                                // Enhance the recently added rows: inject spans with data-status
                                const fourRows = extraInfo.querySelectorAll('.trial-four-col');
                                fourRows.forEach(row => {
                                    const spans = row.querySelectorAll('.trial-tag');
                                    spans.forEach(tagSpan => {
                                        const label = (tagSpan.textContent || '').replace(':', '').trim();
                                        if (['CXL', 'PENDING', 'SHIPPED', 'TRANSFER'].includes(label)) {
                                            const valueSpan = tagSpan.nextElementSibling;
                                            if (valueSpan) {
                                                valueSpan.classList.add('trial-status-label');
                                                valueSpan.setAttribute('data-status', label);
                                                valueSpan.style.cursor = 'pointer';
                                            }
                                        }
                                    });
                                });
                                const goodTotal = resp.statusCounts.total >= resp.statusCounts.cxl * 2;
                                addCenter(`TOTAL: <b>${resp.statusCounts.total}</b> <span class="${goodTotal ? 'db-adyen-check' : 'db-adyen-cross'}" title="Order volume vs cancellations">${goodTotal ? '✔' : '✖'}</span>`);
                                addSep();
                                if (resp.ltv) {
                                    const openOrders = (parseInt(resp.statusCounts.total, 10) || 0) -
                                                        (parseInt(resp.statusCounts.cxl, 10) || 0);
                                    const ltvNum = Math.round(parseFloat(String(resp.ltv).replace(/[^0-9.]/g, '')) || 0);
                                    const ratio = openOrders > 0 ? `$${(ltvNum / openOrders).toFixed(2)}` : '$0.00';
                                    addFour([['LTV', resp.ltv], ['P/ORDER', ratio]]);
                                }
                                // Attach click handlers for tooltip popovers after DOM update
                                setTimeout(() => {
                                    const existing = trialFloater.element.querySelectorAll('.trial-status-tooltip');
                                    existing.forEach(e => e.remove());
                                    const onDocClick = (ev) => {
                                        const tip = ev.target.closest('.trial-status-tooltip');
                                        const label = ev.target.closest('.trial-status-label');
                                        if (tip || label) return; // keep open if clicking inside or on a label
                                        document.removeEventListener('click', onDocClick, true);
                                        const tips = trialFloater.element.querySelectorAll('.trial-status-tooltip');
                                        tips.forEach(t => t.remove());
                                    };
                                    extraInfo.querySelectorAll('.trial-status-label').forEach(lbl => {
                                        lbl.addEventListener('click', (e) => {
                                            // Check if there's already a tooltip for this label
                                            const existingTip = document.querySelector('.trial-status-tooltip');
                                            if (existingTip) {
                                                existingTip.remove();
                                                document.removeEventListener('click', onDocClick, true);
                                                return;
                                            }
                                            
                                            const statusKey = lbl.getAttribute('data-status');
                                            const ids = statusToOrders[statusKey] || [];
                                            const tip = document.createElement('div');
                                            tip.className = 'trial-status-tooltip';
                                            tip.style.position = 'absolute';
                                            tip.style.zIndex = '2147483647';
                                            tip.style.background = '#fff';
                                            tip.style.border = '1px solid #ccc';
                                            tip.style.borderRadius = '6px';
                                            tip.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
                                            tip.style.padding = '8px';
                                            tip.style.maxWidth = '260px';
                                            tip.style.fontSize = '12px';
                                            const list = document.createElement('div');
                                            const topTen = ids.slice(0, 10);
                                            list.innerHTML = topTen.map(id => `<div><a href="https://db.incfile.com/incfile/order/detail/${id}" target="_blank" rel="noreferrer">${id}</a></div>`).join('') || '<div>No orders</div>';
                                            tip.appendChild(list);
                                            if (ids.length > 10) {
                                                const more = document.createElement('div');
                                                more.style.marginTop = '6px';
                                                more.innerHTML = `<a href="#" class="trial-see-more">See more</a>`;
                                                more.querySelector('a').addEventListener('click', (ev) => {
                                                    ev.preventDefault();
                                                    // Focus Order Search tab
                                                    chrome.storage.local.set({ fennecReturnTab: null }, () => {
                                                        const email = (order && order.clientEmail) || (data.sidebarOrderInfo && data.sidebarOrderInfo.clientEmail) || '';
                                                        const url = email ? `https://db.incfile.com/order-tracker/orders/order-search?fennec_email=${encodeURIComponent(email)}` : 'https://db.incfile.com/order-tracker/orders/order-search';
                                                        bg.openOrReuseTab({ url, active: true, refocus: true });
                                                    });
                                                });
                                                tip.appendChild(more);
                                            }
                                            // Position near label
                                            const rect = lbl.getBoundingClientRect();
                                            tip.style.left = Math.round(rect.left + window.scrollX) + 'px';
                                            tip.style.top = Math.round(rect.bottom + window.scrollY + 6) + 'px';
                                            document.body.appendChild(tip);
                                            // Close on outside click
                                            setTimeout(() => document.addEventListener('click', onDocClick, true), 0);
                                        });
                                    });
                                }, 0);
                                // Do not append COUNTRY/STATE lines here to avoid duplication with the main DB column.
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
                ? '<span class="name-match check" title="Names across DB/Adyen/Kount match">✔</span>'
                : '<span class="name-match cross" title="Names across DB/Adyen/Kount do not match">✖</span>';

            function colorFor(res) {
                if (res === 'green') return 'copilot-tag-green';
                if (res === 'purple') return 'copilot-tag-purple';
                return 'copilot-tag-black';
            }
            function pushFlag(html) {
                if (/copilot-tag-green/.test(html)) green.push(html);
                if (/copilot-tag-purple/.test(html)) red.push(html);
            }

            function verdictIcon(ok, label) {
                const safe = escapeHtml(label || '');
                return `<span class="${ok ? 'db-adyen-check' : 'db-adyen-cross'}" title="${safe}">${ok ? '✔' : '✖'}</span>`;
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
                if (!text || typeof text !== 'string') return '';
                const digits = String(text).replace(/[^0-9]/g, '');
                if (digits.length >= 4) {
                    const mm = digits.slice(0,2).padStart(2, '0');
                    const yy = digits.slice(-2);
                    return `${mm}/${yy}`;
                }
                return text;
            }





            function normName(name) {
                if (!name || typeof name !== 'string') return '';
                return name.toLowerCase().replace(/[^a-z]+/g, ' ').trim();
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
                const norm = t => {
                    if (!t || typeof t !== 'string') return '';
                    return t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
                };
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
                dnaDigits = (dna && dna.payment && dna.payment.card && dna.payment.card['Card number'] ? dna.payment.card['Card number'] : '').replace(/\D+/g, '').slice(-4);
                dbExp = (order.billing.expiry || '').replace(/\D+/g, '');
                dnaExp = (dna && dna.payment && dna.payment.card && dna.payment.card['Expiry date'] ? dna.payment.card['Expiry date'] : '').replace(/\D+/g, '');
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
                dbLines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">EMAIL:</span><span class="trial-value">${escapeHtml(email)} ${verdictIcon(emailOk, 'Email user matches client/member/company')}</span></div>`);
                if (clientName) {
                    let cOk = namesMatch(clientName, order.billing.cardholder) ||
                               namesPartialMatch(clientName, order.billing.cardholder);
                    if (!cOk && Array.isArray(order.members)) {
                        cOk = order.members.some(m => namesMatch(clientName, m.name) ||
                                                     namesPartialMatch(clientName, m.name));
                    }
                    dbLines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">CLIENT:</span><span class="trial-value">${escapeHtml(clientName)} ${verdictIcon(cOk, 'Client name matches cardholder or member')}</span></div>`);
                }
                if (Array.isArray(order.members) && order.members.length) {
                    const items = order.members.map(m => {
                        const ok = namesMatch(m.name, order.billing.cardholder) ||
                                   namesPartialMatch(m.name, order.billing.cardholder) ||
                                   namesMatch(m.name, clientInfo.name) ||
                                   namesPartialMatch(m.name, clientInfo.name);
                        return `<li>${escapeHtml(m.name)}${ok ? ' <span class="db-adyen-check" title="Member name matches cardholder or client">✔</span>' : ''}</li>`;
                    }).join('');
                    dbLines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">MEMBERS:</span><span class="trial-value"><ul class="member-list">${items}</ul></span></div>`);
                }
                // Move COUNTRY/STATE right after MEMBERS and before the separator
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
                dbLines.push('<div class="trial-line trial-sep"></div>');
                dbLines.push('<div class="trial-line trial-orders-header" style="text-align:center;font-weight:bold;cursor:pointer;">ORDERS</div>');
                dbLines.push('<div id="db-extra-info"></div>');
                const btn = `<button id="sub-detection-btn" class="sub-detect-btn">SUB DETECTION</button>`;
                dbLines.push(`<div class="trial-line">${btn}</div>`);
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
                    adyenLines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">CVV:</span><span class="trial-value">${escapeHtml(proc['CVC/CVV'])} ${verdictIcon(ok, 'CVV matches')}</span></div>`);
                    if (ok) {
                        const tag = `<span class="copilot-tag ${colorFor(r.result)}">${escapeHtml(r.label)}</span>`;
                        pushFlag(tag);
                    }
                }
                if (proc['AVS']) {
                    const r = formatAvs(proc['AVS']);
                    const ok = r.result === 'green';
                    adyenLines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">AVS:</span><span class="trial-value">${escapeHtml(proc['AVS'])} ${verdictIcon(ok, 'AVS matches')}</span></div>`);
                    if (ok) {
                        const tag = `<span class="copilot-tag ${colorFor(r.result)}">${escapeHtml(r.label)}</span>`;
                        pushFlag(tag);
                    }
                }
                adyenLines.push('<div class="trial-line trial-sep"></div>');
                adyenLines.push('<div class="trial-line trial-tx-header" style="text-align:center;font-weight:bold;cursor:pointer;" onclick="focusAdyenDnaTab()">TRANSACTIONS</div>');
                const tx = dna.transactions || {};
                const settledCount = parseInt((tx['Settled'] || tx['Authorised / Settled'] || {}).count || '0', 10);
                const totalCount = parseInt((tx['Total'] || tx['Total transactions'] || {}).count || '0', 10);
                const settledAmt = parseAmount((tx['Settled'] || tx['Authorised / Settled'] || {}).amount);
                const totalAmt = parseAmount((tx['Total'] || tx['Total transactions'] || {}).amount);
                
                // Build two-column layout
                const leftColumn = [];
                const rightColumn = [];
                
                if (totalCount) {
                    leftColumn.push(`<div class="trial-line trial-two-col"><span class="trial-tag">TOTAL:</span><span class="trial-value">${totalCount}</span></div>`);
                    const failed = totalCount - settledCount;
                    if (failed > 0) {
                        rightColumn.push(`<div class="trial-line trial-two-col"><span class="trial-tag">FAILED:</span><span class="trial-value">${failed}</span></div>`);
                    }
                    if (settledCount > 0) {
                        rightColumn.push(`<div class="trial-line trial-two-col"><span class="trial-tag">SETTLED:</span><span class="trial-value">${settledCount}</span></div>`);
                    }
                } else if (totalAmt) {
                    // Handle amount-based transactions
                    leftColumn.push(`<div class="trial-line trial-two-col"><span class="trial-tag">TOTAL:</span><span class="trial-value">${formatCurrency(totalAmt)}</span></div>`);
                    const failedAmt = totalAmt - settledAmt;
                    if (failedAmt > 0) {
                        rightColumn.push(`<div class="trial-line trial-two-col"><span class="trial-tag">FAILED:</span><span class="trial-value">${formatCurrency(failedAmt)}</span></div>`);
                    }
                    if (settledAmt > 0) {
                        rightColumn.push(`<div class="trial-line trial-two-col"><span class="trial-tag">SETTLED:</span><span class="trial-value">${formatCurrency(settledAmt)}</span></div>`);
                    }
                }
                
                // CXL (refunded) - only show if > 0
                const refundedCount = parseInt((tx['Refunded'] || tx['Refunded / Cancelled'] || {}).count || '0', 10);
                const refundedAmt = parseAmount((tx['Refunded'] || tx['Refunded / Cancelled'] || {}).amount);
                if (refundedCount > 0) {
                    rightColumn.push(`<div class="trial-line trial-two-col"><span class="trial-tag">CXL:</span><span class="trial-value">${refundedCount}</span></div>`);
                } else if (refundedAmt > 0) {
                    rightColumn.push(`<div class="trial-line trial-two-col"><span class="trial-tag">CXL:</span><span class="trial-value">${formatCurrency(refundedAmt)}</span></div>`);
                }
                
                // CB (chargebacks) - only show if > 0
                const cb = parseInt((tx['Chargebacks'] || tx['Chargeback'] || {}).count || '0', 10);
                const cbAmt = parseAmount((tx['Chargebacks'] || tx['Chargeback'] || {}).amount);
                if (cb > 0) {
                    rightColumn.push(`<div class="trial-line trial-two-col"><span class="trial-tag">CB:</span><span class="trial-value">${cb}</span></div>`);
                    red.push('<span class="copilot-tag copilot-tag-purple">CB</span>');
                } else if (cbAmt > 0) {
                    rightColumn.push(`<div class="trial-line trial-two-col"><span class="trial-tag">CB:</span><span class="trial-value">${formatCurrency(cbAmt)}</span></div>`);
                    red.push('<span class="copilot-tag copilot-tag-purple">CB</span>');
                }
                
                // Render two-column layout
                if (leftColumn.length > 0 || rightColumn.length > 0) {
                    adyenLines.push('<div class="trial-line" style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">');
                    adyenLines.push(`<div style="overflow:hidden;">${leftColumn.join('')}</div>`);
                    adyenLines.push(`<div style="overflow:hidden;">${rightColumn.join('')}</div>`);
                    adyenLines.push('</div>');
                }
                
                // SETTLED percentage - centered single column
                if (totalCount || totalAmt) {
                    const pct = totalCount ? Math.round(settledCount / totalCount * 100) : Math.round(settledAmt / totalAmt * 100);
                    const ok = pct >= 65;
                    adyenLines.push(`<div class="trial-line trial-center"><b>SETTLED: ${pct}% ${verdictIcon(ok, 'Settled rate ≥ 65%')}</b></div>`);
                    if (!ok) red.push('<span class="copilot-tag copilot-tag-purple">APPROVED %</span>');
                }
                
                // NO PREVIOUS CB's legend
                if (cb === 0 && cbAmt === 0) {
                    adyenLines.push('<div class="trial-line trial-center"><b>NO PREVIOUS CB\'s <span class="db-adyen-check" title="No prior chargebacks">✔</span></b></div>');
                }
            }

            if (kount) {
                // New organized KOUNT layout
                if (kount.ekata) {
                    const ekata = kount.ekata;
                    
                    // Helper function to extract data from detailed EKATA info
                    const extractFromDetails = (details, key) => {
                        if (!details) return null;
                        const text = typeof details === 'string' ? details : JSON.stringify(details);
                        
                        // Special handling for resident name extraction
                        if (key === 'Resident Name' || key === 'Name') {
                            // Look for the specific pattern from the HTML structure
                            const residentMatch = text.match(/Resident Name[\\s:]+([^\\n\\r]+?)(?=\\s+Is Commercial|\\s+Is Forwarder|\\s+Type:|$)/i);
                            if (residentMatch) {
                                return residentMatch[1].trim();
                            }
                            
                            // Fallback to general pattern
                            const regex = new RegExp(`${key}[\\s:]+([^\\n\\r]+?)(?=\\s+Is Commercial|\\s+Is Forwarder|\\s+Type:|$)/i`);
                            const match = text.match(regex);
                            return match ? match[1].trim() : null;
                        }
                        
                        // General pattern for other fields
                        const regex = new RegExp(`${key}[\\s:]+([^\\s,]+)`, 'i');
                        const match = text.match(regex);
                        return match ? match[1] : null;
                    };

                    // Helper function to extract resident names from different sections
                    const extractResidentNames = (ekata) => {
                        const names = {};
                        
                        
                        // Priority: Use the new structured billingInfo and shippingInfo
                        if (ekata && ekata.billingInfo && ekata.billingInfo.residentName) {
                            names.billing = ekata.billingInfo.residentName.trim();
                        }
                        
                        if (ekata && ekata.shippingInfo && ekata.shippingInfo.residentName) {
                            names.shipping = ekata.shippingInfo.residentName.trim();
                        }
                        
                        // Fallback: Try to parse from residentDetails JSON
                        if ((!names.billing || !names.shipping) && ekata && ekata.residentDetails) {
                            try {
                                const details = typeof ekata.residentDetails === 'string' 
                                    ? JSON.parse(ekata.residentDetails) 
                                    : ekata.residentDetails;
                                
                                if (details.billing && details.billing.residentName && !names.billing) {
                                    names.billing = details.billing.residentName.trim();
                                }
                                
                                if (details.shipping && details.shipping.residentName && !names.shipping) {
                                    names.shipping = details.shipping.residentName.trim();
                                }
                            } catch (e) {
                            }
                        }
                        
                        // Legacy fallback: Extract from text patterns
                        if (!names.billing || !names.shipping) {
                            const allText = JSON.stringify(ekata);
                            
                            // Look for Resident Name patterns
                            const residentMatches = allText.match(/Resident Name[\\s:]+([^\\n\r]+?)(?=\\s+(Is Commercial|Is Forwarder|Type:|Distance|Linked|Warnings:|Errors:|Is Valid|Input Completeness|Match to Name)|$)/gi);
                            if (residentMatches && residentMatches.length > 0) {
                                if (!names.billing && residentMatches[0]) {
                                    const billingMatch = residentMatches[0].match(/Resident Name[\\s:]+([^\\n\r]+?)(?=\\s+(Is Commercial|Is Forwarder|Type:|Distance|Linked|Warnings:|Errors:|Is Valid|Input Completeness|Match to Name)|$)/i);
                                    if (billingMatch) {
                                        names.billing = billingMatch[1].trim();
                                    }
                                }
                                
                                if (!names.shipping && residentMatches[1]) {
                                    const shippingMatch = residentMatches[1].match(/Resident Name[\\s:]+([^\\n\r]+?)(?=\\s+(Is Commercial|Is Forwarder|Type:|Distance|Linked|Warnings:|Errors:|Is Valid|Input Completeness|Match to Name)|$)/i);
                                    if (shippingMatch) {
                                        names.shipping = shippingMatch[1].trim();
                                    }
                                }
                                
                                // If only one match found, use for both
                                if (!names.billing && !names.shipping && residentMatches.length === 1) {
                                    const match = residentMatches[0].match(/Resident Name[\\s:]+([^\\n\r]+?)(?=\\s+(Is Commercial|Is Forwarder|Type:|Distance|Linked|Warnings:|Errors:|Is Valid|Input Completeness|Match to Name)|$)/i);
                                if (match) {
                                    const name = match[1].trim();
                                        names.billing = name;
                                        names.shipping = name;
                                    }
                                }
                            }
                        }
                        
                        return names;
                    };
                    
                    // ADDRESS section
                    kountLines.push('<div class="trial-line trial-center"><b>ADDRESS</b></div>');
                    
                    // Extract resident names from different sections
                    const residentNames = extractResidentNames(ekata);
                    
                    // ADDRESS section - reorganized layout
                    
                    // Helper function to get CMRA status for an address
                    const getCmraStatus = (addressType) => {
                        let isCommercial = false;
                        
                        // Priority: Use the new structured data
                        if (addressType === 'Billing' && ekata.billingInfo && ekata.billingInfo.isCommercial) {
                            isCommercial = /^(yes|true|1)$/i.test(ekata.billingInfo.isCommercial);
                        } else if (addressType === 'Shipping' && ekata.shippingInfo && ekata.shippingInfo.isCommercial) {
                            isCommercial = /^(yes|true|1)$/i.test(ekata.shippingInfo.isCommercial);
                        }
                        
                        // Fallback: Try to parse from residentDetails JSON
                        if (!isCommercial && ekata.residentDetails) {
                            try {
                                const details = typeof ekata.residentDetails === 'string' 
                                    ? JSON.parse(ekata.residentDetails) 
                                    : ekata.residentDetails;
                                
                                if (addressType === 'Billing' && details.billing && details.billing.isCommercial) {
                                    isCommercial = /^(yes|true|1)$/i.test(details.billing.isCommercial);
                                } else if (addressType === 'Shipping' && details.shipping && details.shipping.isCommercial) {
                                    isCommercial = /^(yes|true|1)$/i.test(details.shipping.isCommercial);
                                }
                            } catch (e) {
                            }
                        }
                        
                        // Legacy fallback: Extract from text patterns
                        if (!isCommercial && ekata.residentDetails) {
                            const rdText = typeof ekata.residentDetails === 'string' ? ekata.residentDetails : JSON.stringify(ekata.residentDetails);
                            const sectionMatch = rdText.match(new RegExp(`${addressType} Info[\\s\\S]*?(?=Shipping Info|Billing Info|Phone|Email|$)`, 'i'));
                            if (sectionMatch) {
                                const commercialMatch = sectionMatch[0].match(/Is Commercial[\\s:]+(yes|no|true|false|1|0)/i);
                                if (commercialMatch) {
                                    isCommercial = /^(yes|true|1)$/i.test(commercialMatch[1]);
                                    
                                }
                            }
                        }
                        
                        return isCommercial;
                    };
                    
                    // Check if billing and shipping are the same
                    const sameAddress = residentNames.billing && residentNames.shipping && 
                                      residentNames.billing.toLowerCase() === residentNames.shipping.toLowerCase();
                    
                    if (sameAddress) {
                        // Combined SHIPPING/BILLING display
                        const otherNames = [];
                        if (order && order.billing && order.billing.cardholder) otherNames.push(order.billing.cardholder);
                        if (order && order.clientName) otherNames.push(order.clientName);
                        if (Array.isArray(order.members)) otherNames.push(...order.members.map(m => m.name));
                        if (order && order.registeredAgent && order.registeredAgent.name) otherNames.push(order.registeredAgent.name);
                        if (adyenName) otherNames.push(adyenName);
                        const match = otherNames.some(n => namesSharePart(residentNames.shipping, n));
                        const kIcon = verdictIcon(match, 'Shipping/Billing resident name aligns with cardholder/client/member');
                        kountLines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">SHIPPING/BILLING:</span><span class="trial-value">${escapeHtml(residentNames.shipping)} ${kIcon}</span></div>`);
                        
                        // Combined CMRA status
                        const shippingCmra = getCmraStatus('Shipping');
                        const billingCmra = getCmraStatus('Billing');
                        const combinedCmra = shippingCmra || billingCmra;
                        
                        // Use KOUNT CMRA data (not USPS)
                        cmraText = combinedCmra ? 'YES' : 'NO';
                        cmraIcon = combinedCmra 
                            ? '<span class="db-adyen-warning" title="KOUNT CMRA Detected">⚠️</span>'
                            : '<span class="db-adyen-check" title="KOUNT: Not CMRA">✔</span>';
                        
                        kountLines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">KOUNT CMRA:</span><span class="trial-value">${cmraText} ${cmraIcon}</span></div>`);
                        if (combinedCmra) red.push('<span class="copilot-tag copilot-tag-purple">KOUNT CMRA YES</span>');
                    } else {
                        // Separate SHIPPING and BILLING display
                        if (residentNames.shipping) {
                            const otherNames = [];
                            if (order && order.billing && order.billing.cardholder) otherNames.push(order.billing.cardholder);
                            if (order && order.clientName) otherNames.push(order.clientName);
                            if (Array.isArray(order.members)) otherNames.push(...order.members.map(m => m.name));
                            if (order && order.registeredAgent && order.registeredAgent.name) otherNames.push(order.registeredAgent.name);
                            if (adyenName) otherNames.push(adyenName);
                            const match = otherNames.some(n => namesSharePart(residentNames.shipping, n));
                            const kIcon = verdictIcon(match, 'Shipping resident name aligns with cardholder/client/member');
                            kountLines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">SHIPPING:</span><span class="trial-value">${escapeHtml(residentNames.shipping)} ${kIcon}</span></div>`);
                            
                            // Shipping CMRA
                            const shippingCmra = getCmraStatus('Shipping');
                            
                            // Use KOUNT CMRA data (not USPS)
                            cmraText = shippingCmra ? 'YES' : 'NO';
                            cmraIcon = shippingCmra 
                                ? '<span class="db-adyen-warning" title="KOUNT CMRA Detected">⚠️</span>'
                                : '<span class="db-adyen-check" title="KOUNT: Not CMRA">✔</span>';
                            
                            kountLines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">KOUNT CMRA:</span><span class="trial-value">${cmraText} ${cmraIcon}</span></div>`);
                            if (shippingCmra) red.push('<span class="copilot-tag copilot-tag-purple">KOUNT CMRA YES</span>');
                        } else {
                            kountLines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">SHIPPING:</span><span class="trial-value">NOT PROVIDED</span></div>`);
                        }
                        
                        if (residentNames.billing) {
                            const otherNames = [];
                            if (order && order.billing && order.billing.cardholder) otherNames.push(order.billing.cardholder);
                            if (order && order.clientName) otherNames.push(order.clientName);
                            if (Array.isArray(order.members)) otherNames.push(...order.members.map(m => m.name));
                            if (order && order.registeredAgent && order.registeredAgent.name) otherNames.push(order.registeredAgent.name);
                            if (adyenName) otherNames.push(adyenName);
                            const match = otherNames.some(n => namesSharePart(residentNames.billing, n));
                            const kIcon = verdictIcon(match, 'Billing resident name aligns with cardholder/client/member');
                            kountLines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">BILLING:</span><span class="trial-value">${escapeHtml(residentNames.billing)} ${kIcon}</span></div>`);
                            
                            // Billing CMRA
                            const billingCmra = getCmraStatus('Billing');
                            
                            // Use KOUNT CMRA data (not USPS)
                            cmraText = billingCmra ? 'YES' : 'NO';
                            cmraIcon = billingCmra 
                                ? '<span class="db-adyen-warning" title="KOUNT CMRA Detected">⚠️</span>'
                                : '<span class="db-adyen-check" title="KOUNT: Not CMRA">✔</span>';
                            
                            kountLines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">KOUNT CMRA:</span><span class="trial-value">${cmraText} ${cmraIcon}</span></div>`);
                            if (billingCmra) red.push('<span class="copilot-tag copilot-tag-purple">KOUNT CMRA YES</span>');
                        } else {
                            kountLines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">BILLING:</span><span class="trial-value">NOT PROVIDED</span></div>`);
                        }
                    }
                    
                    // Add Match to Name status if available
                    const getMatchToNameStatus = (addressType) => {
                        let matchStatus = '';
                        
                        // Priority: Use the new structured data
                        if (addressType === 'Billing' && ekata.billingInfo && ekata.billingInfo.matchToName) {
                            matchStatus = ekata.billingInfo.matchToName.trim();
                        } else if (addressType === 'Shipping' && ekata.shippingInfo && ekata.shippingInfo.matchToName) {
                            matchStatus = ekata.shippingInfo.matchToName.trim();
                        }
                        
                        // Fallback: Try to parse from residentDetails JSON
                        if (!matchStatus && ekata.residentDetails) {
                            try {
                                const details = typeof ekata.residentDetails === 'string' 
                                    ? JSON.parse(ekata.residentDetails) 
                                    : ekata.residentDetails;
                                
                                if (addressType === 'Billing' && details.billing && details.billing.matchToName) {
                                    matchStatus = details.billing.matchToName.trim();
                                } else if (addressType === 'Shipping' && details.shipping && details.shipping.matchToName) {
                                    matchStatus = details.shipping.matchToName.trim();
                                }
                            } catch (e) {
                            }
                        }
                        
                        return matchStatus;
                    };
                    
                    // Removed MATCH TO NAME line under ADDRESS per request
                    
                    // Add separation before EMAIL section
                    kountLines.push('<div class="trial-line trial-sep"></div>');
                    kountLines.push('<div class="trial-line trial-center"><b>EMAIL</b></div>');
                    
                    // Build per-address EMAIL lines with BILLING/SHIPPING labels
                    const normalizeFirstSeen = (val) => {
                        if (val === undefined || val === null || val === '') return '';
                        const n = parseInt(String(val).match(/\d+/)?.[0] || '0', 10);
                        return n === 0 ? 'NEW' : `${n} days`;
                    };
                    
                    const emailEntries = [];
                    const eBilling = ekata.email && ekata.email.billing ? ekata.email.billing : {};
                    const eShipping = ekata.email && ekata.email.shipping ? ekata.email.shipping : {};
                    
                    if (eBilling.registeredOwnerName || eBilling.emailFirstSeenDays || typeof eBilling.isValid === 'boolean') {
                        emailEntries.push({ 
                            tag: 'BILLING', 
                            owner: (eBilling.registeredOwnerName || '').trim(), 
                            firstSeen: normalizeFirstSeen(eBilling.emailFirstSeenDays),
                            isValid: eBilling.isValid
                        });
                    }
                    if (eShipping.registeredOwnerName || eShipping.emailFirstSeenDays || typeof eShipping.isValid === 'boolean') {
                        emailEntries.push({ 
                            tag: 'SHIPPING', 
                            owner: (eShipping.registeredOwnerName || '').trim(), 
                            firstSeen: normalizeFirstSeen(eShipping.emailFirstSeenDays),
                            isValid: eShipping.isValid
                        });
                    }
                    
                    // Fallback when structured email missing
                    let emailOwner = ekata.emailOwner;
                    if (emailEntries.length === 0 && !emailOwner) {
                        const allText = JSON.stringify(ekata);
                        let ownerMatch = allText.match(/Registered Owner Name[\s:]+([^\s]+(?:[\s]+[^\s]+)*?)(?=\s+Is Commercial|\s+Is Forwarder|\s+Type:|$)/i);
                        if (!ownerMatch) {
                            ownerMatch = allText.match(/Registered Owner Name[\s:]+([^\s]+(?:[\s]+[^\s]+)*)/i);
                        }
                        if (!ownerMatch) {
                            ownerMatch = allText.match(/Email Owner[\s:]+([^\s]+(?:[\s]+[^\s]+)*?)(?=\s+Is Commercial|\s+Is Forwarder|\s+Type:|$)/i);
                        }
                        if (!ownerMatch) {
                            ownerMatch = allText.match(/Email Owner[\s:]+([^\s]+(?:[\s]+[^\s]+)*)/i);
                        }
                        if (!ownerMatch) {
                            const allOwnerMatches = allText.match(/Registered Owner Name[\s:]+([^\s]+(?:[\s]+[^\s]+)*?)(?=\s+Is Commercial|\s+Is Forwarder|\s+Type:|$)/gi);
                            if (allOwnerMatches && allOwnerMatches.length > 0) {
                                const firstMatch = allOwnerMatches[0];
                                const nameMatch = firstMatch.match(/Registered Owner Name[\s:]+([^\s]+(?:[\s]+[^\s]+)*?)(?=\s+Is Commercial|\s+Is Forwarder|\s+Type:|$)/i);
                                if (nameMatch) {
                                    ownerMatch = nameMatch;
                                }
                            }
                        }
                        if (ownerMatch) emailOwner = ownerMatch[1].trim();
                        
                        if (!emailOwner) {
                            if (ekata.proxyDetails && typeof ekata.proxyDetails === 'string') {
                                const proxyText = ekata.proxyDetails;
                                const ownerMatch = proxyText.match(/Registered Owner Name[\s:]+([^\s]+\s+[^\s]+(?:[\s]+[^\s]+)?)/i);
                                if (ownerMatch) emailOwner = ownerMatch[1].trim();
                            }
                        }
                        
                        if (!emailOwner) {
                            const allText = JSON.stringify(ekata);
                            const ownerMatch = allText.match(/Registered Owner Name[\s:]+([^\s]+\s+[^\s]+(?:[\s]+[^\s]+)?)/i);
                            if (ownerMatch) emailOwner = ownerMatch[1].trim();
                        }
                    }
                    if (emailEntries.length === 0 && emailOwner) {
                        emailEntries.push({ tag: 'EMAIL', owner: emailOwner, firstSeen: '', isValid: undefined });
                    }

                    // Render per-address EMAIL lines with separate rows for each field
                    const renderEmailSection = ({ tag, owner, firstSeen, isValid }) => {
                        const lines = [];
                        const otherNames = [];
                        if (order && order.billing && order.billing.cardholder) otherNames.push(order.billing.cardholder);
                        if (order && order.clientName) otherNames.push(order.clientName);
                        if (Array.isArray(order.members)) otherNames.push(...order.members.map(m => m.name));
                        if (order && order.registeredAgent && order.registeredAgent.name) otherNames.push(order.registeredAgent.name);
                        if (adyenName) otherNames.push(adyenName);
                        
                        // Owner row
                        if (owner) {
                            const match = otherNames.some(n => namesSharePart(owner, n));
                            const icon = verdictIcon(match, 'Email owner aligns with cardholder/client/member');
                            lines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">${tag}:</span><span class="trial-value">${escapeHtml(owner)} ${icon}</span></div>`);
                        }
                        
                        // First Seen row
                        if (firstSeen) {
                            const num = /\d+/.test(firstSeen) ? parseInt(firstSeen, 10) : 0;
                            const ok = num > 1;
                            const icon = verdictIcon(ok, 'Email age > 1 day');
                            lines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">1ST SEEN:</span><span class="trial-value">${escapeHtml(firstSeen)} ${icon}</span></div>`);
                        }
                        
                        // Valid row
                        if (typeof isValid === 'boolean') {
                            const validText = isValid ? 'VALID' : 'INVALID';
                            const icon = verdictIcon(isValid, 'Email address valid');
                            lines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">VALID:</span><span class="trial-value">${validText} ${icon}</span></div>`);
                        }
                        
                        return lines;
                    };
                    
                    // Render each email section
                    emailEntries.forEach(entry => {
                        const lines = renderEmailSection(entry);
                        lines.forEach(line => kountLines.push(line));
                    });
                    
                    // Add separation before IP section
                    kountLines.push('<div class="trial-line trial-sep"></div>');
                    kountLines.push('<div class="trial-line trial-center"><b>IP</b></div>');
                    
                    // PROXY RISK (prefer structured ipInfo)
                    let isProxy = (ekata.ipInfo && typeof ekata.ipInfo.proxyRisk !== 'undefined') ? ekata.ipInfo.proxyRisk : ekata.proxyRisk;
                    if (typeof isProxy !== 'boolean') {
                        const allText = JSON.stringify(ekata);
                        const proxyMatch = allText.match(/Proxy Risk[\\s:]+(\\w+)/i);
                        if (proxyMatch) isProxy = /^(yes|true|1)$/i.test(proxyMatch[1]);
                    }
                    if (typeof isProxy === 'boolean') {
                        const proxyText = isProxy ? 'YES' : 'NO';
                        const ok = !isProxy;
                    kountLines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">PROXY:</span><span class="trial-value">${proxyText} ${verdictIcon(ok, 'No proxy/VPN detected')}</span></div>`);
                        if (isProxy) red.push('<span class="copilot-tag copilot-tag-purple">PROXY YES</span>');
                    }
                    
                    // VALID (prefer structured ipInfo)
                    let ipValid = (ekata.ipInfo && typeof ekata.ipInfo.isValid !== 'undefined') ? ekata.ipInfo.isValid : ekata.ipValid;
                    if (typeof ipValid !== 'boolean') {
                        const allText = JSON.stringify(ekata);
                        const validMatch = allText.match(/Is Valid[\\s:]+(\\w+)/i);
                        if (validMatch) ipValid = /^(yes|true|1)$/i.test(validMatch[1]);
                    }
                    if (typeof ipValid === 'boolean') {
                        const validText = ipValid ? 'VALID' : 'INVALID';
                        const ok = ipValid;
                        kountLines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">VALID:</span><span class="trial-value">${validText} ${verdictIcon(ok, 'IP address valid')}</span></div>`);
                        if (!ipValid) red.push('<span class="copilot-tag copilot-tag-purple">IP INVALID</span>');
                    }
                    
                    // LOCATION line - Subdivision/State, Country (prefer structured ipInfo)
                    let location = '';
                    const stateFromIp = ekata.ipInfo && (ekata.ipInfo.subdivision || ekata.ipInfo.state);
                    const countryFromIp = ekata.ipInfo && ekata.ipInfo.country;
                    if (stateFromIp || countryFromIp) {
                        location = [stateFromIp, countryFromIp].filter(Boolean).join(', ');
                    } else if (ekata.state || ekata.country) {
                        location = [ekata.state, ekata.country].filter(Boolean).join(', ');
                    } else {
                        const state = extractFromDetails(ekata, 'Subdivision') || extractFromDetails(ekata, 'State');
                        const country = extractFromDetails(ekata, 'Country');
                        if (state || country) location = [state, country].filter(Boolean).join(', ');
                    }
                    if (location) {
                        // Convert country names to standard abbreviations
                        const countryAbbreviations = {
                            'united states': 'US',
                            'united states of america': 'US',
                            'usa': 'US',
                            'canada': 'CA',
                            'mexico': 'MX',
                            'united kingdom': 'UK',
                            'united kingdom of great britain and northern ireland': 'UK',
                            'great britain': 'UK',
                            'germany': 'DE',
                            'france': 'FR',
                            'spain': 'ES',
                            'italy': 'IT',
                            'japan': 'JP',
                            'china': 'CN',
                            'australia': 'AU',
                            'brazil': 'BR',
                            'india': 'IN'
                        };
                        
                        let formattedLocation = location;
                        // Sort by length (longest first) to avoid partial matches
                        const sortedAbbreviations = Object.entries(countryAbbreviations)
                            .sort((a, b) => b[0].length - a[0].length);
                        
                        sortedAbbreviations.forEach(([fullName, abbr]) => {
                            const regex = new RegExp(`\\b${fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
                            formattedLocation = formattedLocation.replace(regex, abbr);
                        });
                        
                        kountLines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">LOCATION:</span><span class="trial-value">${escapeHtml(formattedLocation)}</span></div>`);
                    }
                    
                    // Add separation before PHONE section
                    kountLines.push('<div class="trial-line trial-sep"></div>');
                    kountLines.push('<div class="trial-line trial-center"><b>PHONE</b></div>');
                    
                    // VALID line - extract phone validation
                    let phoneValid = ekata.phoneValid;
                    if (phoneValid === undefined || phoneValid === null) {
                        const validText = extractFromDetails(ekata, 'Phone.*Is Valid') ||
                                        extractFromDetails(ekata, 'Is Valid.*true');
                        phoneValid = validText ? true : false;
                    }
                    if (typeof phoneValid === 'boolean') {
                        const validText = phoneValid ? 'VALID' : 'INVALID';
                        const ok = phoneValid; // Valid phone is good
                    kountLines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">VALID:</span><span class="trial-value">${validText} ${verdictIcon(ok, 'Phone number valid')}</span></div>`);
                        if (!phoneValid) red.push('<span class="copilot-tag copilot-tag-purple">PHONE INVALID</span>');
                    }
                    
                    // LOCATION line - extract phone location from Carrier
                    let phoneLocation = ekata.phoneLocation;
                    if (!phoneLocation) {
                        const allText = JSON.stringify(ekata);
                        
                        
                        // Try multiple patterns for phone carrier
                        let carrierMatch = allText.match(/Carrier[\\s:]+([^\\s]+(?:\\s+[^\\s]+)*)/i);
                        if (!carrierMatch) {
                            carrierMatch = allText.match(/Phone.*Carrier[\\s:]+([^\\s]+(?:\\s+[^\\s]+)*)/i);
                        }
                        if (!carrierMatch) {
                            carrierMatch = allText.match(/Line Type[\\s:]+([^\\s]+(?:\\s+[^\\s]+)*)/i);
                        }
                        if (carrierMatch) {
                            phoneLocation = carrierMatch[1].trim();
                        }
                        
                        // If still no phone location, try to extract from the actual data structure
                        if (!phoneLocation) {
                            // The data might be nested in proxyDetails or other fields
                            if (ekata.proxyDetails && typeof ekata.proxyDetails === 'string') {
                                const proxyText = ekata.proxyDetails;
                                const carrierMatch = proxyText.match(/Carrier[\\s:]+([^\\s]+(?:\\s+[^\\s]+)*)/i);
                                if (carrierMatch) {
                                    phoneLocation = carrierMatch[1].trim();
                                }
                            }
                        }
                        
                        // If still no phone location, try to extract from the raw JSON string
                        if (!phoneLocation) {
                            const allText = JSON.stringify(ekata);
                            const carrierMatch = allText.match(/Carrier[\\s:]+([^\\s]+(?:\\s+[^\\s]+)*)/i);
                            if (carrierMatch) {
                                phoneLocation = carrierMatch[1].trim();
                            }
                        }
                    }
                    if (phoneLocation) {
                        kountLines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">LOCATION:</span><span class="trial-value">${escapeHtml(phoneLocation)}</span></div>`);
                    }
                    
                    // OWNER line - extract phone owner from Subscriber Name
                    let phoneOwner = ekata.phoneOwner;
                    if (!phoneOwner) {
                        const allText = JSON.stringify(ekata);
                        
                        
                        // Try multiple patterns for phone owner
                        let ownerMatch = allText.match(/Subscriber Name[\\s:]+([^\\s]+\\s+[^\\s]+\\s+[^\\s]+)/i);
                        if (!ownerMatch) {
                            ownerMatch = allText.match(/Subscriber Name[\\s:]+([^\\s]+\\s+[^\\s]+)/i);
                        }
                        if (!ownerMatch) {
                            ownerMatch = allText.match(/Phone Owner[\\s:]+([^\\s]+\\s+[^\\s]+\\s+[^\\s]+)/i);
                        }
                        if (!ownerMatch) {
                            // Try a more flexible approach for phone owner
                            const allOwnerMatches = allText.match(/Subscriber Name[\\s:]+([^\\s]+\\s+[^\\s]+(?:\\s+[^\\s]+)?)/gi);
                            if (allOwnerMatches && allOwnerMatches.length > 0) {
                                const firstMatch = allOwnerMatches[0];
                                const nameMatch = firstMatch.match(/Subscriber Name[\\s:]+([^\\s]+\\s+[^\\s]+(?:\\s+[^\\s]+)?)/i);
                                if (nameMatch) {
                                    ownerMatch = nameMatch;
                                }
                            }
                        }
                        if (ownerMatch) {
                            phoneOwner = ownerMatch[1].trim();
                        }
                        
                        // If still no phone owner, try to extract from the actual data structure
                        if (!phoneOwner) {
                            // The data might be nested in proxyDetails or other fields
                            if (ekata.proxyDetails && typeof ekata.proxyDetails === 'string') {
                                const proxyText = ekata.proxyDetails;
                                const ownerMatch = proxyText.match(/Subscriber Name[\\s:]+([^\\s]+\\s+[^\\s]+(?:\\s+[^\\s]+)?)/i);
                                if (ownerMatch) {
                                    phoneOwner = ownerMatch[1].trim();
                                }
                            }
                        }
                        
                        // If still no phone owner, try to extract from the raw JSON string
                        if (!phoneOwner) {
                            const allText = JSON.stringify(ekata);
                            const ownerMatch = allText.match(/Subscriber Name[\\s:]+([^\\s]+\\s+[^\\s]+(?:\\s+[^\\s]+)?)/i);
                            if (ownerMatch) {
                                phoneOwner = ownerMatch[1].trim();
                            }
                        }
                    }
                    if (phoneOwner) {
                        const otherNames = [];
                        if (order && order.billing && order.billing.cardholder) otherNames.push(order.billing.cardholder);
                        if (order && order.clientName) otherNames.push(order.clientName);
                        if (Array.isArray(order.members)) otherNames.push(...order.members.map(m => m.name));
                        if (order && order.registeredAgent && order.registeredAgent.name) otherNames.push(order.registeredAgent.name);
                        if (adyenName) otherNames.push(adyenName);
                        const match = otherNames.some(n => namesSharePart(phoneOwner, n));
                        const kIcon = `<span class="${match ? 'db-adyen-check' : 'db-adyen-cross'}">${match ? '✔' : '✖'}</span>`;
                        kountLines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">OWNER:</span><span class="trial-value">${escapeHtml(phoneOwner)} ${kIcon}</span></div>`);
                    }
                    
                }
                
                // Display legacy KOUNT data (like old KOUNT)
                if (kount.emailAge) {
                    const num = parseInt(String(kount.emailAge).replace(/\D+/g, ''), 10) || 0;
                    const ok = num > 1;
                    kountLines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">EMAIL AGE:</span><span class="trial-value">${escapeHtml(kount.emailAge)} ${verdictIcon(ok, 'Email age > 1 day')}</span></div>`);
                }
                if (Array.isArray(kount.declines)) {
                    const count = kount.declines.length;
                    kountLines.push(`<div class="trial-line trial-two-col"><span class="trial-tag">DECLINE:</span><span class="trial-value">${count} ${verdictIcon(count === 0, 'No linked orders with declines')}</span></div>`);
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
            
            // Clear sidebar and local storage
            clearSidebar(false);
			
			// Also remove the sidebar UI and restore page layout so DB page is clean
			const sidebarEl = document.getElementById('copilot-sidebar');
			if (sidebarEl) {
				sidebarEl.remove();
				document.body.style.marginRight = '';
				const padStyle = document.getElementById('copilot-db-padding');
				if (padStyle) padStyle.remove();
			}
            
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
                        
                        // Use background controller to close tracked tabs
                        bg.send('closeTabsByIds', { tabIds: xrayOpenedTabs }, (response) => {
                            if (response && response.success) {
                            } else {
                                closeTabsByUrlPatterns();
                            }
                        });
                    } else {
                        closeTabsByUrlPatterns();
                    }
                });
                
                function closeTabsByUrlPatterns() {
                    // Use background controller to close tabs by URL patterns
					const urlPatterns = [
						'db.incfile.com/incfile/order/detail/',
						'db.incfile.com/order-tracker/orders/order-search',
						'awc.kount.net/workflow/',
						'app.kount.com',
						'/event-analysis/order/',
						'ca-live.adyen.com'
					];
                    
                    bg.send('closeTabsByUrlPatterns', { 
                        patterns: urlPatterns,
                        fraudReviewSession: fraudReviewSession 
                    }, (response) => {
                        if (response && response.success) {
                        } else {
                            closeTabsByTitles();
                        }
                    });
                }
                
                function closeTabsByTitles() {
                    // Use background controller to close tabs by titles
					const titlePatterns = ['[DB]', '[KOUNT]', '[KOUNT 360]', '[EKATA]', '[ADYEN]', 'Order Search'];
                    
                    bg.send('closeTabsByTitles', { 
                        patterns: titlePatterns 
                    }, (response) => {
                        if (response && response.success) {
                        } else {
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
				
				// Ensure the Fraud Review page shows a brand new start
				setTimeout(() => {
					try { location.reload(); } catch (e) { /* noop */ }
				}, 100);
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
            
            // Clean up any existing TRIAL FLOATER
                if (trialFloater.exists()) {
                trialFloater.element.remove();
                if (trialFloater.header) trialFloater.header.remove();
            }
        }

        injectSidebar();
        scanOrders();
        chrome.storage.local.get({ fraudReviewSession: null }, () => {
            if (!sessionStorage.getItem('fennecShowTrialFloater')) {
                chrome.storage.local.set({ sidebarDb: [], sidebarOrderId: null, sidebarOrderInfo: null, adyenDnaInfo: null, kountInfo: null, sidebarFreezeId: null });
                showInitialStatus();
                // Clean up any existing TRIAL FLOATER that shouldn't be there
                if (trialFloater.exists()) {
                    trialFloater.element.remove();
                    if (trialFloater.header) trialFloater.header.remove();
                }
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
                        }
                    // Removed the else clause that was causing TRIAL FLOATER to show when it shouldn't
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
