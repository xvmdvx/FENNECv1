class KountLauncher extends Launcher {
    init() {
    if (window.top !== window) return;
    const bg = fennecMessenger;
    chrome.storage.local.get({ extensionEnabled: true }, ({ extensionEnabled }) => {
        if (!extensionEnabled) return;
        try {
            function saveData(part) {
                chrome.storage.local.get({ kountInfo: {} }, ({ kountInfo }) => {
                    const updated = Object.assign({}, kountInfo, part);
                    chrome.storage.local.set({ kountInfo: updated });
                    console.log('[FENNEC (POO) Kount] Data saved', part);
                });
            }

            const path = window.location.pathname;

            function findVal(label) {
                const cell = Array.from(document.querySelectorAll('table th, table td'))
                    .find(el => el.textContent.trim() === label);
                return cell && cell.nextElementSibling ? cell.nextElementSibling.textContent.trim() : '';
            }

            if (path.includes('/workflow/detail')) {
                const run = () => {
                    const emailAgeEl = document.querySelector('span[title*="email address was first seen"]');
                    const emailAge = emailAgeEl ? emailAgeEl.textContent.trim() : '';
                    const locEl = document.querySelector('th[title="Device Location"] + td span');
                    const deviceLocation = locEl ? locEl.textContent.trim() : '';
                    const ipEl = document.querySelector('th[title*="IP Address"] + td');
                    const ip = ipEl ? ipEl.textContent.trim() : '';

                    const vipBtn = Array.from(document.querySelectorAll('a,button'))
                        .find(el => /VIP Lists/i.test(el.textContent));
                    if (vipBtn) vipBtn.click();
                    setTimeout(() => {
                        const declines = Array.from(document.querySelectorAll('#vip-lists tr'))
                            .filter(row => row.querySelector('input[value="decline"]')?.checked)
                            .map(row => {
                                const label = row.querySelector('th')?.textContent.trim() || '';
                                const valEl = row.querySelector('td.value, td.truncated.value');
                                const val = valEl ? (valEl.getAttribute('title') || valEl.textContent).trim() : '';
                                return label && val ? `${label}: ${val}` : '';
                            })
                            .filter(Boolean);

                        const linked = {};
                        document.querySelectorAll('#link-analysis tbody tr').forEach(row => {
                            const th = row.querySelector('th');
                            const countEl = row.querySelector('.count');
                            if (!th || !countEl) return;
                            const label = th.textContent.replace(/:\s*$/, '').trim();
                            const num = parseInt(countEl.textContent.replace(/[^0-9]/g, ''), 10) || 0;
                            switch (label) {
                                case 'Email': linked.email = num; break;
                                case 'IP Address': linked.ip = num; break;
                                case 'Cust. ID': linked.custId = num; break;
                                case 'Payment': linked.payment = num; break;
                                case 'Bill Addr': linked.billAddr = num; break;
                                case 'Ship Addr': linked.shipAddr = num; break;
                                case 'Device ID': linked.deviceId = num; break;
                                default: break;
                            }
                        });

                        saveData({ emailAge, deviceLocation, ip, declines, linked });

                        const ekataLink = document.querySelector('a[href*="/workflow/ekata"]');
                        if (ekataLink) {
                            const url = ekataLink.href.startsWith('http') ? ekataLink.href : location.origin + ekataLink.getAttribute('href');
                            bg.openOrReuseTab({ url, active: true });
                        }
                    }, 500);
                };
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', run);
                } else run();
            } else if (path.includes('/workflow/ekata')) {
                const run = () => {
                    const link = Array.from(document.querySelectorAll('a.link'))
                        .find(a => /Generate Ekata Report/i.test(a.textContent));
                    if (link) {
                        link.click();
                        return;
                    }
                    const btn = document.querySelector('input.simple-submit[value="Update Report"]');
                    if (btn && !sessionStorage.getItem('fennecEkataUpdateClicked')) {
                        sessionStorage.setItem('fennecEkataUpdateClicked', '1');
                        btn.click();
                        return;
                    }
                    setTimeout(() => {
                        const ipValid = findVal('Is Valid');
                        const proxyRisk = findVal('Proxy Risk');
                        const addressToName = findVal('Address to Name');
                        const residentName = findVal('Resident Name');
                        saveData({ ekata: { ipValid, proxyRisk, addressToName, residentName } });
                        sessionStorage.removeItem('fennecEkataUpdateClicked');
                        chrome.storage.local.get({ fennecFraudAdyen: null }, ({ fennecFraudAdyen }) => {
                            if (fennecFraudAdyen) {
                                chrome.storage.local.remove('fennecFraudAdyen');
                                bg.openOrReuseTab({ url: fennecFraudAdyen, active: true });
                            }
                        });
                    }, 1500);
                };
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', run);
                } else run();
            }
        } catch (e) {
            console.error('[FENNEC (POO) Kount] Launcher error:', e);
        }
    });
    }
}

new KountLauncher().init();
