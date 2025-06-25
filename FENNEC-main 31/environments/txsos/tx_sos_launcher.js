// Automates early steps of the Texas SOS filing process.
(function() {
    chrome.storage.local.get({ sidebarOrderInfo: null }, ({ sidebarOrderInfo }) => {
        const info = sidebarOrderInfo || {};
        chrome.storage.sync.get({ txsosUser: "", txsosPass: "" }, creds => {

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
            if (creds.txsosUser && creds.txsosPass) {
                setValue('input[name="client_id"]', creds.txsosUser);
                setValue('input[name="web_password"], input[name="password"]', creds.txsosPass);
                click('input[type="submit"]');
            }
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
            return;
        }

        if (document.querySelector('input[name=":Saddress1"]') && document.querySelector('input[name=":Szip_code"]')) {
            const ra = info.registeredAgent || {};
            if (ra.name) {
                const parts = ra.name.trim().split(/\s+/);
                setValue('input[name=":Sfirst_name"]', parts.shift() || '');
                setValue('input[name=":Slast_name"]', parts.join(' '));
            }
            if (ra.address) {
                const addr = ra.address.split(',');
                setValue('input[name=":Saddress1"]', addr[0] || '');
                if (addr[1]) {
                    const cityState = addr[1].trim().split(/\s+/);
                    setValue('input[name=":Scity"]', cityState[0] || '');
                    if (cityState[1]) setValue('input[name=":Sstate"]', cityState[1].replace(/[^A-Z]/gi, '').slice(0,2));
                    if (cityState[2]) setValue('input[name=":Szip_code"]', cityState[2]);
                }
            }
            click('input[type="submit"][value="Continue"]');
            return;
        }

        if (document.querySelector('input[name=":Nmanagement_type"]')) {
            const radio = document.querySelector('input[name=":Nmanagement_type"][value="1"]');
            if (radio) radio.checked = true;
            const addBtn = document.querySelector('input[type="submit"][value="Add Manager/Member"]');
            if (addBtn) { addBtn.click(); return; }
        }

        if (document.querySelector('input[name=":Scity"]') && document.querySelector('input[name=":NidxMO"]')) {
            const idx = parseInt(document.querySelector('input[name=":NidxMO"]').value, 10) || 1;
            const member = Array.isArray(info.members) ? info.members[idx - 1] : null;
            if (member) {
                const nameParts = (member.name || '').split(/\s+/);
                setValue('input[name=":Sfirst_name"]', nameParts.shift() || '');
                setValue('input[name=":Slast_name"]', nameParts.join(' '));
                const addr = (member.address || '').split(',');
                setValue('input[name=":Saddress1"]', addr[0] || '');
                if (addr[1]) {
                    const cs = addr[1].trim().split(/\s+/);
                    setValue('input[name=":Scity"]', cs[0] || '');
                    if (cs[1]) setValue('input[name=":Sstate"]', cs[1].replace(/[^A-Z]/gi, '').slice(0,2));
                    if (cs[2]) setValue('input[name=":Szip_code"]', cs[2]);
                }
            }
            const updBtn = document.querySelector('input[type="submit"][value="Update"]');
            if (updBtn) { updBtn.click(); return; }
        }

        if (document.querySelector('input[type="submit"][value="Add Manager/Member"]')) {
            const nextIdx = document.querySelectorAll('input[name=":NidxMO"]').length + 1;
            if (info.members && info.members.length >= nextIdx) {
                document.querySelector('input[type="submit"][value="Add Manager/Member"]').click();
                return;
            }
            const cont = document.querySelector('input[type="submit"][value="Continue"]');
            if (cont) { cont.click(); return; }
        }

        if (document.querySelector('input[name="page_caption"][value="Supplemental Provisions/Information"]')) {
            const cont = document.querySelector('input[type="submit"][value="Continue"]');
            if (cont) { cont.click(); return; }
        }

        if (document.querySelector('input[name="OA_desc"]')) {
            setValue('input[name=":Slast_name"]', 'DOBSON');
            setValue('input[name=":Sfirst_name"]', 'LOVETTE');
            setValue('input[name=":Saddress1"]', '17350 State Hwy 249 Ste 220');
            setValue('input[name=":Scity"]', 'Houston');
            setValue('input[name=":Sstate"]', 'TX');
            setValue('input[name=":Szip_code"]', '77064');
            click('input[type="submit"][value="Continue"]');
            return;
        }

        if (document.querySelector('input[name=":Sexecution1"]')) {
            setValue('input[name=":Sexecution1"]', 'LOVETTE DOBSON');
            const cont = document.querySelector('input[type="submit"][value="Continue"]');
            if (cont) { cont.click(); return; }
        }
        });
    });
})();
