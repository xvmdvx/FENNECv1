(function() {
    if (window.top !== window) return;
    const bg = fennecMessenger;
    chrome.storage.local.get({ extensionEnabled: true }, ({ extensionEnabled }) => {
        if (!extensionEnabled) return;
        const params = new URLSearchParams(location.search);
        const email = params.get('fennec_email');
        if (!email) return;
        function collectOrders() {
            const rows = document.querySelectorAll('.search_result tbody tr');
            return Array.from(rows).map(r => {
                const link = r.querySelector('a[href*="/order/detail/"]');
                const id = link ? link.textContent.replace(/\D+/g, '') : '';
                const cells = r.querySelectorAll('td');
                let type = '';
                if (cells.length >= 6) type = cells[5].textContent.trim();
                else if (cells.length >= 4) type = cells[3].textContent.trim();
                const status = cells.length >= 5 ? cells[4].textContent.trim() : '';
                return { orderId: id, type, status };
            });
        }

        function waitForResults(callback) {
            const tbody = document.querySelector('.search_result tbody');
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
            const btn = document.getElementById('mainSearching') || document.querySelector('#mainSearching');
            if (btn) btn.click();
            waitForResults(() => {
                const orders = collectOrders();
                bg.send('dbEmailSearchResults', { orders });
            });
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', run);
        } else run();

        chrome.runtime.onMessage.addListener((msg, snd, sendResponse) => {
            if (msg.action === 'getEmailOrders') {
                sendResponse({ orders: collectOrders() });
            }
        });
    });
})();
