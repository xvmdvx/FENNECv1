// Automates Texas SOS filing and shows the current DB sidebar.
(function() {
    if (window !== window.top) return;
    chrome.storage.local.get({ sidebarOrderInfo: null, sidebarDb: [], lightMode: false, bentoMode: false },
        ({ sidebarOrderInfo, sidebarDb, lightMode, bentoMode }) => {
        const info = sidebarOrderInfo || {};
        if (lightMode) document.body.classList.add('fennec-light-mode');
        if (bentoMode) document.body.classList.add('fennec-bento-mode');
        chrome.storage.sync.get({ txsosUser: "", txsosPass: "", sidebarWidth: 340 }, creds => {

        function log(step) {
            console.log("[File Along] " + step);
        }

        function injectSidebar() {
            if (document.getElementById('copilot-sidebar')) return;
            log('Injecting sidebar');
            const sidebar = document.createElement('div');
            sidebar.id = 'copilot-sidebar';
            sidebar.innerHTML = `
                <div class="copilot-header">
                    <div class="copilot-title">
                        <img src="${chrome.runtime.getURL('fennec_icon.png')}" class="copilot-icon" alt="FENNEC (v0.3)" />
                        <span>FENNEC (v0.3)</span>
                    </div>
                    <button id="copilot-close">✕</button>
                </div>
                <div class="copilot-body" id="copilot-body-content"></div>
            `;
            document.body.appendChild(sidebar);
            if (document.body.classList.contains('fennec-bento-mode')) {
                const vid = document.createElement('video');
                vid.id = 'bento-video';
                vid.src = chrome.runtime.getURL('BG_HOLO.mp4');
                vid.muted = true;
                vid.autoplay = true;
                vid.playsInline = true;
                vid.loop = false;
                vid.playbackRate = 0.2;
                sidebar.prepend(vid);
                let reverse = false;
                vid.addEventListener('ended', () => {
                    reverse = !reverse;
                    vid.playbackRate = reverse ? -0.2 : 0.2;
                    vid.currentTime = reverse ? vid.duration - 0.01 : 0.01;
                    vid.play();
                });
            }
            document.body.style.marginRight = (parseInt(creds.sidebarWidth, 10) || 340) + 'px';
            const body = document.getElementById('copilot-body-content');
            if (Array.isArray(sidebarDb) && sidebarDb.length) {
                body.innerHTML = sidebarDb.join('');
                attachCommonListeners(body);
            } else {
                body.innerHTML = '<div style="text-align:center; color:#aaa; margin-top:20px;">No DB data.</div>';
            }
            const closeBtn = sidebar.querySelector('#copilot-close');
            if (closeBtn) {
                closeBtn.onclick = () => {
                    sidebar.remove();
                    document.body.style.marginRight = '';
                };
            }
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                log('DOM ready');
                injectSidebar();
            });
        } else {
            log('DOM ready');
            injectSidebar();
        }

        function click(sel) {
            log('Clicking ' + sel);
            const el = document.querySelector(sel);
            if (el) el.click();
        }

        function setValue(sel, value) {
            log('Setting ' + sel + ' to ' + value);
            const el = document.querySelector(sel);
            if (el) {
                el.focus();
                el.value = "";
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.value = value;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        function performSteps() {
            const path = location.pathname;

            if (path.includes('/acct/acct-login.asp')) {
                log('Login page');
                if (creds.txsosUser && creds.txsosPass) {
                    log('Filling credentials');
                    setValue('input[name="client_id"]', creds.txsosUser);
                    setValue('input[name="web_password"], input[name="password"]', creds.txsosPass);
                    log('Submitting login');
                    click('input[type="submit"]');
                }
                return true;
            }

            if (document.querySelector('select[name="payment_type_id"]')) {
                log('Selecting payment type');
                const sel = document.querySelector('select[name="payment_type_id"]');
                const opt = Array.from(sel.options).find(o => /client account/i.test(o.textContent));
                setValue('select[name="payment_type_id"]', opt ? opt.value : '5');
                click('input[type="submit"][value="Continue"]');
                return true;
            }

        const bizLink = document.querySelector('#navlist a[href*="home-corp.asp"]');
            if (bizLink) {
                log('Opening business filing page');
                bizLink.click();
                return true;
            }

            if (document.querySelector('select[name=":Ncorp_type_id"]')) {
                log('Selecting entity type');
                setValue('select[name=":Ncorp_type_id"]', '6');
                click('input[type="submit"][value="File Document"]');
                return true;
            }

            if (document.querySelector('select[name=":Nfiling_type_id"]')) {
                log('Choosing filing type');
                setValue('select[name=":Nfiling_type_id"]', '10601');
                click('input[type="submit"][value="Continue"]');
                return true;
            }

            if (document.querySelector('input[name=":Scorp_name"]')) {
                log('Entering company name');
                setValue('input[name=":Scorp_name"]', info.companyName || '');
                click('input[type="submit"][value="Continue"]');
                return true;
            }

            if (document.querySelector('input[name=":Sinitial_address1IA"]')) {
                log('Entering initial address');
                setValue('input[name=":Sinitial_address1IA"]', '17350 State Highway 249 Ste 220');
                setValue('input[name=":Sinitial_cityIA"]', 'Houston');
                setValue('input[name=":Sinitial_stateIA"]', 'TX');
                setValue('input[name=":Sinitial_zipIA"]', '77064');
                click('input[type="submit"][value="Continue"]');
                return true;
            }

            if (document.querySelector('input[name=":Saddress1"]') && document.querySelector('input[name=":Szip_code"]')) {
                log('Entering registered agent');
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
                return true;
            }

            if (document.querySelector('input[name=":Nmanagement_type"]')) {
                log('Setting management type');
                const radio = document.querySelector('input[name=":Nmanagement_type"][value="1"]');
                if (radio) radio.checked = true;
                const addBtn = document.querySelector('input[type="submit"][value="Add Manager/Member"]');
                if (addBtn) { addBtn.click(); return true; }
            }

            if (document.querySelector('input[name=":Scity"]') && document.querySelector('input[name=":NidxMO"]')) {
                log('Adding member info');
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
                if (updBtn) { updBtn.click(); return true; }
            }

            if (document.querySelector('input[type="submit"][value="Add Manager/Member"]')) {
                log('Handling additional member');
                const nextIdx = document.querySelectorAll('input[name=":NidxMO"]').length + 1;
                if (info.members && info.members.length >= nextIdx) {
                    document.querySelector('input[type="submit"][value="Add Manager/Member"]').click();
                    return true;
                }
                const cont = document.querySelector('input[type="submit"][value="Continue"]');
                if (cont) { cont.click(); return true; }
            }

            if (document.querySelector('input[name="page_caption"][value="Supplemental Provisions/Information"]')) {
                log('Skipping provisions');
                const cont = document.querySelector('input[type="submit"][value="Continue"]');
                if (cont) { cont.click(); return true; }
            }

            if (document.querySelector('input[name="OA_desc"]')) {
                log('Entering organizer info');
                setValue('input[name=":Slast_name"]', 'DOBSON');
                setValue('input[name=":Sfirst_name"]', 'LOVETTE');
                setValue('input[name=":Saddress1"]', '17350 State Hwy 249 Ste 220');
                setValue('input[name=":Scity"]', 'Houston');
                setValue('input[name=":Sstate"]', 'TX');
                setValue('input[name=":Szip_code"]', '77064');
                click('input[type="submit"][value="Continue"]');
                return true;
            }

            if (document.querySelector('input[name=":Sexecution1"]')) {
                log('Signing execution');
                setValue('input[name=":Sexecution1"]', 'LOVETTE DOBSON');
                const cont = document.querySelector('input[type="submit"][value="Continue"]');
                if (cont) { cont.click(); return true; }
            }

            return false;
        }

        let attempts = 0;
        function runSteps() {
            if (!performSteps() && attempts < 20) {
                attempts++;
                setTimeout(runSteps, 1000);
            }
        }

        runSteps();
        });
    });
})();
