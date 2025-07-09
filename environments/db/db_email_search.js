(function() {
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
                const typeCell = r.querySelector('td:nth-child(4)');
                const type = typeCell ? typeCell.textContent.trim() : '';
                return { orderId: id, type };
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
            const btn = document.querySelector('button[type="submit"],input[type="submit"]');
            if (btn) btn.click();
            waitForResults(() => {
                const orders = collectOrders();
                chrome.runtime.sendMessage({ action: 'dbEmailSearchResults', orders });
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
