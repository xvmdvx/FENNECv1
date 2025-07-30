// Injects the FENNEC (POO) sidebar into Gmail pages.
// Pads main panels and the attachment viewer so content stays visible.
(function persistentSidebar() {
    if (window.top !== window) return;
    const bg = fennecMessenger;
    // Clear the closed flag on reload and wipe session data on unload so
    // old details don't persist when returning to Gmail.
    function cleanupSidebarSession() {
        sessionStorage.removeItem("fennecSidebarClosed");
        const data = {
            sidebarDb: [],
            sidebarOrderId: null,
            sidebarOrderInfo: null,
            adyenDnaInfo: null,
            kountInfo: null,
            sidebarFreezeId: null,
            fraudReviewSession: null,
            forceFraudXray: null,
            fennecFraudAdyen: null,
            sidebarSnapshot: null
        };
        sessionSet(data);
        sessionStorage.removeItem('fennecShowTrialFloater');
        localStorage.removeItem('fraudXrayFinished');
        chrome.storage.local.remove(Object.keys(data).concat([
            'fennecPendingComment',
            'fennecPendingUpload',
            'fennecUpdateRequest',
            'fennecQuickResolveDone',
            'fennecUploadDone'
        ]));
    }

    if (window.location.hash.startsWith('#inbox')) {
        cleanupSidebarSession();
    }

    window.addEventListener('beforeunload', cleanupSidebarSession);
    window.addEventListener('pagehide', cleanupSidebarSession);
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === 'fennecToggle') {
            window.location.reload();
        }
        if (msg.action === 'sosPermissionError') {
            alert('Permiso denegado para abrir la búsqueda SOS.');
        }
        if (msg.action === 'intStorageLoadComplete') {
            console.log('[FENNEC (POO) GM SB] Received INT STORAGE load complete signal for order:', msg.orderId, 'files count:', msg.filesCount);
            
            // Process completion signal for current order
            if (window.currentIntStorageOrderId === msg.orderId) {
                console.log('[FENNEC (POO) GM SB] INT STORAGE load complete for current order, checking storage for data');
                
                // Give a moment for the storage to be updated, then check for the data
                setTimeout(() => {
                    chrome.storage.local.get({ intStorageData: null }, ({ intStorageData }) => {
                        if (intStorageData && intStorageData.orderId === msg.orderId) {
                            console.log('[FENNEC (POO) GM SB] Found INT STORAGE data after completion signal');
                            if (intStorageData.error) {
                                updateIntStorageDisplay(null, msg.orderId, intStorageData.error, 0);
                            } else {
                                updateIntStorageDisplay(intStorageData.files, msg.orderId, null, 0);
                            }
                        } else {
                            console.log('[FENNEC (POO) GM SB] No INT STORAGE data found after completion signal');
                        }
                    });
                }, 500);
            } else {
                console.log('[FENNEC (POO) GM SB] INT STORAGE completion signal for different order:', msg.orderId, 'current order:', window.currentIntStorageOrderId);
            }
        }
    });
    chrome.storage.sync.get({ fennecReviewMode: false, fennecDevMode: false, sidebarWidth: 340 }, ({ fennecReviewMode, fennecDevMode, sidebarWidth }) => {
        chrome.storage.local.get({ extensionEnabled: true, lightMode: false, fennecDevMode: false }, ({ extensionEnabled, lightMode, fennecDevMode: localDev }) => {
        const devMode = localDev || fennecDevMode;
        if (!extensionEnabled) {
            return;
        }
        document.title = '[GM] ' + document.title;
        function maintainTitle(prefix) {
            const t = `[${prefix}] `;
            const titleEl = document.querySelector('title');
            if (!titleEl) return;
            const apply = () => {
                if (!document.title.startsWith(t)) {
                    document.title = t + document.title.replace(/^\[[^\]]+\]\s*/, '');
                }
            };
            new MutationObserver(apply).observe(titleEl, { childList: true });
            apply();
        }
        maintainTitle('GM');

        function runSearch(query) {
            const attempt = () => {
                const input = document.querySelector('input[name="q"]');
                if (input) {
                    input.value = query;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    const form = input.form;
                    if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                    return true;
                }
                return false;
            };
            if (!attempt()) {
                const obs = new MutationObserver(() => { if (attempt()) obs.disconnect(); });
                obs.observe(document.body, { childList: true, subtree: true });
                setTimeout(() => obs.disconnect(), 5000);
            }
        }

        {
            if (location.hash.startsWith('#search/')) {
                const q = decodeURIComponent(location.hash.replace(/^#search\//, ''));
                runSearch(q);
            }

            chrome.storage.local.get({ fennecPendingSearch: null }, ({ fennecPendingSearch }) => {
                if (fennecPendingSearch) {
                    chrome.storage.local.remove('fennecPendingSearch');
                    runSearch(fennecPendingSearch);
                }
            });
        }

        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && changes.fennecPendingSearch) {
                const q = changes.fennecPendingSearch.newValue;
                chrome.storage.local.remove('fennecPendingSearch');
                if (q) {
                    const run = () => {
                        const input = document.querySelector('input[name="q"]');
                        if (input) {
                            input.value = q;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            const form = input.form;
                            if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                            return true;
                        }
                        return false;
                    };
                    if (!run()) {
                        const obs = new MutationObserver(() => { if (run()) obs.disconnect(); });
                        obs.observe(document.body, { childList: true, subtree: true });
                        setTimeout(() => obs.disconnect(), 5000);
                    }
                }
            }
        });
        if (lightMode) {
            document.body.classList.add('fennec-light-mode');
        } else {
            document.body.classList.remove('fennec-light-mode');
        }
        try {
            const SIDEBAR_WIDTH = parseInt(sidebarWidth, 10) || 340;
            chrome.storage.local.get({ fennecActiveSession: null }, ({ fennecActiveSession }) => {
                if (fennecActiveSession) {
                    sessionStorage.setItem('fennecSessionId', fennecActiveSession);
                }
                getFennecSessionId();
                let reviewMode = sessionStorage.getItem('fennecReviewMode');
                reviewMode = reviewMode === null ? fennecReviewMode : reviewMode === 'true';
                let currentContext = null;
                let storedOrderInfo = null;
                let droppedFiles = [];
                let searchInProgress = false;
            const updateFloater = new UpdateFloater();

            function dedupeFiles(list) {
                const seen = new Set();
                return list.filter(f => {
                    const name = (f.file || f).name;
                    if (seen.has(name)) return false;
                    seen.add(name);
                    return true;
                });
            }
            // Preserve the latest DNA details across Gmail pages.
            // Older versions cleared the data on each load when no sidebar was
            // frozen, which prevented displaying Adyen's DNA in Review Mode.

            // Map of US states to their SOS business search pages
            const SOS_URLS = {
                "Alabama": { name: "https://arc-sos.state.al.us/CGI/CORPNAME.MBR/INPUT", id: "https://arc-sos.state.al.us/CGI/corpnumber.mbr/input" },
                "Alaska": { name: "https://www.commerce.alaska.gov/cbp/main/search/entities", id: "https://www.commerce.alaska.gov/cbp/main/search/entities" },
                "Arizona": { name: "https://ecorp.azcc.gov/EntitySearch/Index", id: "https://ecorp.azcc.gov/EntitySearch/Index" },
                "Arkansas": { name: "https://www.ark.org/corp-search/", id: "https://www.ark.org/corp-search/" },
                "California": { name: "https://bizfileonline.sos.ca.gov/search/business", id: "https://bizfileonline.sos.ca.gov/search/business" },
                "Colorado": { name: "https://www.sos.state.co.us/biz/BusinessEntityCriteriaExt.do", id: "https://www.sos.state.co.us/biz/BusinessEntityCriteriaExt.do" },
                "Connecticut": { name: "https://service.ct.gov/business/s/onlinebusinesssearch?language=en_US", id: "https://service.ct.gov/business/s/onlinebusinesssearch?language=en_US" },
                "Delaware": { name: "https://icis.corp.delaware.gov/Ecorp/EntitySearch/NameSearch.aspx", id: "https://icis.corp.delaware.gov/Ecorp/EntitySearch/NameSearch.aspx" },
                "District of Columbia": { name: "https://os.dc.gov/", id: "https://os.dc.gov/" },
                "Florida": { name: "https://search.sunbiz.org/Inquiry/CorporationSearch/ByName", id: "https://search.sunbiz.org/Inquiry/CorporationSearch/ByDocumentNumber" },
                "Georgia": { name: "https://ecorp.sos.ga.gov/BusinessSearch", id: "https://ecorp.sos.ga.gov/BusinessSearch" },
                "Hawaii": { name: "https://hbe.ehawaii.gov/documents/search.html", id: "https://hbe.ehawaii.gov/documents/search.html" },
                "Idaho": { name: "https://sosbiz.idaho.gov/search/business", id: "https://sosbiz.idaho.gov/search/business" },
                "Illinois": { name: "https://apps.ilsos.gov/businessentitysearch/", id: "https://apps.ilsos.gov/businessentitysearch/" },
                "Indiana": { name: "https://bsd.sos.in.gov/publicbusinesssearch", id: "https://bsd.sos.in.gov/publicbusinesssearch" },
                "Iowa": { name: "https://sos.iowa.gov/search/business/search.aspx", id: "https://sos.iowa.gov/search/business/search.aspx" },
                "Kansas": { name: "https://www.sos.ks.gov/eforms/BusinessEntity/Search.aspx", id: "https://www.sos.ks.gov/eforms/BusinessEntity/Search.aspx" },
                "Kentucky": { name: "https://sosbes.sos.ky.gov/BusSearchNProfile/Search.aspx?na=true", id: "https://sosbes.sos.ky.gov/BusSearchNProfile/Search.aspx?na=true" },
                "Louisiana": { name: "https://coraweb.sos.la.gov/commercialsearch/commercialsearch.aspx", id: "https://coraweb.sos.la.gov/commercialsearch/commercialsearch.aspx" },
                "Maine": { name: "https://apps3.web.maine.gov/nei-sos-icrs/ICRS?MainPage=", id: "https://apps3.web.maine.gov/nei-sos-icrs/ICRS?MainPage=" },
                "Maryland": { name: "https://egov.maryland.gov/businessexpress/entitysearch", id: "https://egov.maryland.gov/businessexpress/entitysearch" },
                "Massachusetts": { name: "https://corp.sec.state.ma.us/corpweb/CorpSearch/CorpSearch.aspx", id: "https://corp.sec.state.ma.us/corpweb/CorpSearch/CorpSearch.aspx" },
                "Michigan": { name: "https://www.michigan.gov/lara/online-services/business-entity-search", id: "https://www.michigan.gov/lara/online-services/business-entity-search" },
                "Minnesota": { name: "https://mblsportal.sos.mn.gov/Business/Search", id: "https://mblsportal.sos.mn.gov/Business/Search" },
                "Mississippi": { name: "https://corp.sos.ms.gov/corp/portal/c/page/corpBusinessIdSearch/portal.aspx", id: "https://corp.sos.ms.gov/corp/portal/c/page/corpBusinessIdSearch/portal.aspx" },
                "Missouri": { name: "https://bsd.sos.mo.gov/BusinessEntity/BESearch.aspx?SearchType=0", id: "https://bsd.sos.mo.gov/BusinessEntity/BESearch.aspx?SearchType=0" },
                "Montana": { name: "https://biz.sosmt.gov/search/business/1000", id: "https://biz.sosmt.gov/search/business/1000" },
                "Nebraska": { name: "https://www.nebraska.gov/sos/corp/corpsearch.cgi?nav=search", id: "https://www.nebraska.gov/sos/corp/corpsearch.cgi?nav=search" },
                "Nevada": { name: "https://esos.nv.gov/EntitySearch/OnlineEntitySearch", id: "https://esos.nv.gov/EntitySearch/OnlineEntitySearch" },
                "New Hampshire": { name: "https://quickstart.sos.nh.gov/online/BusinessInquire", id: "https://quickstart.sos.nh.gov/online/BusinessInquire" },
                "New Jersey": { name: "https://www.njportal.com/DOR/BusinessNameSearch/Search/BusinessName", id: "https://www.njportal.com/DOR/BusinessNameSearch/Search/EntityId" },
                "New Mexico": { name: "https://enterprise.sos.nm.gov/search", id: "https://enterprise.sos.nm.gov/search" },
                "New York": { name: "https://apps.dos.ny.gov/publicInquiry/", id: "https://apps.dos.ny.gov/publicInquiry/" },
                "North Carolina": { name: "https://www.sosnc.gov/online_services/search/by_title/_Business_Registration", id: "https://www.sosnc.gov/online_services/search/by_title/_Business_Registration" },
                "North Dakota": { name: "https://firststop.sos.nd.gov/search", id: "https://firststop.sos.nd.gov/search" },
                "Ohio": { name: "https://businesssearch.ohiosos.gov/", id: "https://businesssearch.ohiosos.gov/" },
                "Oklahoma": { name: "https://www.sos.ok.gov/corp/corpInquiryFind.aspx", id: "https://www.sos.ok.gov/corp/corpInquiryFind.aspx" },
                "Oregon": { name: "https://sos.oregon.gov/business/Pages/find.aspx", id: "https://sos.oregon.gov/business/Pages/find.aspx" },
                "Pennsylvania": { name: "https://file.dos.pa.gov/search/business", id: "https://file.dos.pa.gov/search/business" },
                "Rhode Island": { name: "https://business.sos.ri.gov/corp/CorpSearch/CorpSearchInput.asp", id: "https://business.sos.ri.gov/corp/CorpSearch/CorpSearchInput.asp" },
                "South Carolina": { name: "https://businessfilings.sc.gov/BusinessFiling/Entity/NewFiling", id: "https://businessfilings.sc.gov/BusinessFiling/Entity/NewFiling" },
                "South Dakota": { name: "https://sosenterprise.sd.gov/BusinessServices/Business/FilingSearch.aspx", id: "https://sosenterprise.sd.gov/BusinessServices/Business/FilingSearch.aspx" },
                "Tennessee": { name: "https://tncab.tnsos.gov/business-entity-search", id: "https://tncab.tnsos.gov/business-entity-search" },
                "Texas": { name: "https://comptroller.texas.gov/taxes/franchise/account-status/search", id: "https://comptroller.texas.gov/taxes/franchise/account-status/search" },
                "Utah": { name: "https://businessregistration.utah.gov/NameAvailabilitySearch", id: "https://businessregistration.utah.gov/EntitySearch/OnlineEntitySearch" },
                "Vermont": { name: "https://www.vermontbusinessregistry.com/BusinessSearch.aspx", id: "https://www.vermontbusinessregistry.com/BusinessSearch.aspx" },
                "Virginia": { name: "https://cis.scc.virginia.gov/EntitySearch/Index", id: "https://cis.scc.virginia.gov/EntitySearch/Index" },
                "Washington": { name: "https://ccfs.sos.wa.gov/#/", id: "https://ccfs.sos.wa.gov/#/" },
                "West Virginia": { name: "https://apps.sos.wv.gov/business/corporations/", id: "https://apps.sos.wv.gov/business/corporations/" },
                "Wisconsin": { name: "https://apps.dfi.wi.gov/apps/corpsearch/search.aspx", id: "https://apps.dfi.wi.gov/apps/corpsearch/search.aspx" },
                "Wyoming": { name: "https://wyobiz.wyo.gov/business/filingsearch.aspx", id: "https://wyobiz.wyo.gov/business/filingsearch.aspx" }
            };

            function canonicalizeState(state) {
                if (!state) return '';
                const clean = String(state).trim().toLowerCase();
                for (const key of Object.keys(SOS_URLS)) {
                    if (key.toLowerCase() === clean) return key;
                }
                return String(state).trim();
            }

            function buildSosUrl(state, query, type = 'name') {
                const rec = SOS_URLS[canonicalizeState(state)];
                if (!rec) return null;
                const base = rec[type] || rec.name;
                if (!query) return base;
                const sep = base.includes('?') ? '&' : '?';
                return base + sep + 'q=' + encodeURIComponent(query);
            }
            window.buildSosUrl = buildSosUrl;

        function applyPaddingToMainPanels() {
            const candidates = [
                ...Array.from(document.body.querySelectorAll(':scope > .nH')),
                ...Array.from(document.body.querySelectorAll('.aeF')),
                ...Array.from(document.body.querySelectorAll('.Bk')),
                ...Array.from(document.body.querySelectorAll('div[role="dialog"]'))
            ];

            // También ajustamos la barra superior de Gmail
            const gmailBar = document.getElementById('gb');
            if (gmailBar) candidates.push(gmailBar);

            // Detectamos paneles de visor (adjuntos, imágenes, etc.)
            Array.from(document.body.children).forEach(el => {
                const rect = el.getBoundingClientRect();
                const style = getComputedStyle(el);
                if ((style.position === 'fixed' || style.position === 'absolute') &&
                    rect.width >= window.innerWidth * 0.8 &&
                    rect.height >= window.innerHeight * 0.6) {
                    candidates.push(el);
                }
            });

            const mainPanels = candidates.filter(el => {
                const rect = el.getBoundingClientRect();
                return rect.width > (window.innerWidth * 0.6);
            });

            if (mainPanels.length === 0) {
                mainPanels.push(document.body);
            }

            mainPanels.forEach(el => {
                // Usamos margin-right para no desplazar
                // elementos de paginación fuera de la vista
                el.style.setProperty("margin-right", SIDEBAR_WIDTH + "px", "important");
                el.style.setProperty("transition", "margin-right 0.2s", "important");
                const style = getComputedStyle(el);
                if (style.position === 'fixed' || style.position === 'absolute') {
                    el.style.setProperty('right', SIDEBAR_WIDTH + 'px', 'important');
                }
            });

            // More selective approach to navigation buttons - only adjust if they're actually covered
            const navigationContainers = [
                ...Array.from(document.body.querySelectorAll('.ar5.J-J5-Ji')),
                ...Array.from(document.body.querySelectorAll('[role="button"][aria-label*="Newer"]')),
                ...Array.from(document.body.querySelectorAll('[role="button"][aria-label*="Older"]')),
                ...Array.from(document.body.querySelectorAll('.T-I[role="button"]')),
                ...Array.from(document.body.querySelectorAll('.amD[role="button"]'))
            ];

            navigationContainers.forEach(el => {
                if (el) {
                    const rect = el.getBoundingClientRect();
                    const style = getComputedStyle(el);
                    
                    // Only adjust if the element is actually covered by the sidebar
                    const rightEdge = rect.left + rect.width;
                    const sidebarLeft = window.innerWidth - SIDEBAR_WIDTH;
                    
                    if (rightEdge > sidebarLeft) {
                        // Only apply positioning fixes if the element is covered
                        if (style.position === 'fixed' || style.position === 'absolute') {
                            el.style.setProperty('right', SIDEBAR_WIDTH + 'px', 'important');
                            el.style.setProperty('z-index', '1000', 'important');
                        } else {
                            // For non-positioned elements, ensure they have proper margin
                            el.style.setProperty('margin-right', SIDEBAR_WIDTH + 'px', 'important');
                        }
                    }
                    
                    // Only apply minimal styling to ensure visibility, don't override Gmail's own styles
                    el.style.setProperty('z-index', '1000', 'important');
                    el.style.setProperty('visibility', 'visible', 'important');
                    el.style.setProperty('opacity', '1', 'important');
                }
            });

            return mainPanels;
        }

        function ensureNavigationButtonsVisible() {
            // Continuously monitor and ensure navigation buttons are visible
            const navigationSelectors = [
                '.ar5.J-J5-Ji',
                '[role="button"][aria-label*="Newer"]',
                '[role="button"][aria-label*="Older"]',
                '.T-I[role="button"]',
                '.amD[role="button"]'
            ];

            navigationSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    if (el) {
                        const rect = el.getBoundingClientRect();
                        const style = getComputedStyle(el);
                        
                        // Check if element is covered by sidebar
                        const rightEdge = rect.left + rect.width;
                        const sidebarLeft = window.innerWidth - SIDEBAR_WIDTH;
                        
                        if (rightEdge > sidebarLeft || rect.right > window.innerWidth - SIDEBAR_WIDTH) {
                            // Only apply positioning fixes if the element is actually covered
                            if (style.position === 'fixed' || style.position === 'absolute') {
                                el.style.setProperty('right', SIDEBAR_WIDTH + 'px', 'important');
                                el.style.setProperty('z-index', '1000', 'important');
                            } else {
                                el.style.setProperty('position', 'relative', 'important');
                            }
                        }
                        
                        // Only apply minimal styling to ensure visibility, don't override Gmail's own styles
                        el.style.setProperty('z-index', '1000', 'important');
                        el.style.setProperty('visibility', 'visible', 'important');
                        el.style.setProperty('opacity', '1', 'important');
                    }
                });
            });
        }

        function ensureGmailIconsVisible() {
            // Ensure Gmail icons and indicators remain visible
            const iconSelectors = [
                '[data-tooltip*="unread"]',
                '[data-tooltip*="Unread"]',
                '[aria-label*="unread"]',
                '[aria-label*="Unread"]',
                '.gb_1', '.gb_2', '.gb_3', '.gb_4', '.gb_5', '.gb_6', '.gb_7', '.gb_8', '.gb_9', '.gb_A',
                '.T-I', '.T-I-J3', '.T-I-JW', '.T-I-JW-ax7',
                '.aeF', '.aeG', '.aeH', '.aeI'
            ];

            iconSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    if (el) {
                        // Only apply minimal visibility fixes, don't override Gmail's own styling
                        el.style.setProperty('visibility', 'visible', 'important');
                        el.style.setProperty('opacity', '1', 'important');
                        el.style.setProperty('z-index', '1000', 'important');
                    }
                });
            });
        }

        function ensureClientBillingHidden() {
            // Continuously monitor and hide CLIENT and BILLING sections when not in review mode
            const clientLabel = document.getElementById('client-section-label');
            const clientBox = document.getElementById('client-section-box');
            const billingLabel = document.getElementById('billing-section-label');
            const billingBox = document.getElementById('billing-section-box');
            
            if (clientLabel) {
                clientLabel.style.display = reviewMode ? '' : 'none';
            }
            if (clientBox) {
                clientBox.style.display = reviewMode ? '' : 'none';
            }
            if (billingLabel) {
                billingLabel.style.display = reviewMode ? '' : 'none';
            }
            if (billingBox) {
                billingBox.style.display = reviewMode ? '' : 'none';
            }
        }
        function showFloatingIcon() {
            if (document.getElementById("fennec-floating-icon")) return;
            const icon = document.createElement("img");
            icon.id = "fennec-floating-icon";
            icon.src = chrome.runtime.getURL("fennec_icon.png");
            icon.alt = "FENNEC";
            icon.addEventListener("click", () => {
                icon.remove();
                sessionStorage.removeItem("fennecSidebarClosed");
                const panels = applyPaddingToMainPanels();
                injectSidebar(panels);
                showInitialStatus();
            });
            document.body.appendChild(icon);
        }

        function ensureFloatingIcon() {
            if (sessionStorage.getItem("fennecSidebarClosed") === "true" &&
                !document.getElementById("fennec-floating-icon") &&
                !document.getElementById("copilot-sidebar")) {
                showFloatingIcon();
            }
        }


        function showFullDetails() {
            const container = document.getElementById("db-summary-section");
            if (!container) return;
            Array.from(container.children).forEach(el => el.style.display = "");
            const btn = document.getElementById("review-details-btn");
            if (btn) btn.remove();
        }

        function updateDetailVisibility() {
            const container = document.getElementById("db-summary-section");
            if (!container) return;
            const quick = container.querySelector("#quick-summary");
            const orderBox = document.querySelector(".order-summary-box");
            const orderContent = document.getElementById("order-summary-content");
            const issueBox = document.getElementById("issue-summary-box");
            const clientLabel = container.querySelector("#client-section-label");
            const clientBox = container.querySelector("#client-section-box");
            const billingLabel = container.querySelector("#billing-section-label");
            const billingBox = container.querySelector("#billing-section-box");
            if (!quick || !orderBox) return;
            const hasOrder = orderBox &&
                orderBox.style.display !== 'none' &&
                orderContent && orderContent.textContent.trim() !== '';
            if (issueBox) {
                if (hasOrder && reviewMode) {
                    issueBox.style.display = 'block';
                    ensureIssueControls();
                } else if (hasOrder) {
                    issueBox.style.display = '';
                } else {
                    issueBox.style.display = 'none';
                }
            }
            
            // Hide CLIENT and BILLING sections when not in review mode
            if (clientLabel) {
                clientLabel.style.display = reviewMode ? '' : 'none';
            }
            if (clientBox) {
                clientBox.style.display = reviewMode ? '' : 'none';
            }
            if (billingLabel) {
                billingLabel.style.display = reviewMode ? '' : 'none';
            }
            if (billingBox) {
                billingBox.style.display = reviewMode ? '' : 'none';
            }
            
            // Ensure INT STORAGE section is properly positioned after ISSUES
            const intStorageSection = document.getElementById('int-storage-section');
            const issueSection = document.getElementById('issue-summary-section');
            if (intStorageSection && issueSection && intStorageSection.parentElement === issueSection.parentElement) {
                // If INT STORAGE is not already after ISSUES, move it
                if (intStorageSection.previousElementSibling !== issueSection) {
                    issueSection.parentElement.insertBefore(intStorageSection, issueSection.nextSibling);
                }
            }
            
            // Show INT STORAGE section in classic mode
            if (intStorageSection) {
                intStorageSection.style.display = 'block';
                const sectionLabel = intStorageSection.querySelector('.section-label');
                if (sectionLabel) sectionLabel.style.display = 'block';
            }
            
            if (quick && quick.parentElement !== container) container.prepend(quick);
            if (reviewMode) {
                quick.classList.remove("quick-summary-collapsed");
                quick.style.maxHeight = quick.scrollHeight + "px";
                showFullDetails();
            } else {
                quick.classList.add("white-box");
                quick.classList.add("quick-summary-collapsed");
                quick.style.marginBottom = "10px";
                quick.style.padding = "12px";
                quick.style.maxHeight = "0";
                showFullDetails();
            }
        }

        function applyReviewMode() {
            const orderBoxEl = document.querySelector("#copilot-sidebar .order-summary-box");
            if (orderBoxEl) orderBoxEl.style.marginTop = reviewMode ? "4px" : "12px";
            chrome.storage.sync.set({ fennecReviewMode: reviewMode });
            sessionSet({ fennecReviewMode: reviewMode });
            updateDetailVisibility();
            setupXrayButton();
        }

        function extractOrderNumber(text) {
            if (!text) return null;
            const match = text.match(/[#(]?\s*(22[\d\s-]{10,})\s*[)]?/);
            if (!match) return null;
            const digits = match[1].replace(/\D/g, '');
            return /^22\d{10}$/.test(digits) ? digits : null;
        }

        function isValidName(str) {
            if (!str) return false;
            const cleaned = str.trim();
            if (cleaned.length < 3) return false;
            if (!/[A-Za-z]/.test(cleaned)) return false;
            return /^[A-Za-z0-9'\-\.\s]+$/.test(cleaned);
        }

        const IGNORED_ADDRESSES = [
            'BIZEE.COM 17350 STATE HIGHWAY 249, SUITE 220, HOUSTON, TX 77064'
        ];

        const STATE_NAMES = [
            'ALABAMA','ALASKA','ARIZONA','ARKANSAS','CALIFORNIA','COLORADO',
            'CONNECTICUT','DELAWARE','FLORIDA','GEORGIA','HAWAII','IDAHO',
            'ILLINOIS','INDIANA','IOWA','KANSAS','KENTUCKY','LOUISIANA',
            'MAINE','MARYLAND','MASSACHUSETTS','MICHIGAN','MINNESOTA',
            'MISSISSIPPI','MISSOURI','MONTANA','NEBRASKA','NEVADA',
            'NEW HAMPSHIRE','NEW JERSEY','NEW MEXICO','NEW YORK',
            'NORTH CAROLINA','NORTH DAKOTA','OHIO','OKLAHOMA','OREGON',
            'PENNSYLVANIA','RHODE ISLAND','SOUTH CAROLINA','SOUTH DAKOTA',
            'TENNESSEE','TEXAS','UTAH','VERMONT','VIRGINIA','WASHINGTON',
            'WEST VIRGINIA','WISCONSIN','WYOMING'
        ];

        const STATE_ABBRS = [
            'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS',
            'KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY',
            'NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV',
            'WI','WY'
        ];

        function isValidAddress(str) {
            if (!str) return false;
            let cleaned = str.trim()
                .replace(/\s+/g, ' ')
                .replace(/\s*,\s*/g, ', ')
                .replace(/\s*#\s*/g, ' #');

            const normalized = cleaned.toUpperCase();
            if (IGNORED_ADDRESSES.includes(normalized)) return false;

            if (cleaned.length < 5) return false;
            if (!/[A-Za-z]/.test(cleaned)) return false;

            const startsWithNum = /^\d/.test(cleaned) || /\bP\.?O\.?\s+BOX\b/i.test(cleaned);
            if (!startsWithNum) return false;

            const stateZip = /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?(?:\s+USA?)?\b/i;
            const stateNameZip = new RegExp('\\b(' + STATE_NAMES.join('|') + ')\\b\\s+\\d{5}(?:-\\d{4})?(?:\\s+USA?)?\\b', 'i');
            const stateOnly = new RegExp('\\b(' + STATE_ABBRS.join('|') + '|' + STATE_NAMES.join('|') + ')\\b', 'i');

            if (!(stateZip.test(cleaned) || stateNameZip.test(cleaned) || stateOnly.test(cleaned))) {
                return false;
            }

            if (/\bP\.?O\.?\s+BOX\b/i.test(cleaned)) {
                return /\b\d{1,}\b/.test(cleaned);
            }
            return /\d/.test(cleaned);
        }

        function cleanAddress(str) {
            return str
                .replace(/\s+/g, ' ')
                .replace(/\s*,\s*/g, ', ')
                .replace(/\s*#\s*/g, ' #')
                .trim();
        }

        function extractPotentialAddresses(text) {
            if (!text) return [];
            const addrs = [];
            const lines = text.split(/\n+/);
            const keyword = /\b(?:st(?:reet)?|ave(?:nue)?|road|rd|dr|boulevard|blvd|lane|ln|hwy|p\.?o\.?\s*box|suite|ste|apt|apartment)\b/i;
            const startZip = /^\s*\d+[\w\s.,#-]*\b\d{5}(?:-\d{4})?\b/i;
            const startState = new RegExp('^\\s*\\d+[\\w\\s.,#-]*\\b(' + STATE_ABBRS.join('|') + '|' + STATE_NAMES.join('|') + ')\\b', 'i');
            lines.forEach(line => {
                const cleaned = cleanAddress(line);
                if (cleaned.length < 8) return;
                if (!(startZip.test(cleaned) || startState.test(cleaned) || keyword.test(cleaned))) return;
                if (!isValidAddress(cleaned)) return;
                if (!addrs.includes(cleaned)) addrs.push(cleaned);
            });
            return addrs;
        }

        function isLikelyCompany(name) {
            if (!name) return false;
            const designators = [
                'LLC', 'L.L.C', 'INC', 'CORP', 'CORPORATION', 'COMPANY', 'CO',
                'LTD', 'LIMITED', 'LLP', 'LP', 'PLC', 'PC', 'PA'
            ];
            const regex = new RegExp('\\b(' + designators.join('|') + ')\\.?\\b', 'i');
            return regex.test(name);
        }

        function extractCompanyNames(text) {
            if (!text) return [];

            const designators = [
                'LLC', 'L.L.C', 'INC', 'CORP', 'CORPORATION', 'COMPANY', 'CO',
                'LTD', 'LIMITED', 'LLP', 'LP', 'PLC', 'PC', 'PA'
            ];
            const designatorsDot = [
                'L.L.C.', 'INC.', 'CORP.', 'CO.', 'LTD.', 'L.L.P.',
                'L.P.', 'P.L.C.', 'P.C.', 'P.A.'
            ];

            const namesMap = new Map();
            const lines = text.split(/\n+/);

            for (const line of lines) {
                const tokens = line.trim().split(/\s+/);
                for (let i = 0; i < tokens.length; i++) {
                    const raw = tokens[i];
                    const clean = raw.replace(/^[^A-Za-z0-9&]+|[^A-Za-z0-9&.,]+$/g, '');
                    if (!clean) continue;

                    const base = clean.replace(/[.,]+$/, '');
                    const upper = base.toUpperCase();

                    if (designators.includes(upper) || designatorsDot.includes(clean.toUpperCase())) {
                        const parts = [clean];
                        const designatorWithDot = designatorsDot.includes(clean.toUpperCase());

                        let j = i - 1, count = 0;
                        while (j >= 0 && count < 6) {
                            const prev = tokens[j];
                            const prevClean = prev.replace(/^[^A-Za-z0-9&]+|[^A-Za-z0-9&.,]+$/g, '');
                            if (!prevClean) { j--; count++; continue; }
                            if (/^[a-z]/.test(prevClean)) break;
                            parts.unshift(prevClean);
                            if (prevClean.length > 2 && /[.!?]$/.test(prevClean)) break;
                            j--; count++;
                        }

                        let candidate = parts.join(' ')      
                            .replace(/\s+,/g, ',')
                            .replace(/\s+&\s+/g, ' & ');

                        if (!designatorWithDot) candidate = candidate.replace(/[.,]+$/, '');
                        candidate = candidate.trim();

                        const key = candidate.toUpperCase();
                        if (candidate.split(' ').length > 1 && !namesMap.has(key)) {
                            namesMap.set(key, candidate);
                        }
                    }
                }
            }

            return Array.from(namesMap.values());
        }


        function renderAddress(addr) {
            if (!addr) return '<span style="color:#aaa">-</span>';
            addr = cleanAddress(addr);
            const parts = addr.split(/,\s*/);

            const firstLine = parts.shift() || '';
            let secondLine = '';
            let rest = '';

            if (parts.length > 2) {
                secondLine = parts.shift();
                rest = parts.join(', ');
            } else {
                rest = parts.join(', ');
            }

            const lines = [firstLine];
            if (secondLine) lines.push(secondLine);
            if (rest) lines.push(rest);
            const display = lines.map(escapeHtml).join('<br>');
            const escFull = escapeHtml(addr);
            return `<span class="address-wrapper"><a href="#" class="copilot-address" data-address="${escFull}">${display}</a><span class="copilot-usps" data-address="${escFull}" title="USPS Lookup"> ✉️</span><span class="copilot-copy-icon" data-copy="${escFull}" title="Copy">⧉</span></span>`;
        }

        // Format billing address into two lines and add USPS verification
        function renderBillingAddress(addr) {
            if (!addr) return '<span style="color:#aaa">-</span>';
            let line1 = '';
            let line2 = '';
            if (typeof addr === 'object') {
                const p1 = [];
                if (addr.street1) p1.push(addr.street1.trim());
                if (addr.street2) p1.push(addr.street2.trim());
                line1 = p1.join(' ');

                const p2 = [];
                if (addr.city) p2.push(addr.city.trim());
                if (addr.state) p2.push(addr.state.trim());
                if (addr.zip) p2.push(addr.zip.trim());
                if (addr.country) p2.push(addr.country.trim());
                line2 = p2.join(', ');
                addr = [line1, line2].filter(Boolean).join(', ');
            } else {
                addr = cleanAddress(addr);
                const parts = addr.split(/,\s*/);
                line1 = parts.shift() || '';
                if (parts.length > 1) {
                    const second = parts[0].trim();
                    if (parts.length > 2 || /\d/.test(second) || /(apt|suite|ste|unit|#|floor|bldg|building|po box)/i.test(second)) {
                        line1 += ' ' + parts.shift();
                    }
                }
                line2 = parts.join(', ');
            }

            const lines = [];
            if (line1) lines.push(escapeHtml(line1));
            if (line2) lines.push(escapeHtml(line2));
            const escFull = escapeHtml(addr);
            return `<span class="address-wrapper"><a href="#" class="copilot-address" data-address="${escFull}">${lines.join('<br>')}</a><span class="copilot-usps" data-address="${escFull}" title="USPS Lookup"> ✉️</span><span class="copilot-copy-icon" data-copy="${escFull}" title="Copy">⧉</span></span>`;
        }

        function normalizeAddr(a) {
            if (!a) return '';
            return cleanAddress(a)
                .toLowerCase()
                .replace(/[.,]/g, '')
                .replace(/\s+/g, ' ')
                .replace(/\s+(?:us|usa|united states(?: of america)?)$/, '')
                .trim();
        }

        function getBillingInfo() {
            const box = document.querySelector('#billing-section-box');
            if (!box) return null;
            const info = { cardholder: '', last4: '', expiry: '', address: '' };
            const divs = box.querySelectorAll(':scope > div');
            if (divs[0]) info.cardholder = divs[0].textContent.trim();
            if (divs[1]) {
                const parts = divs[1].textContent.split('•').map(s => s.trim());
                if (parts[1]) info.last4 = parts[1];
                if (parts[2]) info.expiry = parts[2];
            }
            const addrLink = box.querySelector('.address-wrapper a');
            if (addrLink) info.address = addrLink.getAttribute('data-address') || addrLink.textContent.trim();
            return info;
        }


        function buildCardMatchTag(info) {
            const billing = getBillingInfo();
            if (!billing) return '';
            const card = info.payment.card || {};
            const normalizeName = n => (n || '').toUpperCase().replace(/\s+/g, ' ').trim();
            const dbName = normalizeName(billing.cardholder);
            const dnaName = normalizeName(card['Card holder']);
            const dbDigits = (billing.last4 || '').replace(/\D+/g, '').slice(-4);
            const dnaDigits = (card['Card number'] || '').replace(/\D+/g, '').slice(-4);
            const parseExp = d => {
                if (!d) return '';
                const digits = d.replace(/\D+/g, '');
                return digits.length >= 4 ? digits.slice(0, 2) + digits.slice(-2) : digits;
            };
            const dbExp = parseExp(billing.expiry);
            const dnaExp = parseExp(card['Expiry date']);

            let compared = 0;
            let matches = 0;
            const mism = [];
            if (dbName && dnaName) {
                compared++;
                if (dbName === dnaName) {
                    matches++;
                } else {
                    mism.push('NAME ✖️');
                }
            }
            if (dbDigits && dnaDigits) {
                compared++;
                if (dbDigits === dnaDigits) {
                    matches++;
                } else {
                    mism.push('LAST 4 ✖️');
                }
            }
            if (dbExp && dnaExp) {
                compared++;
                if (dbExp === dnaExp) {
                    matches++;
                } else {
                    mism.push('EXP DATE ✖️');
                }
            }
            if (!compared) return '';
            let text = '';
            let cls = 'copilot-tag copilot-tag-green';
            if (matches === compared) {
                text = 'DB: MATCH';
            } else if (matches === 0) {
                text = 'DB: NO MATCH';
                cls = 'copilot-tag copilot-tag-purple';
            } else {
                text = 'DB: PARTIAL (' + mism.join(' ') + ')';
                cls = 'copilot-tag copilot-tag-purple';
            }
            return `<span class="${cls}">${escapeHtml(text)}</span>`;
        }

        function renderCopy(text) {
            if (!text) return '<span style="color:#aaa">-</span>';
            const esc = escapeHtml(text);
            return `<span class="copilot-copy" data-copy="${esc}">${esc}</span>`;
        }

        function renderCopyIcon(text) {
            if (!text) return '';
            const esc = escapeHtml(text);
            return `<span class="copilot-copy-icon" data-copy="${esc}" title="Copy">⧉</span>`;
        }

        function parseOrderDetails(text) {
            const details = {};

            const compName = text.match(/Company Name\s*(?:[:\-]|\n)\s*([^\n]+)/i);
            if (compName && isValidName(compName[1])) details.companyName = compName[1].trim();

            const purpose = text.match(/Purpose\s*(?:[:\-]|\n)\s*([^\n]+)/i);
            if (purpose) details.purpose = purpose[1].trim();

            const compAddr = text.match(/(?:Company\s*)?Address\s*(?:[:\-]|\n)\s*([^\n]+)/i);
            if (compAddr && isValidAddress(compAddr[1])) details.companyAddress = cleanAddress(compAddr[1]);

            const raName = text.match(/(?:RA|Registered Agent) Name\s*(?:[:\-]|\n)\s*([^\n]+)/i);
            if (raName && isValidName(raName[1])) details.raName = raName[1].trim();

            const raAddr = text.match(/(?:RA|Registered Agent) Address\s*(?:[:\-]|\n)\s*([^\n]+)/i);
            if (raAddr && isValidAddress(raAddr[1])) details.raAddress = cleanAddress(raAddr[1]);

            const people = [];
            const memberRegex = /(Member|Director|Officer|Shareholder)\s*Name\s*(?:[:\-]|\n)\s*([^\n]+)\n(?:.*?(?:Address)\s*(?:[:\-]|\n)\s*([^\n]+))?/gi;
            let m;
            while ((m = memberRegex.exec(text)) !== null) {
                const entry = { role: m[1], name: m[2].trim() };
                if (!isValidName(entry.name)) continue;
                if (m[3] && isValidAddress(m[3])) entry.address = cleanAddress(m[3]);
                people.push(entry);
            }
            if (people.length) details.people = people;

            return details;
        }

        function getVisibleEmailBodies() {
            return Array.from(document.querySelectorAll('.a3s')).filter(el => el.offsetParent !== null);
        }

        function isEmailOpen() {
            return getVisibleEmailBodies().length > 0;
        }

        function extractOrderContextFromEmail() {
            try {
                const senderSpan = document.querySelector("h3.iw span[email]");
                const senderEmail = senderSpan?.getAttribute("email") || null;
                const senderName = senderSpan?.innerText?.trim() || null;

                const subjectText = document.querySelector('h2.hP')?.innerText || "";
                const a3sNodes = getVisibleEmailBodies();
                let fullText = subjectText;
                a3sNodes.forEach(n => {
                    if (n.innerText) fullText += "\n" + n.innerText;
                });

                if (!fullText.trim()) {
                    return null;
                }

                const orderNumber = extractOrderNumber(fullText);
                const details = parseOrderDetails(fullText);
                const companies = extractCompanyNames(fullText);

                let fallbackName = null;
                const helloLine = fullText.match(/Hello\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
                if (helloLine && helloLine[1]) fallbackName = helloLine[1];

                const finalName = senderName || fallbackName || null;

                return {
                    orderNumber,
                    email: senderEmail,
                    name: finalName,
                    details,
                    companies,
                    rawText: fullText
                };
            } catch (err) {
                return null;
            }
        }

        function fillOrderSummaryBox(context) {
            const summaryBox = document.getElementById('order-summary-content');
            if (!summaryBox) return;
            const container = document.querySelector('.order-summary-box');
            if (container) container.style.display = 'block';
            const orderId = context?.orderNumber || (storedOrderInfo && storedOrderInfo.orderId) || '';
            const url = orderId ? `https://db.incfile.com/incfile/order/detail/${orderId}` : '#';

            let html = `<div id="order-summary-link" style="text-align:center">`;
            if (reviewMode && storedOrderInfo) {
                const nameBase = buildSosUrl(storedOrderInfo.companyState, null, 'name');
                const companyName = escapeHtml(storedOrderInfo.companyName || '');
                if (companyName) {
                    const cLink = nameBase ? `<a href="#" id="company-link" class="copilot-sos copilot-link" data-url="${nameBase}" data-query="${companyName}" data-type="name">${companyName}</a>` : companyName;
                    html += `<div class="order-summary-company"><b>${cLink}</b></div>`;
                }
                if (storedOrderInfo.companyId) {
                    const idBase = buildSosUrl(storedOrderInfo.companyState, null, 'id');
                    const compId = escapeHtml(storedOrderInfo.companyId);
                    const idLink = idBase ? `<a href="#" class="copilot-sos copilot-link" data-url="${idBase}" data-query="${compId}" data-type="id">${compId}</a>` : compId;
                    const dof = storedOrderInfo.type && storedOrderInfo.type.toLowerCase() !== 'formation' && storedOrderInfo.formationDate
                        ? ` (${escapeHtml(storedOrderInfo.formationDate)})`
                        : '';
                    html += `<div>${idLink}${dof} ${renderCopyIcon(storedOrderInfo.companyId)}</div>`;
                }
            }
            if (orderId) html += `<div><b><a href="#" id="order-link" class="order-link">${renderCopy(orderId)}</a> ${renderCopyIcon(orderId)}</b></div>`;
            if (reviewMode && storedOrderInfo) {
                const typeTag = storedOrderInfo.type ? `<span class="copilot-tag">${escapeHtml(storedOrderInfo.type)}</span>` : "";
                const expClass = storedOrderInfo.expedited ? 'copilot-tag copilot-tag-green' : 'copilot-tag';
                const expTag = `<span class="${expClass}">${storedOrderInfo.expedited ? 'Expedited' : 'Non Expedited'}</span>`;
                html += `<div>${typeTag} ${expTag}</div>`;
            }
            html += '</div>';
            summaryBox.innerHTML = html;
            const link = summaryBox.querySelector('#order-link');
            if (link && orderId) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    bg.openActiveTab({ url });
                });
            }
            attachCommonListeners(summaryBox);
        }

        function fillIntelBox(context) {
            const intelBox = document.getElementById('intel-summary-content');
            if (!intelBox) return;

            const details = context?.details || {};
            const companyMap = new Map();
            const peopleMap = new Map();
            const addrSet = new Set();

            const addCompany = n => {
                if (!n || n === context?.name) return;
                const key = n.trim().toUpperCase();
                if (!companyMap.has(key)) companyMap.set(key, n.trim());
            };
            const addPerson = n => {
                if (!n || n === context?.name) return;
                const key = n.trim().toUpperCase();
                if (!peopleMap.has(key)) peopleMap.set(key, n.trim());
            };
            const addAddr = a => {
                if (!a) return;
                const cleaned = cleanAddress(a);
                if (cleaned && !addrSet.has(cleaned)) addrSet.add(cleaned);
            };

            if (details.companyName) {
                if (isLikelyCompany(details.companyName)) addCompany(details.companyName);
                else addPerson(details.companyName);
            }

            if (details.raName) {
                if (isLikelyCompany(details.raName)) addCompany(details.raName);
                else addPerson(details.raName);
            }

            if (details.people) details.people.forEach(p => {
                if (isLikelyCompany(p.name)) addCompany(p.name); else addPerson(p.name);
                if (p.address) addAddr(p.address);
            });

            addAddr(details.companyAddress);
            addAddr(details.raAddress);

            if (context?.rawText) {
                extractPotentialAddresses(context.rawText).forEach(addAddr);
            }

            if (Array.isArray(context?.companies)) {
                context.companies.forEach(addCompany);
            }

            const compHtml = Array.from(companyMap.values()).map(n => `<div>${renderCopy(n)}</div>`).join('');
            const peopleHtml = Array.from(peopleMap.values()).map(n => `<div>${renderCopy(n)}</div>`).join('');
            const addrHtml = Array.from(addrSet).map(a => `<div>${renderAddress(a)}</div>`).join('');

            if (!compHtml && !peopleHtml && !addrHtml) {
                intelBox.innerHTML = '<span style="color:#ccc">No intel found.</span>';
            } else {
                let html = '';
                if (compHtml) html += `<div><u>Company Names</u></div>${compHtml}`;
                if (peopleHtml) {
                    if (compHtml) html += '<hr style="border:none;border-top:1px solid #555;margin:6px 0"/>';
                    html += `<div><u>Individual Names</u></div>${peopleHtml}`;
                }
                if (addrHtml) {
                    if (compHtml || peopleHtml) html += '<hr style="border:none;border-top:1px solid #555;margin:6px 0"/>';
                    html += `<div><u>Addresses</u></div>${addrHtml}`;
                }
                intelBox.innerHTML = html;
            }
            attachCommonListeners(intelBox);
        }


        function loadDbSummary(expectedId) {
            const container = document.getElementById('db-summary-section');
            if (!container) return;
            document.querySelectorAll('#copilot-sidebar #quick-summary').forEach(el => el.remove());
            chrome.storage.local.get({ sidebarDb: [], sidebarOrderId: null, sidebarOrderInfo: null }, ({ sidebarDb, sidebarOrderId, sidebarOrderInfo }) => {
                if (Array.isArray(sidebarDb) && sidebarDb.length && (!expectedId || sidebarOrderId === expectedId)) {
                    container.innerHTML = sidebarDb.join("");
                    container.style.display = 'block';
                    attachCommonListeners(container);
                    const qbox = container.querySelector('#quick-summary');
                    if (qbox) {
                        qbox.classList.remove('quick-summary-collapsed');
                        qbox.style.maxHeight = 'none';
                    }
                    storedOrderInfo = sidebarOrderInfo;
                    fillOrderSummaryBox(currentContext);
                    
                    // Hide CLIENT and BILLING sections when not in review mode
                    const clientLabel = container.querySelector('#client-section-label');
                    const clientBox = container.querySelector('#client-section-box');
                    const billingLabel = container.querySelector('#billing-section-label');
                    const billingBox = container.querySelector('#billing-section-box');
                    
                    if (clientLabel) {
                        clientLabel.style.display = reviewMode ? '' : 'none';
                    }
                    if (clientBox) {
                        clientBox.style.display = reviewMode ? '' : 'none';
                    }
                    if (billingLabel) {
                        billingLabel.style.display = reviewMode ? '' : 'none';
                    }
                    if (billingBox) {
                        billingBox.style.display = reviewMode ? '' : 'none';
                    }
                    
                    // Ensure INT STORAGE section is properly positioned after ISSUES
                    const intStorageSection = document.getElementById('int-storage-section');
                    const issueSection = document.getElementById('issue-summary-section');
                    if (intStorageSection && issueSection && intStorageSection.parentElement === issueSection.parentElement) {
                        // If INT STORAGE is not already after ISSUES, move it
                        if (intStorageSection.previousElementSibling !== issueSection) {
                            issueSection.parentElement.insertBefore(intStorageSection, issueSection.nextSibling);
                        }
                    }
                    
                    // Show INT STORAGE section in classic mode
                    if (intStorageSection) {
                        intStorageSection.style.display = 'block';
                        const sectionLabel = intStorageSection.querySelector('.section-label');
                        if (sectionLabel) sectionLabel.style.display = 'block';
                    }
                    
                    // Load ISSUES and INT STORAGE for both review mode and classic mode
                    if (storedOrderInfo && storedOrderInfo.orderId) {
                        console.log('[FENNEC (POO) GM SB] Loading ISSUES and INT STORAGE for order:', storedOrderInfo.orderId, 'reviewMode:', reviewMode);
                        checkLastIssue(storedOrderInfo.orderId);
                        
                        // Wait for database tab to load INT STORAGE data in both review mode and classic mode
                        console.log('[FENNEC (POO) GM SB] Waiting for DB tab to load INT STORAGE data for order:', storedOrderInfo.orderId);
                        const box = document.getElementById('int-storage-box');
                        if (box) {
                            box.style.display = 'block';
                            box.innerHTML = '<div style="text-align:center;color:#aaa">Waiting for DB tab...</div>';
                        }
                    } else {
                        console.log('[FENNEC (POO) GM SB] Not loading INT STORAGE:', {
                            reviewMode: reviewMode,
                            hasStoredOrderInfo: !!storedOrderInfo,
                            orderId: storedOrderInfo ? storedOrderInfo.orderId : null
                        });
                    }
                } else if (container.innerHTML.trim() === '') {
                    container.innerHTML = '';
                    container.style.display = 'none';
                    storedOrderInfo = null;
                } else {
                    // keep previously loaded info until new data arrives
                }


                reorderReviewSections();
                repositionDnaSummary();
                updateDetailVisibility();
            });
        }

        const insertDnaAfterCompany = window.insertDnaAfterCompany;

        function reorderReviewSections() {
            if (!reviewMode) return;
            const container = document.getElementById('db-summary-section');
            if (!container) return;
            const quick = container.querySelector('#quick-summary');
            if (quick) quick.remove();
            if (typeof applyStandardSectionOrder === 'function') {
                applyStandardSectionOrder(container);
            }
        }

        function repositionDnaSummary() {
            const dnaBox = document.querySelector('.copilot-dna');
            const summary = document.getElementById('dna-summary');
            if (!dnaBox || !summary) return;
            const dnaBtn = dnaBox.querySelector('#btn-dna');
            const xrayBtn = dnaBox.querySelector('#btn-xray');
            const afterBtn = xrayBtn || dnaBtn;
            if (afterBtn) {
                const next = afterBtn.nextSibling;
                if (next !== summary) dnaBox.insertBefore(summary, next);
            } else if (summary.parentElement !== dnaBox) {
                dnaBox.appendChild(summary);
            }
            const kount = document.getElementById('kount-summary');
            if (kount && summary.nextSibling !== kount) {
                dnaBox.insertBefore(kount, summary.nextSibling);
            }
            insertDnaAfterCompany();
        }

        function ensureDnaSections() {
            let dnaBox = document.querySelector('.copilot-dna');
            if (!dnaBox) {
                const body = document.querySelector('.copilot-body');
                if (!body) return;
                dnaBox = document.createElement('div');
                dnaBox.className = 'copilot-dna';
                body.insertBefore(dnaBox, body.firstChild);
            }
            if (!document.getElementById('dna-summary')) {
                const d = document.createElement('div');
                d.id = 'dna-summary';
                d.style.marginTop = '16px';
                dnaBox.appendChild(d);
            }
            if (!document.getElementById('kount-summary')) {
                const k = document.createElement('div');
                k.id = 'kount-summary';
                k.style.marginTop = '10px';
                dnaBox.appendChild(k);
            }
            repositionDnaSummary();
        }

        function buildTransactionTable(tx) {
            if (!tx) return "";
            const colors = {
                "Total": "lightgray",
                "Authorised / Settled": "green",
                "Settled": "green",
                "Refused": "purple",
                "Refunded": "black",
                "Chargebacks": "black",
                "Chargeback": "black"
            };

            function parseAmount(str) {
                if (!str) return 0;
                const n = parseFloat(str.replace(/[^0-9.]/g, ""));
                return isNaN(n) ? 0 : n;
            }

            const entries = Object.keys(tx).map(k => {
                const t = tx[k];
                let label = k;
                if (label === "Authorised / Settled") label = "Settled";
                else if (label === "Total transactions") label = "Total";
                else if (label === "Refunded / Cancelled") label = "Refunded";
                return { label, count: t.count || "", amount: t.amount || "" };
            });
            if (!entries.length) return "";

            const total = entries.find(e => e.label === "Total") || { amount: 0 };
            const totalVal = parseAmount(total.amount);

            entries.sort((a, b) => (a.label === "Total" ? -1 : b.label === "Total" ? 1 : 0));

            const rows = entries.map(e => {
                const cls = "copilot-tag-" + (colors[e.label] || "white");
                const amountVal = parseAmount(e.amount);
                const pct = totalVal ? Math.round(amountVal / totalVal * 100) : 0;
                const amount = (e.amount || "").replace("EUR", "€");
                const pctText = totalVal ? ` (${pct}%)` : "";
                const label = escapeHtml(e.label.toUpperCase() + ": ");
                const count = `<span class="dna-count">${escapeHtml(e.count)}</span>`;
                return `<tr><td><span class="copilot-tag dna-label ${cls}">${label}${count}</span></td><td>${escapeHtml(amount)}${escapeHtml(pctText)}</td></tr>`;
            }).join("");

            return `<table class="dna-tx-table"><thead><tr><th>Type</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>`;
        }

       function buildDnaHtml(info) {
            if (!info || !info.payment) return null;
            const p = info.payment;
            const card = p.card || {};
            const shopper = p.shopper || {};
            const proc = p.processing || {};

            const parts = [];

            // First line: bold card holder name only
            if (card['Card holder']) {
                const holder = `<b>${escapeHtml(card['Card holder'])}</b>`;
                parts.push(`<div>${holder}</div>`);
            }

            // Second line: card type, last 4 digits, expiry and funding source
            const cardLine = [];
            if (card['Payment method']) cardLine.push(escapeHtml(card['Payment method']));
            if (card['Card number']) {
                const digits = card['Card number'].replace(/\D+/g, '').slice(-4);
                if (digits) cardLine.push(escapeHtml(digits));
            }
            function formatExpiry(date) {
                if (!date) return '';
                const digits = date.replace(/\D+/g, '');
                if (digits.length >= 4) {
                    const mm = digits.slice(0, 2);
                    const yy = digits.slice(-2);
                    return `${mm}/${yy}`;
                }
                return date;
            }

            if (card['Expiry date']) cardLine.push(escapeHtml(formatExpiry(card['Expiry date'])));
            if (card['Funding source']) cardLine.push(escapeHtml(card['Funding source']));
            if (cardLine.length) parts.push(`<div>${cardLine.join(' \u2022 ')}</div>`);

            // Billing address with issuer info below
            if (shopper['Billing address']) {
                parts.push(`<div class="dna-address">${renderBillingAddress(shopper['Billing address'])}</div>`);
                if (card['Issuer name'] || card['Issuer country/region']) {
                    let bank = (card['Issuer name'] || '').trim();
                    if (bank.length > 25) bank = bank.slice(0, 22) + '...';
                    const country = (card['Issuer country/region'] || '').trim();
                    let countryInit = '';
                    if (country) {
                        countryInit = country.split(/\s+/).map(w => w.charAt(0)).join('').toUpperCase();
                        countryInit = ` (<span class="dna-country"><b>${escapeHtml(countryInit)}</b></span>)`;
                    }
                    parts.push(`<div class="dna-issuer">${escapeHtml(bank)}${countryInit}</div>`);
                }
            }

            // CVV and AVS on the same line
            const cvv = proc['CVC/CVV'];
            const avs = proc['AVS'];

            function colorFor(result) {
                if (result === 'green') return 'copilot-tag-green';
                if (result === 'purple') return 'copilot-tag-purple';
                return 'copilot-tag-black';
            }

            function formatCvv(text) {
                const t = (text || '').toLowerCase();
                if ((/\bmatch(es|ed)?\b/.test(t) || /\(m\)/.test(t)) && !/not\s+match/.test(t)) {
                    return { label: 'CVV: MATCH', result: 'green' };
                }
                if (/not\s+match/.test(t) || /\(n\)/.test(t)) {
                    return { label: 'CVV: NO MATCH', result: 'purple' };
                }
                if (/not provided|not checked|error|not supplied|unknown/.test(t)) {
                    return { label: 'CVV: UNKNOWN', result: 'black' };
                }
                return { label: 'CVV: UNKNOWN', result: 'black' };
            }

            function formatAvs(text) {
                const t = (text || '').toLowerCase();
                if (/both\s+postal\s+code\s+and\s+address\s+match/.test(t) || /^7\b/.test(t) || t.includes('both match')) {
                    return { label: 'AVS: MATCH', result: 'green' };
                }
                if (/^6\b/.test(t) || (t.includes('postal code matches') && t.includes("address doesn't"))) {
                    return { label: 'AVS: PARTIAL (STREET✖️)', result: 'purple' };
                }
                if (/^1\b/.test(t) || (t.includes('address matches') && t.includes("postal code doesn't"))) {
                    return { label: 'AVS: PARTIAL (ZIP✖️)', result: 'purple' };
                }
                if (/^2\b/.test(t) || t.includes('neither matches') || /\bw\b/.test(t)) {
                    return { label: 'AVS: NO MATCH', result: 'purple' };
                }
                if (/^0\b/.test(t) || /^3\b/.test(t) || /^4\b/.test(t) || /^5\b/.test(t) || t.includes('unavailable') || t.includes('not supported') || t.includes('no avs') || t.includes('unknown')) {
                    return { label: 'AVS: UNKNOWN', result: 'black' };
                }
                return { label: 'AVS: UNKNOWN', result: 'black' };
            }

            if (cvv || avs) {
                const tags = [];
                if (cvv) {
                    const { label, result } = formatCvv(cvv);
                    tags.push(`<span class="copilot-tag ${colorFor(result)}">${escapeHtml(label)}</span>`);
                }
                if (avs) {
                    const { label, result } = formatAvs(avs);
                    tags.push(`<span class="copilot-tag ${colorFor(result)}">${escapeHtml(label)}</span>`);
                }
                const cardTag = buildCardMatchTag(info);
                if (cardTag) tags.push(cardTag);
                if (tags.length) parts.push(`<div>${tags.join(' ')}</div>`);
            }

            // IP line hidden but keep spacing
            const ip = shopper['IP Address'] || shopper['IP'];
            if (ip) parts.push('<div>&nbsp;</div>');

            // Fraud scoring
            if (proc['Fraud scoring']) parts.push(`<div><b>Fraud scoring:</b> ${escapeHtml(proc['Fraud scoring'])}</div>`);

            // Separator line before transaction stats
            if (parts.length) {
                parts.push('<hr style="border:none;border-top:1px solid #555;margin:6px 0"/>');
            }

            const txTable = buildTransactionTable(info.transactions || {});
            if (txTable) parts.push(txTable);

            if (!parts.length) return null;
           return `<div class="section-label">ADYEN'S DNA</div><div class="white-box" style="margin-bottom:10px">${parts.join('')}</div>`;
       }

        function buildKountHtml(info) {
            if (!info) return null;
            const parts = [];
            if (info.emailAge) parts.push(`<div><b>Email age:</b> ${escapeHtml(info.emailAge)}</div>`);
            if (info.deviceLocation || info.ip) {
                const loc = escapeHtml(info.deviceLocation || '');
                const ip = escapeHtml(info.ip || '');
                parts.push(`<div><b>Device:</b> ${loc} ${ip}</div>`);
            }
            if (Array.isArray(info.declines) && info.declines.length) {
                parts.push(`<div><b>DECLINE LIST</b><br>${info.declines.map(escapeHtml).join('<br>')}</div>`);
            }
            if (info.ekata) {
                const e = info.ekata;
                const ipLine = e.ipValid || e.proxyRisk ? `<div><b>IP Valid:</b> ${escapeHtml(e.ipValid || '')} <b>Proxy:</b> ${escapeHtml(e.proxyRisk || '')}</div>` : '';
                const addrLine = e.addressToName || e.residentName ? `<div><b>Address to Name:</b> ${escapeHtml(e.addressToName || '')}<br><b>Resident Name:</b> ${escapeHtml(e.residentName || '')}</div>` : '';
                if (ipLine) parts.push(ipLine);
                if (addrLine) parts.push(addrLine);
            }
            if (!parts.length) return null;
            return `<div class="section-label">KOUNT</div><div class="white-box" style="margin-bottom:10px">${parts.join('')}</div>`;
        }

        function loadDnaSummary() {
            ensureDnaSections();
            const container = document.getElementById('dna-summary');
            if (!container) return;
            try {
                chrome.storage.local.get({ adyenDnaInfo: null }, ({ adyenDnaInfo }) => {
                    const html = buildDnaHtml(adyenDnaInfo);
                    container.innerHTML = html || '';
                    // console.log('[Copilot] ADYEN DNA summary', html ? 'loaded' : 'not found');
                    attachCommonListeners(container);
                    repositionDnaSummary();
                    ensureIssueControls();
                    setupResolveButton();
                });
            } catch (err) {
                // console.warn('[Copilot] failed to load ADYEN DNA summary:', err);
            }
        }

        function loadKountSummary() {
            ensureDnaSections();
            const container = document.getElementById('kount-summary');
            if (!container) return;
            chrome.storage.local.get({ kountInfo: null }, ({ kountInfo }) => {
                const html = buildKountHtml(kountInfo);
                container.innerHTML = html || '';
                // console.log('[Copilot] KOUNT summary', html ? 'loaded' : 'not found');
                attachCommonListeners(container);
            });
        }

        let dnaWatchInterval = null;
        function startDnaWatch() {
            if (dnaWatchInterval) clearInterval(dnaWatchInterval);
            // console.log('[Copilot] waiting for ADYEN DNA/KOUNT data...');
            dnaWatchInterval = setInterval(() => {
                chrome.storage.local.get({ adyenDnaInfo: null, kountInfo: null }, data => {
                    const hasDna = data.adyenDnaInfo && data.adyenDnaInfo.payment;
                    const hasKount = data.kountInfo && (data.kountInfo.emailAge || data.kountInfo.deviceLocation || data.kountInfo.ip || data.kountInfo.ekata);
                    if (hasDna || hasKount) {
                        ensureDnaSections();
                        loadDnaSummary();
                        loadKountSummary();
                        repositionDnaSummary();
                        clearInterval(dnaWatchInterval);
                        dnaWatchInterval = null;
                        // console.log('[Copilot] ADYEN DNA/KOUNT data loaded');
                    }
                });
            }, 1000);
        }

        function formatIssueText(text) {
            if (!text) return '';
            const norm = text.toLowerCase().replace(/\s+/g, ' ').trim();
            if (norm.includes('a clear photo of the card used to pay for the order') &&
                norm.includes('selfie holding your id')) {
                return 'ID CONFIRMATION ISSUE';
            }
            let formatted = text.replace(/\s*(\d+\s*[).])/g, (m, g) => '\n' + g + ' ');
            return formatted.replace(/^\n/, '').trim();
        }

        function fillIssueBox(info, orderId) {
            const section = document.getElementById('issue-summary-section');
            const box = document.getElementById('issue-summary-box');
            const content = document.getElementById('issue-summary-content');
            const label = document.getElementById('issue-status-label');
            ensureIssueControls();
            const btn = document.getElementById('issue-resolve-btn');
            const commentInput = document.getElementById('issue-comment-input');
            if (!box || !content || !label) return;
            
            // Show the ISSUES section in review mode
            if (section) section.style.display = 'block';
            const sectionLabel = section ? section.querySelector('.section-label') : null;
            if (sectionLabel) sectionLabel.style.display = 'block';
            if (box) box.style.display = 'block';
            if (info && info.text) {
                content.textContent = formatIssueText(info.text);
                label.textContent = info.active ? 'ACTIVE' : 'RESOLVED';
                label.className = 'issue-status-label ' + (info.active ? 'issue-status-active' : 'issue-status-resolved');
                if (btn) {
                    // Set initial button state based on issue status
                    if (info.active) {
                        btn.textContent = 'COMMENT & RESOLVE';
                    } else {
                        btn.textContent = 'COMMENT';
                    }
                }
            } else {
                const link = orderId ? `<a href="https://db.incfile.com/incfile/order/detail/${orderId}" target="_blank">${orderId}</a>` : '';
                content.innerHTML = `NO ISSUE DETECTED FROM ORDER: ${link}`;
                label.textContent = '';
                label.className = 'issue-status-label';
                if (btn) {
                    btn.textContent = 'COMMENT';
                }
            }
            
            // Gray out comment input when docs are dropped
            if (commentInput) {
                commentInput.disabled = droppedFiles.length > 0;
                commentInput.classList.toggle('disabled', droppedFiles.length > 0);
            }
            
            updateResolveButtonLabel();
        }

        function checkLastIssue(orderId) {
            if (!orderId) return;
            const content = document.getElementById('issue-summary-content');
            const label = document.getElementById('issue-status-label');
            if (content && label) {
                content.innerHTML = `<img src="${chrome.runtime.getURL('fennec_icon.png')}" class="loading-fennec"/>`;
                label.textContent = '';
                label.className = 'issue-status-label';
            }
            bg.send('checkLastIssue', { orderId }, (resp) => {
                if (chrome.runtime.lastError) {
                    fillIssueBox(null, orderId);
                    return;
                }
                fillIssueBox(resp && resp.issueInfo, orderId);
            });
        }

        function loadIntStorage(orderId) {
            if (!orderId) return;
            
            const section = document.getElementById('int-storage-section');
            const box = document.getElementById('int-storage-box');
            
            if (section) section.style.display = 'block';
            const sectionLabel = section ? section.querySelector('.section-label') : null;
            if (sectionLabel) sectionLabel.style.display = 'block';
            if (box) {
                box.style.display = 'block';
                box.innerHTML = '<div style="text-align:center;color:#aaa">Loading...</div>';
            }
            
            // Store the orderId for data sharing
            window.currentIntStorageOrderId = orderId;
            
            // Clear any existing data for this order to ensure fresh load
            chrome.storage.local.remove(['intStorageData', 'intStorageLoaded', 'intStorageOrderId'], () => {
                console.log('[FENNEC (POO) GM SB] Cleared existing INT STORAGE data for fresh load');
                
                // No cleanup needed since we're not using storage listeners anymore
                
                // No longer need to listen for storage changes - we'll wait for completion signal
                console.log('[FENNEC (POO) GM SB] Waiting for DB SB to complete INT STORAGE load');
                
                // Trigger DB SB to load INT STORAGE data and wait for completion signal
                console.log('[FENNEC (POO) GM SB] Requesting fresh INT STORAGE data for order:', orderId);
                bg.send('triggerIntStorageLoad', { orderId }, (response) => {
                    console.log('[FENNEC (POO) GM SB] INT STORAGE load trigger response:', response);
                    
                    // Don't immediately request data - wait for DB SB to signal completion
                    if (response && response.success) {
                        console.log('[FENNEC (POO) GM SB] DB SB load triggered successfully, waiting for completion signal');
                    } else {
                        console.error('[FENNEC (POO) GM SB] Failed to trigger DB SB load:', response);
                    }
                });
                
                // Set a timeout to show "Waiting for DB..." after 5 seconds
                setTimeout(() => {
                    if (box && box.innerHTML.includes('Loading...')) {
                        box.innerHTML = '<div style="text-align:center;color:#aaa">Waiting for DB...</div>';
                    }
                }, 5000);
                
                // Set a longer timeout to show "Failed to load" after 30 seconds
                setTimeout(() => {
                    if (box && (box.innerHTML.includes('Loading...') || box.innerHTML.includes('Waiting for DB...'))) {
                        console.log('[FENNEC (POO) GM SB] INT STORAGE timeout - no completion signal received after 30 seconds');
                        box.innerHTML = '<div style="text-align:center;color:#aaa">Failed to load</div>';
                    }
                }, 30000);
            });
        }

        function startIntStorageListener(orderId) {
            console.log('[FENNEC (POO) GM SB] Starting INT STORAGE listener for order:', orderId);
            
            // Create a one-time listener that will be removed after processing
            const listener = function(changes, area) {
                if (area === 'local' && changes.intStorageData) {
                    const newData = changes.intStorageData.newValue;
                    
                    console.log('[FENNEC (POO) GM SB] INT STORAGE DEBUG: Received storage change for order:', orderId, 'data:', newData);
                    
                    // Only process if we have data and it's for the current order
                    if (newData && newData.orderId === orderId) {
                        console.log('[FENNEC (POO) GM SB] INT STORAGE DEBUG: Processing data for order:', orderId, 'files count:', newData.files ? newData.files.length : 'null');
                        
                        // Remove the listener since we got the data
                        chrome.storage.onChanged.removeListener(listener);
                        
                        if (newData.error) {
                            updateIntStorageDisplay(null, orderId, newData.error, 0);
                        } else {
                            updateIntStorageDisplay(newData.files, orderId, null, 0);
                        }
                    } else if (newData && newData.orderId !== orderId) {
                        console.log('[FENNEC (POO) GM SB] INT STORAGE DEBUG: Data mismatch - expected orderId:', orderId, 'received orderId:', newData.orderId);
                    } else if (!newData) {
                        console.log('[FENNEC (POO) GM SB] INT STORAGE DEBUG: Received null data for order:', orderId);
                    }
                }
            };
            
            // Add the listener
            chrome.storage.onChanged.addListener(listener);
            
            // Store the listener reference for potential cleanup
            window.currentIntStorageListener = listener;
        }

        function updateIntStorageDisplay(files, orderId, error = null, retryCount = 0) {
            const box = document.getElementById('int-storage-box');
            const section = document.getElementById('int-storage-section');
            const sectionLabel = section ? section.querySelector('.section-label') : null;
            
            if (!box) return;
            
            if (error) {
                if (sectionLabel) sectionLabel.style.display = 'block';
                box.style.display = 'block';
                box.innerHTML = `<div style="text-align:center;color:#aaa">${error}</div>`;
                return;
            }
            
            if (!files || !Array.isArray(files)) {
                if (sectionLabel) sectionLabel.style.display = 'block';
                box.style.display = 'block';
                box.innerHTML = '<div style="text-align:center;color:#aaa">No files</div>';
                // Retry logic for "No files" - retry up to 3 times
                if (retryCount < 3) {
                    console.log(`[FENNEC (POO) GM SB] INT STORAGE: No files found, retrying in 5 seconds (attempt ${retryCount + 1}/3)`);
                    setTimeout(() => {
                        // Trigger a fresh INT STORAGE load from DB
                        bg.send('triggerIntStorageLoad', { orderId }, (response) => {
                            console.log('[FENNEC (POO) GM SB] INT STORAGE retry triggered:', response);
                            // Set up a listener to wait for the new data
                            const checkForNewData = () => {
                                chrome.storage.local.get({ intStorageData: null }, ({ intStorageData }) => {
                                    if (intStorageData && intStorageData.orderId === orderId) {
                                        console.log('[FENNEC (POO) GM SB] INT STORAGE retry: Found new data');
                                        if (intStorageData.error) {
                                            updateIntStorageDisplay(null, orderId, intStorageData.error, retryCount + 1);
                                        } else {
                                            updateIntStorageDisplay(intStorageData.files, orderId, null, retryCount + 1);
                                        }
                                    } else {
                                        // Check again in 2 seconds
                                        setTimeout(checkForNewData, 2000);
                                    }
                                });
                            };
                            setTimeout(checkForNewData, 3000);
                        });
                    }, 5000);
                } else {
                    console.log('[FENNEC (POO) GM SB] INT STORAGE: No files found after 3 retries, giving up');
                }
                return;
            }
            
            if (files.length === 0) {
                if (sectionLabel) sectionLabel.style.display = 'block';
                box.style.display = 'block';
                box.innerHTML = '<div style="text-align:center;color:#aaa">No files</div>';
                // Retry logic for empty files array - retry up to 3 times
                if (retryCount < 3) {
                    console.log(`[FENNEC (POO) GM SB] INT STORAGE: Empty files array, retrying in 5 seconds (attempt ${retryCount + 1}/3)`);
                    setTimeout(() => {
                        // Trigger a fresh INT STORAGE load from DB
                        bg.send('triggerIntStorageLoad', { orderId }, (response) => {
                            console.log('[FENNEC (POO) GM SB] INT STORAGE retry triggered:', response);
                            // Set up a listener to wait for the new data
                            const checkForNewData = () => {
                                chrome.storage.local.get({ intStorageData: null }, ({ intStorageData }) => {
                                    if (intStorageData && intStorageData.orderId === orderId) {
                                        console.log('[FENNEC (POO) GM SB] INT STORAGE retry: Found new data');
                                        if (intStorageData.error) {
                                            updateIntStorageDisplay(null, orderId, intStorageData.error, retryCount + 1);
                                        } else {
                                            updateIntStorageDisplay(intStorageData.files, orderId, null, retryCount + 1);
                                        }
                                    } else {
                                        // Check again in 2 seconds
                                        setTimeout(checkForNewData, 2000);
                                    }
                                });
                            };
                            setTimeout(checkForNewData, 3000);
                        });
                    }, 5000);
                } else {
                    console.log('[FENNEC (POO) GM SB] INT STORAGE: Empty files array after 3 retries, giving up');
                }
                return;
            }
            
            const list = files.map((file, idx) => {
                let shortName = file.name.length > 24 ? file.name.slice(0, 21) + '...' : file.name;
                const nameDiv = `<div class="int-doc-name" title="${escapeHtml(file.name)}">${escapeHtml(shortName)}</div>`;
                const uploaderDiv = `<div class="int-doc-uploader">${escapeHtml(file.uploadedBy || 'Unknown')}</div>`;
                
                let dateDiv = '';
                if (file.date) {
                    let dateObj = new Date(file.date);
                    if (!isNaN(dateObj.getTime())) {
                        let mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                        let dd = String(dateObj.getDate()).padStart(2, '0');
                        let yy = String(dateObj.getFullYear()).slice(-2);
                        let time = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                        dateDiv = `<div class="int-doc-date">${mm}/${dd}/${yy}<br><span class="int-doc-time">${time}</span></div>`;
                    } else {
                        dateDiv = `<div class="int-doc-date">--/--/--<br><span class="int-doc-time">--:--</span></div>`;
                    }
                } else {
                    dateDiv = `<div class="int-doc-date">--/--/--<br><span class="int-doc-time">--:--</span></div>`;
                }
                
                const clip = `<span class="int-doc-clip" data-idx="${idx}" title="Remove">📎</span>`;
                const openBtn = `<button class="copilot-button int-open" style="font-size:11px;padding:5px 8px;" data-url="${escapeHtml(file.url)}">OPEN</button>`;
                return `<div class="int-row" style="display:flex;align-items:center;gap:8px;margin:4px 0;">${clip}<div class="int-doc-info">${nameDiv}${uploaderDiv}</div>${dateDiv}${openBtn}</div>`;
            }).join('');
            
            if (sectionLabel) sectionLabel.style.display = 'block';
            box.style.display = 'block';
            box.innerHTML = list;
        }

        function showDnaLoading() {
            const dnaBox = document.querySelector('.copilot-dna');
            if (!dnaBox) return;
            let summary = dnaBox.querySelector('#dna-summary');
            if (!summary) {
                summary = document.createElement('div');
                summary.id = 'dna-summary';
                summary.style.marginTop = '16px';
            }
            const xrayBtn = dnaBox.querySelector('#btn-xray');
            const dnaBtn = dnaBox.querySelector('#btn-dna');
            const afterBtn = xrayBtn || dnaBtn;
            if (afterBtn) dnaBox.insertBefore(summary, afterBtn.nextSibling); else dnaBox.appendChild(summary);
            summary.innerHTML = `<img src="${chrome.runtime.getURL('fennec_icon.png')}" class="loading-fennec"/>`;
            // Keep any previously stored DNA data until new info arrives
            repositionDnaSummary();
        }

        function showLoadingState() {
            currentContext = null;
            storedOrderInfo = null;
            const orderBox = document.getElementById('order-summary-content');
            const orderContainer = document.querySelector('.order-summary-box');
            const dbBox = document.getElementById('db-summary-section');
            const issueContent = document.getElementById('issue-summary-content');
            const issueLabel = document.getElementById('issue-status-label');
            const issueBox = document.getElementById('issue-summary-box');
            const icon = `<img src="${chrome.runtime.getURL('fennec_icon.png')}" class="loading-fennec"/>`;
            const dnaBox = document.querySelector('.copilot-dna');
            if (orderContainer) {
                orderContainer.querySelectorAll('[data-review-merged="1"]').forEach(el => el.remove());
            }
            if (orderBox) orderBox.innerHTML = icon;
            if (dbBox) dbBox.innerHTML = icon;
            if (issueBox) {
                const msg = document.getElementById('quick-resolve-confirm');
                if (msg) msg.remove();
                const cText = document.getElementById('quick-resolve-comment-text');
                if (cText) cText.remove();
                let input = document.getElementById('issue-comment-input');
                if (!input) {
                    input = document.createElement('textarea');
                    input.id = 'issue-comment-input';
                    input.className = 'quick-resolve-comment';
                    input.placeholder = 'Comment...';
                    issueBox.appendChild(input);
                } else {
                    input.value = '';
                }
                droppedFiles = [];
                const list = document.getElementById('dropped-file-list');
                if (list) list.remove();
                input.disabled = false;
                input.classList.remove('disabled');
                let btn = document.getElementById('issue-resolve-btn');
                const btnLabel = reviewMode ? 'COMMENT & RELEASE' : 'COMMENT & RESOLVE';
                if (!btn) {
                    btn = document.createElement('button');
                    btn.id = 'issue-resolve-btn';
                    btn.className = 'copilot-button';
                    btn.style.marginTop = '4px';
                    btn.textContent = btnLabel;
                    issueBox.appendChild(btn);
                } else {
                    btn.textContent = btnLabel;
                }
                updateResolveButtonLabel();
                const updBtn = document.getElementById('update-info-btn');
                if (updBtn) issueBox.appendChild(updBtn);
                if (issueContent) issueContent.innerHTML = icon;
                issueBox.style.display = 'block';
                setupResolveButton();
            } else if (issueContent) {
                issueContent.innerHTML = icon;
            }
            if (dnaBox) {
                const summary = dnaBox.querySelector('#dna-summary');
                if (summary) summary.innerHTML = '';
                const kount = dnaBox.querySelector('#kount-summary');
                if (kount) kount.innerHTML = '';
                // console.log('[Copilot] cleared ADYEN DNA/KOUNT summaries');
                // Do not clear stored DNA/Kount info so summaries reappear when available
                repositionDnaSummary();
                startDnaWatch();
            }
        if (issueLabel) {
            issueLabel.textContent = '';
            issueLabel.className = 'issue-status-label';
        }
    }

        function ensureIssueControls(reset = false) {
            const issueBox = document.getElementById('issue-summary-box');
            if (!issueBox) return;
            let input = document.getElementById('issue-comment-input');
            if (!input) {
                input = document.createElement('textarea');
                input.id = 'issue-comment-input';
                input.className = 'quick-resolve-comment';
                input.placeholder = 'Comment...';
                issueBox.appendChild(input);
            } else if (reset) {
                input.value = '';
                issueBox.appendChild(input);
            }
            if (reset) {
                droppedFiles = [];
                const list = document.getElementById('dropped-file-list');
                if (list) list.remove();
                input.disabled = false;
                input.classList.remove('disabled');
                updateResolveButtonLabel();
            }
            let btn = document.getElementById('issue-resolve-btn');
            const btnLabel = reviewMode ? 'COMMENT & RELEASE' : 'COMMENT & RESOLVE';
            if (!btn) {
                btn = document.createElement('button');
                btn.id = 'issue-resolve-btn';
                btn.className = 'copilot-button';
                btn.style.marginTop = '4px';
                btn.textContent = btnLabel;
                issueBox.appendChild(btn);
            } else {
                btn.textContent = btnLabel;
                issueBox.appendChild(btn);
            }
            const updBtn = document.getElementById('update-info-btn');
            if (updBtn) issueBox.appendChild(updBtn);
            setupResolveButton();
            updateResolveButtonLabel();
        }

        function showInitialStatus() {
            const orderBox = document.getElementById('order-summary-content');
            const orderContainer = document.querySelector('.order-summary-box');
            const dbBox = document.getElementById('db-summary-section');
            const issueBox = document.getElementById('issue-summary-box');
            const intStorageBox = document.getElementById('int-storage-box');
            const issueSection = document.getElementById('issue-summary-section');
            const intStorageSection = document.getElementById('int-storage-section');
            const dnaSummary = document.getElementById('dna-summary');
            const kountSummary = document.getElementById('kount-summary');
            const searchBtn = document.getElementById('btn-email-search');
            if (searchBtn) searchBtn.onclick = () => handleEmailSearchClick();
            setupXrayButton();
            if (orderContainer) orderContainer.style.display = 'none';
            if (dbBox) dbBox.style.display = 'none';
            if (issueBox) issueBox.style.display = 'none';
            if (intStorageBox) intStorageBox.style.display = 'none';
            if (issueSection) {
                const issueLabel = issueSection.querySelector('.section-label');
                if (issueLabel) issueLabel.style.display = 'none';
            }
            if (intStorageSection) {
                const intStorageLabel = intStorageSection.querySelector('.section-label');
                if (intStorageLabel) intStorageLabel.style.display = 'none';
            }
            
            // Hide CLIENT and BILLING sections when not in review mode
            const clientLabel = document.getElementById('client-section-label');
            const clientBox = document.getElementById('client-section-box');
            const billingLabel = document.getElementById('billing-section-label');
            const billingBox = document.getElementById('billing-section-box');
            
            if (clientLabel) {
                clientLabel.style.display = reviewMode ? '' : 'none';
            }
            if (clientBox) {
                clientBox.style.display = reviewMode ? '' : 'none';
            }
            if (billingLabel) {
                billingLabel.style.display = reviewMode ? '' : 'none';
            }
            if (billingBox) {
                billingBox.style.display = reviewMode ? '' : 'none';
            }
            
            if (orderBox) orderBox.innerHTML = '';
            if (dbBox) dbBox.innerHTML = '';
            if (issueBox) {
                const content = issueBox.querySelector('#issue-summary-content');
                if (content) content.innerHTML = '';
                const label = issueBox.querySelector('#issue-status-label');
                if (label) label.textContent = '';
                const msg = document.getElementById('quick-resolve-confirm');
                if (msg) msg.remove();
                const cText = document.getElementById('quick-resolve-comment-text');
                if (cText) cText.remove();
                ensureIssueControls(true);
            }
            if (dnaSummary) dnaSummary.innerHTML = '';
            if (kountSummary) kountSummary.innerHTML = '';
            // console.log('[Copilot] cleared ADYEN DNA/KOUNT summaries');
            ensureDnaSections();
            if (dnaWatchInterval) {
                clearInterval(dnaWatchInterval);
                dnaWatchInterval = null;
            }
        }

       function refreshSidebar() {
            const ctx = extractOrderContextFromEmail();
            currentContext = ctx;
            chrome.storage.local.get({ sidebarFreezeId: null }, ({ sidebarFreezeId }) => {
                const prevId = sidebarFreezeId || (storedOrderInfo && storedOrderInfo.orderId);
                if (ctx && prevId && ctx.orderNumber !== prevId) {
                    clearSidebar();
                    return;
                }
                if (ctx && sidebarFreezeId && ctx.orderNumber !== sidebarFreezeId) {
                    sessionSet({ sidebarFreezeId: null, adyenDnaInfo: null });
                }
                const orderId = ctx ? ctx.orderNumber : sidebarFreezeId;
                if (!orderId) {
                    showInitialStatus();
                    applyReviewMode();
                    return;
                }
                if (ctx) fillOrderSummaryBox(ctx);
                ensureDnaSections();
                loadDbSummary(orderId);
                if (orderId) checkLastIssue(orderId);
                loadDnaSummary();
                loadKountSummary();
            });
        }

        function clearSidebar() {
            console.log('[FENNEC (POO) GM SB] TAB TRACKING: Clearing fraudReviewSession (setting to null)');
            
            // Clear all local variables
            storedOrderInfo = null;
            currentContext = null;
            searchInProgress = false;
            
            // Clear session storage
            sessionStorage.removeItem('fennecSidebarClosed');
            sessionStorage.removeItem('fennecShowTrialFloater');
            
            // Clear all session data
            sessionSet({
                sidebarDb: [],
                sidebarOrderId: null,
                sidebarOrderInfo: null,
                adyenDnaInfo: null,
                kountInfo: null,
                sidebarFreezeId: null,
                fraudReviewSession: null,
                forceFraudXray: null,
                fennecFraudAdyen: null,
                sidebarSnapshot: null,
                fennecActiveSession: null,
                fennecFraudAdyen: null
            });
            
            // Clear localStorage
            localStorage.removeItem('fraudXrayFinished');
            localStorage.removeItem('fennecShowTrialFloater');
            
            // Clear all chrome.storage.local data
            chrome.storage.local.remove([
                'fennecPendingComment',
                'fennecPendingUpload',
                'fennecUpdateRequest',
                'fennecQuickResolveDone',
                'fennecUploadDone',
                'intStorageData',
                'intStorageLoaded',
                'intStorageOrderId',
                'sidebarOrderInfo',
                'sidebarOrderId',
                'sidebarDb',
                'adyenDnaInfo',
                'kountInfo',
                'sidebarFreezeId',
                'fraudReviewSession',
                'forceFraudXray',
                'fennecFraudAdyen',
                'sidebarSnapshot',
                'fennecActiveSession',
                'fennecFraudAdyen'
            ], () => {
                console.log('[FENNEC (POO) GM SB] Cleared all storage data during sidebar clear');
            });
            
            // Clear INT STORAGE data
            window.currentIntStorageOrderId = null;
            
            // Clear any dropped files
            window.droppedFiles = [];
            
            // Clear any timers
            if (window.clearTimer) {
                clearTimeout(window.clearTimer);
                window.clearTimer = null;
            }
            
            // Reset sidebar to initial state
            showInitialStatus();
            applyReviewMode();
            loadDnaSummary();
            loadKountSummary();
            repositionDnaSummary();
            
            console.log('[FENNEC (POO) GM SB] Sidebar cleared and reset to brand new state');
        }

        async function handleEmailSearchClick(xray = false) {
            if (searchInProgress) return;
            searchInProgress = true;
            if (xray || !reviewMode) {
                showLoadingState();
            } else {
                ensureIssueControls(true);
            }

            const context = extractOrderContextFromEmail();
            currentContext = context;
            fillOrderSummaryBox(context);
            loadDbSummary(context && context.orderNumber);

            if (xray && (!storedOrderInfo || !storedOrderInfo.orderId)) {
                const data = await new Promise(res => chrome.storage.local.get({ sidebarOrderInfo: null }, res));
                if (data.sidebarOrderInfo) storedOrderInfo = data.sidebarOrderInfo;
            }

            const email = context && context.email ? context.email : (xray && storedOrderInfo ? storedOrderInfo.clientEmail : null);
            if (!email) {
                alert("No se pudo detectar el correo del cliente.");
                searchInProgress = false;
                return;
            }

            const queryParts = [];
            if (context.orderNumber) {
                queryParts.push(context.orderNumber);
                // Remove subject limitation - search in all fields
            }
            if (email) queryParts.push(`"${email}"`);
            if (context && context.name) queryParts.push(`"${context.name}"`);

            const finalQuery = queryParts.join(" OR ");
            const gmailUrl = `https://mail.google.com/mail/u/1/#search/${encodeURIComponent(finalQuery)}`;

            const urls = [gmailUrl];

            const orderIdFallback = storedOrderInfo && storedOrderInfo.orderId;
            let orderId = context.orderNumber || (xray ? orderIdFallback : null);
            if (xray && !orderId) {
                const link = document.getElementById('order-link');
                if (link) {
                    const digits = link.textContent.replace(/\D/g, '');
                    if (/^22\d{10}$/.test(digits)) orderId = digits;
                }
            }

            if (orderId) {
                let dbOrderUrl = `https://db.incfile.com/incfile/order/detail/${orderId}`;
                if (xray) dbOrderUrl += '?fraud_xray=1';
                urls.push(dbOrderUrl);
            } else {
                const dbSearchUrl = "https://db.incfile.com/order-tracker/orders/order-search";
                urls.push(dbSearchUrl);
                navigator.clipboard.writeText(email).catch(() => {});
            }

            const data = { fennecActiveSession: getFennecSessionId() };
            if (!xray) {
                Object.assign(data, {
                    fraudReviewSession: null,
                    sidebarFreezeId: null,
                    fennecFraudAdyen: null
                });
            } else if (orderId) {
                Object.assign(data, {
                    fraudReviewSession: orderId,
                    sidebarFreezeId: orderId,
                    sidebarDb: [],
                    sidebarOrderId: null,
                    sidebarOrderInfo: null
                });
                sessionStorage.setItem('fennecShowTrialFloater', '1');
                localStorage.removeItem('fraudXrayFinished');
            }
            sessionSet(data, () => {
                // Close existing DB and GM tabs before opening new ones, but exclude current tab
                const urlPatterns = [
                    'mail.google.com',
                    'db.incfile.com'
                ];
                
                // Get current tab ID to exclude it from closing
                bg.send('getCurrentTabId', {}, (currentTabId) => {
                    bg.send('closeTabsByUrlPatterns', { 
                        patterns: urlPatterns,
                        excludeTabId: currentTabId 
                    }, (response) => {
                        console.log('[FENNEC (POO) GM SB] Closed existing tabs:', response);
                        
                        // Open new tabs after closing existing ones
                        urls.forEach(url => {
                            bg.openOrReuseTab({ url, active: false });
                        });
                        setTimeout(() => { searchInProgress = false; }, 1000);
                    });
                });
            });
                        if (orderId) {
                checkLastIssue(orderId);
                
                // Set up INT STORAGE listener for order
                console.log('[FENNEC (POO) GM SB] Setting up INT STORAGE listener for order:', orderId, 'reviewMode:', reviewMode);
                window.currentIntStorageOrderId = orderId;
                
                // Set up a listener to wait for INT STORAGE completion signal
                const checkForIntStorageData = () => {
                    chrome.storage.local.get({ intStorageData: null }, ({ intStorageData }) => {
                        if (intStorageData && intStorageData.orderId === orderId) {
                            console.log('[FENNEC (POO) GM SB] Found INT STORAGE data from DB tab for order:', orderId);
                            if (intStorageData.error) {
                                updateIntStorageDisplay(null, orderId, intStorageData.error, 0);
                            } else {
                                updateIntStorageDisplay(intStorageData.files, orderId, null, 0);
                            }
                        } else {
                            // Check again in 2 seconds
                            setTimeout(checkForIntStorageData, 2000);
                        }
                    });
                };
                
                // Start checking for INT STORAGE data after a short delay
                setTimeout(checkForIntStorageData, 3000);
            }
        }

        function injectSidebar(mainPanels) {
            if (document.getElementById('copilot-sidebar')) return;

            const sbObj = new Sidebar();
            
            // Use custom template for GM SB REVIEW MODE, standardized template for other review modes
            if (reviewMode) {
                sbObj.build(`
                    ${buildSidebarHeader()}
                    <div class="order-summary-header">
                        ORDER SUMMARY 
                        <span id="qs-toggle" class="quick-summary-toggle">⚡</span>
                    </div>
                    <div class="copilot-body" id="copilot-body-content">
                        <div class="copilot-actions" style="margin-top:8px;">
                            <button id="btn-xray" class="copilot-button">🩻 XRAY</button>
                            <button id="btn-email-search" class="copilot-button">📧 SEARCH</button>
                        </div>
                        <div id="db-summary-section" style="margin-top:16px;">
                            <div style="text-align:center; color:#888; margin-top:20px;">Cargando resumen...</div>
                        </div>
                        <div class="copilot-dna">
                            <div id="dna-summary" style="margin-top:16px"></div>
                            <div id="kount-summary" style="margin-top:10px"></div>
                        </div>
                        <div id="fraud-summary-section"></div>
                        <div id="issue-summary-section" style="display:none; margin-top:10px;">
                            <div class="section-label" style="display:none;">ISSUES:</div>
                            <div class="issue-summary-box" id="issue-summary-box" style="display:none;">
                                <strong>ISSUE <span id="issue-status-label" class="issue-status-label"></span></strong><br>
                                <div id="issue-summary-content" style="color:#ccc; font-size:13px; white-space:pre-line;">No issue data yet.</div>
                            </div>
                        </div>
                        <div id="int-storage-section" style="display:none; margin-top:10px;">
                            <div class="section-label" style="display:none;">INT STORAGE:</div>
                            <div id="int-storage-box" class="white-box" style="margin-bottom:10px; display:none;">
                                <div style="text-align:center;color:#aaa">Loading...</div>
                            </div>
                        </div>
                        ${devMode ? `<div class="copilot-footer"><button id="copilot-refresh" class="copilot-button">🔄 REFRESH</button></div>` : ''}
                        <div class="copilot-footer"><button id="copilot-clear" class="copilot-button">🧹 CLEAR</button></div>
                        ${devMode ? `
                        <div id="mistral-chat" class="mistral-box">
                            <div id="mistral-log" class="mistral-log"></div>
                            <div class="mistral-input-row">
                                <input id="mistral-input" type="text" placeholder="Ask Mistral..." />
                                <button id="mistral-send" class="copilot-button">Send</button>
                            </div>
                        </div>` : ''}
                        <div id="review-mode-label" class="review-mode-label" style="display:none; margin-top:4px; text-align:center; font-size:11px;">REVIEW MODE</div>
                    </div>
                `);
            } else {
                sbObj.build(`
                    ${buildSidebarHeader()}
                    <div class="order-summary-header">
                        <button id="btn-email-search" class="copilot-button">📧 SEARCH</button>
                    </div>
                    <div class="copilot-body">
                        <div class="order-summary-box">
                            <div id="order-summary-content" style="color:#ccc; font-size:13px;">
                                No order data yet.
                            </div>
                        </div>
                        <div id="db-summary-section"></div>
                        <hr style="border:none;border-top:1px solid #555;margin:6px 0"/>
                        <div class="issue-summary-box" id="issue-summary-box" style="margin-top:10px;">
                            <strong>ISSUE <span id="issue-status-label" class="issue-status-label"></span></strong><br>
                            <div id="issue-summary-content" style="color:#ccc; font-size:13px; white-space:pre-line;">No issue data yet.</div>
                            <textarea id="issue-comment-input" class="quick-resolve-comment" placeholder="Comment..."></textarea>
                            <button id="issue-resolve-btn" class="copilot-button" style="margin-top:4px;">COMMENT & RESOLVE</button>
                            <button id="update-info-btn" class="copilot-button" style="margin-top:4px;">UPDATE</button>
                        </div>
                        <div id="int-storage-section" style="display:none; margin-top:10px;">
                            <div class="section-label" style="display:none;">INT STORAGE:</div>
                            <div id="int-storage-box" class="white-box" style="margin-bottom:10px; display:none;">
                                <div style="text-align:center;color:#aaa">Loading...</div>
                            </div>
                        </div>
                        ${devMode ? `<div class="copilot-footer"><button id="copilot-refresh" class="copilot-button">🔄 REFRESH</button></div>` : ``}
                        <div class="copilot-footer"><button id="copilot-clear" class="copilot-button">🧹 CLEAR</button></div>
                    </div>
                `);
            }
            sbObj.attach();
            const sidebar = sbObj.element;
            ensureDnaSections();
            
            // Override attachCommonListeners to ensure CLIENT and BILLING sections are hidden
            const originalAttachCommonListeners = window.attachCommonListeners;
            window.attachCommonListeners = function(rootEl) {
                if (originalAttachCommonListeners) {
                    originalAttachCommonListeners(rootEl);
                }
                // Ensure CLIENT and BILLING sections are hidden after any content is attached
                setTimeout(() => {
                    ensureClientBillingHidden();
                }, 100);
            };
            chrome.storage.sync.get({
                sidebarFontSize: 13,
                sidebarFont: "'Inter', sans-serif",
                sidebarBgColor: '#212121',
                sidebarBoxColor: '#2e2e2e'
            }, opts => applySidebarDesign(sidebar, opts));
            loadSidebarSnapshot(sidebar, repositionDnaSummary);

            // Start with empty layout showing only action buttons.
            showInitialStatus();
            // Details load after the user interacts with SEARCH or when
            // opened automatically with context.

            // Ensure navigation buttons are visible
            ensureNavigationButtonsVisible();
            ensureGmailIconsVisible();
            ensureClientBillingHidden();
            
            // Set up periodic check for navigation buttons
            const navigationCheckInterval = setInterval(() => {
                ensureNavigationButtonsVisible();
                ensureGmailIconsVisible();
                ensureClientBillingHidden();
            }, 1000);

            // Botón de cierre
            document.getElementById('copilot-close').onclick = () => {
                sidebar.remove();
                // Limpiar el margin aplicado a los paneles
                mainPanels.forEach(el => el.style.marginRight = '');
                // Clear the navigation check interval
                clearInterval(navigationCheckInterval);
                sessionStorage.setItem("fennecSidebarClosed", "true");
                showFloatingIcon();
            };

            const clearBtn = document.getElementById('copilot-clear-tabs');
            if (clearBtn) {
                clearBtn.onclick = () => {
                    bg.closeOtherTabs();
                };
            }

            // Botón SEARCH (listener UNIFICADO)
            const searchBtn = document.getElementById("btn-email-search");
            if (searchBtn) searchBtn.onclick = () => handleEmailSearchClick();
            
            // Botón XRAY (solo en review mode)
            const xrayBtn = document.getElementById("btn-xray");
            if (xrayBtn) xrayBtn.onclick = () => runReviewXray();
            
            const rBtn = document.getElementById("copilot-refresh");
            if (devMode && rBtn) rBtn.onclick = refreshSidebar;
            const clearSb = document.getElementById("copilot-clear");
            if (clearSb) clearSb.onclick = clearSidebar;

            setupResolveButton();
            setupUpdateButton();
            setupXrayButton();
            applyReviewMode();
            if (reviewMode) {
                loadDnaSummary();
                loadKountSummary();
                
                            // Setup INT STORAGE event listeners
            const sidebar = document.getElementById('copilot-sidebar');
            if (sidebar) {
                sidebar.addEventListener('click', (e) => {
                    if (e.target.classList.contains('int-open')) {
                        const url = e.target.dataset.url;
                        if (url) {
                            bg.openOrReuseTab({ url, active: false });
                        }
                    }
                    if (e.target.classList.contains('int-doc-clip')) {
                        const idx = e.target.dataset.idx;
                        if (idx !== undefined) {
                            // Handle remove functionality if needed
                            console.log('[FENNEC (POO) GM SB] Remove INT STORAGE item:', idx);
                        }
                    }
                });
            }
            
                    // Test INT STORAGE data sharing (for debugging)
        console.log('[FENNEC (POO) GM SB] Testing INT STORAGE data sharing...');
        chrome.storage.local.get({ intStorageData: null }, ({ intStorageData }) => {
            console.log('[FENNEC (POO) GM SB] Current INT STORAGE data in storage:', intStorageData);
        });
        
        // Setup cleanup when email tab is closed
        setupEmailTabCleanup();
            }
        }

        function injectSidebarIfMissing() {
            if (sessionStorage.getItem("fennecSidebarClosed") === "true") { ensureFloatingIcon(); return; }
            if (!document.getElementById('copilot-sidebar')) {
                const mainPanels = applyPaddingToMainPanels();
                injectSidebar(mainPanels);
                showInitialStatus();
            } else {
                // Ensure navigation buttons are visible even when sidebar is already present
                ensureNavigationButtonsVisible();
                ensureGmailIconsVisible();
                ensureClientBillingHidden();
            }
        }

        // Observador para reaplicar el padding y detectar si hay correo abierto
        let lastEmailOpen = null;
        let clearTimer = null;
        const observer = new MutationObserver(() => {
            const sidebar = document.getElementById('copilot-sidebar');
            if (!sidebar) return;
            applyPaddingToMainPanels();
            ensureNavigationButtonsVisible();
            ensureGmailIconsVisible();
            ensureClientBillingHidden();
            const hasEmail = isEmailOpen();
            if (hasEmail) {
                if (clearTimer) { clearTimeout(clearTimer); clearTimer = null; }
                if (lastEmailOpen !== true) {
                    lastEmailOpen = true;
                    refreshSidebar();
                }
                return;
            }
            if (lastEmailOpen === false) return;
            if (clearTimer) clearTimeout(clearTimer);
            clearTimer = setTimeout(() => {
                if (!isEmailOpen()) {
                    lastEmailOpen = false;
                    clearSidebar();
                }
            }, 500);
        });
        observer.observe(document.body, { childList: true, subtree: true });

        setInterval(injectSidebarIfMissing, 1200);
        
        // Global interval to ensure navigation buttons are always visible
        setInterval(() => {
            if (document.getElementById('copilot-sidebar')) {
                ensureNavigationButtonsVisible();
                ensureGmailIconsVisible();
                ensureClientBillingHidden();
            }
        }, 2000);

        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && changes.sidebarSessionId &&
                changes.sidebarSessionId.newValue !== getFennecSessionId()) {
                const other = Object.keys(changes).filter(k => k !== 'sidebarSessionId');
                if (!other.length) {
                    return;
                }
            }
            if (area === 'local' && changes.sidebarDb && document.getElementById('db-summary-section')) {
                loadDbSummary();
            }
            if (area === 'local' && changes.adyenDnaInfo) {
                ensureDnaSections();
                loadDnaSummary();
                loadKountSummary();
            }
            if (area === 'local' && changes.fraudXrayFinished && changes.fraudXrayFinished.newValue === '1') {
                chrome.storage.local.remove('fraudXrayFinished');
                ensureDnaSections();
                refreshSidebar();
                loadDnaSummary();
                loadKountSummary();
                startDnaWatch();
                const box = document.getElementById('issue-summary-box');
                if (box) box.style.display = 'block';
                ensureIssueControls(true);
                updateDetailVisibility();
                if (currentContext && currentContext.orderNumber) {
                    checkLastIssue(currentContext.orderNumber);
                }
            }
            if (area === 'local' && changes.sidebarSnapshot && changes.sidebarSnapshot.newValue) {
                const sb = document.getElementById('copilot-sidebar');
                if (sb) {
                    sb.innerHTML = changes.sidebarSnapshot.newValue;
                    attachCommonListeners(sb);
                    ensureDnaSections();
                    repositionDnaSummary();
                    ensureIssueControls(true);
                    setupResolveButton();
                    setupUpdateButton();
                    updateDetailVisibility();
                }
            }
            if (area === 'sync' && changes.fennecReviewMode) {
                reviewMode = changes.fennecReviewMode.newValue;
                sessionStorage.setItem("fennecReviewMode", reviewMode ? "true" : "false");
                applyReviewMode();
            }
            if ((area === 'sync' && changes.fennecDevMode) || (area === 'local' && changes.fennecDevMode)) {
                window.location.reload();
            }
            if (area === 'local' && changes.fennecQuickResolveDone) {
                const data = changes.fennecQuickResolveDone.newValue || {};
                chrome.storage.local.remove('fennecQuickResolveDone');
                const box = document.getElementById('issue-summary-box');
                if (box) {
                    const commentInput = document.getElementById('issue-comment-input');
                    const resolveBtn = document.getElementById('issue-resolve-btn');
                    if (commentInput) commentInput.remove();
                    if (resolveBtn) resolveBtn.remove();
                    if (data.comment) {
                        let c = document.getElementById('quick-resolve-comment-text');
                        if (!c) {
                            c = document.createElement('div');
                            c.id = 'quick-resolve-comment-text';
                            c.className = 'quick-resolve-comment-text';
                            box.appendChild(c);
                        }
                        c.textContent = data.comment;
                    }
                    let msg = document.getElementById('quick-resolve-confirm');
                    if (!msg) {
                        msg = document.createElement('div');
                        msg.id = 'quick-resolve-confirm';
                        msg.style.marginTop = '4px';
                        msg.style.color = '#0a0';
                        box.appendChild(msg);
                    }
                    msg.textContent = 'Issue updated successfully.';
                    msg.style.display = 'block';
                    setTimeout(() => { if (msg) msg.style.display = 'none'; }, 3000);
                    if (data.resolved) {
                        const label = document.getElementById('issue-status-label');
                        if (label) {
                            label.textContent = 'RESOLVED';
                            label.className = 'issue-status-label issue-status-resolved';
                        }
                    }
                }
            }
            if (area === 'local' && changes.fennecUploadDone) {
                const info = changes.fennecUploadDone.newValue || {};
                chrome.storage.local.remove('fennecUploadDone');
                const box = document.getElementById('issue-summary-box');
                if (box) {
                    let msg = document.getElementById('upload-confirm');
                    if (!msg) {
                        msg = document.createElement('div');
                        msg.id = 'upload-confirm';
                        msg.style.marginTop = '4px';
                        msg.style.color = '#0a0';
                        box.appendChild(msg);
                    }
                    let text = info.converted ? 'Document converted' : 'Document';
                    if (info.origName && info.origName !== info.fileName) {
                        text += ` renamed to ${info.fileName}`;
                    }
                    text += ' and uploaded.';
                    msg.textContent = text;
                    msg.style.display = 'block';
                    setTimeout(() => { if (msg) msg.style.display = 'none'; }, 3000);
                    const btn = document.getElementById('issue-resolve-btn');
                    if (btn) btn.textContent = reviewMode ? 'COMMENT & RELEASE' : 'COMMENT & RESOLVE';
                    droppedFiles = [];
                    const list = document.getElementById('dropped-file-list');
                    if (list) list.remove();
                    const commentInput = document.getElementById('issue-comment-input');
                    if (commentInput) {
                        commentInput.disabled = false;
                        commentInput.classList.remove('disabled');
                    }
                    updateResolveButtonLabel();
                }
            }
        });

        // Ensure DNA summary refreshes when returning from Adyen
        // and show comment controls once XRAY completes.
        window.addEventListener('focus', () => {
            ensureDnaSections();
            refreshSidebar();
            loadDnaSummary();
            loadKountSummary();
            const handleFinish = () => {
                const box = document.getElementById('issue-summary-box');
                if (box) box.style.display = 'block';
                ensureIssueControls(true);
                updateDetailVisibility();
                if (currentContext && currentContext.orderNumber) {
                    checkLastIssue(currentContext.orderNumber);
                }
            };
            if (localStorage.getItem('fraudXrayFinished') === '1') {
                localStorage.removeItem('fraudXrayFinished');
                handleFinish();
                startDnaWatch();
            } else {
                chrome.storage.local.get({ fraudXrayFinished: null }, ({ fraudXrayFinished }) => {
                    if (fraudXrayFinished === '1') {
                        chrome.storage.local.remove('fraudXrayFinished');
                        handleFinish();
                        startDnaWatch();
                    }
                });
            }
        });

        // React to XRAY completion even if Gmail tab never lost focus
        window.addEventListener('storage', (e) => {
            if (e.key === 'fraudXrayFinished' && e.newValue === '1') {
                localStorage.removeItem('fraudXrayFinished');
                ensureDnaSections();
                refreshSidebar();
                loadDnaSummary();
                loadKountSummary();
                startDnaWatch();
                const box = document.getElementById('issue-summary-box');
                if (box) box.style.display = 'block';
                ensureIssueControls(true);
                updateDetailVisibility();
                if (currentContext && currentContext.orderNumber) {
                    checkLastIssue(currentContext.orderNumber);
                }
            }
        });

        // --- OPEN ORDER listener reutilizable ---
        function waitForElement(selector, timeout = 10000) {
            return new Promise((resolve, reject) => {
                const intervalTime = 100;
                let elapsed = 0;

                const interval = setInterval(() => {
                    const element = document.querySelector(selector);
                    if (element) {
                        clearInterval(interval);
                        resolve(element);
                    } else if (elapsed >= timeout) {
                        clearInterval(interval);
                        reject("Elemento no encontrado: " + selector);
                    }
                    elapsed += intervalTime;
                }, intervalTime);
            });
        }

        function updateDroppedIcons() {
            const commentInput = document.getElementById('issue-comment-input');
            if (!commentInput) return;
            let list = document.getElementById('dropped-file-list');
            if (!list) {
                list = document.createElement('div');
                list.id = 'dropped-file-list';
                commentInput.parentNode.insertBefore(list, commentInput.nextSibling);
            }
            list.innerHTML = '';
            droppedFiles.forEach(item => {
                const row = document.createElement('div');
                row.className = 'dropped-file-row';
                const icon = document.createElement('div');
                icon.className = 'dropped-file-icon quick-resolve-file-icon';
                icon.textContent = `📎 ${item.file.name}`;
                const input = document.createElement('input');
                input.className = 'dropped-file-name';
                input.placeholder = '[CHANGE NAME]';
                if (item.name !== item.file.name) input.value = item.name;
                input.addEventListener('input', e => {
                    item.name = e.target.value.trim() || item.file.name;
                });
                row.appendChild(icon);
                row.appendChild(input);
                list.appendChild(row);
            });
            commentInput.disabled = droppedFiles.length > 0;
            commentInput.classList.toggle('disabled', droppedFiles.length > 0);
            updateResolveButtonLabel();
        }

        function allFilesPdf(files) {
            return files.every(f => {
                const file = f.file || f;
                return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
            });
        }

        function updateResolveButtonLabel() {
            const btn = document.getElementById('issue-resolve-btn');
            if (!btn) return;
            
            // Don't apply this logic in REVIEW MODE
            if (reviewMode) {
                if (droppedFiles.length) {
                    btn.textContent = allFilesPdf(droppedFiles)
                        ? 'UPLOAD'
                        : 'CONVERT & UPLOAD';
                } else {
                    btn.textContent = 'COMMENT & RELEASE';
                }
                return;
            }
            
            // Get issue status from the label
            const label = document.getElementById('issue-status-label');
            const isActive = label && label.textContent === 'ACTIVE';
            const isResolved = label && label.textContent === 'RESOLVED';
            
            if (droppedFiles.length) {
                // When docs are dropped, show UPLOAD or RENAME & UPLOAD
                const hasRenamedFiles = droppedFiles.some(f => f.name !== f.file.name);
                if (hasRenamedFiles) {
                    btn.textContent = allFilesPdf(droppedFiles) ? 'RENAME & UPLOAD' : 'CONVERT & UPLOAD';
                } else {
                    btn.textContent = allFilesPdf(droppedFiles) ? 'UPLOAD' : 'CONVERT & UPLOAD';
                }
            } else {
                // Initial states based on issue status
                if (isActive) {
                    btn.textContent = 'COMMENT & RESOLVE';
                } else if (isResolved) {
                    btn.textContent = 'COMMENT';
                } else {
                    btn.textContent = 'COMMENT';
                }
            }
        }

        function fileToDataURL(file) {
            return new Promise(res => {
                const r = new FileReader();
                r.onload = () => res(r.result);
                r.readAsDataURL(file);
            });
        }

        async function convertFileToPdf(item) {
            const file = item.file || item;
            const desired = item.name || file.name;
            const { PDFDocument, StandardFonts } = window.PDFLib || {};
            const arrayBuf = await file.arrayBuffer();
            if (file.type === 'application/pdf') {
                const data = await fileToDataURL(file);
                return { fileName: desired, fileData: data, origName: file.name, converted: false };
            }
            if (!PDFDocument) {
                const data = await fileToDataURL(file);
                let name = desired;
                if (!/\.pdf$/i.test(name)) name = name.replace(/\.[^/.]+$/, '') + '.pdf';
                return { fileName: name, fileData: data, origName: file.name, converted: true };
            }
            const pdf = await PDFDocument.create();
            try {
                if (file.type.startsWith('image/')) {
                    const img = file.type === 'image/png'
                        ? await pdf.embedPng(arrayBuf)
                        : await pdf.embedJpg(arrayBuf);
                    const page = pdf.addPage([img.width, img.height]);
                    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
                } else {
                    const page = pdf.addPage();
                    const text = new TextDecoder().decode(arrayBuf).slice(0, 2000);
                    const font = await pdf.embedFont(StandardFonts.Helvetica);
                    const { height } = page.getSize();
                    const lines = text.split(/\r?\n/);
                    let y = height - 50;
                    for (const line of lines) {
                        page.drawText(line, { x: 50, y, font, size: 12 });
                        y -= 14;
                        if (y < 50) break;
                    }
                }
            } catch (err) {
                pdf.addPage();
            }
            const pdfData = await pdf.saveAsBase64({ dataUri: true });
            let name = desired;
            if (!/\.pdf$/i.test(name)) name = name.replace(/\.[^/.]+$/, '') + '.pdf';
            return { fileName: name, fileData: pdfData, origName: file.name, converted: true };
        }

        function setupResolveButton() {
            const resolveBtn = document.getElementById('issue-resolve-btn');
            const commentInput = document.getElementById('issue-comment-input');
            if (!resolveBtn || !commentInput) return;
            const issueBox = document.getElementById('issue-summary-box');

            const handleDrop = e => {
                e.preventDefault();
                e.stopPropagation();
                const files = Array.from(e.dataTransfer.files || []);
                if (files.length) {
                    droppedFiles.push(...files.map(f => ({ file: f, name: f.name })));
                    droppedFiles = dedupeFiles(droppedFiles);
                    updateDroppedIcons();
                    updateResolveButtonLabel();
                }
            };

            [commentInput, issueBox].forEach(el => {
                if (!el || el.dataset.dropListenerAttached) return;
                el.dataset.dropListenerAttached = 'true';
                el.addEventListener('dragover', e => e.preventDefault());
                el.addEventListener('drop', handleDrop);
            });

            if (resolveBtn.dataset.listenerAttached) return;
            resolveBtn.dataset.listenerAttached = 'true';
            resolveBtn.onclick = () => {
                const comment = commentInput.value.trim();
                const orderId = (storedOrderInfo && storedOrderInfo.orderId) ||
                    (currentContext && currentContext.orderNumber);
                if (!orderId) {
                    alert("No order ID detected.");
                    return;
                }
                const files = droppedFiles.slice();
                if (files.length) {
                    Promise.all(files.map(convertFileToPdf)).then(uploadList => {
                        sessionSet({
                            fennecPendingUpload: {
                                orderId,
                                files: uploadList
                            },
                            fennecActiveSession: getFennecSessionId()
                        }, () => {
                            const url = `https://db.incfile.com/storage/incfile/${orderId}`;
                            bg.openOrReuseTab({ url, active: false });
                            commentInput.value = '';
                            droppedFiles = [];
                            const list = document.getElementById('dropped-file-list');
                            if (list) list.remove();
                            commentInput.disabled = false;
                            commentInput.classList.remove('disabled');
                            updateResolveButtonLabel();
                        });
                    });
                    return;
                }
                if (!comment && !reviewMode) {
                    commentInput.focus();
                    return;
                }
                const data = { orderId, comment };
                if (reviewMode && !comment) data.release = true;
                sessionSet({ fennecPendingComment: data, fennecActiveSession: getFennecSessionId() }, () => {
                    const url = `https://db.incfile.com/incfile/order/detail/${orderId}`;
                    bg.openOrReuseTab({ url, active: false });
                });
            };
        }

        function setupUpdateButton() {
            const btn = document.getElementById('update-info-btn');
            if (!btn || btn.dataset.listenerAttached) return;
            btn.dataset.listenerAttached = 'true';
            btn.onclick = showUpdateOverlay;
        }

        function showUpdateOverlay() {
            const orderId = (storedOrderInfo && storedOrderInfo.orderId) ||
                (currentContext && currentContext.orderNumber);
            if (!orderId) { alert('No order ID detected.'); return; }

            updateFloater.remove();
            updateFloater.build();
            updateFloater.element.style.opacity = '0';
            updateFloater.attach();
            let overlay = updateFloater.element;
            const title = updateFloater.header;
            if (title) overlay.appendChild(title);
            const close = document.createElement('div');
            close.className = 'trial-close';
            close.textContent = '✕';
            close.addEventListener('click', () => overlay.remove());
            overlay.appendChild(close);

            const container = document.createElement('div');
            container.className = 'update-fields';
            overlay.appendChild(container);

            const isLLC = storedOrderInfo && storedOrderInfo.isLLC;
            const sections = [
                ['COMPANY', [
                    ['companyName', 'COMPANY NAME', storedOrderInfo ? storedOrderInfo.companyName : ''],
                    ['companyPrincipal', 'COMPANY PRINCIPAL ADDRESS', storedOrderInfo ? (storedOrderInfo.companyAddress || '') : ''],
                    ['companyMailing', 'COMPANY MAILING ADDRESS', storedOrderInfo ? (storedOrderInfo.companyMailing || '') : ''],
                    ['purpose', 'PURPOSE', storedOrderInfo ? (storedOrderInfo.purpose || '') : '']
                ]],
                ['RA', [
                    ['agentName', 'AGENT NAME', storedOrderInfo && storedOrderInfo.registeredAgent ? storedOrderInfo.registeredAgent.name : ''],
                    ['agentAddress', 'AGENT ADDRESS', storedOrderInfo && storedOrderInfo.registeredAgent ? storedOrderInfo.registeredAgent.address : '']
                ]],
                [isLLC ? 'MEMBERS' : 'DIRECTORS', [
                    ['memberName', isLLC ? 'MEMBER NAME' : 'DIRECTOR NAME', ''],
                    ['memberAddress', isLLC ? 'MEMBER ADDRESS' : 'DIRECTOR ADDRESS', '']
                ]]
            ];
            if (!isLLC) {
                sections.push(['OFFICERS', [
                    ['officers', 'OFFICERS (NAME AND ADDRESS)', '']
                ]]);
                sections.push(['SHAREHOLDERS', [
                    ['shareholders', 'SHAREHOLDERS (NAME AND ADDRESS)', '']
                ]]);
            }

            const fields = [];
            sections.forEach(([title, items]) => {
                const sec = document.createElement('div');
                sec.className = 'update-section';
                const h = document.createElement('div');
                h.className = 'update-section-title';
                h.textContent = title;
                sec.appendChild(h);
                const box = document.createElement('div');
                box.className = 'update-box white-box';
                items.forEach(([key, label, value]) => {
                    const row = document.createElement('div');
                    row.className = 'update-row';
                    const labelDiv = document.createElement('label');
                    labelDiv.className = 'update-label';
                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.dataset.field = key;
                    labelDiv.appendChild(cb);
                    const textSpan = document.createElement('span');
                    textSpan.textContent = ' ' + label;
                    labelDiv.appendChild(textSpan);
                    const valueDiv = document.createElement('div');
                    valueDiv.className = 'update-value';
                    valueDiv.innerHTML = value ? escapeHtml(value) : '<span style="color:#aaa">-</span>';
                    row.appendChild(labelDiv);
                    row.appendChild(valueDiv);
                    const input = document.createElement('textarea');
                    input.dataset.field = key;
                    input.className = 'update-input';
                    input.value = value || '';
                    cb.addEventListener('change', () => {
                        row.classList.toggle('checked', cb.checked);
                    });
                    row.appendChild(input);
                    box.appendChild(row);
                    fields.push([key, input, cb]);
                });
                sec.appendChild(box);
                container.appendChild(sec);
            });

            const submit = document.createElement('button');
            submit.id = 'update-submit';
            submit.className = 'copilot-button';
            submit.style.marginTop = '8px';
            submit.textContent = 'UPDATE';
            overlay.appendChild(submit);
            requestAnimationFrame(() => overlay.style.opacity = '1');

            submit.onclick = () => {
                const updates = {};
                fields.forEach(([key]) => {
                    const cb = overlay.querySelector(`input[data-field="${key}"]`);
                    const input = overlay.querySelector(`textarea[data-field="${key}"]`);
                    if (cb && cb.checked && input) {
                        updates[key] = input.value.trim();
                    }
                });
                sessionSet({ fennecUpdateRequest: { orderId, updates }, fennecActiveSession: getFennecSessionId() }, () => {
                    const url = `https://db.incfile.com/incfile/order/detail/${orderId}`;
                    bg.openOrReuseTab({ url, active: false });
                    overlay.remove();
                });
            };
        }


        // In Review Mode, XRAY should mirror the flow triggered from the Fraud
        // tracker.  Open the order in DB with the `fraud_xray` flag, start the
        // DB email search in the background and let DB's launcher handle the
        // remaining steps (Kount → Ekata → Adyen → DNA).  The previous
        // implementation simply delegated to `handleEmailSearchClick(true)`
        // which only opened the DB page and Gmail search.  Recreate the same
        // logic used by the tracker instead.
        function runReviewXray() {
            if (searchInProgress) return;
            searchInProgress = true;
            showLoadingState();
            ensureDnaSections();
            loadDnaSummary();
            loadKountSummary();
            repositionDnaSummary();
            if (!reviewMode) {
                reviewMode = true;
                chrome.storage.sync.set({ fennecReviewMode: true });
                sessionSet({ fennecReviewMode: true });
                applyReviewMode();
            }

            const context = extractOrderContextFromEmail();
            currentContext = context;
            fillOrderSummaryBox(context);
            loadDbSummary(context && context.orderNumber);

            let orderId = context && context.orderNumber;
            if (!orderId && storedOrderInfo) orderId = storedOrderInfo.orderId;
            if (!orderId) {
                alert("No se pudo detectar el n\u00famero de orden.");
                searchInProgress = false;
                return;
            }

            // Load ISSUES and INT STORAGE for review mode
            if (reviewMode && orderId) {
                console.log('[FENNEC (POO) GM SB] XRAY flow - loading ISSUES and INT STORAGE for order:', orderId);
                checkLastIssue(orderId);
                loadIntStorage(orderId);
            } else {
                console.log('[FENNEC (POO) GM SB] XRAY flow - not loading INT STORAGE:', {
                    reviewMode: reviewMode,
                    orderId: orderId
                });
            }

            const email = context && context.email
                ? context.email
                : (storedOrderInfo && storedOrderInfo.clientEmail) || null;

            const searchUrl = email
                ? `https://db.incfile.com/order-tracker/orders/order-search?fennec_email=${encodeURIComponent(email)}`
                : null;
            const dbUrl = `https://db.incfile.com/incfile/order/detail/${orderId}?fraud_xray=1`;

            // Allow rerunning the XRAY flow even if a previous attempt
            // stored a completion flag for this order.
            localStorage.removeItem('fraudXrayCompleted');

            console.log('[FENNEC (POO) GM SB] TAB TRACKING: Setting fraudReviewSession to:', orderId);
            const data = {
                fennecActiveSession: getFennecSessionId(),
                fraudReviewSession: orderId,
                forceFraudXray: orderId,
                sidebarFreezeId: orderId,
                sidebarDb: [],
                sidebarOrderId: null,
                sidebarOrderInfo: null
            };
            sessionStorage.setItem('fennecShowTrialFloater', '1');
            localStorage.removeItem('fraudXrayFinished');

            sessionSet(data, () => {
                if (searchUrl) {
                    bg.openOrReuseTab({ url: searchUrl, active: false });
                }
                bg.openOrReuseTab({ url: dbUrl, active: true, refocus: true });
                setTimeout(() => { searchInProgress = false; }, 1000);
            });
            startDnaWatch();
            checkLastIssue(orderId);
        }

        function setupXrayButton() {
            const button = document.getElementById("btn-xray");
            if (!button || button.dataset.listenerAttached) return;
            button.dataset.listenerAttached = "true";
            button.addEventListener("click", function (e) {
                e.preventDefault();
                e.stopPropagation();
                runReviewXray();
            });
        }
        
        function setupEmailTabCleanup() {
            // Listen for tab updates to detect when email tab is closed
            chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
                // Check if this is the current tab
                chrome.tabs.getCurrent((currentTab) => {
                    if (currentTab && currentTab.id === tabId) {
                        console.log('[FENNEC (POO) GM SB] Email tab closed, cleaning up...');
                        cleanupEmailSession();
                    }
                });
            });
            
            // Listen for navigation away from Gmail
            window.addEventListener('beforeunload', () => {
                console.log('[FENNEC (POO) GM SB] Navigating away from Gmail, cleaning up...');
                cleanupEmailSession();
            });
            
            // Listen for URL changes to detect navigation back to inbox
            let currentUrl = window.location.href;
            let isInEmailView = currentUrl.includes('/mail/u/') && !currentUrl.includes('/#inbox') && !currentUrl.includes('/#search') && !currentUrl.includes('/#sent') && !currentUrl.includes('/#drafts');
            
            const checkUrlChange = () => {
                const newUrl = window.location.href;
                if (newUrl !== currentUrl) {
                    console.log('[FENNEC (POO) GM SB] URL changed from', currentUrl, 'to', newUrl);
                    
                    const wasInEmailView = isInEmailView;
                    isInEmailView = newUrl.includes('/mail/u/') && !newUrl.includes('/#inbox') && !newUrl.includes('/#search') && !newUrl.includes('/#sent') && !newUrl.includes('/#drafts');
                    
                    // Check if navigating from email view back to inbox
                    if (wasInEmailView && !isInEmailView) {
                        console.log('[FENNEC (POO) GM SB] Navigating from email view back to inbox, cleaning up...');
                        cleanupEmailSession();
                    }
                    
                    currentUrl = newUrl;
                }
            };
            
            // Check for URL changes periodically
            setInterval(checkUrlChange, 1000);
            
            // Also observe DOM changes to detect Gmail navigation
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    // Check if we're now in inbox view by looking for inbox-specific elements
                    const inboxIndicators = document.querySelectorAll('[data-tooltip="Inbox"], [aria-label="Inbox"], .bq9');
                    const isInInbox = inboxIndicators.length > 0 && window.location.href.includes('/mail/u/');
                    
                    if (isInInbox && isInEmailView) {
                        isInEmailView = false;
                        cleanupEmailSession();
                    }
                });
            });
            
            // Start observing
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            
            // Also listen for popstate events (back/forward navigation)
            window.addEventListener('popstate', () => {
                setTimeout(checkUrlChange, 100);
            });
            
            // Listen for Gmail back button clicks
            document.addEventListener('click', (event) => {
                const target = event.target.closest('[data-tooltip="Back to Inbox"], [aria-label="Back to Inbox"]');
                if (target) {
                    // Wait a bit for the navigation to complete, then check if we're back to inbox
                    setTimeout(() => {
                        const currentUrl = window.location.href;
                        if (currentUrl.includes('/mail/u/') && (currentUrl.includes('/#inbox') || currentUrl.includes('/#search') || currentUrl.includes('/#sent') || currentUrl.includes('/#drafts'))) {
                            cleanupEmailSession();
                        }
                    }, 500);
                }
            });
        }
        
        function cleanupEmailSession() {
            // Prevent multiple cleanup calls
            if (window.cleanupInProgress) return;
            window.cleanupInProgress = true;
            
            console.log('[FENNEC (POO) GM SB] TAB CLEANUP: Starting cleanup process');
            
            // Clear INT STORAGE data
            chrome.storage.local.remove(['intStorageData', 'intStorageLoaded', 'intStorageOrderId']);
            
            // Clear current order tracking
            window.currentIntStorageOrderId = null;
            
            // Check what tabs are currently tracked before closing
            chrome.storage.local.get({ xrayOpenedTabs: [], fraudReviewSession: null }, ({ xrayOpenedTabs, fraudReviewSession }) => {
                console.log('[FENNEC (POO) GM SB] TAB CLEANUP: Current tracked tabs:', xrayOpenedTabs);
                console.log('[FENNEC (POO) GM SB] TAB CLEANUP: Current fraud review session:', fraudReviewSession);
                
                // Close all tabs opened by the flow FIRST (before clearing session)
                bg.send('closeFlowTabs', {}, (response) => {
                    console.log('[FENNEC (POO) GM SB] TAB CLEANUP: closeFlowTabs response:', response);
                    
                    // Clear sidebar and show initial status AFTER tabs are closed
                    clearSidebar();
                    
                    // Reset cleanup flag after a delay
                    setTimeout(() => {
                        window.cleanupInProgress = false;
                    }, 2000);
                });
            });
        }

        }); // end fennecActiveSession get

    } catch (e) {
        console.error("[Copilot] ERROR en Gmail Launcher:", e);
    }
    });
    });
})();
