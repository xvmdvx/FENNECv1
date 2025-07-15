(function() {
    if (window.top !== window) return;
    const bg = fennecMessenger;
    chrome.storage.local.get({ extensionEnabled: true, lightMode: false, fennecFraudOrders: [] }, opts => {
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

        function collectOrders() {
            const rows = document.querySelectorAll('#tableStatusResults tbody tr');
            return Array.from(rows).map(r => {
                const link = r.querySelector('a[href*="/order/detail/"]');
                const id = link ? link.textContent.replace(/\D+/g, '') : '';
                const statusCell = r.querySelector('td:nth-child(5)');
                const status = statusCell ? statusCell.textContent.trim() : '';
                const stateCell = r.querySelector('td:nth-child(7)');
                const state = stateCell ? stateCell.textContent.trim() : '';
                const expCell = r.querySelector('td:nth-child(4) i.mdi-check-circle');
                const expedited = !!expCell;
                return { id, status, state, expedited, row: r, link };
            }).filter(o => o.id);
        }

        function updateSummary() {
            const orders = collectOrders();
            const stateCounts = {};
            let expCount = 0;
            orders.forEach(o => {
                if (o.state) stateCounts[o.state] = (stateCounts[o.state] || 0) + 1;
                if (o.expedited) expCount++;
            });
            const box = document.getElementById('qs-summary');
            if (!box) return;
            let html = `<div><b>TOTAL:</b> ${orders.length}</div>`;
            html += `<div><b>EXPEDITED:</b> ${expCount}</div>`;
            Object.keys(stateCounts)
                .sort((a,b) => stateCounts[b] - stateCounts[a])
                .forEach(st => {
                    html += `<div><b>${escapeHtml(st)}:</b> ${stateCounts[st]}</div>`;
                });
            box.innerHTML = html;
        }

        function highlightMatches(ids) {
            const set = ids ? new Set(ids.map(String)) : fraudSet;
            const rows = document.querySelectorAll('#tableStatusResults tbody tr');
            rows.forEach(r => {
                const link = r.querySelector('a[href*="/order/detail/"]');
                if (!link) return;
                const id = link.textContent.replace(/\D+/g, '');
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
                } else if (icon) {
                    icon.remove();
                }
            });
        }

        function downloadCsvOrders(cb) {
            const origBlob = window.Blob;
            let csv = null;
            let finished = false;
            window.Blob = function(data, opts) {
                if (Array.isArray(data) && typeof data[0] === 'string') {
                    csv = data[0];
                    finished = true;
                }
                return new origBlob(data, opts);
            };
            function finalize() {
                window.Blob = origBlob;
                const ids = [];
                if (csv) {
                    csv.split('\n').forEach(line => {
                        const m = line.match(/"?(22\d{10})"?/);
                        if (m) ids.push(m[1]);
                    });
                }
                cb(ids);
            }
            if (typeof downloadOrderSearch === 'function') {
                downloadOrderSearch();
            }
            let attempts = 0;
            (function waitCsv() {
                if (finished || attempts > 50) return finalize();
                attempts++;
                setTimeout(waitCsv, 100);
            })();
        }

        function showCsvOrders(ids) {
            const box = document.getElementById('qs-summary');
            if (!box) return;
            const html = ids.map(id => {
                const flag = fraudSet.has(String(id)) ? ' ⚑' : '';
                return `<div><a href="https://db.incfile.com/incfile/order/detail/${id}" target="_blank">${id}</a>${flag}</div>`;
            }).join('');
            box.innerHTML = html;
        }

        function openQueueView() {
            const icon = document.querySelector('#copilot-sidebar .copilot-icon');
            if (icon) icon.classList.add('fennec-flash');
            downloadCsvOrders(ids => {
                if (icon) icon.classList.remove('fennec-flash');
                highlightMatches(ids);
                showCsvOrders(ids);
            });
            const genBtn = document.getElementById('generateCSV');
            if (genBtn) genBtn.click();
            bg.openOrReuseTab({ url: 'https://db.incfile.com/order-tracker/orders/fraud?fennec_queue_scan=1', active: false });
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
                <div class="copilot-header">
                    <div class="copilot-title">
                        <img src="${chrome.runtime.getURL('fennec_icon.png')}" class="copilot-icon" alt="FENNEC (POO)" />
                        <span>FENNEC (POO)</span>
                    </div>
                </div>
                <div class="copilot-body" id="copilot-body-content">
                    <button id="queue-view-btn" class="copilot-button" style="width:100%;margin-bottom:8px">QUEUE VIEW</button>
                    <div id="qs-summary" class="white-box" style="margin-bottom:10px"></div>
                </div>`);
            sb.attach();
            chrome.storage.sync.get({
                sidebarFontSize: 13,
                sidebarFont: "'Inter', sans-serif",
                sidebarBgColor: '#212121',
                sidebarBoxColor: '#2e2e2e'
            }, o => applySidebarDesign(sb.element, o));

            sb.element.querySelector('#queue-view-btn').addEventListener('click', openQueueView);
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
            }
            const btn = document.getElementById('mainSearching') || document.querySelector('#mainSearching');
            if (btn) btn.click();
            waitForResults(() => {
                const orders = collectOrders().map(o => ({ orderId: o.id, type: '', status: o.status }));
                bg.send('dbEmailSearchResults', { orders });
            });
        }

        function init() {
            injectSidebar();
            updateSummary();
            highlightMatches();
            if (email) initEmailSearch();
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else init();

        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && changes.fennecFraudOrders) {
                fraudSet.clear();
                (changes.fennecFraudOrders.newValue || []).forEach(id => fraudSet.add(String(id)));
                highlightMatches();
            }
        });
    });
})();

