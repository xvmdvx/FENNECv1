// Automates early steps of the Texas SOS filing process.
(function() {
    chrome.storage.local.get({ sidebarOrderInfo: null }, ({ sidebarOrderInfo }) => {
        const info = sidebarOrderInfo || {};

        function click(sel) {
            const el = document.querySelector(sel);
            if (el) el.click();
        }

        function setValue(sel, value) {
            const el = document.querySelector(sel);
            if (el) {
                el.focus();
                el.value = value;
                el.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }

        const path = location.pathname;

        if (path.includes('/acct/acct-login.asp')) {
            setValue('input[name="client_id"]', '66658900');
            setValue('input[name="web_password"], input[name="password"]', 'Andr3sfue05$');
            click('input[type="submit"]');
            return;
        }

        if (document.querySelector('select[name="payment_type_id"]')) {
            setValue('select[name="payment_type_id"]', '5');
            click('input[type="submit"][value="Continue"]');
            return;
        }

        const bizLink = document.querySelector('#navlist a[href*="home-corp.asp"]');
        if (bizLink) {
            bizLink.click();
            return;
        }

        if (document.querySelector('select[name=":Ncorp_type_id"]')) {
            setValue('select[name=":Ncorp_type_id"]', '6');
            click('input[type="submit"][value="File Document"]');
            return;
        }

        if (document.querySelector('select[name=":Nfiling_type_id"]')) {
            setValue('select[name=":Nfiling_type_id"]', '10601');
            click('input[type="submit"][value="Continue"]');
            return;
        }

        if (document.querySelector('input[name=":Scorp_name"]')) {
            setValue('input[name=":Scorp_name"]', info.companyName || '');
            click('input[type="submit"][value="Continue"]');
            return;
        }

        if (document.querySelector('input[name=":Sinitial_address1IA"]')) {
            setValue('input[name=":Sinitial_address1IA"]', '17350 State Highway 249 Ste 220');
            setValue('input[name=":Sinitial_cityIA"]', 'Houston');
            setValue('input[name=":Sinitial_stateIA"]', 'TX');
            setValue('input[name=":Sinitial_zipIA"]', '77064');
            click('input[type="submit"][value="Continue"]');
        }
    });
})();
