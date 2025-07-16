(function() {
    if (window.top !== window) return;
    const bg = fennecMessenger;
    chrome.storage.local.get({ extensionEnabled: true }, ({ extensionEnabled }) => {
        if (!extensionEnabled) return;
        const params = new URLSearchParams(location.search);
        const email = params.get('fennec_email');
        if (!email) return;
        function collectOrders() {
            const rows = document.querySelectorAll(
                '.search_result tbody tr, #tableStatusResults tbody tr'
            );
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
                const m = info.textContent.match(/of\s+(\d+)\s+entries/i);
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
            document.addEventListener('DOMContentLoaded', run);
        } else run();

        chrome.runtime.onMessage.addListener((msg, snd, sendResponse) => {
            if (msg.action === 'getEmailOrders') {
                const sendOrders = () => {
                    const orders = collectOrders();
                    const total = getTotalCount();
                    console.log('[FENNEC (POO)] db_email_search returning', orders.length, 'orders');
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
