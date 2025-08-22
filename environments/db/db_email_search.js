(function() {
    if (window.top !== window) return;
    const bg = fennecMessenger;
    chrome.storage.local.get({ extensionEnabled: true, fennecReviewMode: false }, ({ extensionEnabled, fennecReviewMode }) => {
        if (!extensionEnabled) return;
        document.title = '[DB SEARCH] ' + document.title;
        const reviewMode = fennecReviewMode;
        const SIDEBAR_WIDTH = 340;

        function updateReviewDisplay() {
            const label = document.getElementById('review-mode-label');
            if (label) label.style.display = reviewMode ? 'block' : 'none';
        }



        function injectSidebar() {
            if (document.getElementById('copilot-sidebar')) return;
            document.body.style.transition = 'margin-right 0.2s';
            document.body.style.marginRight = SIDEBAR_WIDTH + 'px';
            if (!document.getElementById('copilot-db-padding')) {
                const style = document.createElement('style');
                style.id = 'copilot-db-padding';
                style.textContent = `#frm-search-order { margin-right: ${SIDEBAR_WIDTH}px !important; }`;
                document.head.appendChild(style);
            }

            const sb = new Sidebar();
            sb.build(buildStandardizedReviewModeSidebar(reviewMode, false));
            sb.attach();
            
            // Setup INT STORAGE click handler
            const orderId = sessionStorage.getItem('fennec_order');
            if (orderId) {
                setupIntStorageClickHandler(orderId);
            }
            chrome.storage.sync.get({
                sidebarFontSize: 13,
                sidebarFont: "'Inter', sans-serif",
                sidebarBgColor: '#212121',
                sidebarBoxColor: '#2e2e2e'
            }, opts => applySidebarDesign(sb.element, opts));
            loadSidebarSnapshot(sb.element, updateReviewDisplay);

            const closeBtn = sb.element.querySelector('#copilot-close');
            if (closeBtn) closeBtn.onclick = () => {
                sb.remove();
                document.body.style.marginRight = '';
                const style = document.getElementById('copilot-db-padding');
                if (style) style.remove();
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
        const params = new URLSearchParams(location.search);
        const email = params.get('fennec_email');
        if (!email) return;
        function collectOrders() {
            let rows = document.querySelectorAll(
                '.search_result tbody tr, #tableStatusResults tbody tr'
            );
            if (!rows.length) {
                const table = document.querySelector('table.dataTable');
                if (table) rows = table.querySelectorAll('tbody tr');
            }
            return Array.from(rows).map(r => {
                const link = r.querySelector('a[href*="/order/detail/"]');
                const id = link ? link.textContent.replace(/\D+/g, '') : '';
                const typeCell = r.querySelector('td:nth-child(4)');
                const type = typeCell ? typeCell.textContent.trim() : '';
                const statusCell = r.querySelector('td:nth-child(5)');
                const status = statusCell ? statusCell.textContent.trim() : '';
                return { orderId: id, type, status };
            });
        }

        function getTotalCount() {
            const info = document.querySelector('.dataTables_info');
            if (info) {
                const m = info.textContent.match(/of\s+(\d+)\s+(?:entries|results)/i);
                if (m) return parseInt(m[1], 10);
            }
            return collectOrders().length;
        }

        function waitForResults(callback) {
            const tbody = document.querySelector(
                '.search_result tbody, #tableStatusResults tbody'
            );
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

        function run() {
            const input = document.querySelector('#search_field');
            if (input) {
                input.value = email;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
            const btn = document.querySelector('button[type="submit"],input[type="submit"]');
            if (btn) btn.click();
            waitForResults(() => {
                const orders = collectOrders();
                const total = getTotalCount();
                bg.send('dbEmailSearchResults', { orders, total });
            });
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => { injectSidebar(); run(); });
        } else { injectSidebar(); run(); }

        chrome.runtime.onMessage.addListener((msg, snd, sendResponse) => {
            if (msg.action === 'getEmailOrders') {
                const sendOrders = () => {
                    const orders = collectOrders();
                    const total = getTotalCount();
                    sendResponse({ orders, total });
                };
                const tbody = document.querySelector(
                    '.search_result tbody, #tableStatusResults tbody'
                );
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
    });
})();
