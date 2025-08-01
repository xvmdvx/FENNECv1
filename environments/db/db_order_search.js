(function() {
    if (window.top !== window) return;
    const bg = fennecMessenger;
    chrome.storage.local.get({
        extensionEnabled: true,
        lightMode: false,
        fennecFraudOrders: [],
        fennecCsvSummaryActive: '0',
        fennecCsvSummary: null,
        fennecCsvOrders: null
    }, opts => {
        if (!opts.extensionEnabled) return;
        if (opts.lightMode) {
            document.body.classList.add('fennec-light-mode');
        } else {
            document.body.classList.remove('fennec-light-mode');
        }

        const fraudSet = new Set((opts.fennecFraudOrders || []).map(String));
        const SIDEBAR_WIDTH = 340;
        const params = new URLSearchParams(location.search);
        const email = params.get('fennec_email');
        let tableObserver = null;
        let skipSummaryUpdate = false;
        let csvSummaryActive = false;
        let lastCsvSummary = null;
        let lastCsvOrders = null;
        if (opts.fennecCsvSummaryActive === '1' && opts.fennecCsvSummary) {
            try {
                lastCsvSummary = JSON.parse(opts.fennecCsvSummary);
                if (lastCsvSummary) {
                    skipSummaryUpdate = true;
                    csvSummaryActive = true;
                    sessionStorage.setItem('fennecCsvSummaryActive', '1');
                    sessionStorage.setItem('fennecCsvSummary', JSON.stringify(lastCsvSummary));
                }
            } catch (e) {
                lastCsvSummary = null;
            }
        } else if (sessionStorage.getItem('fennecCsvSummaryActive') === '1') {
            try {
                lastCsvSummary = JSON.parse(sessionStorage.getItem('fennecCsvSummary'));
                if (lastCsvSummary) {
                    skipSummaryUpdate = true;
                    csvSummaryActive = true;
                }
            } catch (e) {
                lastCsvSummary = null;
            }
        }

        if (opts.fennecCsvOrders) {
            try {
                lastCsvOrders = JSON.parse(opts.fennecCsvOrders);
                if (lastCsvOrders) {
                    sessionStorage.setItem('fennecCsvOrders', JSON.stringify(lastCsvOrders));
                }
            } catch (e) {
                lastCsvOrders = null;
            }
        } else if (sessionStorage.getItem('fennecCsvOrders')) {
            try {
                lastCsvOrders = JSON.parse(sessionStorage.getItem('fennecCsvOrders'));
            } catch (e) {
                lastCsvOrders = null;
            }
        }
        // Highlight IDs from Queue View after rows are inserted
        let pendingHighlightIds = null;

        const STATE_ABBRS = 'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
        const STATE_NAMES = [
            'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'
        ];
        const STATE_ABBR_MAP = {};
        STATE_NAMES.forEach((n,i)=>{ STATE_ABBR_MAP[n.toUpperCase()] = STATE_ABBRS[i]; });
        function toStateAbbr(name) {
            if (!name) return '';
            const t = name.trim();
            if (t.length === 2) return t.toUpperCase();
            return STATE_ABBR_MAP[t.toUpperCase()] || '';
        }

        function collectOrders() {
            let table = document.querySelector('#tableStatusResults');
            if (!table) table = document.querySelector('table.dataTable');
            const rows = table ? table.querySelectorAll('tbody tr') : [];
            const headerCells = table ? Array.from(table.querySelectorAll('thead th')) : [];
            const colIndex = { status: -1, state: -1, expedited: -1, ordered: -1 };
            headerCells.forEach((th, idx) => {
                const txt = th.textContent.trim().toLowerCase();
                if (txt === 'status') colIndex.status = idx;
                else if (txt === 'state') colIndex.state = idx;
                else if (txt === 'expedited') colIndex.expedited = idx;
                else if (txt.includes('ordered')) colIndex.ordered = idx;
            });
            return Array.from(rows).map(r => {
                const link = r.querySelector('a[data-detail-link*="/order/detail/"]') ||
                             r.querySelector('a[href*="/order/detail/"]');
                let id = '';
                if (link) {
                    const src = link.dataset.detailLink || link.textContent;
                    id = (src || '').replace(/\D+/g, '');
                }
                const cells = r.querySelectorAll('td');
                const status = (colIndex.status >= 0 && cells[colIndex.status]) ?
                                cells[colIndex.status].textContent.trim() : '';
                const state = (colIndex.state >= 0 && cells[colIndex.state]) ?
                               cells[colIndex.state].textContent.trim() : '';
                let expedited = false;
                if (colIndex.expedited >= 0 && cells[colIndex.expedited]) {
                    expedited = !!cells[colIndex.expedited].querySelector('i.mdi-check-circle');
                }
                const orderedDate = (colIndex.ordered >= 0 && cells[colIndex.ordered]) ?
                                   cells[colIndex.ordered].textContent.trim() : '';
                r.dataset.ordered = orderedDate;
                return { id, status, state, expedited, orderedDate, row: r, link };
            }).filter(o => o.id);
        }

        function getTotalCount() {
            const info = document.querySelector('.dataTables_info');
            if (info) {
                const m = info.textContent.match(/of\s+(\d+)\s+(?:entries|results)/i);
                if (m) return parseInt(m[1], 10);
            }
            return collectOrders().length;
        }

        function summarizeOrders(orders) {
            const stateCounts = {};
            const statusCounts = {};
            const dateCounts = { today: 0, yesterday: 0, in3: 0, in7: 0, in14: 0, in30: 0 };
            let expCount = 0;
            let fraudCount = 0;
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const yday = new Date(today.getTime() - 86400000);
            const d3 = new Date(today.getTime() + 3 * 86400000);
            const d7 = new Date(today.getTime() + 7 * 86400000);
            const d14 = new Date(today.getTime() + 14 * 86400000);
            const d30 = new Date(today.getTime() + 30 * 86400000);
            orders.forEach(o => {
                const abbr = toStateAbbr(o.state);
                if (abbr) stateCounts[abbr] = (stateCounts[abbr] || 0) + 1;
                if (o.status) {
                    statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
                }
                // Determine if the order is flagged as possible fraud.
                const flagged = fraudSet.has(String(o.id));
                if (flagged) fraudCount++;
                if (o.expedited) expCount++;
                const d = o.orderedDate ? new Date(o.orderedDate) : null;
                if (d && !isNaN(d)) {
                    const sd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                    if (sd.getTime() === today.getTime()) dateCounts.today++;
                    else if (sd.getTime() === yday.getTime()) dateCounts.yesterday++;
                    else if (sd <= d3) dateCounts.in3++;
                    else if (sd <= d7) dateCounts.in7++;
                    else if (sd <= d14) dateCounts.in14++;
                    else if (sd <= d30) dateCounts.in30++;
                }
            });
            return { total: orders.length, stateCounts, statusCounts, expCount, dateCounts, fraudCount };
        }

        let currentFilterState = '';
        let currentFilterDate = '';
        let hideFraud = false;

        function applyFilters() {
            const rows = document.querySelectorAll('#tableStatusResults tbody tr');
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const yday = new Date(today.getTime() - 86400000);
            const d3 = new Date(today.getTime() + 3 * 86400000);
            const d7 = new Date(today.getTime() + 7 * 86400000);
            const d14 = new Date(today.getTime() + 14 * 86400000);
            const d30 = new Date(today.getTime() + 30 * 86400000);
            rows.forEach(r => {
                const stateCell = r.querySelector('td:nth-child(6)');
                const st = toStateAbbr(stateCell ? stateCell.textContent.trim() : '');
                const text = r.dataset.ordered || '';
                const d = text ? new Date(text) : null;
                const flagged = r.dataset.possibleFraud === '1';
                let show = true;
                if (currentFilterState && st !== currentFilterState) show = false;
                if (currentFilterDate) {
                    if (d && !isNaN(d)) {
                        const sd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                        if (currentFilterDate === 'today') show = show && sd.getTime() === today.getTime();
                        else if (currentFilterDate === 'yesterday') show = show && sd.getTime() === yday.getTime();
                        else if (currentFilterDate === 'in3') show = show && sd > today && sd <= d3;
                        else if (currentFilterDate === 'in7') show = show && sd > d3 && sd <= d7;
                        else if (currentFilterDate === 'in14') show = show && sd > d7 && sd <= d14;
                        else if (currentFilterDate === 'in30') show = show && sd > d14 && sd <= d30;
                    } else show = false;
                }
                if (hideFraud && flagged) show = false;
                r.style.display = show ? '' : 'none';
            });
            document.querySelectorAll('#qs-summary .state-count').forEach(it => {
                if (it.dataset.state === currentFilterState && currentFilterState) it.classList.add('active');
                else it.classList.remove('active');
            });
            document.querySelectorAll('#qs-summary .date-count').forEach(it => {
                if (it.dataset.range === currentFilterDate && currentFilterDate) it.classList.add('active');
                else it.classList.remove('active');
            });
        }

        function filterByState(state) {
            if (currentFilterState === state) state = '';
            currentFilterState = state;
            applyFilters();
        }

        function filterByDate(range) {
            if (currentFilterDate === range) range = '';
            currentFilterDate = range;
            applyFilters();
        }

        function toggleFraud() {
            hideFraud = !hideFraud;
            const icon = document.getElementById('fraud-eye');
            if (icon) icon.className = hideFraud ? 'ti ti-eye-off' : 'ti ti-eye';
            applyFilters();
        }

        function renderSummary(total, expCount, fraudCount, stateCounts, statusCounts, dateCounts) {
            const box = document.getElementById('qs-summary');
            if (!box) return;
            const row = (label, value, id) => {
                const idAttr = id ? ` id="${id}"` : '';
                return `<div${idAttr} style="display:flex"><div style="width:50%;text-align:right;padding-right:6px">${label}</div><div style="width:50%;text-align:left">${value}</div></div>`;
            };
            let html = row('<b>TOTAL:</b>', `<b>${total}</b>`);
            html += row('<b>EXPEDITED:</b>', `<b>${expCount}</b>`);
            html += row('<b>POSSIBLE FRAUD:</b>', `<b>${fraudCount}</b> <i id="fraud-eye" class="ti ti-eye" style="margin-left:4px"></i>`, 'fraud-toggle');
            html += '<div style="margin-top:8px"><b>BY STATE</b></div>';
            html += '<div style="display:flex;flex-wrap:wrap">';
            Object.keys(stateCounts)
                .sort((a,b) => stateCounts[b] - stateCounts[a])
                .forEach(st => {
                    html += `<span class="state-count" data-state="${escapeHtml(st)}" ` +
                            `style="width:25%;cursor:pointer;display:inline-block">` +
                            `<b>${escapeHtml(st)}:</b> <b>${stateCounts[st]}</b></span>`;
                });
            html += '</div>';
            let dateHtml = '';
            [
                ['today','TODAY'],
                ['yesterday','YESTERDAY'],
                ['in3','+3 DAYS'],
                ['in7','+7 DAYS'],
                ['in14','+2 WEEKS'],
                ['in30','+1 MONTH']
            ].forEach(([k,label]) => {
                const cnt = dateCounts && dateCounts[k] ? dateCounts[k] : 0;
                if (cnt) dateHtml += row(`<b>${label}:</b>`, `<b>${cnt}</b>`, null).replace('<div', `<div class="date-count" data-range="${k}"`);
            });
            if (dateHtml) {
                html += '<div style="margin-top:8px"><b>BY DATE</b></div>';
                html += `<div>${dateHtml}</div>`;
            }
            box.innerHTML = html;
            box.querySelectorAll('.state-count').forEach(el => {
                el.addEventListener('click', () => filterByState(el.dataset.state));
            });
            box.querySelectorAll('.date-count').forEach(el => {
                el.addEventListener('click', () => filterByDate(el.dataset.range));
            });
            const fraudEl = document.getElementById('fraud-toggle');
            if (fraudEl) fraudEl.addEventListener('click', toggleFraud);
        }

        function updateSummary() {
            if (csvSummaryActive && lastCsvSummary) {
                renderSummary(
                    lastCsvSummary.total,
                    lastCsvSummary.expCount,
                    lastCsvSummary.fraudCount,
                    lastCsvSummary.stateCounts,
                    lastCsvSummary.statusCounts,
                    lastCsvSummary.dateCounts
                );
                return;
            }
            if (skipSummaryUpdate) return;
            const orders = collectOrders();
            const { total, stateCounts, statusCounts, expCount, dateCounts, fraudCount } = summarizeOrders(orders);
            renderSummary(total, expCount, fraudCount, stateCounts, statusCounts, dateCounts);
        }

        function observeTable() {
            const table = document.querySelector('#tableStatusResults');
            if (!table) return;
            tableObserver = new MutationObserver(() => updateSummary());
            tableObserver.observe(table, { childList: true, subtree: true });
        }

        function parseCsvLine(line) {
            const parts = [];
            let cur = '';
            let inQuote = false;
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '"') {
                    inQuote = !inQuote;
                } else if (ch === ',' && !inQuote) {
                    parts.push(cur);
                    cur = '';
                } else {
                    cur += ch;
                }
            }
            parts.push(cur);
            return parts.map(p => p.replace(/^"|"$/g, '').trim());
        }

        function parseCsv(text) {
            const rows = [];
            let cur = '';
            let row = [];
            let inQuote = false;
            for (let i = 0; i < text.length; i++) {
                const ch = text[i];
                if (ch === '"') {
                    if (text[i + 1] === '"') {
                        cur += '"';
                        i++;
                    } else {
                        inQuote = !inQuote;
                    }
                } else if (ch === ',' && !inQuote) {
                    row.push(cur);
                    cur = '';
                } else if ((ch === '\n' || ch === '\r') && !inQuote) {
                    if (ch === '\r' && text[i + 1] === '\n') i++;
                    row.push(cur);
                    rows.push(row.map(p => p.replace(/^"|"$/g, '').trim()));
                    row = [];
                    cur = '';
                } else {
                    cur += ch;
                }
            }
            if (cur.length || row.length) {
                row.push(cur);
                rows.push(row.map(p => p.replace(/^"|"$/g, '').trim()));
            }
            return rows;
        }

        function highlightMatches(ids) {
            const set = ids ? new Set(ids.map(String)) : fraudSet;
            const rows = document.querySelectorAll('#tableStatusResults tbody tr');
            console.log(`[FENNEC] Applying fraud flags for ${set.size} orders`);
            rows.forEach(r => {
                const link = r.querySelector('a[data-detail-link*="/order/detail/"]') ||
                             r.querySelector('a[href*="/order/detail/"]');
                if (!link) return;
                const src = link.dataset.detailLink || link.textContent;
                const id = (src || '').replace(/\D+/g, '');
                let icon = r.querySelector('.fennec-fraud-flag');
                if (set.has(id)) {
                    if (!icon) {
                        icon = document.createElement('span');
                        icon.textContent = '⚑';
                        icon.className = 'fennec-fraud-flag';
                        icon.style.color = 'orange';
                        icon.style.marginRight = '3px';
                        link.prepend(icon);
                    }
                    r.dataset.possibleFraud = '1';
                } else {
                    if (icon) icon.remove();
                    r.dataset.possibleFraud = '';
                }
            });
            console.log('[FENNEC] Fraud flags applied');
            applyFilters();
        }

       function injectCsvHook() {
           return new Promise(resolve => {
               if (window.__fennecCsvHook) { resolve(); return; }
               const script = document.createElement('script');
               script.src = chrome.runtime.getURL('environments/db/csv_hook.js');
               script.onload = () => resolve();
               document.documentElement.appendChild(script);
               script.remove();
           });
       }

        function injectDatatablesPatch() {
            return new Promise(resolve => {
                if (window.__fennecDtPatch) { resolve(); return; }
                const script = document.createElement('script');
                script.src = chrome.runtime.getURL('environments/db/datatables_patch.js');
                script.onload = () => resolve();
                document.documentElement.appendChild(script);
                script.remove();
            });
        }

        function downloadCsvOrders(cb) {
            let csv = null;
            let timeout = null;
            function finalize() {
                window.removeEventListener('message', onMsg);
                const orders = [];
                if (csv) {
                    const rows = parseCsv(csv);
                    console.log(`[FENNEC] CSV text length ${csv.length}, rows ${rows.length}`);
                    rows.slice(1).forEach(cols => {
                        const id = cols[0];
                        const state = cols[1];
                        const name = cols[2] || '';
                        const status = cols[19] || '';
                        const expedited = (cols[21] || '').toLowerCase().startsWith('y');
                        const orderedDate = cols[22] || '';
                        const expectedDate = cols[23] || '';
                        const forwardedDate = cols[24] || '';
                        const shippingDate = cols[25] || '';
                        if (id) orders.push({ id, state, name, expedited, status, orderedDate, expectedDate, forwardedDate, shippingDate });
                    });
                }
                if (!csv) console.warn('[FENNEC] CSV not captured');
                console.log(`[FENNEC] Parsed ${orders.length} orders from CSV`);
                cb(orders);
            }
            function onMsg(e) {
                if (e.source !== window || !e.data || e.data.type !== 'FENNEC_CSV_CAPTURE') return;
                csv = e.data.csv;
                clearTimeout(timeout);
                finalize();
            }
            injectCsvHook().then(() => {
                window.addEventListener('message', onMsg);
                if (typeof downloadOrderSearch === 'function') {
                    downloadOrderSearch();
                } else {
                    console.warn('[FENNEC] downloadOrderSearch function not found');
                }
                timeout = setTimeout(() => finalize(), 30000);
            });
        }

        function showCsvSummary(orders) {
            const { total, stateCounts, statusCounts, expCount, dateCounts, fraudCount } = summarizeOrders(orders);
            console.log(`[FENNEC] Rendering summary for ${total} CSV orders`);
            renderSummary(total, expCount, fraudCount, stateCounts, statusCounts, dateCounts);
            lastCsvSummary = { total, stateCounts, statusCounts, expCount, dateCounts, fraudCount };
            csvSummaryActive = true;
            skipSummaryUpdate = true;
            sessionStorage.setItem('fennecCsvSummaryActive', '1');
            sessionStorage.setItem('fennecCsvSummary', JSON.stringify(lastCsvSummary));
            chrome.storage.local.set({
                fennecCsvSummaryActive: '1',
                fennecCsvSummary: JSON.stringify(lastCsvSummary)
            });
        }

        function injectTableHelper() {
            return new Promise(resolve => {
                if (window.__fennecTableInject) { resolve(); return; }
                const script = document.createElement('script');
                script.src = chrome.runtime.getURL('environments/db/table_inject.js');
                script.onload = () => resolve();
                document.documentElement.appendChild(script);
                script.remove();
            });
        }

        function formatOrderId(id) {
            const str = String(id || '');
            if (str.length > 7) {
                const prefix = str.slice(0, 3);
                const mid = str.slice(3, 7);
                const suffix = str.slice(7);
                return `${escapeHtml(prefix)}<span style="color:#ff7676;"><b>${escapeHtml(mid)}</b></span>${escapeHtml(suffix)}`;
            }
            return escapeHtml(str);
        }

        function injectCsvOrders(orders) {
            console.log(`[FENNEC] Injecting ${orders.length} orders into table`);
            const tableEl = document.getElementById('tableStatusResults');
            if (!tableEl) { console.warn('[FENNEC] tableStatusResults not found'); return; }
            injectTableHelper().then(() => {
                const existing = new Set();
                Array.from(tableEl.querySelectorAll('tbody tr')).forEach(tr => {
                    const link = tr.querySelector('a[data-detail-link*="/order/detail/"]') || tr.querySelector('a[href*="/order/detail/"]');
                    const id = link ? (link.dataset.detailLink || link.textContent).replace(/\D+/g, '') : '';
                    if (id) existing.add(String(id));
                });

                const headers = Array.from(tableEl.querySelectorAll('thead th'));
                const headerText = headers.map(th => th.textContent.trim().toLowerCase());

                const rows = [];
                orders.forEach(o => {
                    if (existing.has(String(o.id))) return;

                    const expedited = o.expedited ? '<i class="mdi mdi-check-circle" style="color:#3cb81e; font-size:25px; margin-left:20px; margin-top: -4px; display: inline-block"></i>' : '';
                    const searchLink = typeof buildSosUrl === 'function' ?
                        buildSosUrl(o.state, null, 'name') :
                        'https://icis.corp.delaware.gov/Ecorp/EntitySearch/NameSearch.aspx';

                    const cells = headerText.map((txt, idx) => {
                        if (idx === 0 || txt.includes('upload')) {
                            return `<td><a class="btn btn-transparent btn-sm" href="https://db.incfile.com/incfile/order/upload/${o.id}" target="_blank" data-toggle="tooltip" data-placement="right" data-trigger="hover" title="" data-original-title="Upload document for&lt;br&gt; ${escapeHtml(o.name || '')}"><i class="ti ti-upload"></i></a></td>`;
                        } else if (txt.includes('order #')) {
                            return `<td><a href="https://db.incfile.com/redirect-to-dashboard-staff-bypass/${o.id}" target="_blank" style="margin-right: 1rem;" title="" data-toggle="tooltip" data-original-title="Client Dashboard"><img src="/static/img/dashboard.ico" width="30" height="30" alt=""></a><a class="goto-orderdetail" href="javascript:void(0)" data-detail-link="https://db.incfile.com/incfile/order/detail/${o.id}" style="color:#2cabe3">${formatOrderId(o.id)}</a></td>`;
                        } else if (txt.includes('company')) {
                            return `<td><div class="wrapper-comp"><span class="name-inside pull-left">${escapeHtml(o.name || '')}</span>  <button target="_blank" data-view-link="https://db.incfile.com/incfile/order/detail/${o.id}" class="btn btn-primary btn-sm btn-rounded view_comp_detail pull-right" style="margin-left:5px;width:60px">View</button><button style="width:60px" class="btn btn-danger btn-sm btn-rounded copy pull-right" data-comp-name="${escapeHtml(o.name || '')}" data-name-search-link="${escapeHtml(searchLink)}">Search</button></div></td>`;
                        } else if (txt === 'status') {
                            return `<td>${escapeHtml(o.status || '')}</td>`;
                        } else if (txt === 'expedited') {
                            return `<td>${expedited}</td>`;
                        } else if (txt === 'state') {
                            return `<td>${escapeHtml(o.state || '')}</td>`;
                        } else if (txt.includes('order type')) {
                            return `<td>${escapeHtml(o.orderType || '')}</td>`;
                        } else if (txt === 'entity') {
                            return `<td>${escapeHtml(o.entity || '')}</td>`;
                        } else if (txt.includes('order date') || txt.includes('ordered')) {
                            return `<td>${escapeHtml(o.orderedDate || '')}</td>`;
                        } else if (!txt && idx === headers.length - 1) {
                            return `<td><div class="checkbox checkbox-primary"> <input type="checkbox" class="chk_to_print" id="ord_${o.id}" value="${o.id}"> <label for="ord_${o.id}">&nbsp;</label> </div></td>`;
                        }
                        return '<td></td>';
                    });

                    const rowHtml = `<tr class="even" data-ordered="${escapeHtml(o.orderedDate || '')}">` +
                        cells.join('') + '</tr>';
                    rows.push(rowHtml);
                });
                if (!rows.length) { console.log('[FENNEC] No new CSV orders to inject'); return; }

                const headerTexts = headers.map(th => th.textContent.trim().toLowerCase());
                const orderedIdx = headerTexts.findIndex(t => t.includes('ordered'));

                function onAdded(e) {
                    if (e.source !== window || !e.data || e.data.type !== 'FENNEC_ROWS_ADDED') return;
                    window.removeEventListener('message', onAdded);
                    Array.from(tableEl.querySelectorAll('tbody tr')).forEach(tr => {
                        const cell = orderedIdx >= 0 ?
                            tr.querySelector(`td:nth-child(${orderedIdx + 1})`) : null;
                        const ordered = cell ? cell.textContent.trim() : '';
                        tr.dataset.ordered = ordered;
                    });
                    console.log('[FENNEC] Table updated with CSV orders');
                    if (pendingHighlightIds) {
                        highlightMatches(pendingHighlightIds);
                        const orders = lastCsvOrders || collectOrders();
                        showCsvSummary(orders);
                        pendingHighlightIds = null;
                    }
                }

                window.addEventListener('message', onAdded);
                window.postMessage({ type: 'FENNEC_ADD_ROWS', rows }, '*');
            });
        }

        function openQueueView() {
            const icon = document.querySelector('#copilot-sidebar .copilot-icon');
            const progress = document.getElementById('qs-progress');
            if (progress) {
                progress.textContent = 'Downloading queue CSV...';
                progress.style.display = 'block';
            }
            console.log('[FENNEC] Starting queue scan...');
            sessionStorage.removeItem('fennecCsvSummary');
            sessionStorage.removeItem('fennecCsvSummaryActive');
            sessionStorage.removeItem('fennecCsvOrders');
            chrome.storage.local.remove(['fennecCsvSummary', 'fennecCsvSummaryActive', 'fennecCsvOrders']);
            lastCsvSummary = null;
            lastCsvOrders = null;
            csvSummaryActive = false;
            if (icon) icon.classList.add('fennec-flash');

            // Prevent automatic summary refreshes while the CSV is processed so
            // the sidebar doesn't revert to the old totals.
            skipSummaryUpdate = true;
            if (tableObserver) tableObserver.disconnect();

            // Open the Fraud Review queue immediately so IDs are collected even if
            // the CSV download fails.
            bg.openOrReuseTab({ url: 'https://db.incfile.com/order-tracker/orders/fraud?fennec_queue_scan=1', active: false });

            // Suppress DataTables Ajax error alerts in the page context so the
            // warning dialog doesn't appear when the built-in request fails.
            injectDatatablesPatch().then(() => {
                // Trigger the standard CSV download in case the custom request fails.
                const genBtn = document.getElementById('generateCSV');
                if (genBtn) {
                    console.log('[FENNEC] Triggering built-in CSV download button');
                    genBtn.click();
                } else {
                    console.warn('[FENNEC] generateCSV button not found');
                }

                downloadCsvOrders(orders => {
                    if (icon) icon.classList.remove('fennec-flash');
                    if (progress) {
                        progress.textContent = '';
                        progress.style.display = 'none';
                    }
                    console.log(`[FENNEC] CSV downloaded with ${orders.length} orders`);

                    // Update sidebar summary first using the CSV data
                    showCsvSummary(orders);
                    lastCsvOrders = orders;
                    sessionStorage.setItem('fennecCsvOrders', JSON.stringify(orders));
                    chrome.storage.local.set({ fennecCsvOrders: JSON.stringify(orders) });

                    skipSummaryUpdate = true;
                    if (tableObserver) tableObserver.disconnect();

                    console.log('[FENNEC] Injecting CSV orders into search results table');
                    injectCsvOrders(orders);

                    const ids = orders.map(o => String(o.id));
                    const highlightIds = ids.filter(id => fraudSet.has(id));
                    console.log(`[FENNEC] Flagging ${highlightIds.length} possible fraud orders`);
                    pendingHighlightIds = highlightIds;
                    highlightMatches(highlightIds);

                    // Show the real totals again after all rows are injected
                    showCsvSummary(orders);

                    // Keep CSV totals displayed until Queue View runs again
                    // so automatic updates don't revert the summary
                    // skipSummaryUpdate remains true and table observer stays disabled
                });
            });
        }

        function openCurrentView() {
            console.log('[FENNEC] Showing summary for current page');
            const orders = collectOrders();
            showCsvSummary(orders);
            lastCsvOrders = orders;
            sessionStorage.setItem('fennecCsvOrders', JSON.stringify(orders));
            chrome.storage.local.set({ fennecCsvOrders: JSON.stringify(orders) });
            const highlightIds = orders
                .map(o => String(o.id))
                .filter(id => fraudSet.has(id));
            highlightMatches(highlightIds);
            skipSummaryUpdate = true;
            if (tableObserver) tableObserver.disconnect();
        }

        function clearQueueData() {
            console.log('[FENNEC] Clearing queue summary');
            sessionStorage.removeItem('fennecCsvSummary');
            sessionStorage.removeItem('fennecCsvSummaryActive');
            sessionStorage.removeItem('fennecCsvOrders');
            chrome.storage.local.remove(['fennecCsvSummary', 'fennecCsvSummaryActive', 'fennecCsvOrders']);
            lastCsvSummary = null;
            lastCsvOrders = null;
            csvSummaryActive = false;
            skipSummaryUpdate = true;
            if (tableObserver) tableObserver.disconnect();
            renderSummary(0, 0, 0, {}, {}, {});
            highlightMatches();
            const progress = document.getElementById('qs-progress');
            if (progress) { progress.textContent = ''; progress.style.display = 'none'; }
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

            const sb = new Sidebar();
            sb.build(`
                ${buildSidebarHeader()}
                <div class="copilot-body" id="copilot-body-content">
                    <div id="qs-summary" class="white-box" style="margin-bottom:10px"></div>
                    <button id="queue-view-btn" class="copilot-button" style="width:100%;margin-bottom:8px">VIEW ALL</button>
                    <button id="current-view-btn" class="copilot-button" style="width:100%;margin-bottom:8px">VIEW CURRENT</button>
                    <button id="queue-clear-btn" class="copilot-button" style="width:100%;margin-bottom:8px">CLEAR</button>
                    <div id="qs-progress" style="display:none;margin-bottom:10px;color:#ffa500;font-weight:bold"></div>
                </div>`);
            sb.attach();
            chrome.storage.sync.get({
                sidebarFontSize: 13,
                sidebarFont: "'Inter', sans-serif",
                sidebarBgColor: '#212121',
                sidebarBoxColor: '#2e2e2e'
            }, o => applySidebarDesign(sb.element, o));

            sb.element.querySelector('#queue-view-btn').addEventListener('click', openQueueView);
            const currentBtn = sb.element.querySelector('#current-view-btn');
            if (currentBtn) currentBtn.addEventListener('click', openCurrentView);
            const clearBtn = sb.element.querySelector('#queue-clear-btn');
            if (clearBtn) clearBtn.addEventListener('click', clearQueueData);
        }

        function waitForResults(callback) {
            const tbody = document.querySelector('#tableStatusResults tbody');
            if (!tbody) { setTimeout(() => waitForResults(callback), 100); return; }
            const rows = tbody.querySelectorAll('tr');
            if (rows.length) { callback(); return; }
            const obs = new MutationObserver(() => {
                if (tbody.querySelector('tr')) {
                    obs.disconnect();
                    callback();
                }
            });
            obs.observe(tbody, { childList: true });
        }

        function initEmailSearch() {
            const input = document.querySelector('#search_field');
            if (input) {
                input.value = email;
                input.dispatchEvent(new Event('input', { bubbles: true }));

                // Trigger the search without invoking the <a href="javascript:void(0)">
                // default handler, which is blocked by the extension's CSP when
                // executed programmatically.  Dispatching the keypress event
                // causes the page's jQuery handler to run `ajaxSearch()` safely.
                input.dispatchEvent(new KeyboardEvent('keypress', {
                    key: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true
                }));
            } else {
                const btn = document.getElementById('mainSearching') || document.querySelector('#mainSearching');
                // Fallback for very old pages: try clicking the button.  This may
                // be ignored by modern pages where the event is attached to the
                // input field instead.
                if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            }
            waitForResults(() => {
                const orders = collectOrders().map(o => ({ orderId: o.id, type: '', status: o.status }));
                const total = getTotalCount();
                bg.send('dbEmailSearchResults', { orders, total });
            });
        }

        function init() {
            injectSidebar();
            injectDatatablesPatch();
            if (lastCsvSummary) {
                renderSummary(
                    lastCsvSummary.total,
                    lastCsvSummary.expCount,
                    lastCsvSummary.fraudCount,
                    lastCsvSummary.stateCounts,
                    lastCsvSummary.statusCounts,
                    lastCsvSummary.dateCounts
                );
            }
            waitForResults(() => {
                updateSummary();
                observeTable();
                highlightMatches();
                if (csvSummaryActive && lastCsvOrders && lastCsvOrders.length) {
                    const highlightIds = Array.from(new Set([
                        ...fraudSet,
                        ...lastCsvOrders.filter(o => /possible fraud/i.test(o.status)).map(o => String(o.id))
                    ]));
                    pendingHighlightIds = highlightIds;
                    injectCsvOrders(lastCsvOrders);
                }
            });
            if (email) initEmailSearch();
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else init();

        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && changes.fennecFraudOrders) {
                fraudSet.clear();
                (changes.fennecFraudOrders.newValue || []).forEach(id =>
                    fraudSet.add(String(id))
                );
                highlightMatches();
                // Refresh the summary so POSSIBLE FRAUD count includes the
                // newly saved list even when automatic updates are disabled.
                if (csvSummaryActive && lastCsvSummary) {
                    const orders = lastCsvOrders && lastCsvOrders.length ?
                        lastCsvOrders : collectOrders();
                    showCsvSummary(orders);
                } else {
                    showCsvSummary(collectOrders());
                }
            }
        });

        chrome.runtime.onMessage.addListener((msg, snd, sendResponse) => {
            if (msg.action === 'getEmailOrders') {
                const sendOrders = () => {
                    const orders = collectOrders().map(o => ({ orderId: o.id, type: '', status: o.status }));
                    const total = getTotalCount();
                    console.log('[FENNEC (POO)] db_order_search returning', orders.length, 'orders');
                    sendResponse({ orders, total });
                };
                const tbody = document.querySelector('#tableStatusResults tbody');
                if (tbody && !tbody.querySelector('tr')) {
                    const obs = new MutationObserver(() => {
                        if (tbody.querySelector('tr')) {
                            obs.disconnect();
                            sendOrders();
                        }
                    });
                    obs.observe(tbody, { childList: true });
                    setTimeout(() => { obs.disconnect(); sendOrders(); }, 30000);
                    return true;
                }
                sendOrders();
            }
        });

        // Persist CSV summary across page reloads so the sidebar does not
        // revert to the initial state when the order search page refreshes.
        window.addEventListener('beforeunload', () => {
            if (csvSummaryActive && lastCsvSummary) {
                sessionStorage.setItem('fennecCsvSummaryActive', '1');
                sessionStorage.setItem('fennecCsvSummary', JSON.stringify(lastCsvSummary));
                chrome.storage.local.set({
                    fennecCsvSummaryActive: '1',
                    fennecCsvSummary: JSON.stringify(lastCsvSummary)
                });
                if (lastCsvOrders) {
                    sessionStorage.setItem('fennecCsvOrders', JSON.stringify(lastCsvOrders));
                    chrome.storage.local.set({ fennecCsvOrders: JSON.stringify(lastCsvOrders) });
                }
            }
        });
    });
})();

