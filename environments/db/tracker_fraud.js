(function() {
    chrome.storage.local.get({ extensionEnabled: true, lightMode: false }, opts => {
        if (!opts.extensionEnabled) return;
        if (opts.lightMode) {
            document.body.classList.add('fennec-light-mode');
        } else {
            document.body.classList.remove('fennec-light-mode');
        }
        const SIDEBAR_WIDTH = 340;
        chrome.storage.local.set({ fennecReviewMode: true });
        chrome.storage.sync.set({ fennecReviewMode: true });

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
            sidebar.innerHTML = `
                <div class="copilot-header">
                    <span id="qa-toggle" class="quick-actions-toggle">☰</span>
                    <div class="copilot-title">
                        <img src="${chrome.runtime.getURL('fennec_icon.png')}" class="copilot-icon" alt="FENNEC (BETA)" />
                        <span>FENNEC (BETA)</span>
                    </div>
                    <button id="copilot-clear-tabs">🗑</button>
                    <button id="copilot-close">✕</button>
                </div>
                <div class="order-summary-header">ORDER SUMMARY</div>
                <div class="copilot-body" id="copilot-body-content">
                    <div id="db-summary-section"></div>
                    <div class="copilot-dna">
                        <div id="dna-summary" style="margin-top:16px"></div>
                        <div id="kount-summary" style="margin-top:10px"></div>
                    </div>
                    <div id="fraud-summary-section"></div>
                    <div class="issue-summary-box" id="issue-summary-box" style="display:none; margin-top:10px;">
                        <strong>ISSUE <span id="issue-status-label" class="issue-status-label"></span></strong><br>
                        <div id="issue-summary-content" style="color:#ccc; font-size:13px; white-space:pre-line;">No issue data yet.</div>
                    </div>
                    <div class="copilot-footer"><button id="copilot-clear" class="copilot-button">🧹 CLEAR</button></div>
                    <div id="review-mode-label" class="review-mode-label" style="margin-top:4px; text-align:center; font-size:11px;">REVIEW MODE</div>
                </div>`;
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
                    chrome.runtime.sendMessage({ action: 'closeOtherTabs' });
                };
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
                kountInfo: null
            }, () => {
                chrome.runtime.sendMessage({ action: 'openTab', url: dbUrl, active: true, refocus: true });
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
                    <div class="vip-declines" style="cursor:pointer"><b>VIP DECLINES:</b> ${summary.vipDecline}</div>
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
        // Increase retries so the trial floater still appears.
        function showTrialFloater(retries = 60, force = false) {
            const flag = sessionStorage.getItem('fennecShowTrialFloater');
            const overlayExists = document.getElementById('fennec-trial-overlay');
            if ((!flag && !force && !overlayExists) || retries <= 0) return;
            const summary = document.getElementById('fraud-summary-box');
            if (summary) summary.remove();
            chrome.storage.local.get({ adyenDnaInfo: null, kountInfo: null, sidebarOrderInfo: null }, data => {
                if ((!data.adyenDnaInfo || !data.adyenDnaInfo.payment) && retries > 0) {
                    setTimeout(() => showTrialFloater(retries - 1, force), 1000);
                    return;
                }
                const html = buildTrialHtml(data.adyenDnaInfo, data.kountInfo, data.sidebarOrderInfo);
                if (!html) {
                    setTimeout(() => showTrialFloater(retries - 1, force), 1000);
                    return;
                }
                sessionStorage.removeItem('fennecShowTrialFloater');
                if (data.sidebarOrderInfo && data.sidebarOrderInfo.orderId) {
                    localStorage.setItem('fraudXrayCompleted', String(data.sidebarOrderInfo.orderId));
                } else {
                    localStorage.setItem('fraudXrayCompleted', '1');
                }
                localStorage.setItem('fraudXrayFinished', '1');
                chrome.runtime.sendMessage({ action: 'refocusTab' });
                let overlay = document.getElementById('fennec-trial-overlay');
                let title = document.getElementById('fennec-trial-title');
                if (!overlay) {
                    overlay = document.createElement('div');
                    overlay.id = 'fennec-trial-overlay';
                    title = document.createElement('div');
                    title.id = 'fennec-trial-title';
                    title.textContent = 'FRAUD REVIEW';
                    const sidebarEl = document.getElementById('copilot-sidebar');
                    let baseSize = 13;
                    if (sidebarEl) {
                        const s = window.getComputedStyle(sidebarEl).fontSize;
                        const n = parseFloat(s);
                        if (!isNaN(n)) baseSize = n;
                    }
                    title.style.setProperty('font-size', (baseSize + 26) + 'px', 'important');
                    title.style.setProperty('line-height', '1.2', 'important');
                    title.style.setProperty('padding', '8px 0', 'important');
                    title.style.setProperty('border-radius', '12px', 'important');
                    title.style.setProperty('text-shadow', '0 0 4px #fff, 0 0 8px #fff', 'important');
                    title.style.setProperty('box-shadow', '0 0 0 2px #fff inset', 'important');
                    title.style.setProperty('background-color', 'inherit', 'important');
                    title.style.setProperty('-webkit-text-stroke', '1px #fff', 'important');
                    document.body.appendChild(title);
                    document.body.appendChild(overlay);
                } else {
                    // Ensure header styling persists if overlay already existed
                    const sidebarEl2 = document.getElementById('copilot-sidebar');
                    let baseSize2 = 13;
                    if (sidebarEl2) {
                        const s = window.getComputedStyle(sidebarEl2).fontSize;
                        const n = parseFloat(s);
                        if (!isNaN(n)) baseSize2 = n;
                    }
                    title.style.setProperty('font-size', (baseSize2 + 26) + 'px', 'important');
                    title.style.setProperty('line-height', '1.2', 'important');
                    title.style.setProperty('padding', '8px 0', 'important');
                    title.style.setProperty('border-radius', '12px', 'important');
                    title.style.setProperty('text-shadow', '0 0 4px #fff, 0 0 8px #fff', 'important');
                    title.style.setProperty('box-shadow', '0 0 0 2px #fff inset', 'important');
                    title.style.setProperty('background-color', 'inherit', 'important');
                    title.style.setProperty('-webkit-text-stroke', '1px #fff', 'important');
                }
                overlay.innerHTML = html;
                const close = overlay.querySelector('.trial-close');
                if (close) close.addEventListener('click', () => {
                    overlay.remove();
                    title.remove();
                    endFraudSession();
                    chrome.runtime.sendMessage({ action: 'refocusTab' });
                });
                const subBtn = overlay.querySelector('#sub-detection-btn');
                if (subBtn) {
                    subBtn.addEventListener('click', () => {
                        subBtn.disabled = true;
                        chrome.runtime.sendMessage({
                            action: 'detectSubscriptions',
                            email: (data.sidebarOrderInfo && data.sidebarOrderInfo.clientEmail) || '',
                            ltv: (data.sidebarOrderInfo && data.sidebarOrderInfo.clientLtv) || ''
                        }, resp => {
                            subBtn.disabled = false;
                            if (!resp) return;
                            const dbCol = overlay.querySelector('.trial-col');
                            if (!dbCol) return;
                            const line1 = document.createElement('div');
                            line1.className = 'trial-line';
                            line1.textContent = `Orders: ${resp.orderCount}`;
                            const raVa = dbCol.querySelector('.ra-va-line');
                            if (raVa && raVa.nextSibling) dbCol.insertBefore(line1, raVa.nextSibling);
                            else dbCol.appendChild(line1);
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
                    chrome.runtime.sendMessage({ action: 'refocusTab' });
                }

                const crBtn = overlay.querySelector('#trial-btn-cr');
                if (crBtn) crBtn.addEventListener('click', () => handleTrialAction('.cancel-and-refund-potential-fraud'));
                const idBtn = overlay.querySelector('#trial-btn-id');
                if (idBtn) idBtn.addEventListener('click', () => handleTrialAction('.confirm-fraud-potential-fraud'));
                const relBtn = overlay.querySelector('#trial-btn-release');
                if (relBtn) relBtn.addEventListener('click', () => handleTrialAction('.remove-potential-fraud'));

                const crossCount = overlay.querySelectorAll('.db-adyen-cross').length;
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
                    let srcBtn = relBtn;
                    let selector = '.remove-potential-fraud';
                    if (crossCount > 4) {
                        srcBtn = crBtn;
                        selector = '.cancel-and-refund-potential-fraud';
                    } else if (crossCount > 0) {
                        srcBtn = idBtn;
                        selector = '.confirm-fraud-potential-fraud';
                    }
                    if (srcBtn) {
                        const bigBtn = srcBtn.cloneNode(true);
                        bigBtn.id = '';
                        bigBtn.classList.add('big-trial-btn');
                        bigBtn.addEventListener('click', () => handleTrialAction(selector));
                        bigSpot.appendChild(bigBtn);
                    }
                }
                if (data.sidebarOrderInfo && data.sidebarOrderInfo.clientEmail) {
                    chrome.runtime.sendMessage({
                        action: 'detectSubscriptions',
                        email: data.sidebarOrderInfo.clientEmail,
                        ltv: data.sidebarOrderInfo.clientLtv || ''
                    }, resp => {
                        if (!resp) return;
                        const cols = overlay.querySelectorAll('.trial-columns .trial-col');
                        const dbCol = cols && cols[0];
                        if (!dbCol) return;
                        const line = document.createElement('div');
                        line.className = 'trial-line';
                        line.textContent = `Orders Found: ${resp.orderCount}`;
                        const raVa = dbCol.querySelector('.ra-va-line');
                        if (raVa && raVa.nextSibling) dbCol.insertBefore(line, raVa.nextSibling);
                        else dbCol.appendChild(line);
                    });
                }
            });
        }

        function buildTrialHtml(dna, kount, order) {
            if (!dna && !kount && !order) return null;
            const dbLines = [];
            const adyenLines = [];
            const kountLines = [];
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
                const dbName = (order.billing.cardholder || '').toLowerCase();
                const dnaName = (dna && dna.payment && dna.payment.card ? dna.payment.card['Card holder'] : '').toLowerCase();
                if (order.billing.expiry) {
                    const ok = dbExp && dnaExp && dbExp === dnaExp;
                    dbLines.push(`<div class="trial-line trial-card-details">${escapeHtml(order.billing.expiry)} <span class="${ok ? 'db-adyen-check' : 'db-adyen-cross'}">${ok ? '✔' : '✖'}</span></div>`);
                }
                if (order.billing.last4) {
                    const ok = dbDigits && dnaDigits && dbDigits === dnaDigits;
                    dbLines.push(`<div class="trial-line trial-card-details">${escapeHtml(order.billing.last4)} <span class="${ok ? 'db-adyen-check' : 'db-adyen-cross'}">${ok ? '✔' : '✖'}</span></div>`);
                }
                const cardOk = dbName && dnaName && dbName === dnaName && dbDigits && dnaDigits && dbDigits === dnaDigits && dbExp && dnaExp && dbExp === dnaExp;
                const tag = dna && dna.payment ? buildCardMatchTag(order.billing, dna.payment.card || {}) : '';
                if (tag) pushFlag(tag);
                let ltv = order && order.clientLtv;
                if (!ltv) ltv = getClientLtv();
                if (ltv) dbLines.push(`<div class="trial-line">LTV: ${escapeHtml(ltv)}</div>`);
                else dbLines.push(`<div class="trial-line">LTV: N/A</div>`);
                const raVa = [];
                if (typeof order.hasRA === 'boolean') {
                    const txt = order.raExpired ? 'EXPIRED' : (order.hasRA ? 'Sí' : 'No');
                    const cls = order.raExpired ? 'copilot-tag copilot-tag-yellow' : (order.hasRA ? 'copilot-tag copilot-tag-green' : 'copilot-tag copilot-tag-purple');
                    raVa.push(`RA: <span class="${cls}">${txt}</span>`);
                }
                if (typeof order.hasVA === 'boolean') {
                    const cls = order.hasVA ? 'copilot-tag copilot-tag-green' : 'copilot-tag copilot-tag-purple';
                    raVa.push(`VA: <span class="${cls}">${order.hasVA ? 'Sí' : 'No'}</span>`);
                }
                if (raVa.length) {
                    dbLines.push(`<div class="trial-line ra-va-line">${raVa.join(' ')}</div>`);
                }
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
                if (card['Expiry date']) {
                    const ok = dbExp && dnaExp && dbExp === dnaExp;
                    adyenLines.push(`<div class="trial-line trial-card-details">${escapeHtml(card['Expiry date'])} <span class="${ok ? 'db-adyen-check' : 'db-adyen-cross'}">${ok ? '✔' : '✖'}</span></div>`);
                }
                if (adDigits) {
                    const ok = dbDigits && adDigits && dbDigits === adDigits;
                    adyenLines.push(`<div class="trial-line trial-card-details">${escapeHtml(adDigits)} <span class="${ok ? 'db-adyen-check' : 'db-adyen-cross'}">${ok ? '✔' : '✖'}</span></div>`);
                }
                if (proc['CVC/CVV']) {
                    const r = formatCvv(proc['CVC/CVV']);
                    const ok = r.result === 'green';
                    adyenLines.push(`<div class="trial-line">CVV: ${escapeHtml(proc['CVC/CVV'])} <span class="${ok ? 'db-adyen-check' : 'db-adyen-cross'}">${ok ? '✔' : '✖'}</span></div>`);
                    if (ok) {
                        const tag = `<span class="copilot-tag ${colorFor(r.result)}">${escapeHtml(r.label)}</span>`;
                        pushFlag(tag);
                    }
                }
                if (proc['AVS']) {
                    const r = formatAvs(proc['AVS']);
                    const ok = r.result === 'green';
                    adyenLines.push(`<div class="trial-line">AVS: ${escapeHtml(proc['AVS'])} <span class="${ok ? 'db-adyen-check' : 'db-adyen-cross'}">${ok ? '✔' : '✖'}</span></div>`);
                    if (ok) {
                        const tag = `<span class="copilot-tag ${colorFor(r.result)}">${escapeHtml(r.label)}</span>`;
                        pushFlag(tag);
                    }
                }
                const tx = dna.transactions || {};
                const settled = parseAmount((tx['Settled'] || tx['Authorised / Settled'] || {}).amount);
                const total = parseAmount((tx['Total'] || tx['Total transactions'] || {}).amount);
                if (total) {
                    const pct = Math.round(settled / total * 100);
                    const ok = pct >= 65;
                    adyenLines.push(`<div class="trial-line">Settled: ${pct}% (${settled}/${total}) <span class="${ok ? 'db-adyen-check' : 'db-adyen-cross'}">${ok ? '✔' : '✖'}</span></div>`);
                    if (!ok) red.push('<span class="copilot-tag copilot-tag-purple">APPROVED %</span>');
                }
                const cb = parseInt((tx['Chargebacks'] || tx['Chargeback'] || {}).count || '0', 10);
                const okCb = cb === 0;
                adyenLines.push(`<div class="trial-line">CB: ${cb} <span class="${okCb ? 'db-adyen-check' : 'db-adyen-cross'}">${okCb ? '✔' : '✖'}</span></div>`);
                if (!okCb) red.push('<span class="copilot-tag copilot-tag-purple">CB</span>');
            }

            if (kount) {
                if (kount.ekata && kount.ekata.residentName) {
                    kountLines.push(`<div class="trial-line trial-name">${escapeHtml(kount.ekata.residentName)} ${iconHtml}</div>`);
                }
                if (kount.ekata && kount.ekata.proxyRisk) {
                    const ok = /^no$/i.test(kount.ekata.proxyRisk);
                    kountLines.push(`<div class="trial-line">Proxy: ${escapeHtml(kount.ekata.proxyRisk)} <span class="${ok ? 'db-adyen-check' : 'db-adyen-cross'}">${ok ? '✔' : '✖'}</span></div>`);
                    if (!ok) red.push('<span class="copilot-tag copilot-tag-purple">PROXY YES</span>');
                }
                if (kount.emailAge) {
                    const num = parseInt(String(kount.emailAge).replace(/\D+/g, ''), 10) || 0;
                    const ok = num > 1;
                    kountLines.push(`<div class="trial-line">Email age: ${escapeHtml(kount.emailAge)} <span class="${ok ? 'db-adyen-check' : 'db-adyen-cross'}">${ok ? '✔' : '✖'}</span></div>`);
                }
                if (Array.isArray(kount.declines)) {
                    const count = kount.declines.length;
                    kountLines.push(`<div class="trial-line">VIP DECLINES: ${count} <span class="${count === 0 ? 'db-adyen-check' : 'db-adyen-cross'}">${count === 0 ? '✔' : '✖'}</span></div>`);
                }
                if (kount.ekata && kount.ekata.addressToName) kountLines.push(`<div class="trial-line">Address Name: ${escapeHtml(kount.ekata.addressToName)}</div>`);

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
                    const total = map.reduce((sum, [k]) => sum + (parseInt(kount.linked[k] || 0, 10)), 0);
                    if (total === 0) {
                        kountLines.push(`<div class="trial-line">NO LINKED ORDERS <span class="db-adyen-check">✔</span></div>`);
                    } else {
                        map.forEach(([k, label]) => {
                            const n = parseInt(kount.linked[k] || 0, 10);
                            if (n > 0) kountLines.push(`<div class="trial-line">${label}: ${n}</div>`);
                        });
                    }
                }
            }

            const actions = `
                <div class="trial-actions">
                    <button id="trial-btn-cr" class="trial-action-btn trial-btn-cr">C&R</button>
                    <button id="trial-btn-id" class="trial-action-btn trial-btn-id">ID CONFIRM</button>
                    <button id="trial-btn-release" class="trial-action-btn trial-btn-release">RELEASE (NO)</button>
                </div>`;

            const orderLines = [];
            if (order) {
            if (order.companyName) {
                orderLines.push(`<div class="trial-line trial-company-name">${escapeHtml(order.companyName)}</div>`);
            }
            const tags = [];
            if (order.type) {
                const cleanType = String(order.type).replace(/BUSINESS\s*FORMATION/gi, '').trim();
                if (cleanType) tags.push(`<span class="copilot-tag copilot-tag-lightgray">${escapeHtml(cleanType)}</span>`);
            }
            if (typeof order.expedited === 'boolean') {
                const expText = order.expedited ? 'EXPEDITED' : 'STANDARD';
                const expCls = order.expedited ? 'copilot-tag-green' : 'copilot-tag-lightgray';
                tags.push(`<span class="copilot-tag ${expCls}">${expText}</span>`);
            }
            if (order.orderCost) tags.push(`<span class="copilot-tag copilot-tag-lightgray">${escapeHtml(order.orderCost)}</span>`);
                if (tags.length) {
                    orderLines.push(`<div class="trial-line no-highlight trial-tags">${tags.join(' ')}</div>`);
                }
                orderLines.push(`<div class="trial-line no-highlight trial-btn-line"><span id="trial-big-button"></span></div>`);
            }

            const html = `
                <div class="trial-close">✕</div>
                <div class="trial-order"><div class="trial-col">${orderLines.join('')}</div></div>
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
            chrome.runtime.sendMessage({ action: 'checkLastIssue', orderId }, (resp) => {
                if (chrome.runtime.lastError) {
                    fillIssueBox(null, orderId);
                    return;
                }
                fillIssueBox(resp && resp.issueInfo, orderId);
            });
        }

        function loadDbSummary() {
            const container = document.getElementById('db-summary-section');
            const fraud = document.getElementById('fraud-summary-section');
            if (!container) return;
            chrome.storage.local.get({ sidebarDb: [], sidebarOrderId: null, sidebarOrderInfo: null }, ({ sidebarDb, sidebarOrderId, sidebarOrderInfo }) => {
                if (Array.isArray(sidebarDb) && sidebarDb.length) {
                    container.innerHTML = sidebarDb.join('');
                    attachCommonListeners(container);
                    const qbox = container.querySelector('#quick-summary');
                    if (qbox) { qbox.classList.remove('quick-summary-collapsed'); qbox.style.maxHeight = 'none'; }
                    checkLastIssue(sidebarOrderId);
                    if (fraud) fraud.innerHTML = '';
                } else {
                    container.innerHTML = '';
                    fillIssueBox(null, null);
                    if (fraud) insertFraudSummary();
                }
            });
        }

        function clearSidebar() {
            chrome.storage.local.set({ sidebarDb: [], sidebarOrderId: null, sidebarOrderInfo: null, adyenDnaInfo: null, sidebarFreezeId: null });
            const db = document.getElementById('db-summary-section');
            const dna = document.getElementById('dna-summary');
            const fraud = document.getElementById('fraud-summary-section');
            const issue = document.getElementById('issue-summary-box');
            if (db) db.innerHTML = '';
            if (dna) dna.innerHTML = '';
            if (fraud) fraud.innerHTML = '';
            if (issue) { const content = issue.querySelector('#issue-summary-content'); const label = issue.querySelector('#issue-status-label'); if (content) content.innerHTML = 'No issue data yet.'; if (label) { label.textContent = ''; label.className = 'issue-status-label'; } issue.style.display = 'none'; }
            insertFraudSummary();
        }

        function endFraudSession() {
            clearSidebar();
            chrome.storage.local.set({
                fraudReviewSession: null,
                kountInfo: null
            });
            localStorage.removeItem('fraudXrayCompleted');
            localStorage.removeItem('fraudXrayFinished');
            sessionStorage.removeItem('fennecShowTrialFloater');
            showInitialStatus();
        }

        function showInitialStatus() {
            const db = document.getElementById('db-summary-section');
            const dna = document.getElementById('dna-summary');
            const kount = document.getElementById('kount-summary');
            const fraud = document.getElementById('fraud-summary-section');
            const issue = document.getElementById('issue-summary-box');
            if (db) db.innerHTML = '';
            if (dna) dna.innerHTML = '';
            if (kount) kount.innerHTML = '';
            if (issue) {
                const content = issue.querySelector('#issue-summary-content');
                const label = issue.querySelector('#issue-status-label');
                if (content) content.innerHTML = '';
                if (label) label.textContent = '';
                issue.style.display = 'none';
            }
            if (fraud) insertFraudSummary();
        }

        injectSidebar();
        scanOrders();
        const manualOpen = !sessionStorage.getItem('fennecShowTrialFloater');
        if (manualOpen) {
            chrome.storage.local.set({ sidebarDb: [], sidebarOrderId: null, sidebarOrderInfo: null, adyenDnaInfo: null, kountInfo: null, sidebarFreezeId: null });
            showInitialStatus();
        } else {
           loadDbSummary();
           loadDnaSummary();
           loadKountSummary();
        }
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
            if (area === 'local' && (changes.adyenDnaInfo || changes.kountInfo)) {
                showTrialFloater(60, true);
            }
        });
        window.addEventListener('focus', () => {
            loadDnaSummary();
            loadKountSummary();
            showTrialFloater(60, true);
        });
    });
})();
