// Injects the FENNEC (MVP) sidebar into DB pages.
class DBLauncher extends Launcher {
    init() {
        console.log('[FENNEC (MVP) DB SB] DB Launcher initialized on URL:', location.href);
        if (location.pathname.includes('/storage/incfile/')) {
            console.log('[FENNEC (MVP) DB SB] This is a storage page');
            setupIntStoragePageRefreshDetection();
        }
    if (window.top !== window) return;
    const bg = fennecMessenger;
    // Clear the closed flag on reloads so the sidebar reappears
    window.addEventListener('beforeunload', () => {
        sessionStorage.removeItem("fennecSidebarClosed");
    });
    chrome.storage.local.get({ fennecActiveSession: null }, ({ fennecActiveSession }) => {
        if (fennecActiveSession) {
            sessionStorage.setItem('fennecSessionId', fennecActiveSession);
        }
        getFennecSessionId();
    });
    let currentOrderType = null;
    let currentOrderTypeText = null;
    let initQuickSummary = null;
    let annualReportMode = false;
    let reinstatementMode = false;
    let miscMode = false;
    let autoFamilyTreeDone = false;
    let noStore = new URLSearchParams(location.search).get('fennec_no_store') === '1';
    // Tracks whether Review Mode is active across DB pages
    let reviewMode = false;
    let devMode = false;
    const diagnoseFloater = new DiagnoseFloater();
    let fraudXray = new URLSearchParams(location.search).get('fraud_xray') === '1';
    let intStorageMode = new URLSearchParams(location.search).get('fennec_int_storage') === '1';
    if (fraudXray) {
        document.title = '[DB] ' + document.title;
    }
    if (intStorageMode) {
        document.title = '[DB-INT] ' + document.title;
    }
    if (!fraudXray && sessionStorage.getItem('fraudXrayPending')) {
        fraudXray = true;
    }
    if (fraudXray && localStorage.getItem('fraudXrayFinished') === '1') {
        const params = new URLSearchParams(location.search);
        params.delete('fraud_xray');
        const newUrl = location.pathname + (params.toString() ? '?' + params.toString() : '');
        history.replaceState(null, '', newUrl);
        fraudXray = false;
    }
    let subCheck = new URLSearchParams(location.search).get('fennec_sub_check') === '1';
    const currentId = (location.pathname.match(/(?:detail|storage\/incfile)\/(\d+)/) || [])[1];
    
    chrome.storage.local.get({ forceFraudXray: null }, ({ forceFraudXray }) => {
        if (forceFraudXray && currentId && String(forceFraudXray) === currentId) {
            fraudXray = true;
            chrome.storage.local.remove('forceFraudXray');
        }
    });
    const xrayDoneId = localStorage.getItem('fraudXrayCompleted');
    const xrayDone = xrayDoneId && currentId && xrayDoneId === currentId;
    if (xrayDoneId && currentId && xrayDoneId !== currentId) {
        localStorage.removeItem('fraudXrayCompleted');
    }
    if (fraudXray && xrayDone) {
        // Allow the XRAY flow to run again when manually refreshed by
        // clearing the completion flag without stripping the parameter.
        localStorage.removeItem('fraudXrayCompleted');
    }

    // Some DB pages do not show the correct LTV value until the order is
    // refreshed. This should only happen during FRAUD REVIEW or REVIEW XRAY
    // flows so the sidebar retrieves accurate data.
    (function refreshForLtv() {
        const m = location.pathname.match(/(?:detail|storage\/incfile)\/(\d+)/);
        const orderId = m ? m[1] : null;
        if (!orderId) return;
        if (!fraudXray && !subCheck) return;
        const key = 'fennecLtvRefreshed_' + orderId;
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, '1');
        sessionStorage.setItem('fraudXrayPending', '1');
        window.addEventListener('load', () => {
            setTimeout(() => location.reload(), 300);
        }, { once: true });
    })();

    function showFloatingIcon() {
        if (document.getElementById("fennec-floating-icon")) return;
        const icon = document.createElement("img");
        icon.id = "fennec-floating-icon";
        icon.src = chrome.runtime.getURL("fennec_icon.png");
        icon.alt = "FENNEC";
        icon.addEventListener("click", () => {
            icon.remove();
            sessionStorage.removeItem("fennecSidebarClosed");
            initSidebar();
        });
        document.body.appendChild(icon);
    }

    function ensureFloatingIcon() {
        if (sessionStorage.getItem("fennecSidebarClosed") === "true" &&
            !document.getElementById("copilot-sidebar") &&
            !document.getElementById("fennec-floating-icon")) {
            showFloatingIcon();
        }
    }

    function getText(el) {
        const result = el ? (el.innerText || el.textContent || "").trim() : "";
        return result;
    }

    // Focused, toggleable logging for address debugging
    window.FENNEC_ADDR_DEBUG = window.FENNEC_ADDR_DEBUG ?? true; // set to false to silence
    function addrLog(...args) {
        if (!window.FENNEC_ADDR_DEBUG) return;
        console.log('[FENNEC SB][ADDR]', ...args);
    }

    function autoOpenFamilyTree() {
        console.log('[FENNEC (MVP)] autoOpenFamilyTree called, autoFamilyTreeDone:', autoFamilyTreeDone);
        if (autoFamilyTreeDone) return;
        
        const ftIcon = document.getElementById('family-tree-icon');
        console.log('[FENNEC (MVP)] Family tree icon found:', !!ftIcon, 'display style:', ftIcon ? ftIcon.style.display : 'N/A');
        console.log('[FENNEC (MVP)] Family tree icon listener attached:', ftIcon ? ftIcon.dataset.listenerAttached : 'N/A');
        
        if (ftIcon && ftIcon.style.display !== 'none') {
            console.log('[FENNEC (MVP)] Auto-clicking family tree icon');
            autoFamilyTreeDone = true;
            
            // For MISC orders, trigger the family tree click to open it automatically
            if (miscMode) {
                console.log('[FENNEC (MVP)] MISC mode detected, triggering family tree click');
                // Use a small delay to ensure the icon is ready
                setTimeout(() => {
                    if (ftIcon && ftIcon.style.display !== 'none') {
                        console.log('[FENNEC (MVP)] Triggering click on family tree icon for MISC order');
                        ftIcon.click();
                    } else {
                        console.warn('[FENNEC (MVP)] Family tree icon not visible after delay');
                    }
                }, 500);
            } else {
                // For non-MISC orders, just click the icon
                console.log('[FENNEC (MVP)] Non-MISC order, using manual click');
                ftIcon.click();
            }
        } else {
            console.warn('[FENNEC (MVP)] Family tree icon not found or not visible');
            // Try again after a delay if the icon is not ready
            if (!autoFamilyTreeDone) {
                setTimeout(() => {
                    console.log('[FENNEC (MVP)] Retrying autoOpenFamilyTree after delay');
                    autoFamilyTreeDone = false;
                    autoOpenFamilyTree();
                }, 1000);
            }
        }
    }

    function loadStoredSummary() {
        const body = document.getElementById('copilot-body-content');
        if (!body) return;
        const currentId = getBasicOrderInfo().orderId;
        chrome.storage.local.get({ sidebarDb: [], sidebarOrderId: null }, ({ sidebarDb, sidebarOrderId }) => {
            if (Array.isArray(sidebarDb) && sidebarDb.length && sidebarOrderId && sidebarOrderId === currentId) {
                body.innerHTML = sidebarDb.join('');
                
                // Ensure INT STORAGE section exists
                if (!body.querySelector('#int-storage-section')) {
                    body.innerHTML += `
                        <div id="int-storage-section" style="display:none; margin-top:10px;">
                            <div class="section-label">INT STORAGE:</div>
                            <div id="int-storage-box" class="white-box" style="margin-bottom:10px">
                                <div style="text-align:center;color:#aaa">Loading<span class="loading-dots">...</span></div>
                            </div>
                        </div>
                    `;
                }
                
                // Initialize quick summary state
                const box = body.querySelector('#quick-summary');
                if (box) {
                    box.style.maxHeight = '0px';
                    box.classList.add('quick-summary-collapsed');
                }
                attachCommonListeners(body);
                updateReviewDisplay();
                insertDnaAfterCompany();
                
                // Setup global drag and drop for INT STORAGE uploads
                setupGlobalIntStorageDrop(body, currentId);
                if (typeof applyStandardSectionOrder === 'function') {
                    applyStandardSectionOrder(body.querySelector('#db-summary-section'));
                }
                if (typeof checkLastIssue === 'function') {
                    checkLastIssue(currentId);
                }
                
                // Load INT STORAGE
                console.log('[FENNEC (MVP) DB SB] About to load INT STORAGE with currentId:', currentId);
                loadIntStorage(currentId);
                // Store INT STORAGE data to share with other environments
                chrome.storage.local.set({ 
                    intStorageLoaded: true, 
                    intStorageOrderId: currentId 
                });
                
                if (miscMode) {
                    console.log('[FENNEC (MVP)] MISC mode detected, auto-opening family tree');
                    // Use multiple attempts to ensure family tree opens
                    const attemptAutoOpen = (attempt = 1) => {
                        console.log(`[FENNEC (MVP)] Auto-open attempt ${attempt} for MISC order (loadStoredSummary)`);
                        const ftIcon = document.getElementById('family-tree-icon');
                        if (ftIcon && ftIcon.style.display !== 'none') {
                            console.log('[FENNEC (MVP)] Family tree icon found and visible, triggering auto-open');
                            autoOpenFamilyTree();
                        } else if (attempt < 5) {
                            console.log(`[FENNEC (MVP)] Family tree icon not ready, retrying in ${attempt * 500}ms`);
                            setTimeout(() => attemptAutoOpen(attempt + 1), attempt * 500);
                        } else {
                            console.warn('[FENNEC (MVP)] Family tree icon not found after 5 attempts');
                        }
                    };
                    
                    // Start the auto-open process with a delay
                    setTimeout(() => {
                        requestAnimationFrame(() => {
                            attemptAutoOpen();
                        });
                    }, 1500);
                } else {
                    console.log('[FENNEC (MVP)] Not MISC mode, miscMode:', miscMode, 'orderType:', currentOrderTypeText);
                }
            } else {
                body.innerHTML = `
                    <div style="text-align:center; color:#aaa; margin-top:40px">No DB data.</div>
                    <div id="int-storage-section" style="display:none; margin-top:10px;">
                        <div class="section-label">INT STORAGE:</div>
                        <div id="int-storage-box" class="white-box" style="margin-bottom:10px">
                            <div style="text-align:center;color:#aaa">Loading<span class="loading-dots">...</span></div>
                        </div>
                    </div>
                `;
                
                // Load INT STORAGE even when there's no other DB data
                console.log('[FENNEC (MVP) DB SB] About to load INT STORAGE (no DB data) with currentId:', currentId);
                loadIntStorage(currentId);
                
                // Setup global drag and drop for INT STORAGE uploads (no DB data case)
                setupGlobalIntStorageDrop(body, currentId);
                // Store INT STORAGE data to share with other environments
                chrome.storage.local.set({ 
                    intStorageLoaded: true, 
                    intStorageOrderId: currentId 
                });
            }
        });
    }
    
    // Listen for messages from other environments
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'loadIntStorage' && message.orderId) {
            console.log('[FENNEC (MVP) DB SB] Received INT STORAGE load trigger for order:', message.orderId);
            loadIntStorage(message.orderId);
            sendResponse({ success: true, message: 'INT STORAGE load triggered' });
            return true;
        }
        
        if (message.action === 'uspsCmraResult') {
            console.log('[FENNEC (MVP) DB SB] Received USPS CMRA result:', message);
            // The utils.js will handle the icon updates
            return true;
        }
    });
    
    // Map of US states to their SOS business search pages (name and ID)
    const SOS_URLS = {
        "Alabama": {
            name: "https://arc-sos.state.al.us/CGI/CORPNAME.MBR/INPUT",
            id: "https://arc-sos.state.al.us/CGI/corpnumber.mbr/input"
        },
        "Alaska": {
            name: "https://www.commerce.alaska.gov/cbp/main/search/entities",
            id: "https://www.commerce.alaska.gov/cbp/main/search/entities"
        },
        "Arizona": {
            name: "https://ecorp.azcc.gov/EntitySearch/Index",
            id: "https://ecorp.azcc.gov/EntitySearch/Index"
        },
        "Arkansas": {
            name: "https://www.ark.org/corp-search/",
            id: "https://www.ark.org/corp-search/"
        },
        "California": {
            name: "https://bizfileonline.sos.ca.gov/search/business",
            id: "https://bizfileonline.sos.ca.gov/search/business"
        },
        "Colorado": {
            name: "https://www.sos.state.co.us/biz/BusinessEntityCriteriaExt.do",
            id: "https://www.sos.state.co.us/biz/BusinessEntityCriteriaExt.do"
        },
        "Connecticut": {
            name: "https://service.ct.gov/business/s/onlinebusinesssearch?language=en_US",
            id: "https://service.ct.gov/business/s/onlinebusinesssearch?language=en_US"
        },
        "Delaware": {
            name: "https://icis.corp.delaware.gov/Ecorp/EntitySearch/NameSearch.aspx",
            id: "https://icis.corp.delaware.gov/Ecorp/EntitySearch/NameSearch.aspx"
        },
        "District of Columbia": {
            name: "https://os.dc.gov/",
            id: "https://os.dc.gov/"
        },
        "Florida": {
            name: "https://search.sunbiz.org/Inquiry/CorporationSearch/ByName",
            id: "https://search.sunbiz.org/Inquiry/CorporationSearch/ByDocumentNumber"
        },
        "Georgia": {
            name: "https://ecorp.sos.ga.gov/BusinessSearch",
            id: "https://ecorp.sos.ga.gov/BusinessSearch"
        },
        "Hawaii": {
            name: "https://hbe.ehawaii.gov/documents/search.html",
            id: "https://hbe.ehawaii.gov/documents/search.html"
        },
        "Idaho": {
            name: "https://sosbiz.idaho.gov/search/business",
            id: "https://sosbiz.idaho.gov/search/business"
        },
        "Illinois": {
            name: "https://apps.ilsos.gov/businessentitysearch/",
            id: "https://apps.ilsos.gov/businessentitysearch/"
        },
        "Indiana": {
            name: "https://bsd.sos.in.gov/publicbusinesssearch",
            id: "https://bsd.sos.in.gov/publicbusinesssearch"
        },
        "Iowa": {
            name: "https://sos.iowa.gov/search/business/search.aspx",
            id: "https://sos.iowa.gov/search/business/search.aspx"
        },
        "Kansas": {
            name: "https://www.sos.ks.gov/eforms/BusinessEntity/Search.aspx",
            id: "https://www.sos.ks.gov/eforms/BusinessEntity/Search.aspx"
        },
        "Kentucky": {
            name: "https://sosbes.sos.ky.gov/BusSearchNProfile/Search.aspx?na=true",
            id: "https://sosbes.sos.ky.gov/BusSearchNProfile/Search.aspx?na=true"
        },
        "Louisiana": {
            name: "https://coraweb.sos.la.gov/commercialsearch/commercialsearch.aspx",
            id: "https://coraweb.sos.la.gov/commercialsearch/commercialsearch.aspx"
        },
        "Maine": {
            name: "https://apps3.web.maine.gov/nei-sos-icrs/ICRS?MainPage=",
            id: "https://apps3.web.maine.gov/nei-sos-icrs/ICRS?MainPage="
        },
        "Maryland": {
            name: "https://egov.maryland.gov/businessexpress/entitysearch",
            id: "https://egov.maryland.gov/businessexpress/entitysearch"
        },
        "Massachusetts": {
            name: "https://corp.sec.state.ma.us/corpweb/CorpSearch/CorpSearch.aspx",
            id: "https://corp.sec.state.ma.us/corpweb/CorpSearch/CorpSearch.aspx"
        },
        "Michigan": {
            name: "https://www.michigan.gov/lara/online-services/business-entity-search",
            id: "https://www.michigan.gov/lara/online-services/business-entity-search"
        },
        "Minnesota": {
            name: "https://mblsportal.sos.mn.gov/Business/Search",
            id: "https://mblsportal.sos.mn.gov/Business/Search"
        },
        "Mississippi": {
            name: "https://corp.sos.ms.gov/corp/portal/c/page/corpBusinessIdSearch/portal.aspx",
            id: "https://corp.sos.ms.gov/corp/portal/c/page/corpBusinessIdSearch/portal.aspx"
        },
        "Missouri": {
            name: "https://bsd.sos.mo.gov/BusinessEntity/BESearch.aspx?SearchType=0",
            id: "https://bsd.sos.mo.gov/BusinessEntity/BESearch.aspx?SearchType=0"
        },
        "Montana": {
            name: "https://biz.sosmt.gov/search/business/1000",
            id: "https://biz.sosmt.gov/search/business/1000"
        },
        "Nebraska": {
            name: "https://www.nebraska.gov/sos/corp/corpsearch.cgi?nav=search",
            id: "https://www.nebraska.gov/sos/corp/corpsearch.cgi?nav=search"
        },
        "Nevada": {
            name: "https://esos.nv.gov/EntitySearch/OnlineEntitySearch",
            id: "https://esos.nv.gov/EntitySearch/OnlineEntitySearch"
        },
        "New Hampshire": {
            name: "https://quickstart.sos.nh.gov/online/BusinessInquire",
            id: "https://quickstart.sos.nh.gov/online/BusinessInquire"
        },
        "New Jersey": {
            name: "https://www.njportal.com/DOR/BusinessNameSearch/Search/BusinessName",
            id: "https://www.njportal.com/DOR/BusinessNameSearch/Search/EntityId"
        },
        "New Mexico": {
            name: "https://enterprise.sos.nm.gov/search",
            id: "https://enterprise.sos.nm.gov/search"
        },
        "New York": {
            name: "https://apps.dos.ny.gov/publicInquiry/",
            id: "https://apps.dos.ny.gov/publicInquiry/"
        },
        "North Carolina": {
            name: "https://www.sosnc.gov/online_services/search/by_title/_Business_Registration",
            id: "https://www.sosnc.gov/online_services/search/by_title/_Business_Registration"
        },
        "North Dakota": {
            name: "https://firststop.sos.nd.gov/search",
            id: "https://firststop.sos.nd.gov/search"
        },
        "Ohio": {
            name: "https://businesssearch.ohiosos.gov/",
            id: "https://businesssearch.ohiosos.gov/"
        },
        "Oklahoma": {
            name: "https://www.sos.ok.gov/corp/corpInquiryFind.aspx",
            id: "https://www.sos.ok.gov/corp/corpInquiryFind.aspx"
        },
        "Oregon": {
            name: "https://sos.oregon.gov/business/Pages/find.aspx",
            id: "https://sos.oregon.gov/business/Pages/find.aspx"
        },
        "Pennsylvania": {
            name: "https://file.dos.pa.gov/search/business",
            id: "https://file.dos.pa.gov/search/business"
        },
        "Rhode Island": {
            name: "https://business.sos.ri.gov/corp/CorpSearch/CorpSearchInput.asp",
            id: "https://business.sos.ri.gov/corp/CorpSearch/CorpSearchInput.asp"
        },
        "South Carolina": {
            name: "https://businessfilings.sc.gov/BusinessFiling/Entity/NewFiling",
            id: "https://businessfilings.sc.gov/BusinessFiling/Entity/NewFiling"
        },
        "South Dakota": {
            name: "https://sosenterprise.sd.gov/BusinessServices/Business/FilingSearch.aspx",
            id: "https://sosenterprise.sd.gov/BusinessServices/Business/FilingSearch.aspx"
        },
        "Tennessee": {
            name: "https://tncab.tnsos.gov/business-entity-search",
            id: "https://tncab.tnsos.gov/business-entity-search"
        },
        "Texas": {
            name: "https://comptroller.texas.gov/taxes/franchise/account-status/search",
            id: "https://comptroller.texas.gov/taxes/franchise/account-status/search"
        },
        "Utah": {
            name: "https://businessregistration.utah.gov/NameAvailabilitySearch",
            id: "https://businessregistration.utah.gov/EntitySearch/OnlineEntitySearch"
        },
        "Vermont": {
            name: "https://www.vermontbusinessregistry.com/BusinessSearch.aspx",
            id: "https://www.vermontbusinessregistry.com/BusinessSearch.aspx"
        },
        "Virginia": {
            name: "https://cis.scc.virginia.gov/EntitySearch/Index",
            id: "https://cis.scc.virginia.gov/EntitySearch/Index"
        },
        "Washington": {
            name: "https://ccfs.sos.wa.gov/#/",
            id: "https://ccfs.sos.wa.gov/#/"
        },
        "West Virginia": {
            name: "https://apps.sos.wv.gov/business/corporations/",
            id: "https://apps.sos.wv.gov/business/corporations/"
        },
        "Wisconsin": {
            name: "https://apps.dfi.wi.gov/apps/corpsearch/search.aspx",
            id: "https://apps.dfi.wi.gov/apps/corpsearch/search.aspx"
        },
        "Wyoming": {
            name: "https://wyobiz.wyo.gov/business/filingsearch.aspx",
            id: "https://wyobiz.wyo.gov/business/filingsearch.aspx"
        }
    };

    // Used to detect and highlight US addresses within amendment details
    const STATE_ABBRS = 'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
    const STATE_NAMES = [
        'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'
    ];
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.action === 'fennecToggle') {
            window.location.reload();
        }
        if (msg.action === 'getLastIssue') {
            let attempts = 10;
            const tryExtract = () => {
                try {
                    const info = getLastIssueInfo();
                    if (info || attempts <= 0) {
                        sendResponse({ issueInfo: info });
                    } else {
                        attempts--;
                        setTimeout(tryExtract, 500);
                    }
                } catch (err) {
                    console.warn('[FENNEC (MVP)] Error extracting issue text:', err);
                    sendResponse({ issueInfo: null });
                }
            };
            tryExtract();
            return true;
        }
        if (msg.action === 'getChildOrders') {
            try {
                const orders = getChildOrdersInfo();
                const parent = getBasicOrderInfo();
                sendResponse({ childOrders: orders, parentInfo: parent });
            } catch (err) {
                console.warn('[FENNEC (MVP)] Error extracting child orders:', err);
                sendResponse({ childOrders: null, parentInfo: null });
            }
            return true;
        }
        if (msg.action === 'getHoldUser') {
            getLastHoldUser().then(user => {
                sendResponse({ holdUser: user });
            });
            return true;
        }
        if (msg.action === 'getActiveSubs') {
            try {
                const subs = getActiveSubscriptions();
                sendResponse({ subs });
            } catch (err) {
                console.warn('[FENNEC (MVP)] Error extracting subscriptions:', err);
                sendResponse({ subs: [] });
            }
            return true;
        }
        if (msg.action === 'getIntStorageList') {
            console.log('[FENNEC (MVP) DB SB] Received getIntStorageList message');
            
            // Check if we're on a storage page
            if (!location.pathname.includes('/storage/incfile/')) {
                console.log('[FENNEC (MVP) DB SB] Not on storage page, current pathname:', location.pathname);
                sendResponse({ files: null, error: 'Not on storage page' });
                return true;
            }
            
            try {
                // Check if page is fully loaded
                if (document.readyState !== 'complete') {
                    console.log('[FENNEC (MVP) DB SB] Page not fully loaded, readyState:', document.readyState);
                    sendResponse({ files: null, error: 'Page not fully loaded' });
                    return true;
                }
                
                const files = getIntStorageFiles();
                console.log('[FENNEC (MVP) DB SB] getIntStorageList response:', { files: files ? files.length : 'null' });
                sendResponse({ files });
            } catch (err) {
                console.error('[FENNEC (MVP) DB SB] getIntStorageList error:', err);
                sendResponse({ files: null, error: err.message });
            }
            return true;
        }
        if (msg.action === 'loadIntStorage') {
            console.log('[FENNEC (MVP) DB SB] Received INT STORAGE load trigger for order:', msg.orderId);
            if (msg.orderId) {
                loadIntStorage(msg.orderId);
                sendResponse({ success: true, message: 'INT STORAGE load triggered' });
            } else {
                sendResponse({ success: false, error: 'No orderId provided' });
            }
            return true;
        }
        
        if (msg.action === 'refreshIntStorageForOrder') {
            console.log('[FENNEC (MVP) DB SB] Received INT STORAGE refresh request for order:', msg.orderId);
            if (msg.orderId) {
                // Check if this tab has a sidebar with INT STORAGE for this order
                const currentOrderId = (location.pathname.match(/(?:detail|storage\/incfile)\/(\d+)/) || [])[1];
                if (currentOrderId === msg.orderId) {
                    console.log('[FENNEC (MVP) DB SB] Refreshing INT STORAGE for current order');
                    loadIntStorage(msg.orderId);
                    sendResponse({ success: true, message: 'INT STORAGE refreshed for current order' });
                } else {
                    console.log('[FENNEC (MVP) DB SB] Order ID mismatch, not refreshing INT STORAGE');
                    sendResponse({ success: false, message: 'Order ID mismatch' });
                }
            } else {
                sendResponse({ success: false, error: 'No orderId provided' });
            }
            return true;
        }
    });

    // Track auto-upload setting for global drag & drop
    window.fennecAutoUpload = false;
    chrome.storage.local.get({ autoUpload: false }, ({ autoUpload }) => {
        window.fennecAutoUpload = !!autoUpload;
    });
    function getOrderType() {
        const el = document.getElementById("ordType");
        if (!el) return "formation";
        const txt = (el.textContent || "").trim().toLowerCase();
        if (/amendment/.test(txt)) return "amendment";
        if (/silver|gold|platinum/.test(txt)) return "formation";
        return "other";
    }

    function normalizeOrderType(text) {
        const t = (text || "").toLowerCase();
        if (t.includes("amendment")) return "Amendment";
        if (t.includes("foreign") && t.includes("qualification")) {
            return "Foreign Qualification";
        }
        if (t.includes("registered agent") && t.includes("change")) {
            return "Registered Agent Change";
        }
        const annual = [
            "annual report",
            "business entity report",
            "biennial report",
            "information report",
            "annual statement",
            "annual registration report",
            "annual list",
            "annual certificate",
            "renewal",
            "public information report",
            "pir",
            "registration fee"
        ];
        if (annual.some(k => t.includes(k))) return "Annual Report";
        if (t.includes("silver")) return "Business Formation - Silver";
        if (t.includes("gold")) return "Business Formation - Gold";
        if (t.includes("platinum")) return "Business Formation - Platinum";
        if (t.includes("formation")) return "Business Formation";
        return text;
    }

    function mapKbCategory(text) {
        const t = (text || "").toLowerCase();
        if (t.includes("business formation")) return "Main Orders";
        if (t.includes("amendment")) return "Amendments";
        return text;
    }

    function updateReviewDisplay() {
        const label = document.getElementById('review-mode-label');
        if (label) label.style.display = reviewMode ? 'block' : 'none';
        const cLabel = document.getElementById('client-section-label');
        const cBox = document.getElementById('client-section-box');
        if (cLabel && cBox) {
            cLabel.style.display = reviewMode ? '' : 'none';
            cBox.style.display = reviewMode ? '' : 'none';
        }
        const bLabel = document.getElementById('billing-section-label');
        const bBox = document.getElementById('billing-section-box');
        if (bLabel && bBox) {
            bLabel.style.display = reviewMode ? '' : 'none';
            bBox.style.display = reviewMode ? '' : 'none';
        }
        
        // Handle DNA/Kount content for storage pages when switching REVIEW MODE
        const isStorage = /\/storage\/incfile\//.test(location.pathname);
        if (isStorage) {
            const body = document.getElementById('copilot-body-content');
            if (body) {
                const dnaSection = body.querySelector('.copilot-dna');
                if (!reviewMode && dnaSection) {
                    // Remove DNA/Kount section when switching to REVIEW MODE OFF
                    dnaSection.remove();
                } else if (reviewMode && !dnaSection) {
                    // Reload content with DNA/Kount when switching to REVIEW MODE ON
                    loadStoredSummary();
                }
            }
        }
    }

    chrome.storage.local.get({ extensionEnabled: true, lightMode: false, fennecReviewMode: false, fennecDevMode: false }, ({ extensionEnabled, lightMode, fennecReviewMode, fennecDevMode }) => {
        if (!extensionEnabled || noStore) {
            console.log('[FENNEC (MVP)] Extension disabled or no-store mode, skipping DB launcher.');
            return;
        }
        if (lightMode) {
            document.body.classList.add('fennec-light-mode');
        } else {
            document.body.classList.remove('fennec-light-mode');
        }

        reviewMode = fennecReviewMode || fraudXray;
        if (fraudXray && !fennecReviewMode) {
            chrome.storage.local.set({ fennecReviewMode: true });
            chrome.storage.sync.set({ fennecReviewMode: true });
        }
        devMode = fennecDevMode;
        
        // Check if this is a manually opened INTERNAL STORAGE page
        const isStorage = /\/storage\/incfile\//.test(location.pathname);
        if (isStorage && currentId) {
            // This is a storage page, check if we have order information available
            console.log('[FENNEC (MVP)] Detected INTERNAL STORAGE page for order:', currentId);
            
            // Check if order information is available from previous order page visit
            function checkAndLoadOrderInfoForStorage() {
                chrome.storage.local.get({ sidebarOrderId: null, sidebarDb: [] }, ({ sidebarOrderId, sidebarDb }) => {
                    // Only show order info if we have data from a previous order page visit
                    if (sidebarOrderId && sidebarDb && sidebarDb.length > 0) {
                        console.log('[FENNEC (MVP)] Order information available, loading sidebar for storage page');
                        
                        // Set the order ID in session storage for consistency
                        sessionStorage.setItem('fennec_order', sidebarOrderId);
                        
                        // Initialize sidebar with existing data
                        setTimeout(() => {
                            if (typeof initSidebar === 'function') {
                                initSidebar();
                                
                                // For storage pages, ensure we only show basic order layout when REVIEW MODE is off
                                if (!reviewMode) {
                                    const body = document.getElementById('copilot-body-content');
                                    if (body) {
                                        // Clear any existing DNA/Kount content first
                                        const dnaSection = body.querySelector('.copilot-dna');
                                        if (dnaSection) {
                                            dnaSection.remove();
                                        }
                                        
                                        // Load basic order information without DNA/Kount sections
                                        const currentId = getBasicOrderInfo().orderId;
                                        chrome.storage.local.get({ sidebarDb: [], sidebarOrderId: null }, ({ sidebarDb, sidebarOrderId }) => {
                                            if (Array.isArray(sidebarDb) && sidebarDb.length && sidebarOrderId && sidebarOrderId === currentId) {
                                                // Filter out DNA/Kount sections for storage pages when REVIEW MODE is off
                                                const filteredContent = sidebarDb.filter(section => 
                                                    !section.includes('copilot-dna') && 
                                                    !section.includes('dna-summary') && 
                                                    !section.includes('kount-summary') &&
                                                    !section.includes('ADYEN') &&
                                                    !section.includes('KOUNT')
                                                );
                                                body.innerHTML = filteredContent.join('');
                                                if (typeof initQuickSummary === 'function') initQuickSummary();
                                                attachCommonListeners(body);
                                                updateReviewDisplay();
                                                insertDnaAfterCompany();
                                                
                                                // Setup global drag and drop for INT STORAGE uploads on storage pages
                                                setupGlobalIntStorageDrop(body, currentId);
                                                if (typeof applyStandardSectionOrder === 'function') {
                                                    applyStandardSectionOrder(body.querySelector('#db-summary-section'));
                                                }
                                                if (typeof checkLastIssue === 'function') {
                                                    checkLastIssue(currentId);
                                                }
                                                if (miscMode) {
                                                    setTimeout(autoOpenFamilyTree, 100);
                                                }
                                            } else {
                                                body.innerHTML = '<div style="text-align:center; color:#aaa; margin-top:40px">No DB data.</div>';
                                            }
                                        });
                                    }
                                } else {
                                    // When REVIEW MODE is ON, show full order information including DNA/Kount
                                    loadStoredSummary();
                                }
                            }
                        }, 500);
                    } else {
                        console.log('[FENNEC (MVP)] No order information available for storage page');
                        
                        // Show "NO ORDER INFO AVAILABLE" message
                        setTimeout(() => {
                            if (typeof initSidebar === 'function') {
                                initSidebar();
                                const body = document.getElementById('copilot-body-content');
                                if (body) {
                                    body.innerHTML = '<div style="text-align:center; color:#aaa; margin-top:40px">NO ORDER INFO AVAILABLE</div>';
                                }
                            }
                        }, 500);
                    }
                });
            }
            
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', checkAndLoadOrderInfoForStorage);
            } else {
                checkAndLoadOrderInfoForStorage();
            }
        }
        
        try {
        function initSidebar() {
            if (sessionStorage.getItem("fennecSidebarClosed") === "true") { showFloatingIcon(); return; }
            if (!document.getElementById('copilot-sidebar')) {
                console.log("[FENNEC (MVP)] Sidebar no encontrado, inyectando en DB...");

                const SIDEBAR_WIDTH = 340;
                document.body.style.transition = 'margin-right 0.2s';
                document.body.style.marginRight = SIDEBAR_WIDTH + 'px';

                // Extra padding for elements that stick to the right edge
                if (!document.getElementById('copilot-db-padding')) {
                    const style = document.createElement('style');
                    style.id = 'copilot-db-padding';
                    style.textContent = `
                        #frm-search-order { margin-right: ${SIDEBAR_WIDTH}px !important; }
                        .modal-fullscreen { width: calc(100% - ${SIDEBAR_WIDTH}px); }
                    `;
                    document.head.appendChild(style);
                }

                (function injectSidebar() {
                    if (document.getElementById('copilot-sidebar')) return;
                    const sbObj = new Sidebar();
                    
                    sbObj.build(buildStandardizedReviewModeSidebar(reviewMode, devMode));
                    sbObj.attach();
                    
                    // Setup INT STORAGE click handler
                    const currentId = getBasicOrderInfo().orderId;
                    if (currentId) {
                        setupIntStorageClickHandler(currentId);
                    }
                    const sidebar = sbObj.element;
                    
                    // Debug: Check if INT STORAGE elements were created
                    console.log('[FENNEC (MVP)] Sidebar built, checking INT STORAGE elements immediately after creation:', {
                        intStorageSection: !!sidebar.querySelector('#int-storage-section'),
                        intStorageBox: !!sidebar.querySelector('#int-storage-box'),
                        reviewMode: reviewMode
                    });
                    chrome.storage.sync.get({
                        sidebarFontSize: 13,
                        sidebarFont: "'Inter', sans-serif",
                        sidebarBgColor: '#212121',
                        sidebarBoxColor: '#2e2e2e'
                    }, opts => applySidebarDesign(sidebar, opts));
                    loadSidebarSnapshot(sidebar, updateReviewDisplay);
                    const closeBtn = sidebar.querySelector('#copilot-close');
                    if (closeBtn) {
                        closeBtn.onclick = () => {
                            sidebar.remove();
                            document.body.style.marginRight = '';
                            const style = document.getElementById('copilot-db-padding');
                            if (style) style.remove();
                            sessionStorage.setItem("fennecSidebarClosed", "true");
                            console.log("[FENNEC (MVP)] Sidebar cerrado manualmente en DB.");
                            showFloatingIcon();
                        };
                    }

                    const clearBtn = sidebar.querySelector('#copilot-clear-tabs');
                    if (clearBtn) {
                        clearBtn.onclick = () => {
                            bg.closeOtherTabs();
                        };
                    }
                    const clearSb = sidebar.querySelector('#copilot-clear');
                    if (clearSb) clearSb.onclick = clearSidebar;
                    
                    // XRAY button (only in review mode)
                    const xrayBtn = sidebar.querySelector('#btn-xray');
                    if (xrayBtn) xrayBtn.onclick = () => runFraudXray();
                    const isStorage = /\/storage\/incfile\//.test(location.pathname);
                    chrome.storage.local.get({ sidebarFreezeId: null, sidebarDb: [], sidebarOrderId: null }, ({ sidebarFreezeId, sidebarDb, sidebarOrderId }) => {
                        const currentId = getBasicOrderInfo().orderId;
                        const rawType = getText(document.getElementById('ordType')) || '';
                        currentOrderTypeText = normalizeOrderType(rawType);
                        annualReportMode = /annual report/i.test(currentOrderTypeText);
                        reinstatementMode = /reinstat/i.test(currentOrderTypeText);
                        miscMode = !/formation/i.test(currentOrderTypeText);
                        
                        console.log('[FENNEC (MVP)] Order type analysis:', {
                            rawType: rawType,
                            currentOrderTypeText: currentOrderTypeText,
                            annualReportMode: annualReportMode,
                            reinstatementMode: reinstatementMode, 
                            miscMode: miscMode,
                            formationTest: /formation/i.test(currentOrderTypeText),
                            isFormation: /formation/i.test(currentOrderTypeText)
                        });
                        const frozen = sidebarFreezeId && sidebarFreezeId === currentId;
                        const hasStored = Array.isArray(sidebarDb) && sidebarDb.length && sidebarOrderId === currentId;
                        if (isStorage || (frozen && hasStored)) {
                            loadStoredSummary();
                        } else {
                            const orderType = getOrderType();
                            currentOrderType = orderType;
                            const ftIcon = sidebar.querySelector('#family-tree-icon');
                            if (ftIcon) {
                                const shouldShow = orderType !== 'formation';
                                ftIcon.style.display = shouldShow ? 'inline' : 'none';
                                console.log('[FENNEC (MVP)] Family tree icon visibility:', {
                                    orderType: orderType,
                                    shouldShow: shouldShow,
                                    displayStyle: ftIcon.style.display,
                                    miscMode: miscMode,
                                    currentOrderTypeText: currentOrderTypeText
                                });
                                
                                // For MISC orders, ensure the icon is visible and add extra debugging
                                if (miscMode && shouldShow) {
                                    console.log('[FENNEC (MVP)] MISC order detected, ensuring family tree icon is visible');
                                    ftIcon.style.display = 'inline';
                                    ftIcon.style.visibility = 'visible';
                                    ftIcon.style.opacity = '1';
                                    
                                    // Also ensure the icon is clickable
                                    ftIcon.style.pointerEvents = 'auto';
                                    ftIcon.style.cursor = 'pointer';
                                    
                                    console.log('[FENNEC (MVP)] Family tree icon styles after MISC setup:', {
                                        display: ftIcon.style.display,
                                        visibility: ftIcon.style.visibility,
                                        opacity: ftIcon.style.opacity,
                                        pointerEvents: ftIcon.style.pointerEvents,
                                        cursor: ftIcon.style.cursor
                                    });
                                    
                                    // Auto-open family tree for MISC orders
                                    setTimeout(() => {
                                        console.log('[FENNEC (MVP)] Auto-opening family tree for MISC order');
                                        autoOpenFamilyTree();
                                    }, 1000);
                                }
                            } else {
                                console.warn('[FENNEC (MVP)] Family tree icon not found in sidebar');
                            }
                            if (orderType === "amendment") {
                                extractAndShowAmendmentData();
                            } else {
                                extractAndShowFormationData();
                            }
                        }
                        if (reviewMode) {
                            loadDnaSummary();
                            loadKountSummary();
                        }
                        

                        if (fraudXray) {
                            const trigger = () => setTimeout(runFraudXray, 500);
                            if (document.readyState === 'complete') {
                                trigger();
                            } else {
                                window.addEventListener('load', trigger, { once: true });
                            }
                            // Fallback in case the load event was missed
                            setTimeout(runFraudXray, 1500);
                        }
                    });
                    const qsToggle = sidebar.querySelector('#qs-toggle');
                    initQuickSummary = () => {
                        const box = sidebar.querySelector('#quick-summary');
                        if (!box) return;
                        box.style.maxHeight = '0px';
                        box.classList.add('quick-summary-collapsed');
                    };
                    initQuickSummary();
                    if (qsToggle) {
                        qsToggle.addEventListener('click', () => {
                            const box = sidebar.querySelector('#quick-summary');
                            if (!box) return;
                            if (box.style.maxHeight && parseInt(box.style.maxHeight) > 0) {
                                box.style.maxHeight = '0px';
                                box.classList.add('quick-summary-collapsed');
                            } else {
                                box.classList.remove('quick-summary-collapsed');
                                box.style.maxHeight = box.scrollHeight + 'px';
                            }
                        });
                    }

                    const qaToggle = sidebar.querySelector('#qa-toggle');
                    if (qaToggle) {
                        const qaMenu = document.createElement('div');
                        qaMenu.id = 'quick-actions-menu';
                        qaMenu.style.display = 'none';
                        qaMenu.innerHTML = '<div class="qa-title">QUICK ACTIONS</div>' +
                            '<ul><li id="qa-emails">Emails</li><li id="qa-cancel">Cancel</li><li id="qa-coda">CODA SEARCH</li><li id="qa-ein">EIN</li></ul>';
                        document.body.appendChild(qaMenu);

                        function showMenu() {
                            qaMenu.style.display = 'block';
                            requestAnimationFrame(() => qaMenu.classList.add('show'));
                        }

                        function hideMenu() {
                            qaMenu.classList.remove('show');
                            qaMenu.addEventListener('transitionend', function h() {
                                qaMenu.style.display = 'none';
                                qaMenu.removeEventListener('transitionend', h);
                            }, { once: true });
                        }

                        qaToggle.addEventListener('click', (e) => {
                            e.stopPropagation();
                            if (qaMenu.style.display === 'block') {
                                hideMenu();
                            } else {
                                showMenu();
                                const rect = qaToggle.getBoundingClientRect();
                                const menuWidth = qaMenu.offsetWidth;
                                let left = rect.left - menuWidth + rect.width;
                                if (left < 0) left = 0;
                                if (left + menuWidth > window.innerWidth) {
                                    left = window.innerWidth - menuWidth;
                                }
                                qaMenu.style.top = rect.bottom + 'px';
                                qaMenu.style.left = left + 'px';
                            }
                        });

                        document.addEventListener('click', (e) => {
                            if (!qaMenu.contains(e.target) && e.target !== qaToggle && qaMenu.style.display === 'block') {
                                hideMenu();
                            }
                        });

                        qaMenu.querySelector('#qa-emails').addEventListener('click', () => {
                            hideMenu();
                            const info = getBasicOrderInfo();
                            const client = getClientInfo();
                            const parts = [];
                            if (info.orderId) {
                                parts.push(info.orderId);
                                parts.push(`subject:"${info.orderId}"`);
                            }
                            if (client.email) parts.push(`"${client.email}"`);
                            if (client.name) parts.push(`"${client.name}"`);
                            if (parts.length) {
                                const query = parts.join(' OR ');
                                const url = `https://mail.google.com/mail/u/1/#search/${encodeURIComponent(query)}`;
                                bg.openActiveTab({ url });
                            }
                        });


                        qaMenu.querySelector('#qa-cancel').addEventListener('click', () => {
                            hideMenu();
                            startCancelProcedure();
                        });

                        const codaItem = qaMenu.querySelector('#qa-coda');
                        if (codaItem) {
                            codaItem.addEventListener('click', () => {
                                hideMenu();
                                openCodaSearch();
                            });
                        }

                        const einItem = qaMenu.querySelector('#qa-ein');
                        if (einItem) {
                            einItem.addEventListener('click', () => {
                                hideMenu();
                                openEINSearch();
                            });
                        }
                    }
                        if (devMode) {
                            const refreshBtn = sidebar.querySelector('#copilot-refresh');
                            if (refreshBtn) {
                                refreshBtn.onclick = () => {
                                    if (currentOrderType === "amendment") {
                                        extractAndShowAmendmentData();
                                    } else {
                                        extractAndShowFormationData();
                                    }
                                };
                            }
                            const fileBtn = sidebar.querySelector('#filing-xray');
                            if (fileBtn) fileBtn.onclick = startFileAlong;
                            initMistralChat();
                        }
                        if (sessionStorage.getItem('fennecCancelPending') === '1') {
                            openCancelPopup();
                        }
                })();
            }
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                initSidebar();
                // Auto-load INT STORAGE if in INT STORAGE mode
                if (intStorageMode && currentId) {
                    console.log('[FENNEC (MVP) DB SB] Auto-loading INT STORAGE for order:', currentId);
                    setTimeout(() => loadIntStorage(currentId), 2000);
                }
            });
        } else {
            initSidebar();
            // Auto-load INT STORAGE if in INT STORAGE mode
            if (intStorageMode && currentId) {
                console.log('[FENNEC (MVP) DB SB] Auto-loading INT STORAGE for order:', currentId);
                setTimeout(() => loadIntStorage(currentId), 2000);
            }
        }
    } catch (e) {
        console.error("[FENNEC (MVP)] ERROR en DB Launcher:", e);

        const body = document.getElementById('copilot-body-content');
        if (body) {
            body.innerHTML = '<div style="text-align:center; color:#aaa; margin-top:40px">Error loading summary.</div>';
        }
    }


    function canonicalizeState(state) {
        if (!state) return '';
        
        // State abbreviation to full name mapping
        const stateAbbreviations = {
            'al': 'Alabama', 'ak': 'Alaska', 'az': 'Arizona', 'ar': 'Arkansas', 'ca': 'California',
            'co': 'Colorado', 'ct': 'Connecticut', 'de': 'Delaware', 'dc': 'District of Columbia',
            'fl': 'Florida', 'ga': 'Georgia', 'hi': 'Hawaii', 'id': 'Idaho', 'il': 'Illinois',
            'in': 'Indiana', 'ia': 'Iowa', 'ks': 'Kansas', 'ky': 'Kentucky', 'la': 'Louisiana',
            'me': 'Maine', 'md': 'Maryland', 'ma': 'Massachusetts', 'mi': 'Michigan', 'mn': 'Minnesota',
            'ms': 'Mississippi', 'mo': 'Missouri', 'mt': 'Montana', 'ne': 'Nebraska', 'nv': 'Nevada',
            'nh': 'New Hampshire', 'nj': 'New Jersey', 'nm': 'New Mexico', 'ny': 'New York',
            'nc': 'North Carolina', 'nd': 'North Dakota', 'oh': 'Ohio', 'ok': 'Oklahoma',
            'or': 'Oregon', 'pa': 'Pennsylvania', 'ri': 'Rhode Island', 'sc': 'South Carolina',
            'sd': 'South Dakota', 'tn': 'Tennessee', 'tx': 'Texas', 'ut': 'Utah', 'vt': 'Vermont',
            'va': 'Virginia', 'wa': 'Washington', 'wv': 'West Virginia', 'wi': 'Wisconsin', 'wy': 'Wyoming'
        };
        
        const clean = String(state).trim().toLowerCase();
        
        // First check if it's a state abbreviation and convert to full name
        if (stateAbbreviations[clean]) {
            const fullName = stateAbbreviations[clean];
            console.log(`[FENNEC (MVP)] Converted state abbreviation "${state}" to "${fullName}"`);
            return fullName;
        }
        
        // Then check for exact matches in SOS_URLS keys
        for (const key of Object.keys(SOS_URLS)) {
            if (key.toLowerCase() === clean) return key;
        }
        
        console.warn(`[FENNEC (MVP)] Could not canonicalize state: "${state}"`);
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


    function isValidField(text) {
        if (!text) return false;
        const clean = String(text).trim().toLowerCase();
        const compact = clean.replace(/\s+/g, '');
        if (!compact) return false;
        if (compact === 'n/a' || compact === 'na') return false;
        if (clean.includes('no service')) return false;
        if (['us', 'usa', 'unitedstates', 'unitedstatesofamerica'].includes(compact)) {
            return false;
        }
        return true;
    }

    function formatAddressForUSPS(addr) {
        if (!isValidField(addr)) return '';
        
        // Clean the address string
        let cleanAddr = addr.trim();
        
        // Remove country codes like "US" at the end
        cleanAddr = cleanAddr.replace(/,\s*US\s*$/i, '');
        cleanAddr = cleanAddr.replace(/,\s*USA\s*$/i, '');
        cleanAddr = cleanAddr.replace(/,\s*United States\s*$/i, '');
        
        // Remove any extra commas and normalize spacing
        cleanAddr = cleanAddr.replace(/,\s*,/g, ',').replace(/\s+/g, ' ').trim();
        
        // Remove trailing commas
        cleanAddr = cleanAddr.replace(/,\s*$/, '');
        
        return cleanAddr;
    }

    function renderAddress(addr, isVA = false) {
        // If addr is an object (raw address data), build a normalized string first
        if (typeof addr === 'object' && addr !== null) {
            const built = buildAddress(addr);
            addr = built || '';
        }

        if (!isValidField(addr)) return '';
        
        // Otherwise, treat as string and parse it
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
        
        // Use simple text with line breaks for more reliable display
        const display = lines.map(escapeHtml).join('<br>');
        
        // Use the cleaned address for USPS links
        const uspsAddr = formatAddressForUSPS(addr);
        const escFull = escapeHtml(uspsAddr);
        
        const extra = isVA
            ? ` <span class="copilot-tag copilot-tag-green">VA</span>`
            : `<span class="copilot-usps" data-address="${escFull}" title="USPS Lookup"> ✉️</span><span class="copilot-copy-icon" data-copy="${escFull}" title="Copy">⧉</span>`;
        
        const result = `<span class="address-wrapper"><a href="#" class="copilot-address" data-address="${escFull}">${display}</a>${extra}</span>`;
        console.log('[FENNEC] DB PRINT - Address:', addr, 'HTML:', result);
        return result;
    }

    function renderAddressFromObject(addrObj, isVA = false) {
        if (!addrObj) return '';
        
        const isValid = val => val && val.trim() && val.trim().toLowerCase() !== 'n/a';
        
        const lines = [];
        
        // Add street address
        if (isValid(addrObj.street)) {
            lines.push(escapeHtml(addrObj.street.trim()));
        }
        
        // Add city, state, zip as a single line - handle both with and without country
        console.log('[FENNEC] renderAddressFromObject - cityStateZipCountry:', addrObj.cityStateZipCountry, 'cityStateZip:', addrObj.cityStateZip);
        if (isValid(addrObj.cityStateZipCountry)) {
            console.log('[FENNEC] Using cityStateZipCountry:', addrObj.cityStateZipCountry);
            lines.push(escapeHtml(addrObj.cityStateZipCountry.trim()));
        } else if (isValid(addrObj.cityStateZip)) {
            console.log('[FENNEC] Using cityStateZip:', addrObj.cityStateZip);
            lines.push(escapeHtml(addrObj.cityStateZip.trim()));
        } else {
            console.log('[FENNEC] No valid city/state/zip field found');
        }
        
        // Fallback: if nothing was captured, build a normalized string and render via string path
        if (lines.length === 0) {
            const built = buildAddress(addrObj);
            return renderAddress(built, isVA);
        }
        
        const display = lines.join('<br>');
        
        // Build full address for USPS links
        const fullAddress = [addrObj.street, (addrObj.cityStateZipCountry || addrObj.cityStateZip)].filter(Boolean).join(', ');
        const uspsAddr = formatAddressForUSPS(fullAddress);
        const escFull = escapeHtml(uspsAddr);
        
        const extra = isVA
            ? ` <span class="copilot-tag copilot-tag-green">VA</span>`
            : `<span class="copilot-usps" data-address="${escFull}" title="USPS Lookup"> ✉️</span><span class="copilot-copy-icon" data-copy="${escFull}" title="Copy">⧉</span>`;
        
        const result = `<span class="address-wrapper"><a href="#" class="copilot-address" data-address="${escFull}">${display}</a>${extra}</span>`;
        addrLog('renderAddressFromObject lines=', lines, 'street=', addrObj.street, 'csz/cszc=', addrObj.cityStateZip || addrObj.cityStateZipCountry, 'fullForUSPS=', uspsAddr);
        return result;
    }

    function renderAddressWithoutTag(addr) {
        // If addr is an object (raw address data), build a normalized string first
        if (typeof addr === 'object' && addr !== null) {
            const built = buildAddress(addr);
            addr = built || '';
        }

        if (!isValidField(addr)) return '';
        
        // Otherwise, treat as string and parse it
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
        
        // Use simple text with line breaks for more reliable display
        const display = lines.map(escapeHtml).join('<br>');
        
        // Use the cleaned address for USPS links
        const uspsAddr = formatAddressForUSPS(addr);
        const escFull = escapeHtml(uspsAddr);
        
        // Include USPS validation and copy icons, but no VA tag
        const extra = `<span class="copilot-usps" data-address="${escFull}" title="USPS Lookup"> ✉️</span><span class="copilot-copy-icon" data-copy="${escFull}" title="Copy">⧉</span>`;
        
        const result = `<span class="address-wrapper"><a href="#" class="copilot-address" data-address="${escFull}">${display}</a>${extra}</span>`;
        console.log('[FENNEC] DB PRINT - Address without tag:', addr, 'HTML:', result);
        return result;
    }

    function renderAddressFromObjectWithoutTag(addrObj) {
        if (!addrObj) return '';
        
        const isValid = val => val && val.trim() && val.trim().toLowerCase() !== 'n/a';
        
        const lines = [];
        
        // Add street address
        if (isValid(addrObj.street)) {
            lines.push(escapeHtml(addrObj.street.trim()));
        }
        
        // Add city, state, zip as a single line - handle both with and without country
        console.log('[FENNEC] renderAddressFromObjectWithoutTag - cityStateZipCountry:', addrObj.cityStateZipCountry, 'cityStateZip:', addrObj.cityStateZip);
        if (isValid(addrObj.cityStateZipCountry)) {
            console.log('[FENNEC] Using cityStateZipCountry:', addrObj.cityStateZipCountry);
            lines.push(escapeHtml(addrObj.cityStateZipCountry.trim()));
        } else if (isValid(addrObj.cityStateZip)) {
            console.log('[FENNEC] Using cityStateZip:', addrObj.cityStateZip);
            lines.push(escapeHtml(addrObj.cityStateZip.trim()));
        } else {
            console.log('[FENNEC] No valid city/state/zip field found');
        }
        
        // Fallback: if nothing was captured, build a normalized string and render via string path
        if (lines.length === 0) {
            const built = buildAddress(addrObj);
            return renderAddressWithoutTag(built);
        }
        
        const display = lines.join('<br>');
        
        // Build full address for USPS links
        const fullAddress = [addrObj.street, (addrObj.cityStateZipCountry || addrObj.cityStateZip)].filter(Boolean).join(', ');
        const uspsAddr = formatAddressForUSPS(fullAddress);
        const escFull = escapeHtml(uspsAddr);
        
        // Include USPS validation and copy icons, but no VA tag
        const extra = `<span class="copilot-usps" data-address="${escFull}" title="USPS Lookup"> ✉️</span><span class="copilot-copy-icon" data-copy="${escFull}" title="Copy">⧉</span>`;
        
        const result = `<span class="address-wrapper"><a href="#" class="copilot-address" data-address="${escFull}">${display}</a>${extra}</span>`;
        addrLog('renderAddressFromObjectWithoutTag lines=', lines, 'street=', addrObj.street, 'csz/cszc=', addrObj.cityStateZip || addrObj.cityStateZipCountry, 'fullForUSPS=', uspsAddr);
        return result;
    }

    function renderBillingAddress(info) {
        if (!info) return '';
        const parts1 = [];
        if (isValidField(info.street1)) parts1.push(info.street1.trim());
        if (isValidField(info.street2)) parts1.push(info.street2.trim());
        const line1 = parts1.join(' ');

        let line2 = '';
        if (isValidField(info.cityStateZipCountry)) {
            line2 = info.cityStateZipCountry.trim();
        } else {
            const seg = [];
            if (isValidField(info.cityStateZip)) seg.push(info.cityStateZip.trim());
            if (info.country && (!info.cityStateZip || !info.cityStateZip.includes(info.country))) {
                seg.push(info.country.trim());
            }
            line2 = seg.join(', ');
        }

        const displayLines = [];
        if (line1) displayLines.push(escapeHtml(line1));
        if (line2) displayLines.push(escapeHtml(line2));
        if (!displayLines.length) return '';
        const full = [line1, line2].filter(Boolean).join(', ');
        
        // Use the cleaned address for USPS links
        const uspsAddr = formatAddressForUSPS(full);
        const escFull = escapeHtml(uspsAddr);
        
        return `<span class="address-wrapper"><a href="#" class="copilot-address" data-address="${escFull}">${displayLines.join('<br>')}</a><span class="copilot-usps" data-address="${escFull}" title="USPS Lookup"> ✉️</span><span class="copilot-copy-icon" data-copy="${escFull}" title="Copy">⧉</span></span>`;
    }

    function formatExpiry(text) {
        if (!isValidField(text)) return '';
        const digits = text.replace(/[^0-9]/g, '');
        if (digits.length >= 4) {
            const month = digits.slice(0, 2).padStart(2, '0');
            const year = digits.slice(-2);
            return `${month}/${year}`;
        }
        return text.trim();
    }

    function renderCopy(text) {
        if (!isValidField(text)) return '';
        const esc = escapeHtml(text);
        return `<span class="copilot-copy" data-copy="${esc}">${esc}</span>`;
    }

    function renderName(text) {
        if (!isValidField(text)) return '';
        const esc = escapeHtml(text);
        return `<span class="copilot-copy copilot-name" data-copy="${esc}">${esc}</span>`;
    }

    function renderCopyIcon(text) {
        if (!isValidField(text)) return '';
        const esc = escapeHtml(text);
        return `<span class="copilot-copy-icon" data-copy="${esc}" title="Copy">⧉</span>`;
    }

    function renderKb(state) {
        if (!isValidField(state)) return '<span style="color:#aaa">-</span>';
        const esc = escapeHtml(state);
        const type = currentOrderTypeText ? mapKbCategory(currentOrderTypeText) : '';
        return `<a href="#" class="copilot-kb" data-state="${esc}" data-otype="${escapeHtml(type)}">${esc}</a>`;
    }


    function isFullAddress(text) {
        if (/\b\d{5}(?:-\d{4})?\b/.test(text)) return true;
        const abbrRe = new RegExp('\\b(' + STATE_ABBRS.join('|') + ')\\b', 'i');
        if (abbrRe.test(text)) return true;
        const nameRe = new RegExp('\\b(' + STATE_NAMES.join('|') + ')\\b', 'i');
        return nameRe.test(text);
    }

    function highlightAddresses(text) {
        const re = /\b\d[\w-]*[^.\n]*?(?:street|st\.?|road|rd\.?|ave\.?|avenue|drive|dr\.?|lane|ln\.?|boulevard|blvd\.?|pkwy|parkway|court|ct\.?|hwy|highway|way|loop|circle|cir\.?|place|pl\.?|trail|trl\.?|point|pt\.?|falls?|fls?|bit)[^.\n]*/gi;
        let out = '';
        let last = 0;
        for (let m; (m = re.exec(text)); ) {
            out += escapeHtml(text.slice(last, m.index));
            const addr = m[0].trim();
            if (isFullAddress(addr)) {
                out += renderAddress(addr);
            } else {
                out += '<strong>' + renderName(addr) + '</strong>';
            }
            last = re.lastIndex;
        }
        out += escapeHtml(text.slice(last));
        return out;
    }

    function isAddressLine(line) {
        if (!line) return false;
        const addrRegex = /(street|st\.?|road|rd\.?|ave\.?|avenue|drive|dr\.?|lane|ln\.?|boulevard|blvd\.?|pkwy|parkway|court|ct\.?|hwy|highway|way|loop|circle|cir\.?|place|pl\.?|trail|trl\.?|point|pt\.?|falls?|fls?|bit)/i;
        return addrRegex.test(line) && /\d/.test(line);
    }

    function formatAmendmentDetails(text) {
        if (!text) return '';
        const lines = text.split(/\n+|\.\s*/).map(l => l.trim()).filter(Boolean);
        return lines.map(l => {
            const idx = l.indexOf(':');
            if (idx !== -1) {
                const before = l.slice(0, idx + 1);
                const after = l.slice(idx + 1).trim();
                return `<div>${escapeHtml(before)} ${highlightAddresses(after)}</div>`;
            }
            return `<div>${highlightAddresses(l)}</div>`;
        }).join('');
    }

    function extractAmendmentDetails() {
        const label = Array.from(document.querySelectorAll('#vcomp label'))
            .find(l => getText(l).toLowerCase().includes('amendment details'));
        if (!label) return null;
        let valDiv = label.nextElementSibling;
        const parent = label.closest('div');
        if ((!valDiv || !getText(valDiv)) && parent) {
            if (parent.nextElementSibling && getText(parent.nextElementSibling)) {
                valDiv = parent.nextElementSibling;
            } else {
                const siblings = Array.from(parent.parentElement.children);
                const idx = siblings.indexOf(parent);
                for (let i = idx + 1; i < siblings.length; i++) {
                    if (getText(siblings[i])) {
                        valDiv = siblings[i];
                        break;
                    }
                }
            }
        }
        return valDiv ? getText(valDiv) : null;
    }

    function parseDate(text) {
        const parsed = Date.parse(text);
        return isNaN(parsed) ? null : new Date(parsed);
    }


    function cleanFieldValue(name, text) {
        if (!text) return text;
        if (name === 'expiration') {
            return text.replace(/Update Expiration Date/i, '').trim();
        }
        return text.trim();
    }

    function buildAddress(obj) {
        if (!obj) return '';

        // Warning: Check if this looks like member data (common member addresses)
        if (obj.street1 && (obj.street1.includes('Pompadour Ct') || obj.street1.includes('6814'))) {
            console.warn('[FENNEC (MVP) DB SB] WARNING: buildAddress received what appears to be member data:', obj.street1);
        }

        const isValid = val => val && val.trim() && val.trim().toLowerCase() !== 'n/a';

        const parts = [];

        // Handle street address - preserve box numbers
        const line1 = isValid(obj.street1) ? obj.street1
                    : isValid(obj.street) ? obj.street
                    : obj.address;
        if (isValid(line1)) {
            // Preserve box/suite numbers in street address
            let streetWithBox = line1.trim();
            
            // Check if we need to add box number from other fields
            if (obj.suiteNumber && isValid(obj.suiteNumber)) {
                // If suite number is separate, append it to street
                if (!streetWithBox.includes(obj.suiteNumber)) {
                    streetWithBox = `${streetWithBox}, Ste ${obj.suiteNumber}`;
                }
            } else if (obj.boxNumber && isValid(obj.boxNumber)) {
                // If box number is separate, append it to street
                if (!streetWithBox.includes(obj.boxNumber)) {
                    streetWithBox = `${streetWithBox}, #${obj.boxNumber}`;
                }
            }
            
            parts.push(streetWithBox);
        }
        if (isValid(obj.street2)) parts.push(obj.street2.trim());

        // Handle city, state, zip, country
        if (obj.cityStateZipCountry && isValid(obj.cityStateZipCountry)) {
            // If we have cityStateZipCountry, use it as is
            parts.push(obj.cityStateZipCountry.trim());
        } else if (obj.cityStateZip && isValid(obj.cityStateZip)) {
            // If we have cityStateZip, use it as is
            parts.push(obj.cityStateZip.trim());
        } else {
            // Build from individual components if available
            const cityStateZipParts = [];
            if (isValid(obj.city)) cityStateZipParts.push(obj.city.trim());
            if (isValid(obj.state)) cityStateZipParts.push(obj.state.trim());
            if (isValid(obj.zip)) cityStateZipParts.push(obj.zip.trim());
            
            if (cityStateZipParts.length > 0) {
                parts.push(cityStateZipParts.join(', '));
            }
            
            if (isValid(obj.country) && (!obj.cityStateZip || !obj.cityStateZip.includes(obj.country))) {
                parts.push(obj.country.trim());
            }
        }

        // Clean up the final address string for better USPS parsing
        let address = parts.join(', ');
        
        // Remove any extra commas and normalize spacing
        address = address.replace(/,\s*,/g, ',').replace(/\s+/g, ' ').trim();
        
        // Ensure proper format for USPS: "Street, City, State ZIP"
        // Try to format city, state, zip more consistently
        const addressParts = address.split(',');
        if (addressParts.length >= 3) {
            const streetPart = addressParts[0].trim();
            const cityPart = addressParts[1].trim();
            const stateZipPart = addressParts.slice(2).join(',').trim();
            
            // Try to separate state and ZIP if they're together
            const stateZipMatch = stateZipPart.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
            if (stateZipMatch) {
                const state = stateZipMatch[1];
                const zip = stateZipMatch[2];
                address = `${streetPart}, ${cityPart}, ${state} ${zip}`;
            } else {
                // Keep original format if we can't parse it
                address = `${streetPart}, ${cityPart}, ${stateZipPart}`;
            }
        }
        
        return address;
    }

    function extractSingleElement(root, fields) {
        if (!root) return null;
        const rows = Array.from(root.querySelectorAll('.row'));
        const obj = {};
        
        console.log('[FENNEC (MVP) DB SB] extractSingleElement - Root:', root, 'Fields:', fields, 'Rows found:', rows.length);
        
        rows.forEach((row, index) => {
            fields.forEach(field => {
                if (obj[field.name]) return;
                let label = Array.from(row.querySelectorAll('label')).find(l =>
                    getText(l).toLowerCase().includes(field.label.toLowerCase())
                );
                if (label) {
                    console.log(`[FENNEC (MVP) DB SB] Found label for field "${field.name}":`, getText(label), 'in row', index);
                    let valDiv = label.nextElementSibling;
                    const parent = label.closest('div');
                    if ((!valDiv || !getText(valDiv)) && parent) {
                        if (parent.nextElementSibling && getText(parent.nextElementSibling)) {
                            valDiv = parent.nextElementSibling;
                        } else {
                            const siblings = Array.from(parent.parentElement.children);
                            const idx = siblings.indexOf(parent);
                            for (let i = idx + 1; i < siblings.length; i++) {
                                if (getText(siblings[i])) {
                                    valDiv = siblings[i];
                                    break;
                                }
                            }
                        }
                    }
                    if (valDiv) {
                        const value = cleanFieldValue(field.name, getText(valDiv));
                        obj[field.name] = value;
                        console.log(`[FENNEC (MVP) DB SB] Extracted value for "${field.name}":`, value);
                    }
                }
            });
        });
        
        const result = Object.values(obj).some(v => v) ? obj : null;
        console.log('[FENNEC (MVP) DB SB] extractSingleElement result:', result);
        return result;
    }

    // Scrapea los .row de una sección dada y devuelve array de objetos campo:valor
    function extractRows(sectionSel, fields) {
        const root = document.querySelector(sectionSel);
        if (!root) return [];
        const rows = Array.from(root.querySelectorAll('.row'));
        return rows.map(row => {
            let obj = {};
            fields.forEach(field => {
                let label = Array.from(row.querySelectorAll('label')).find(l =>
                    getText(l).toLowerCase().includes(field.label.toLowerCase())
                );
                if (label) {
                    let valDiv = label.nextElementSibling;
                    const parent = label.closest('div');
                    if ((!valDiv || !getText(valDiv)) && parent) {
                        if (parent.nextElementSibling && getText(parent.nextElementSibling)) {
                            valDiv = parent.nextElementSibling;
                        } else {
                            const siblings = Array.from(parent.parentElement.children);
                            const idx = siblings.indexOf(parent);
                            for (let i = idx + 1; i < siblings.length; i++) {
                                if (getText(siblings[i])) {
                                    valDiv = siblings[i];
                                    break;
                                }
                            }
                        }
                    }
                    if (valDiv) {
                        obj[field.name] = cleanFieldValue(field.name, getText(valDiv));
                    }
                }
            });
            // Devuelve sólo si hay al menos un campo con valor
            return Object.values(obj).some(x => x) ? obj : null;
        }).filter(Boolean);
    }

    // Extrae todos los campos de una sección (Company o Agent) en un solo objeto
    function extractSingle(sectionSel, fields) {
        const root = document.querySelector(sectionSel);
        if (!root) return null;
        const rows = Array.from(root.querySelectorAll('.row'));
        const obj = {};
        
        console.log('=== EXTRACT SINGLE DEBUG ===');
        console.log('Section selector:', sectionSel);
        console.log('Root element found:', !!root);
        console.log('Number of rows found:', rows.length);
        console.log('Fields to extract:', fields.map(f => f.name + ':' + f.label));
        
        rows.forEach((row, index) => {
            fields.forEach(field => {
                if (obj[field.name]) return;
                let label = Array.from(row.querySelectorAll('label')).find(l =>
                    getText(l).toLowerCase().includes(field.label.toLowerCase())
                );
                if (label) {
                    console.log(`Found label for "${field.name}" in row ${index}:`, getText(label));
                    let valDiv = label.nextElementSibling;
                    const parent = label.closest('div');
                    if ((!valDiv || !getText(valDiv)) && parent) {
                        if (parent.nextElementSibling && getText(parent.nextElementSibling)) {
                            valDiv = parent.nextElementSibling;
                        } else {
                            const siblings = Array.from(parent.parentElement.children);
                            const idx = siblings.indexOf(parent);
                            for (let i = idx + 1; i < siblings.length; i++) {
                                if (getText(siblings[i])) {
                                    valDiv = siblings[i];
                                    break;
                                }
                            }
                        }
                    }
                    if (valDiv) {
                        const value = cleanFieldValue(field.name, getText(valDiv));
                        obj[field.name] = value;
                        console.log(`Extracted "${field.name}":`, value);
                    }
                }
            });
        });
        
        const result = Object.values(obj).some(v => v) ? obj : null;
        console.log('Final extraction result:', result);
        console.log('=== END EXTRACT SINGLE DEBUG ===');
        return result;
    }

    // Extrae miembros (o directores) agrupando por contenedores m-b-10
    function extractMembers(sectionSel, fields) {
        const root = document.querySelector(sectionSel);
        if (!root) return [];
        let blocks = Array.from(root.querySelectorAll('.row.m-b-10'));
        if (!blocks.length) return extractRows(sectionSel, fields);

        // Algunos contenedores de miembros agrupan dos columnas (.col-sm-6)
        // dentro de una sola fila .row.m-b-10. Dividimos dichos contenedores
        // para procesar cada columna como un miembro independiente.
        blocks = [].concat(...blocks.map(b => {
            const cols = Array.from(b.querySelectorAll('.col-sm-6'))
                .filter(c => c.parentElement === b);
            return cols.length > 1 ? cols : [b];
        }));

        return blocks.map(block => {
            const obj = {};
            const rows = Array.from(block.querySelectorAll('.row'));
            rows.forEach(row => {
                fields.forEach(field => {
                    let label = Array.from(row.querySelectorAll('label')).find(l =>
                        getText(l).toLowerCase().includes(field.label.toLowerCase())
                    );
                    if (label) {
                        let valDiv = label.nextElementSibling;
                        const parent = label.closest('div');
                        if ((!valDiv || !getText(valDiv)) && parent) {
                            if (parent.nextElementSibling && getText(parent.nextElementSibling)) {
                                valDiv = parent.nextElementSibling;
                            } else {
                                const siblings = Array.from(parent.parentElement.children);
                                const idx = siblings.indexOf(parent);
                                for (let i = idx + 1; i < siblings.length; i++) {
                                    if (getText(siblings[i])) {
                                        valDiv = siblings[i];
                                        break;
                                    }
                                }
                            }
                        }
                        if (valDiv) {
                            obj[field.name] = cleanFieldValue(field.name, getText(valDiv));
                        }
                    }
                });
            });
            return Object.values(obj).some(x => x) ? obj : null;
        }).filter(Boolean);
    }

    // Extrae oficiales listados en bloques m-b-10. Cada bloque contiene el
    // puesto (label) y el nombre en la primera fila, seguido de varias filas de
    // domicilio. Se agrupan las columnas para soportar múltiples oficiales por
    // fila.
    function extractOfficers(sectionSel) {
        const root = document.querySelector(sectionSel);
        if (!root) return [];

        let blocks = Array.from(root.querySelectorAll('.row.m-b-10'));
        if (!blocks.length) {
            // Fallback a la lógica antigua si no existen bloques m-b-10
            const groups = Array.from(root.querySelectorAll('.form-group'));
            return groups.map(g => {
                const label = g.querySelector('label');
                const val = g.querySelector('.form-control-static, p');
                if (!label || !val || !getText(val)) return null;
                return {
                    name: getText(val),
                    position: getText(label).replace(/:/g, '')
                };
            }).filter(Boolean);
        }

        // Separar columnas dentro del bloque para procesar cada oficial por
        // separado.
        blocks = [].concat(...blocks.map(b => {
            const cols = Array.from(b.querySelectorAll('.col-sm-6'))
                .filter(c => c.parentElement === b);
            return cols.length > 1 ? cols : [b];
        }));

        return blocks.map(block => {
            // Nombre y puesto se encuentran en la primera form-group que no sea
            // de dirección.
            let name = null;
            let position = null;
            const groups = Array.from(block.querySelectorAll('.form-group'));
            for (const g of groups) {
                const label = g.querySelector('label');
                const val = g.querySelector('.form-control-static, p');
                if (!label || !val || !getText(val)) continue;
                const text = getText(label).toLowerCase();
                if (text.includes('street') || text.includes('city') ||
                    text.includes('zip') || text.includes('address')) {
                    continue;
                }
                name = getText(val);
                position = getText(label).replace(/:/g, '');
                break;
            }

            const addrRaw = extractSingleElement(block, [
                {name: 'street', label: 'street'},
                {name: 'street1', label: 'street 1'},
                {name: 'street2', label: 'street 2'},
                {name: 'cityStateZipCountry', label: 'city, state, zip, country'},
                {name: 'cityStateZip', label: 'city, state, zip'},
                {name: 'country', label: 'country'},
                {name: 'address', label: 'address'}
            ]);

            const address = buildAddress(addrRaw);
            return name ? { name, position, address } : null;
        }).filter(Boolean);
    }


    function extractAndShowFormationData(isAmendment = false) {
        let dbSections = [];
        function addEmptySection(label, text = "NO INFO") {
            const section = `
            <div class="section-label">${label}</div>
            <div class="white-box" style="margin-bottom:10px">
                <div style="color:#aaa">${text}</div>
            </div>`;
            html += section;
            dbSections.push(section);
        }
        // 1. COMPANY
        console.log('=== HTML STRUCTURE VERIFICATION ===');
        const vcompElement = document.querySelector('#vcomp');
        const formBodyElement = document.querySelector('#vcomp .form-body');
        console.log('vcomp element found:', !!vcompElement);
        console.log('form-body element found:', !!formBodyElement);
        if (formBodyElement) {
            const allLabels = Array.from(formBodyElement.querySelectorAll('label'));
            console.log('Total labels in form-body:', allLabels.length);
            console.log('Labels with address-related text:', allLabels.filter(l => 
                getText(l).toLowerCase().includes('street') || 
                getText(l).toLowerCase().includes('address') || 
                getText(l).toLowerCase().includes('city') || 
                getText(l).toLowerCase().includes('state') || 
                getText(l).toLowerCase().includes('zip') || 
                getText(l).toLowerCase().includes('physical') || 
                getText(l).toLowerCase().includes('mailing')
            ).map(l => getText(l)));
        }
        console.log('=== END HTML STRUCTURE VERIFICATION ===');
        
        const companyRaw = extractSingle('#vcomp .form-body', [
            {name: 'name', label: 'company name'},
            {name: 'stateId', label: 'state id'},
            {name: 'formationDate', label: 'date of formation'},
            {name: 'formationState', label: 'state of formation'},
            {name: 'status', label: 'state status'},
            {name: 'purpose', label: 'purpose'},
            {name: 'avs', label: 'avs'}
        ]);
        
        console.log('[FENNEC (MVP) DB SB] Company raw extraction result:', companyRaw);
        console.log('=== COMPANY RAW EXTRACTION ===');
        console.log('Company Raw Object:', JSON.stringify(companyRaw, null, 2));
        console.log('Company Raw Keys:', companyRaw ? Object.keys(companyRaw) : 'NULL');
        console.log('=== END COMPANY RAW EXTRACTION ===');

        const headers = Array.from(
            document.querySelectorAll('#vcomp .form-body h2, #vcomp .form-body h3, #vcomp .form-body h4, #vcomp .form-body h5')
        );
        const physicalBox = headers.find(h => /physical.*street.*address/i.test(getText(h)));
        const mailingBox = headers.find(h => /mailing.*address/i.test(getText(h)));
        
        console.log('=== HEADER DETECTION ===');
        console.log('All headers found:', headers.map(h => getText(h)));
        console.log('Physical box found:', physicalBox ? getText(physicalBox) : 'NOT FOUND');
        console.log('Mailing box found:', mailingBox ? getText(mailingBox) : 'NOT FOUND');
        console.log('=== END HEADER DETECTION ===');

        // Improved address extraction for physical and mailing addresses
        let physicalRaw = null;
        let mailingRaw = null;
        
        // Helper function to extract address data from a specific header block
        function extractAddressFromHeader(headerElement) {
            if (!headerElement) return null;
            
            console.log('[FENNEC (MVP) DB SB] Extracting address from header:', getText(headerElement));
            console.log('[FENNEC (MVP) DB SB] Header element:', headerElement);
            
            const addressData = {};
            let currentElement = headerElement.nextElementSibling;
            let rowCount = 0;
            
            console.log('[FENNEC (MVP) DB SB] Starting to traverse from header...');
            
            // Look for address-related rows that follow this header
            while (currentElement && currentElement.tagName && 
                   (!currentElement.classList.contains('white-box') && 
                    !currentElement.matches('h2, h3, h4, h5'))) {
                
                console.log('[FENNEC (MVP) DB SB] Checking element:', currentElement.tagName, currentElement.className);
                
                if (currentElement.classList.contains('row') || currentElement.classList.contains('form-group')) {
                    rowCount++;
                    const label = currentElement.querySelector('label');
                    if (label) {
                        const labelText = getText(label).toLowerCase();
                        const valueElement = currentElement.querySelector('.col-md-8 p, .col-md-8, .col-md-8 div, .col-md-8 span');
                        const value = valueElement ? getText(valueElement) : '';
                        
                        console.log('[FENNEC (MVP) DB SB] Row', rowCount, '- Found label:', getText(label), 'value:', value);
                        console.log('[FENNEC (MVP) DB SB] Row', rowCount, '- Value element:', valueElement);
                        console.log('[FENNEC (MVP) DB SB] Row', rowCount, '- Current element HTML:', currentElement.innerHTML);
                        
                        // Map label to field name
                        if (labelText.includes('street') && !labelText.includes('street 2')) {
                            addressData.street = value;
                            addressData.street1 = value;
                            console.log('[FENNEC (MVP) DB SB] Mapped to street/street1:', value);
                        } else if (labelText.includes('street 2')) {
                            addressData.street2 = value;
                            console.log('[FENNEC (MVP) DB SB] Mapped to street2:', value);
                        } else if (labelText.includes('suite') || labelText.includes('box')) {
                            // Capture suite/box numbers
                            addressData.suiteNumber = value;
                            addressData.boxNumber = value;
                            console.log('[FENNEC (MVP) DB SB] Mapped to suiteNumber/boxNumber:', value);
                        } else if (labelText.includes('city') || labelText.includes('state') || labelText.includes('zip')) {
                            if (!addressData.cityStateZip) {
                                addressData.cityStateZip = value;
                                console.log('[FENNEC (MVP) DB SB] Mapped to cityStateZip:', value);
                            }
                        } else if (labelText.includes('country')) {
                            addressData.country = value;
                            console.log('[FENNEC (MVP) DB SB] Mapped to country:', value);
                        } else if (labelText.includes('address')) {
                            addressData.address = value;
                            console.log('[FENNEC (MVP) DB SB] Mapped to address:', value);
                        }
                    } else {
                        console.log('[FENNEC (MVP) DB SB] Row', rowCount, '- No label found');
                    }
                }
                
                currentElement = currentElement.nextElementSibling;
            }
            
            console.log('[FENNEC (MVP) DB SB] Finished traversing. Total rows processed:', rowCount);
            
            // Build cityStateZipCountry if we have the components
            if (addressData.cityStateZip && addressData.country) {
                addressData.cityStateZipCountry = `${addressData.cityStateZip}, ${addressData.country}`;
            } else if (addressData.cityStateZip) {
                addressData.cityStateZipCountry = addressData.cityStateZip;
            }
            
            // Extract box numbers from street address if not already captured
            if (addressData.street && !addressData.suiteNumber && !addressData.boxNumber) {
                const boxPatterns = [
                    /#\s*(\d{3,})/, // #12345
                    /ste\s*(\d{3,})/i, // Ste 12345
                    /suite\s*(\d{3,})/i, // Suite 12345
                    /box\s*(\d{3,})/i // Box 12345
                ];
                
                for (const pattern of boxPatterns) {
                    const match = addressData.street.match(pattern);
                    if (match) {
                        addressData.suiteNumber = match[1];
                        addressData.boxNumber = match[1];
                        console.log('[FENNEC (MVP) DB SB] Extracted box number from street:', match[1]);
                        break;
                    }
                }
            }
            
            console.log('[FENNEC (MVP) DB SB] Final extracted address data:', addressData);
            
            // Return null if no meaningful data was extracted
            const hasData = Object.values(addressData).some(v => v && v.trim());
            console.log('[FENNEC (MVP) DB SB] Has meaningful data:', hasData);
            
            return hasData ? addressData : null;
        }
        
        if (physicalBox) {
            console.log('[FENNEC (MVP) DB SB] Processing physical address extraction...');
            physicalRaw = extractAddressFromHeader(physicalBox);
            console.log('[FENNEC (MVP) DB SB] Physical raw extraction result:', physicalRaw);
            if (physicalRaw && physicalRaw.street && !physicalRaw.cityStateZip && !physicalRaw.cityStateZipCountry) {
                const csz = findFollowingValue(physicalBox, /city.*state.*zip/);
                if (csz) physicalRaw.cityStateZip = csz;
            }
        }
        
        function escapeRegex(str) {
            return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        function enrichAddressWithCityStateZip(addrRaw) {
            if (!addrRaw || (addrRaw.cityStateZip || addrRaw.cityStateZipCountry)) return addrRaw;
            if (!addrRaw.street) return addrRaw;
            try {
                const container = document.querySelector('#vcomp .form-body');
                const haystack = container ? getText(container) : '';
                const streetPattern = escapeRegex(addrRaw.street.trim());
                // Match: "<street>, City, ST 12345" optionally with extra comma and country
                const re = new RegExp(
                    streetPattern + 
                    "\\s*,\\s*" +
                    "([^,]+)\\s*,\\s*" +
                    "([A-Z]{2})\\s*,?\\s*" +
                    "(\\d{5}(?:-\\d{4})?)" +
                    "(?:\\s*,\\s*(US|USA))?",
                    'i'
                );
                const m = haystack.match(re);
                if (m) {
                    const city = (m[1] || '').trim();
                    const state = (m[2] || '').trim();
                    const zip = (m[3] || '').trim();
                    const country = (m[4] || '').trim();
                    const csz = `${city}, ${state} ${zip}`;
                    addrRaw.cityStateZip = addrRaw.cityStateZip || csz;
                    if (country) addrRaw.country = addrRaw.country || country;
                    if (addrRaw.cityStateZip && addrRaw.country) {
                        addrRaw.cityStateZipCountry = `${addrRaw.cityStateZip}, ${addrRaw.country}`;
                    } else if (addrRaw.cityStateZip) {
                        addrRaw.cityStateZipCountry = addrRaw.cityStateZip;
                    }
                }
            } catch (e) {
                console.warn('[FENNEC (MVP) DB SB] enrichAddressWithCityStateZip error', e);
            }
            return addrRaw;
        }

        function findFollowingValue(headerElement, labelRegex) {
            let node = headerElement ? headerElement.nextElementSibling : null;
            while (node && node.tagName && !node.classList.contains('white-box') && !node.matches('h2, h3, h4, h5')) {
                const label = node.querySelector('label');
                if (label) {
                    const txt = getText(label).toLowerCase();
                    addrLog('scan sibling row for', labelRegex, 'label=', txt);
                    if (labelRegex.test(txt)) {
                        const valueEl = node.querySelector('.col-md-8 p, .col-md-8, .col-md-8 div, .col-md-8 span');
                        const value = valueEl ? getText(valueEl) : '';
                        addrLog('matched label; extracted value=', value);
                        if (value) return value;
                    }
                }
                node = node.nextElementSibling;
            }
            return '';
        }

        if (mailingBox) {
            console.log('[FENNEC (MVP) DB SB] Processing mailing address extraction...');
            mailingRaw = extractAddressFromHeader(mailingBox);
            console.log('[FENNEC (MVP) DB SB] Mailing raw extraction result:', mailingRaw);
            if (mailingRaw && mailingRaw.street && !mailingRaw.cityStateZip && !mailingRaw.cityStateZipCountry) {
                const cszc = findFollowingValue(mailingBox, /city.*state.*zip.*(country)?/);
                if (cszc) {
                    const parts = cszc.split(',').map(s => s.trim());
                    if (parts.length >= 3) {
                        const city = parts[0];
                        const stateZip = parts[1];
                        const rest = parts.slice(2).join(', ');
                        const m = stateZip.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
                        const cityStateZip = m ? `${city}, ${m[1]} ${m[2]}` : `${city}, ${stateZip}`;
                        mailingRaw.cityStateZip = cityStateZip;
                        if (rest) mailingRaw.country = rest.replace(/^(US|USA)$/i, 'US');
                    } else {
                        mailingRaw.cityStateZip = cszc;
                    }
                }
            }
        }
        
        // Fallback: if we couldn't extract physical/mailing addresses from headers,
        // try to extract them from the general company section
        if (!physicalRaw || !mailingRaw) {
            console.log('[FENNEC (MVP) DB SB] Attempting fallback address extraction from company section...');
            
            // Look for physical and mailing address fields in the general company section
            const allLabels = Array.from(document.querySelectorAll('#vcomp .form-body label'));
            console.log('[FENNEC (MVP) DB SB] Found', allLabels.length, 'labels in company section');
            
            if (!physicalRaw) {
                // Look for Physical Street Address section
                const physicalHeader = Array.from(document.querySelectorAll('#vcomp .form-body h5')).find(h => 
                    /physical.*street.*address/i.test(getText(h))
                );
                
                if (physicalHeader) {
                    console.log('[FENNEC (MVP) DB SB] Found physical header:', getText(physicalHeader));
                    let currentElement = physicalHeader.nextElementSibling;
                    const physicalData = {};
                    
                    // Traverse through rows after the physical header
                    while (currentElement && currentElement.tagName && 
                           !currentElement.matches('h5') && 
                           !currentElement.classList.contains('white-box')) {
                        
                        if (currentElement.classList.contains('row') || currentElement.classList.contains('form-group')) {
                            const label = currentElement.querySelector('label');
                            if (label) {
                                const labelText = getText(label).toLowerCase();
                                const valueElement = currentElement.querySelector('.col-md-8 p, .col-md-8, .col-md-8 div, .col-md-8 span');
                                const value = valueElement ? getText(valueElement) : '';
                                
                                console.log('[FENNEC (MVP) DB SB] Physical row - Label:', getText(label), 'Value:', value);
                                
                                if (labelText.includes('street')) {
                                    physicalData.street = value.trim();
                                } else if (labelText.includes('city') || labelText.includes('state') || labelText.includes('zip')) {
                                    physicalData.cityStateZip = value.trim();
                                } else if (labelText.includes('county')) {
                                    physicalData.country = value.trim();
                                }
                            }
                        }
                        currentElement = currentElement.nextElementSibling;
                    }
                    
                    if (physicalData.street && physicalData.cityStateZip) {
                        physicalRaw = physicalData;
                        console.log('[FENNEC (MVP) DB SB] Extracted physical address:', physicalData);
                    }
                }
            }
            
            if (!mailingRaw) {
                // Look for Mailing Address section
                const mailingHeader = Array.from(document.querySelectorAll('#vcomp .form-body h5')).find(h => 
                    /mailing.*address/i.test(getText(h))
                );
                
                if (mailingHeader) {
                    console.log('[FENNEC (MVP) DB SB] Found mailing header:', getText(mailingHeader));
                    let currentElement = mailingHeader.nextElementSibling;
                    const mailingData = {};
                    
                    // Traverse through rows after the mailing header
                    while (currentElement && currentElement.tagName && 
                           !currentElement.matches('h5') && 
                           !currentElement.classList.contains('white-box')) {
                        
                        if (currentElement.classList.contains('row') || currentElement.classList.contains('form-group')) {
                            const label = currentElement.querySelector('label');
                            if (label) {
                                const labelText = getText(label).toLowerCase();
                                const valueElement = currentElement.querySelector('.col-md-8 p, .col-md-8, .col-md-8 div, .col-md-8 span');
                                const value = valueElement ? getText(valueElement) : '';
                                
                                console.log('[FENNEC (MVP) DB SB] Mailing row - Label:', getText(label), 'Value:', value);
                                
                                if (labelText.includes('street')) {
                                    mailingData.street = value.trim();
                                } else if (labelText.includes('city') || labelText.includes('state') || labelText.includes('zip')) {
                                    mailingData.cityStateZip = value.trim();
                                } else if (labelText.includes('country')) {
                                    mailingData.country = value.trim();
                                } else if (labelText.includes('county')) {
                                    mailingData.country = value.trim();
                                }
                            }
                        }
                        currentElement = currentElement.nextElementSibling;
                    }
                    
                    if (mailingData.street && mailingData.cityStateZip) {
                        mailingRaw = mailingData;
                        console.log('[FENNEC (MVP) DB SB] Extracted mailing address:', mailingData);
                    }
                }
            }
        }
        
        // Enrich extracted addresses if they are missing city/state/zip
        physicalRaw = enrichAddressWithCityStateZip(physicalRaw);
        mailingRaw = enrichAddressWithCityStateZip(mailingRaw);

        // If we still don't have physical/mailing addresses, check if there's a single general address
        // This handles cases where there's only one address (no separate physical/mailing sections)
        if (!physicalRaw && !mailingRaw) {
            console.log('[FENNEC (MVP) DB SB] No physical/mailing addresses found, checking for general address...');
            const allLabels = Array.from(document.querySelectorAll('#vcomp .form-body label'));
            
            // Quick check: what labels do we have?
            const labelTexts = allLabels.map(l => getText(l).trim()).filter(t => t);
            console.log('[FENNEC (MVP) DB SB] Available labels:', labelTexts);
            
                    // Look for general address fields (Street, City, State, Zip) - more flexible matching
        const streetLabel = allLabels.find(l => {
            const labelText = getText(l).trim().toLowerCase();
            return labelText === 'street' || labelText === 'street:' || labelText.includes('street');
        });
        console.log('[FENNEC (MVP) DB SB] Street label found:', streetLabel ? getText(streetLabel) : 'NOT FOUND');
            
            if (streetLabel) {
                const streetRow = streetLabel.closest('.row, .form-group');
                if (streetRow) {
                    const streetValue = getText(streetRow.querySelector('.col-md-8 p, .col-md-8, .col-md-8 div, .col-md-8 span'));
                    
                    // Find City, State, Zip label directly instead of using nextElementSibling
                    const cityStateZipLabel = allLabels.find(l => {
                        const labelText = getText(l).trim().toLowerCase();
                        return labelText === 'city, state, zip' || labelText === 'city, state, zip:' || labelText.includes('city') && labelText.includes('state') && labelText.includes('zip');
                    });
                    
                    console.log('[FENNEC (MVP) DB SB] City/State/Zip label found:', cityStateZipLabel ? getText(cityStateZipLabel) : 'NOT FOUND');
                    
                    let cityStateZipValue = '';
                    if (cityStateZipLabel) {
                        const cityStateZipRow = cityStateZipLabel.closest('.row, .form-group');
                        console.log('[FENNEC (MVP) DB SB] City/State/Zip row found:', !!cityStateZipRow);
                        
                        if (cityStateZipRow) {
                            const valueElement = cityStateZipRow.querySelector('.col-md-8 p, .col-md-8, .col-md-8 div, .col-md-8 span');
                            console.log('[FENNEC (MVP) DB SB] City/State/Zip value element found:', !!valueElement);
                            
                            if (valueElement) {
                                cityStateZipValue = getText(valueElement);
                                console.log('[FENNEC (MVP) DB SB] City/State/Zip raw value:', cityStateZipValue);
                            }
                        }
                    }
                    
                    // Find County label directly
                    const countyLabel = allLabels.find(l => {
                        const labelText = getText(l).trim().toLowerCase();
                        return labelText === 'county' || labelText === 'county:' || labelText.includes('county');
                    });
                    
                    let countyValue = '';
                    if (countyLabel) {
                        const countyRow = countyLabel.closest('.row, .form-group');
                        if (countyRow) {
                            countyValue = getText(countyRow.querySelector('.col-md-8 p, .col-md-8, .col-md-8 div, .col-md-8 span'));
                        }
                    }
                    

                    
                    if (streetValue && cityStateZipValue) {
                        // When there's only one address, set it as physical address only (not duplicated)
                        const generalAddress = {
                            street: streetValue.trim(),
                            cityStateZip: cityStateZipValue.trim(),
                            county: countyValue.trim()
                        };
                        
                        physicalRaw = generalAddress;
                        // Don't duplicate - leave mailingRaw as null when there's only one address
                        

                    }
                }
            } else {
                // If no street label found, try to find any address-related information
                console.log('[FENNEC (MVP) DB SB] No street label found, trying alternative address extraction...');
                
                // Look for any row that might contain address information
                const allRows = Array.from(document.querySelectorAll('#vcomp .form-body .row, #vcomp .form-body .form-group'));
                let foundAddress = false;
                
                for (const row of allRows) {
                    const label = row.querySelector('label');
                    if (label) {
                        const labelText = getText(label).trim().toLowerCase();
                        const valueElement = row.querySelector('.col-md-8 p, .col-md-8, .col-md-8 div, .col-md-8 span');
                        const value = valueElement ? getText(valueElement) : '';
                        
                        // If this looks like an address value (contains street number and state)
                        if (value && /^\d+/.test(value) && /[A-Z]{2}\s+\d{5}/.test(value)) {
                            console.log('[FENNEC (MVP) DB SB] Found address value:', value);
                            
                            // Try to parse the address
                            const addressMatch = value.match(/^(.+?),\s*([^,]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
                            if (addressMatch) {
                                const [, street, city, state, zip] = addressMatch;
                                const generalAddress = {
                                    street: street.trim(),
                                    cityStateZip: `${city.trim()}, ${state} ${zip}`.trim()
                                };
                                
                                physicalRaw = generalAddress;
                                // Don't duplicate - leave mailingRaw as null when there's only one address
                                foundAddress = true;
                                

                                break;
                            }
                        }
                    }
                }
                
                if (!foundAddress) {
                    console.log('[FENNEC (MVP) DB SB] No address found in alternative extraction');
                    
                    // Final fallback: look for any text that looks like an address in the company section
                    const companySection = document.querySelector('#vcomp .form-body');
                    if (companySection) {
                        const allText = getText(companySection);
                        
                        // Look for address patterns like "123 Main St #123, City, ST 12345" or "123 Main St, City, ST 12345"
                        const addressPattern = /(\d+[^,]+(?:#[^,]*)?),\s*([^,]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/g;
                        const matches = [...allText.matchAll(addressPattern)];
                        
                        if (matches.length > 0) {
                            const match = matches[0];
                            const [, street, city, state, zip] = match;
                            const generalAddress = {
                                street: street.trim(),
                                cityStateZip: `${city.trim()}, ${state} ${zip}`.trim()
                            };
                            
                            physicalRaw = generalAddress;
                            // Don't duplicate - leave mailingRaw as null when there's only one address
                            

                        }
                    }
                }
            }
        }

        const headerStatus = getText(document.querySelector('.btn-status-text')) || null;

        // Extract order state from order number or page content
        function getOrderState() {
            // Try to extract from order number format like "225072481270 - CA"
            const orderTitle = document.title;
            const orderMatch = orderTitle.match(/(\d+)\s*-\s*([A-Z]{2})/);
            if (orderMatch) {
                return orderMatch[2];
            }
            
            // Try to extract from page content - look for order number patterns
            const orderElements = Array.from(document.querySelectorAll('*')).filter(el => {
                const text = getText(el);
                return text && /\d+\s*-\s*[A-Z]{2}/.test(text);
            });
            
            for (const el of orderElements) {
                const text = getText(el);
                const match = text.match(/(\d+)\s*-\s*([A-Z]{2})/);
                if (match) {
                    return match[2];
                }
            }
            
            // Try to extract from page content - look for standalone state codes
            const stateElements = Array.from(document.querySelectorAll('*')).filter(el => {
                const text = getText(el);
                return text && /^\s*[A-Z]{2}\s*$/.test(text.trim());
            });
            
            if (stateElements.length > 0) {
                const stateText = getText(stateElements[0]).trim();
                if (stateText.length === 2) {
                    return stateText;
                }
            }
            
            // Fallback to formation state if no order state found
            return companyRaw ? companyRaw.formationState : null;
        }
        
        const orderState = getOrderState();
        console.log('[FENNEC (MVP) DB SB] Order state extraction:', {
            orderState: orderState,
            formationState: companyRaw ? companyRaw.formationState : null,
            title: document.title
        });
        
        const company = companyRaw ? {
            name: companyRaw.name,
            stateId: companyRaw.stateId,
            formationDate: companyRaw.formationDate,
            state: orderState || companyRaw.formationState, // Use order state, fallback to formation state
            formationState: companyRaw.formationState, // Keep formation state for reference
            status: companyRaw.status || headerStatus,
            purpose: companyRaw.purpose,
            address: null, // We'll handle address display separately in the sidebar
            physicalAddress: physicalRaw ? buildAddress(physicalRaw) : null,
            mailingAddress: mailingRaw ? buildAddress(mailingRaw) : null,
            // Store raw data for better rendering
            physicalRaw: physicalRaw,
            mailingRaw: mailingRaw
        } : (headerStatus ? { status: headerStatus } : null);
        

        

        

        

        

        
        // Additional validation: ensure addresses are not coming from wrong sources
        if (company && company.physicalAddress) {
            const physAddr = company.physicalAddress.toLowerCase();
            if (physAddr.includes('733 s manhattan') || physAddr.includes('unit 404')) {
                console.warn('[FENNEC (MVP) DB SB] WARNING: Physical address appears to be from member data instead of company data:', company.physicalAddress);
            }
        }
        if (company && company.mailingAddress) {
            const mailAddr = company.mailingAddress.toLowerCase();
            if (mailAddr.includes('733 s manhattan') || mailAddr.includes('unit 404')) {
                console.warn('[FENNEC (MVP) DB SB] WARNING: Mailing address appears to be from member data instead of company data:', company.mailingAddress);
            }
        }

        // 2. AGENT
        const agentRaw = extractSingle('#vagent .form-body', [
            {name: 'name', label: 'name'},
            {name: 'address', label: 'address'},
            {name: 'street', label: 'street'},
            {name: 'street1', label: 'street 1'},
            {name: 'street2', label: 'street 2'},
            {name: 'cityStateZipCountry', label: 'city, state, zip, country'},
            {name: 'cityStateZip', label: 'city, state, zip'},
            {name: 'country', label: 'country'},
            {name: 'status', label: 'registered agent service'},
            {name: 'status', label: 'subscription'},
            {name: 'expiration', label: 'expiration date'}
        ]);
        const agent = agentRaw ? {
            name: agentRaw.name,
            status: agentRaw.status,
            expiration: agentRaw.expiration,
            address: buildAddress(agentRaw)
        } : {};
        const hasAgentInfo = agent && (isValidField(agent.name) || isValidField(agent.address));



        // Detectar tipo de entidad para nombrar apropiadamente
        const entTypeEl = document.getElementById('entityType');
        const entityType = entTypeEl ? getText(entTypeEl).toLowerCase() : '';
        const isLLC = entityType.includes('llc');

        // 3. DIRECTORS/MEMBERS
        const directorsRaw = extractMembers('#vmembers .form-body', [
            {name: 'name', label: 'name'},
            {name: 'address', label: 'address'},
            {name: 'street', label: 'street'},
            {name: 'street1', label: 'street 1'},
            {name: 'street2', label: 'street 2'},
            {name: 'cityStateZipCountry', label: 'city, state, zip, country'},
            {name: 'cityStateZip', label: 'city, state, zip'},
            {name: 'country', label: 'country'}
        ]);
        const directors = directorsRaw.map(d => ({
            name: d.name,
            address: buildAddress(d)
        }));

        // 4. SHAREHOLDERS
        // Usamos extractMembers en lugar de extractRows porque cada
        // accionista se encuentra agrupado dentro de bloques `.row.m-b-10`.
        // De lo contrario se generaban objetos incompletos y duplicados.
        const shareholdersRaw = extractMembers('#vshareholders .form-body', [
            {name: 'name', label: 'name'},
            {name: 'address', label: 'address'},
            {name: 'street', label: 'street'},
            {name: 'street1', label: 'street 1'},
            {name: 'street2', label: 'street 2'},
            {name: 'cityStateZipCountry', label: 'city, state, zip, country'},
            {name: 'cityStateZip', label: 'city, state, zip'},
            {name: 'country', label: 'country'},
            {name: 'shares', label: 'share'}
        ]);
        const shareholders = shareholdersRaw.map(s => ({
            name: s.name,
            address: buildAddress(s),
            shares: s.shares
        }));

        // 5. OFFICERS
        let officers = extractOfficers('#vofficers .form-body');
        // Deduplicate officers that share the same name by merging their positions
        const officerMap = {};
        officers.forEach(o => {
            const key = o.name ? o.name.trim().toLowerCase() : '';
            if (!key) return;
            if (!officerMap[key]) {
                officerMap[key] = { name: o.name.trim(), address: o.address, positions: new Set() };
            }
            if (o.position) officerMap[key].positions.add(o.position.trim());
            if (!officerMap[key].address && o.address) officerMap[key].address = o.address;
        });
        const dedupedOfficers = Object.values(officerMap).map(o => ({ name: o.name, address: o.address, position: Array.from(o.positions).join(', ') }));
        officers = dedupedOfficers;

        const amendmentDetails = isAmendment ? extractAmendmentDetails() : null;

        // ---------- QUICK SUMMARY -------------
        const INTERNAL_NAME_PATTERNS = [/incfile/i, /republic registered agent/i];
        const INTERNAL_ADDR_PATTERNS = [/17350 state hwy 249/i];
        const isInternal = (name, addr) => {
            const text = (name || '') + ' ' + (addr || '');
            return INTERNAL_NAME_PATTERNS.some(re => re.test(text)) ||
                   INTERNAL_ADDR_PATTERNS.some(re => re.test(text));
        };

        const roleMap = {};
        const addRole = (name, role, addr) => {
            if (!name || !isValidField(name) || isInternal(name, addr)) return;
            const key = name.trim().toLowerCase();
            if (!roleMap[key]) roleMap[key] = { display: name.trim(), roles: new Set() };
            roleMap[key].roles.add(role);
        };

        if (agent && agent.name) addRole(agent.name, 'RA', agent.address);
        directors.forEach(d => addRole(d.name, isLLC ? 'MEMBER' : 'DIRECTOR', d.address));
        if (!isLLC) {
            shareholders.forEach(s => addRole(s.name, 'SHAREHOLDER', s.address));
            officers.forEach(o => {
                if (o.position) {
                    o.position.split(/[,/&]+|\band\b/i).forEach(p => {
                        let role = p.trim().toUpperCase();
                        if (!role) return;
                        role = role.replace(/\./g, '');
                        if (/^VICE/i.test(role) || /^VP/i.test(role)) role = 'VP';
                        addRole(o.name, role, o.address);
                    });
                } else {
                    addRole(o.name, 'OFFICER', o.address);
                }
            });
        }

        const client = getClientInfo();
        if (client && client.name) addRole(client.name, 'CLIENT');
        const billing = getBillingInfo();
        if (billing && billing.cardholder) addRole(billing.cardholder, 'BILLING');

        const addrs = [];
        const pushAddr = (label, addr, name) => {
            if (!isValidField(addr) || isInternal(name, addr)) return;
            addrs.push({ label, addr });
        };
        if (company) {
            pushAddr('Company', company.address, company.name);
            pushAddr('Company Physical', company.physicalAddress, company.name);
            pushAddr('Company Mailing', company.mailingAddress, company.name);
        }
        if (agent && agent.address) pushAddr('Agent', agent.address, agent.name);
        directors.forEach((d, i) => pushAddr(`${isLLC ? 'Member' : 'Director'} ${i+1}`, d.address, d.name));
        if (!isLLC) {
            shareholders.forEach((s, i) => pushAddr(`Shareholder ${i+1}`, s.address, s.name));
            officers.forEach((o, i) => pushAddr(`Officer ${i+1}`, o.address, o.name));
        }

        const normalizeAddr = a => {
            if (!a) return '';
            return a
                .toLowerCase()
                .replace(/[.,]/g, '')
                .replace(/\s+/g, ' ')
                .replace(/\s+(?:us|usa|united states(?: of america)?)$/, '')
                .trim();
        };
        const addrMap = {};
        addrs.forEach(({ label, addr }) => {
            const key = normalizeAddr(addr);
            if (!key) return;
            if (!addrMap[key]) addrMap[key] = { addr, labels: [] };
            addrMap[key].labels.push(label);
        });

        const orderItems = Array.from(document.querySelectorAll('.order-items li'))
            .map(li => getText(li).toLowerCase());

        // Registered Agent subscription status from #vagent section
        const hasRA = /^yes/i.test(agent.status || "");
        const raExpDate = agent.expiration ? parseDate(agent.expiration) : null;
        const raExpired = hasRA && raExpDate && raExpDate < new Date();

        // Virtual Address status from #vvirtual-address section or fallback button
        let hasVA = false;
        let vaBoxNumbers = []; // Store actual box numbers from VA section
        const vaSection = document.querySelector('#vvirtual-address');
        if (vaSection) {
            // Enhanced extraction of box numbers from the virtual address section
            const vaTable = vaSection.querySelector('table');
            if (vaTable) {
                const rows = Array.from(vaTable.querySelectorAll('tr'));
                rows.forEach(row => {
                    const cells = Array.from(row.querySelectorAll('td'));
                    cells.forEach(cell => {
                        const text = getText(cell).trim();
                        // Look for box/suite numbers in various formats
                        const boxPatterns = [
                            /#\s*(\d{3,})/, // #12345
                            /ste\s*(\d{3,})/i, // Ste 12345
                            /suite\s*(\d{3,})/i, // Suite 12345
                            /box\s*(\d{3,})/i, // Box 12345
                            /(\d{3,})/ // Just the number if it's in a suite column
                        ];
                        
                        for (const pattern of boxPatterns) {
                            const boxMatch = text.match(pattern);
                            if (boxMatch) {
                                const boxNum = boxMatch[1];
                                if (!vaBoxNumbers.includes(boxNum)) {
                                    vaBoxNumbers.push(boxNum);
                                    console.log('[FENNEC] Found VA box number:', boxNum, 'from text:', text);
                                }
                                break; // Use first match
                            }
                        }
                    });
                });
            }
            
            // Also check for suite numbers in the expanded VA details
            const vaDetails = vaSection.querySelectorAll('.form-body, .va-details, [class*="suite"], [class*="box"]');
            vaDetails.forEach(detail => {
                const text = getText(detail).trim();
                // Look for "Suite Number: #1011" pattern
                const suiteMatch = text.match(/suite\s*number\s*:\s*#?\s*(\d{3,})/i);
                if (suiteMatch) {
                    const boxNum = suiteMatch[1];
                    if (!vaBoxNumbers.includes(boxNum)) {
                        vaBoxNumbers.push(boxNum);
                        console.log('[FENNEC] Found VA suite number from details:', boxNum, 'from text:', text);
                    }
                }
            });
            
            // Also check for box numbers in other elements within the VA section
            const allVaElements = Array.from(vaSection.querySelectorAll('*'));
            allVaElements.forEach(el => {
                const text = getText(el).trim();
                
                // Look for "Suite Number: #1011" pattern specifically
                const suiteNumberMatch = text.match(/suite\s*number\s*:\s*#?\s*(\d{3,})/i);
                if (suiteNumberMatch) {
                    const boxNum = suiteNumberMatch[1];
                    if (!vaBoxNumbers.includes(boxNum)) {
                        vaBoxNumbers.push(boxNum);
                        console.log('[FENNEC] Found VA suite number from element:', boxNum, 'from text:', text);
                    }
                } else {
                    // Fallback to general box number pattern
                    const boxMatch = text.match(/#\s*(\d{3,})/);
                    if (boxMatch) {
                        const boxNum = boxMatch[1];
                        if (!vaBoxNumbers.includes(boxNum)) {
                            vaBoxNumbers.push(boxNum);
                            console.log('[FENNEC] Found VA box number from element:', boxNum, 'from text:', text);
                        }
                    }
                }
            });
            
            const vaTexts = Array.from(vaSection.querySelectorAll('td, span'))
                .map(el => getText(el).toLowerCase());
            hasVA = vaTexts.some(t => t.includes('active'));
            if (!hasVA && vaTexts.some(t => t.includes('inactive'))) {
                hasVA = false;
            }
        } else {
            const vaBtn = Array.from(document.querySelectorAll('button'))
                .find(b => /virtual address/i.test(getText(b)));
            if (vaBtn) {
                const txt = getText(vaBtn).toLowerCase();
                hasVA = txt.includes('active');
            }
        }

        console.log('[FENNEC] Virtual Address Analysis - hasVA:', hasVA, 'vaBoxNumbers:', vaBoxNumbers);

        const raClass = raExpired
            ? "copilot-tag copilot-tag-yellow"
            : (hasRA
                ? "copilot-tag copilot-tag-green"
                : "copilot-tag copilot-tag-purple");
        const vaClass = hasVA
            ? 'copilot-tag copilot-tag-green'
            : 'copilot-tag copilot-tag-purple';
        
        // Enhanced VA detection: check if address contains any of the known box numbers
        const isVAAddress = addr => {
            if (!hasVA || !addr) return false;
            
            // Extract box number from the address
            const addrBoxMatch = addr.match(/#\s*(\d{3,})/);
            if (!addrBoxMatch) return false; // No box number in address
            
            const addrBoxNum = addrBoxMatch[1];
            
            // Check if this box number matches any of the active VA box numbers
            const isMatchingVA = vaBoxNumbers.some(vaBoxNum => vaBoxNum === addrBoxNum);
            
            console.log('[FENNEC] VA Detection - Address:', addr, 'Address Box:', addrBoxNum, 'VA Boxes:', vaBoxNumbers, 'Is VA:', isMatchingVA);
            
            return isMatchingVA;
        };

        const addrValues = Object.values(addrMap);
        const addrEntries = addrValues
            .map(a => {
                const tags = a.labels.map(l => `<span class="copilot-tag">${escapeHtml(l)}</span>`).join(' ');
                return `<div style="margin-left:10px"><b>${renderAddress(a.addr, isVAAddress(a.addr))}</b><br>${tags}</div>`;
            });

        // Render del HTML
        let html = '';

        const summaryParts = [];
        const roleEntries = Object.values(roleMap)
            .map(r => {
                const name = renderCopy(r.display);
                if (!name) return null;
                const tags = Array.from(r.roles)
                    .map(role => `<span class="copilot-tag">${escapeHtml(role)}</span>`)
                    .join(' ');
                return `<div style="margin-left:10px"><b>${name}</b><br>${tags}</div>`;
            })
            .filter(Boolean);
        if (roleEntries.length) {
            summaryParts.push(...roleEntries);
        }
        if (addrEntries.length) {
            if (summaryParts.length) summaryParts.push('<hr style="border:none;border-top:1px solid #eee;margin:6px 0"/>');
            summaryParts.push(...addrEntries);
        }

        const quickSection = `
            <div class="white-box quick-summary-content" id="quick-summary" style="margin-bottom:10px">
                ${summaryParts.join('')}
            </div>
        `;
        html += quickSection;
        dbSections.push(quickSection);

        if (client && (client.id || client.name || client.email)) {
            const lines = [];
            if (client.name) {
                let nameLine = `<b>${renderName(client.name)}</b>`;
                if (client.id) {
                    const url = `${location.origin}/incfile/companies/${client.id}`;
                    nameLine += ` (<a href="${url}" class="copilot-link" target="_blank">${escapeHtml(client.id)}</a>)`;
                }
                lines.push(`<div>${nameLine}</div>`);
                const r = roleMap[client.name.trim().toLowerCase()];
                if (r && r.roles && r.roles.size) {
                    const tags = Array.from(r.roles)
                        .map(role => `<span class="copilot-tag">${escapeHtml(role)}</span>`)
                        .join(' ');
                    lines.push(`<div>${tags}</div>`);
                } else {
                    lines.push(`<div><span class="copilot-tag copilot-tag-purple">NOT LISTED</span></div>`);
                }
            }
            if (client.email || client.phone) {
                const parts = [];
                if (client.email) {
                    const emailHtml = `<a href="mailto:${encodeURIComponent(client.email)}" class="copilot-link">${escapeHtml(client.email)}</a>`;
                    parts.push(emailHtml);
                }
                if (client.phone) parts.push(escapeHtml(client.phone));
                lines.push(`<div>${parts.join(' \u2022 ')}</div>`);
            }
            const counts = [];
            if (client.orders) counts.push(`Companies: ${renderCopy(client.orders)}`);
            if (client.ltv) counts.push(`LTV: ${renderCopy(client.ltv)}`);
            if (counts.length) lines.push(`<div>${counts.join(' \u2022 ')}</div>`);
            const clientSection = `
            <div id="client-section-label" class="section-label">CLIENT:</div>
            <div id="client-section-box" class="white-box" style="margin-bottom:10px">
                ${lines.join('')}
            </div>`;
            html += clientSection;
            dbSections.push(clientSection);
        }

        function colorFor(result) {
            if (result === 'green') return 'copilot-tag-green';
            if (result === 'purple') return 'copilot-tag-purple';
            return 'copilot-tag-black';
        }

        function formatAvs(text) {
            const t = (text || '').toLowerCase();
            if (/^7\b/.test(t) || t.includes('both match')) {
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
            if (/^0\b/.test(t) || /^3\b/.test(t) || /^4\b/.test(t) || /^5\b/.test(t) ||
                t.includes('unavailable') || t.includes('not supported') || t.includes('no avs') || t.includes('unknown')) {
                return { label: 'AVS: UNKNOWN', result: 'black' };
            }
            return { label: 'AVS: UNKNOWN', result: 'black' };
        }

        if (billing) {
            const linesB = [];
            if (billing.cardholder) {
                linesB.push(`<div><b>${renderCopy(billing.cardholder)}</b></div>`);
            }
            const cardParts = [];
            if (billing.cardType) cardParts.push(renderCopy(billing.cardType));
            if (billing.last4) cardParts.push(renderCopy(billing.last4));
            if (billing.expiry) cardParts.push(renderCopy(formatExpiry(billing.expiry)));
            if (cardParts.length) linesB.push(`<div>${cardParts.join(' \u2022 ')}</div>`);
            if (billing.avs) {
                const { label, result } = formatAvs(billing.avs);
                const avsTag = `<span class="copilot-tag ${colorFor(result)}">${escapeHtml(label)}</span>`;
                linesB.push(`<div>${avsTag}</div>`);
            }
            const addr = renderBillingAddress(billing);
            if (addr) linesB.push(`<div>${addr}</div>`);
            const billingSection = `
            <div id="billing-section-label" class="section-label">BILLING:</div>
            <div id="billing-section-box" class="white-box" style="margin-bottom:10px">
                ${linesB.join('')}
            </div>`;
            html += billingSection;
            dbSections.push(billingSection);
        } else {
            addEmptySection('BILLING:');
        }

        if (currentOrderType !== 'formation') {
            html += `<div id="family-tree-orders" class="ft-collapsed"></div>`;
        }

        // COMPANY
        if (company) {
            const orderIdHighlight = getBasicOrderInfo().orderId;
            let addrHtml = '';
            const phys = company.physicalAddress;
            const mail = company.mailingAddress;
            

            
            
            
            // Handle address display logic
            console.log('[FENNEC] Address display debug - phys:', !!phys, 'mail:', !!mail, 'physicalRaw:', !!company.physicalRaw, 'mailingRaw:', !!company.mailingRaw);
            if (company.physicalRaw) console.log('[FENNEC] Physical raw data:', company.physicalRaw);
            if (company.mailingRaw) console.log('[FENNEC] Mailing raw data:', company.mailingRaw);
            
            if (phys && mail) {
                // Both addresses exist - show with labels and tags
                const physObj = company.physicalRaw || { street: phys };
                const mailObj = company.mailingRaw || { street: mail };
                addrLog('COMP render both - before build', { physObj, mailObj });
                
                // Enhanced address building that preserves box numbers
                const physBuilt = typeof physObj === 'string' ? buildAddress({ street: physObj }) : buildAddress(physObj);
                const mailBuilt = typeof mailObj === 'string' ? buildAddress({ street: mailObj }) : buildAddress(mailObj);
                
                // Fallback: if buildAddress returned only the street, pull City/State/ZIP values in order from the Company section
                let finalPhys = physBuilt;
                let finalMail = mailBuilt;
                const cszNodes = Array.from(document.querySelectorAll('#vcomp .form-body label')).filter(l => /city.*state.*zip/i.test(getText(l)));
                const cszValues = cszNodes.map(l => {
                    const row = l.closest('.row, .form-group, .col-md-12');
                    const valEl = row ? row.querySelector('.col-md-8 p, .col-md-8, .col-md-8 div, .col-md-8 span') : null;
                    return valEl ? getText(valEl) : '';
                }).filter(Boolean);
                const hasCSZ = s => /[A-Z]{2}\s+\d{5}/i.test(s);
                if (!hasCSZ(finalPhys) && cszValues[0]) finalPhys = `${physBuilt}, ${cszValues[0]}`;
                if (!hasCSZ(finalMail) && cszValues[1]) finalMail = `${mailBuilt}, ${cszValues[1]}`;
                
                // Enhanced address parsing that preserves box numbers
                const parseAddressWithBox = (addrStr) => {
                    if (!addrStr) return { street: '', cityStateZip: '' };
                    
                    // Look for box/suite patterns in the address
                    const boxPattern = /(.*?)(?:,\s*)?(?:ste|suite|#)\s*(\d{3,})(?:,\s*)?(.*)/i;
                    const match = addrStr.match(boxPattern);
                    
                    if (match) {
                        const street = match[1].trim();
                        const boxNum = match[2];
                        const rest = match[3] ? match[3].trim() : '';
                        return {
                            street: `${street}, Ste ${boxNum}`,
                            cityStateZip: rest
                        };
                    }
                    
                    // Fallback to simple comma split - ensure box numbers stay in street line
                    const parts = addrStr.split(',');
                    if (parts.length >= 2) {
                        const street = parts[0] || '';
                        const secondPart = parts[1] || '';
                        
                        // Check if second part contains a box number
                        const boxMatch = secondPart.match(/(?:ste|suite|#)\s*(\d{3,})/i);
                        if (boxMatch) {
                            // Box number is in second part, move it to street
                            const boxNum = boxMatch[1];
                            const cleanSecondPart = secondPart.replace(/(?:ste|suite|#)\s*\d{3,}/i, '').trim();
                            const rest = [cleanSecondPart, ...parts.slice(2)].join(',').trim();
                            return {
                                street: `${street}, Ste ${boxNum}`,
                                cityStateZip: rest
                            };
                        }
                    }
                    
                    // Default fallback
                    const street = parts[0] || '';
                    const rest = parts.slice(1).join(',').trim();
                    return { street, cityStateZip: rest };
                };
                
                const physParsed = parseAddressWithBox(finalPhys);
                const mailParsed = parseAddressWithBox(finalMail);
                
                // For mailing address, use the properly extracted data from mailingRaw if available
                let mailCsz = mailParsed.cityStateZip;
                if (company.mailingRaw && company.mailingRaw.cityStateZipCountry) {
                    mailCsz = company.mailingRaw.cityStateZipCountry;
                } else if (company.mailingRaw && company.mailingRaw.cityStateZip) {
                    mailCsz = company.mailingRaw.cityStateZip;
                }
                
                const physObj2 = { 
                    street: physParsed.street, 
                    cityStateZipCountry: physParsed.cityStateZip || physCsz 
                };
                const mailObj2 = { 
                    street: mailParsed.street, 
                    cityStateZipCountry: mailCsz 
                };
                
                addrLog('COMP render both - final objects', { physObj2, mailObj2 });
                addrLog('COMP mailing debug - mailingRaw:', company.mailingRaw, 'mailCsz:', mailCsz, 'cszValues:', cszValues);
                addrLog('COMP address objects - physObj2:', physObj2, 'mailObj2:', mailObj2);
                
                // Use enhanced VA detection that considers box numbers
                const physIsVA = isVAAddress(finalPhys) || isVAAddress(physParsed.street);
                const mailIsVA = isVAAddress(finalMail) || isVAAddress(mailParsed.street);
                
                addrHtml += `<div><b>Physical:</b> ${renderAddressFromObject(physObj2, physIsVA)}</div>`;
                addrHtml += `<div><b>Mailing:</b> ${renderAddressFromObject(mailObj2, mailIsVA)}</div>`;
            } else if (phys) {
                // Only physical address exists - show without tag
                const physBuilt = typeof (company.physicalRaw || phys) === 'string' ? buildAddress({ street: phys }) : buildAddress(company.physicalRaw || phys);
                // Check if this is a VA address and preserve box numbers
                const isPhysVA = isVAAddress(physBuilt);
                addrHtml = `<div>${isPhysVA ? renderAddress(physBuilt, true) : renderAddressWithoutTag(physBuilt)}</div>`;
            } else if (mail) {
                // Only mailing address exists - show without tag
                const mailBuilt = typeof (company.mailingRaw || mail) === 'string' ? buildAddress({ street: mail }) : buildAddress(company.mailingRaw || mail);
                // Check if this is a VA address and preserve box numbers
                const isMailVA = isVAAddress(mailBuilt);
                addrHtml = `<div>${isMailVA ? renderAddress(mailBuilt, true) : renderAddressWithoutTag(mailBuilt)}</div>`;
            } else if (company.address && company.address.trim()) {
                // Fallback to general company address only if it's not empty - show without tag
                const isAddrVA = isVAAddress(company.address);
                addrHtml = `<div>${isAddrVA ? renderAddress(company.address, true) : renderAddressWithoutTag(company.address)}</div>`;
            } else {
                // If no valid addresses found, show a placeholder
                addrHtml = `<div style="color:#aaa">No address information available</div>`;
            }
            
            const companyLines = [];
            const highlight = [];
            let nameText = escapeHtml(company.name);
            const nameBase = buildSosUrl(company.state, null, 'name');
            if (nameBase) {
                nameText = `<a href="#" class="copilot-sos" data-url="${nameBase}" data-query="${escapeHtml(company.name)}" data-type="name">${nameText}</a>`;
            }
            highlight.push(`<div><b>${nameText} ${renderCopyIcon(company.name)}</b></div>`);
            
            // STATE ID moved right after company name
            if (company.stateId && company.stateId.toLowerCase() !== 'n/a') {
                let idHtml = escapeHtml(company.stateId);
                const idBase = buildSosUrl(company.state, null, 'id');
                if (idBase) {
                    idHtml = `<a href="#" class="copilot-sos" data-url="${idBase}" data-query="${escapeHtml(company.stateId)}" data-type="id">${idHtml}</a>`;
                    idHtml += ' ' + renderCopyIcon(company.stateId);
                } else {
                    idHtml += ' ' + renderCopyIcon(company.stateId);
                }
                highlight.push(`<div><b>${idHtml}</b></div>`);
            }
            
            // Order type and status tags (without order ID)
            if (orderIdHighlight) {
                // Get order type and status
                const orderInfo = getBasicOrderInfo();
                const orderStatus = getOrderStatus();
                
                // Format order type - remove "BUSINESS FORMATION" for formation orders
                let typeLabel = '';
                let orderTypeText = currentOrderTypeText || orderInfo.type || '';
                
                if (orderTypeText) {
                    let displayType = orderTypeText;
                    // More aggressive cleaning of "BUSINESS FORMATION" text
                    if (orderTypeText.toLowerCase().includes('business formation')) {
                        // Extract just the package type (SILVER, GOLD, PLATINUM)
                        const packageMatch = orderTypeText.match(/(SILVER|GOLD|PLATINUM)/i);
                        if (packageMatch) {
                            displayType = packageMatch[1];
                        } else {
                            // Remove all variations of "Business Formation"
                            displayType = orderTypeText
                                .replace(/business\s*formation\s*[-–—]\s*/gi, '')
                                .replace(/business\s*formation\s*/gi, '')
                                .trim();
                        }
                    }
                    typeLabel = ` <span class="copilot-tag copilot-tag-white">${escapeHtml(displayType)}</span>`;
                }
                
                // Add status label if available
                let statusLabel = '';
                if (orderStatus.status) {
                    statusLabel = ` <span class="copilot-tag ${orderStatus.statusClass}">${escapeHtml(orderStatus.status)}</span>`;
                } else if (orderInfo.status) {
                    // Fallback to status from getBasicOrderInfo
                    const statusText = orderInfo.status.toLowerCase();
                    let statusClass = '';
                    if (statusText.includes('review')) {
                        statusClass = 'copilot-tag-review';
                    } else if (statusText.includes('processing')) {
                        statusClass = 'copilot-tag-processing';
                    } else if (statusText.includes('hold')) {
                        statusClass = 'copilot-tag-hold';
                    } else if (statusText.includes('forwarded')) {
                        statusClass = 'copilot-tag-forwarded';
                    } else if (statusText.includes('shipped')) {
                        statusClass = 'copilot-tag-shipped';
                    } else if (statusText.includes('canceled') || statusText.includes('cancelled')) {
                        statusClass = 'copilot-tag-canceled';
                    }
                    
                    if (statusClass) {
                        statusLabel = ` <span class="copilot-tag ${statusClass}">${escapeHtml(orderInfo.status.toUpperCase())}</span>`;
                    }
                }
                
                console.log('[FENNEC] Order type and status debug:', { 
                    orderTypeText, 
                    displayType: typeLabel ? 'YES' : 'NO', 
                    orderStatus: orderStatus.status, 
                    orderInfoStatus: orderInfo.status,
                    statusLabel: statusLabel ? 'YES' : 'NO' 
                });
                
                // Order type and status tags on their own line (ORDER ID REMOVED)
                if (typeLabel || statusLabel) {
                    const tagsLine = [];
                    if (typeLabel) tagsLine.push(typeLabel);
                    if (statusLabel) tagsLine.push(statusLabel);
                    highlight.push(`<div>${tagsLine.join(' ')}</div>`);
                }
            }
            if (company.formationDate && company.formationDate.toLowerCase() !== 'n/a') {
                highlight.push(`<div><b>${escapeHtml(company.formationDate)}</b></div>`);
            }
            const searchIcon = '<span class="company-search-toggle">🔍</span>';
            // Move state inside the lightbox
            const stateHtml = company.state ? `<div>${renderKb(company.state)}</div>` : '';
            companyLines.push(`<div class="company-summary-highlight">${highlight.join('')}${stateHtml}${searchIcon}</div>`);
            companyLines.push(addrHtml);

            companyLines.push(`<div class="company-purpose">${renderCopy(company.purpose)}</div>`);
            // Check if VA is active but not being used in any address
            const vaNotUsed = hasVA && vaBoxNumbers.length > 0 && !isVAAddress(company.physicalAddress) && !isVAAddress(company.mailingAddress);
            
            companyLines.push(
                `<div><span class="${raClass}">RA: ${raExpired ? "EXPIRED" : (hasRA ? "Sí" : "No")}</span> ` +
                `<span class="${vaClass}">VA: ${hasVA ? "Sí" : "No"}</span></div>`
            );
            
            // Add VA not being used legend if applicable
            if (vaNotUsed) {
                companyLines.push(`<div style="font-size: 9px; color: #888; margin-top: 2px;">VA IS NOT BEING USED</div>`);
            }
            const stateAttr = company.state ? ` data-state="${escapeHtml(company.state)}"` : '';
            const compSection = `<div class="section-label">COMPANY:</div><div class="white-box company-box"${stateAttr} style="margin-bottom:10px">${companyLines.join('').trim()}</div>`;
            console.log('[FENNEC] DB PRINT - Company section HTML:', compSection);
            if (companyLines.length) {
                html += compSection;
                dbSections.push(compSection);
            } else {
                addEmptySection('COMPANY:');
            }
        } else {
            addEmptySection('COMPANY:');
        }
        // AGENT
        if (hasAgentInfo) {
            const expDate = agent.expiration ? parseDate(agent.expiration) : null;
            const expired = expDate && expDate < new Date();
            let status = (agent.status || "").trim();
            let statusClass = "copilot-tag";
            let statusDisplay = "";
            const showStatus = isInternal(agent.name, agent.address);
            if (/^yes/i.test(status)) {
                statusClass += " copilot-tag-green";
                statusDisplay = `Active${agent.expiration ? ` (${escapeHtml(agent.expiration)})` : ""}`;
            } else if (/resigned|staged for resignatio/i.test(status) || expired) {
                statusClass += " copilot-tag-red";
                statusDisplay = `Resigned${agent.expiration ? ` (${escapeHtml(agent.expiration)})` : ""}`;
            } else if (status && !/no service/i.test(status)) {
                statusDisplay = `${status}${agent.expiration ? ` (${escapeHtml(agent.expiration)})` : ""}`;
            }
            const statusHtml = statusDisplay ? `<span class="${statusClass}">${escapeHtml(statusDisplay)}</span>`
                                              : '<span style="color:#aaa">-</span>';
            const agentLines = [];
            const nameHtml = renderName(agent.name);
            if (nameHtml) agentLines.push(`<div><b>${nameHtml}</b></div>`);
            
            // For active agents, show RA tag instead of envelope/copy icons
            const isActiveAgent = /^yes/i.test(status);
            if (isActiveAgent) {
                // Show address with RA tag (like VA tag)
                const addrHtml2 = renderAddress(agent.address, false); // Don't use VA detection for agents
                if (addrHtml2) {
                    // Replace the envelope/copy icons with RA tag
                    const addrWithRATag = addrHtml2.replace(
                        /<span class="copilot-usps".*?<\/span><span class="copilot-copy-icon".*?<\/span>/,
                        ' <span class="copilot-tag copilot-tag-green">RA</span>'
                    );
                    agentLines.push(`<div>${addrWithRATag}</div>`);
                }
            } else {
                // Show normal address with envelope/copy icons for inactive agents
                const addrHtml2 = renderAddress(agent.address, isVAAddress(agent.address));
                if (addrHtml2) agentLines.push(`<div>${addrHtml2}</div>`);
            }
            
            if (showStatus) agentLines.push(`<div>${statusHtml}</div>`);
            if (agentLines.length) {
                const agentSection = `
            <div class="section-label">AGENT:</div>
            <div class="white-box" style="margin-bottom:10px">
                ${agentLines.join('')}
            </div>`;
                html += agentSection;
                dbSections.push(agentSection);
            } else {
                addEmptySection('AGENT:', 'NO RA INFO');
            }
        } else {
            addEmptySection('AGENT:', 'NO RA INFO');
        }
        // DIRECTORS / MEMBERS
        if (directors.length) {
            const dirSection = `
            <div class="section-label">${isLLC ? 'MEMBERS:' : 'DIRECTORS:'}</div>
            <div class="white-box" style="margin-bottom:10px">
                ${directors.map(d => `
                    <div><b>${renderName(d.name)}</b></div>
                    <div>${renderAddress(d.address, isVAAddress(d.address))}</div>
                `).join('<hr style="border:none; border-top:1px solid #eee; margin:6px 0"/>')}
            </div>`;
            html += dirSection;
            dbSections.push(dirSection);
        } else {
            addEmptySection(isLLC ? 'MEMBERS:' : 'DIRECTORS:');
        }
        if (!isLLC) {
            // SHAREHOLDERS
            if (shareholders.length) {
                const shSection = `
                <div class="section-label">SHAREHOLDERS:</div>
                <div class="white-box" style="margin-bottom:10px">
                    ${shareholders.map(s => {
                        const name = `<div><b>${renderName(s.name)}</b></div>`;
                        const addr = `<div>${renderAddress(s.address, isVAAddress(s.address))}</div>`;
                        const shares = renderCopy(s.shares);
                        const shareLine = shares ? `<div>Shares: ${shares}</div>` : '';
                        return `${name}${addr}${shareLine}`;
                    }).join('<hr style="border:none; border-top:1px solid #eee; margin:6px 0"/>')}
                </div>`;
                html += shSection;
                dbSections.push(shSection);
            } else {
                addEmptySection('SHAREHOLDERS:');
            }
            // OFFICERS
            if (officers.length) {
                const offSection = `
                <div class="section-label">OFFICERS:</div>
                <div class="white-box" style="margin-bottom:10px">
                    ${officers.map(o => {
                        const addrLine = o.address && o.address !== '-' ? `<div>${renderAddress(o.address, isVAAddress(o.address))}</div>` : '';
                        return `
                            <div><b>${renderName(o.name)}</b></div>
                            ${addrLine}
                            <div>${renderCopy(o.position)}</div>
                        `;
                    }).join('<hr style="border:none; border-top:1px solid #eee; margin:6px 0"/>')}
                </div>`;
                html += offSection;
                dbSections.push(offSection);
            } else {
                addEmptySection('OFFICERS:');
            }
        }
        if (isAmendment) {
            if (amendmentDetails) {
            const amendSection = `
            <div class="section-label">AMENDMENT DETAILS:</div>
            <div class="white-box" style="margin-bottom:10px">
                ${formatAmendmentDetails(amendmentDetails)}
            </div>`;
            html += amendSection;
            dbSections.push(amendSection);
            } else {
                addEmptySection('AMENDMENT DETAILS:');
            }
        }

        // INT STORAGE is now handled in its own dedicated section in the sidebar template
        // Removed from dbSections to avoid duplication
        // Add new box for MAIN and MISC orders
        if (currentOrderTypeText && (/main/i.test(currentOrderTypeText) || /misc/i.test(currentOrderTypeText))) {
            const mainMiscBox = `<div class="white-box" style="margin-bottom:10px;text-align:center;"><b>New Box for ${/main/i.test(currentOrderTypeText) ? 'MAIN' : 'MISC'} Order</b></div>`;
            html += mainMiscBox;
            dbSections.push(mainMiscBox);
        }

        if (reviewMode) {
            const grab = label => {
                const idx = dbSections.findIndex(s => s.includes(label));
                return idx >= 0 ? dbSections.splice(idx, 1)[0] : '';
            };
            const ordered = [];
            const company = grab('COMPANY:');
            if (company) ordered.push(company);
            const quick = grab('id="quick-summary"');
            if (quick) ordered.push(quick);
            const billing = grab('BILLING:');
            if (billing) ordered.push(billing);
            const client = grab('CLIENT:');
            if (client) ordered.push(client);
            const agent = grab('AGENT:');
            if (agent) ordered.push(agent);
            const members = grab('MEMBERS:') || grab('DIRECTORS:');
            if (members) ordered.push(members);
            const sh = grab('SHAREHOLDERS:');
            if (sh) ordered.push(sh);
            const off = grab('OFFICERS:');
            if (off) ordered.push(off);
            ordered.push(...dbSections);
            dbSections = ordered;
            html = dbSections.join('');
        }
        if (!html) {
            html = `<div style="text-align:center; color:#aaa; margin-top:40px">No se encontró información relevante de la orden.</div>`;
        }
        
        // Always add INT STORAGE section to the HTML 
        html += `
            <div id="int-storage-section" style="display:none; margin-top:10px;">
                <div class="section-label">INT STORAGE:</div>
                <div id="int-storage-box" class="white-box" style="margin-bottom:10px">
                    <div style="text-align:center;color:#aaa">Loading<span class="loading-dots">...</span></div>
                </div>
            </div>
        `;
        if (devMode) {
            if (reviewMode) {
                html += `<div class="copilot-footer"><button id="filing-xray" class="copilot-button">🤖 FILE</button></div>`;
            }
            html += `<div class="copilot-footer"><button id="copilot-refresh" class="copilot-button">🔄 REFRESH</button></div>`;
            html += `
            <div id="mistral-chat" class="mistral-box">
                <div id="mistral-log" class="mistral-log"></div>
                <div class="mistral-input-row">
                    <input id="mistral-input" type="text" placeholder="Ask Mistral..." />
                    <button id="mistral-send" class="copilot-button">Send</button>
                </div>
            </div>`;
        }
        html += `<div id="review-mode-label" class="review-mode-label" style="display:none; margin-top:4px; text-align:center; font-size:11px;">REVIEW MODE</div>`;

        const orderInfo = getBasicOrderInfo();
        const sidebarOrderInfo = {
            orderId: orderInfo.orderId,
            type: currentOrderTypeText || orderInfo.type,
            expedited: isExpeditedOrder(),
            companyName: company ? company.name : null,
            companyId: company ? company.stateId : null,
            companyState: company ? company.state : null,
            formationDate: company ? company.formationDate : null,
            registeredAgent: hasAgentInfo ? { name: agent.name, address: agent.address } : null,
            members: directors,
            isLLC,
            billing,
            hasVA,
            hasRA,
            raExpired,
            orderCost: getOrderCost(),
            clientLtv: client.ltv,
            clientEmail: client.email,
            clientName: client.name
        };
        sessionSet({
            sidebarDb: dbSections,
            sidebarOrderId: orderInfo.orderId,
            sidebarOrderInfo
        });

        const body = document.getElementById('copilot-body-content');
        if (body) {
            body.innerHTML = html;
            
            // Initialize quick summary state
            const box = body.querySelector('#quick-summary');
            if (box) {
                box.style.maxHeight = '0px';
                box.classList.add('quick-summary-collapsed');
            }
            
            attachCommonListeners(body);
            
            // Ensure company box listeners are properly attached
            if (typeof ensureCompanyBoxListeners === 'function') {
                console.log('[FENNEC (MVP) DB SB] Ensuring company box listeners are attached');
                ensureCompanyBoxListeners();
            }
            
            // Re-attach listeners after a short delay to ensure all content is rendered
            setTimeout(() => {
                attachCommonListeners(body);
                if (typeof ensureCompanyBoxListeners === 'function') {
                    ensureCompanyBoxListeners();
                }
            }, 100);
            
            insertDnaAfterCompany();
            if (typeof applyStandardSectionOrder === 'function') {
                applyStandardSectionOrder(body.querySelector('#db-summary-section'));
            }
            initMistralChat();
            updateReviewDisplay();
            if (typeof checkLastIssue === 'function') {
                checkLastIssue(orderInfo.orderId);
            }
            
            // Setup global drag and drop for INT STORAGE uploads
            setupGlobalIntStorageDrop(body, orderInfo.orderId);
            
            console.log('[FENNEC (MVP) DB SB] About to load INT STORAGE from extractAndShowFormationData with orderId:', orderInfo.orderId);
            loadIntStorage(orderInfo.orderId);
            // Store INT STORAGE data to share with other environments
            chrome.storage.local.set({ 
                intStorageLoaded: true, 
                intStorageOrderId: orderInfo.orderId 
            });
            if (miscMode) {
                console.log('[FENNEC (MVP)] MISC mode detected in extractAndShowFormationData, auto-opening family tree');
                // Use multiple attempts to ensure family tree opens
                const attemptAutoOpen = (attempt = 1) => {
                    console.log(`[FENNEC (MVP)] Auto-open attempt ${attempt} for MISC order`);
                    const ftIcon = document.getElementById('family-tree-icon');
                    if (ftIcon && ftIcon.style.display !== 'none') {
                        console.log('[FENNEC (MVP)] Family tree icon found and visible, triggering auto-open');
                        autoOpenFamilyTree();
                    } else if (attempt < 5) {
                        console.log(`[FENNEC (MVP)] Family tree icon not ready, retrying in ${attempt * 500}ms`);
                        setTimeout(() => attemptAutoOpen(attempt + 1), attempt * 500);
                    } else {
                        console.warn('[FENNEC (MVP)] Family tree icon not found after 5 attempts');
                    }
                };
                
                // Start the auto-open process with a delay
                setTimeout(() => {
                    requestAnimationFrame(() => {
                        attemptAutoOpen();
                    });
                }, 1500);
            } else {
                console.log('[FENNEC (MVP)] Not MISC mode in extractAndShowFormationData, miscMode:', miscMode, 'orderType:', currentOrderTypeText);
            }
        }
    }

    function extractAndShowAmendmentData() {
        extractAndShowFormationData(true);
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
            return `<tr><td><span class="dna-label ${cls}">${label}${count}</span></td><td>${escapeHtml(amount)}${escapeHtml(pctText)}</td></tr>`;
        }).join("");
        return `<table class="dna-tx-table"><thead><tr><th>Type</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>`;
    }

    function buildCardMatchTag(info) {
        const db = info.dbBilling || {};
        const dna = info.payment ? info.payment.card || {} : {};
        const dbName = (db.cardholder || "").toLowerCase();
        const dnaName = (dna["Card holder"] || "").toLowerCase();
        const dbDigits = (db.last4 || "").replace(/\D+/g, "");
        const dnaDigits = (dna["Card number"] || "").replace(/\D+/g, "");
        const dbExp = (db.expiry || "").replace(/\D+/g, "");
        const dnaExp = (dna["Expiry date"] || "").replace(/\D+/g, "");
        let match = dbName && dnaName && dbName === dnaName;
        match = match && dbDigits && dnaDigits && dbDigits === dnaDigits;
        match = match && dbExp && dnaExp && dbExp === dnaExp;
        if (!dbName && !dbDigits && !dbExp) return "";
        const cls = match ? "copilot-tag-green" : "copilot-tag-purple";
        const text = match ? "DB MATCH" : "DB MISMATCH";
        return `<span class="copilot-tag ${cls}">${text}</span>`;
    }

    function buildDnaHtml(info) {
        if (!info || !info.payment) return null;
        const p = info.payment;
        const card = p.card || {};
        const shopper = p.shopper || {};
        const proc = p.processing || {};
        const parts = [];
        if (card["Card holder"]) {
            const holder = `<b>${escapeHtml(card["Card holder"])}</b>`;
            parts.push(`<div>${holder}</div>`);
        }
        const cardLine = [];
        if (card["Payment method"]) cardLine.push(escapeHtml(card["Payment method"]));
        if (card["Card number"]) {
            const digits = card["Card number"].replace(/\D+/g, "").slice(-4);
            if (digits) cardLine.push(escapeHtml(digits));
        }
        function formatExpiry(date) {
            if (!date) return "";
            const digits = date.replace(/\D+/g, "");
            if (digits.length >= 4) {
                const mm = digits.slice(0, 2);
                const yy = digits.slice(-2);
                return `${mm}/${yy}`;
            }
            return date;
        }
        if (card["Expiry date"]) cardLine.push(escapeHtml(formatExpiry(card["Expiry date"])));
        if (card["Funding source"]) cardLine.push(escapeHtml(card["Funding source"]));
        if (cardLine.length) parts.push(`<div>${cardLine.join(' \u2022 ')}</div>`);
        if (shopper["Billing address"]) {
            parts.push(`<div class="dna-address">${renderBillingAddress(shopper["Billing address"])}</div>`);
            if (card["Issuer name"] || card["Issuer country/region"]) {
                let bank = (card["Issuer name"] || '').trim();
                if (bank.length > 25) bank = bank.slice(0, 22) + '...';
                const country = (card["Issuer country/region"] || '').trim();
                let countryInit = '';
                if (country) {
                    countryInit = country.split(/\s+/).map(w => w.charAt(0)).join('').toUpperCase();
                    countryInit = ` (<span class="dna-country"><b>${escapeHtml(countryInit)}</b></span>)`;
                }
                parts.push(`<div class="dna-issuer">${escapeHtml(bank)}${countryInit}</div>`);
            }
        }
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
        if (proc['Fraud scoring']) parts.push(`<div><b>Fraud scoring:</b> ${escapeHtml(proc['Fraud scoring'])}</div>`);
        if (parts.length) {
            parts.push('<hr style="border:none;border-top:1px solid #555;margin:6px 0"/>');
        }
        const txTable = buildTransactionTable(info.transactions || {});
        if (txTable) parts.push(txTable);
        if (!parts.length) return null;
        return `<div class="section-label">ADYEN'S DNA</div><div class="white-box" style="margin-bottom:10px">${parts.join('')}</div>`;
    }

    function loadDnaSummary() {
        const container = document.getElementById('dna-summary');
        if (!container) return;
        chrome.storage.local.get({ adyenDnaInfo: null }, ({ adyenDnaInfo }) => {
            const html = buildDnaHtml(adyenDnaInfo);
            container.innerHTML = html || '';
            attachCommonListeners(container);
            insertDnaAfterCompany();
        });
    }

    // Expose for other scripts that may call it
    window.loadDnaSummary = loadDnaSummary;

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
            
            // Handle new KOUNT 360 EKATA structure
            if (e.scores && typeof e.scores === 'object') {
                const scoreParts = [];
                Object.entries(e.scores).forEach(([key, value]) => {
                    if (value && value !== '--') {
                        const label = key.replace('ekata.', '').replace(/([A-Z])/g, ' $1').trim();
                        scoreParts.push(`<div><b>${label}:</b> ${escapeHtml(value)}</div>`);
                    }
                });
                if (scoreParts.length) {
                    parts.push(`<div><b>EKATA SCORES</b><br>${scoreParts.join('')}</div>`);
                }
            }
            
            // Handle legacy EKATA data structure
            const ipLine = e.ipValid || e.proxyRisk ? `<div><b>IP Valid:</b> ${escapeHtml(e.ipValid || '')} <b>Proxy:</b> ${escapeHtml(e.proxyRisk || '')}</div>` : '';
            const addrLine = e.addressToName || e.residentName ? `<div><b>Address to Name:</b> ${escapeHtml(e.addressToName || '')}<br><b>Resident Name:</b> ${escapeHtml(e.residentName || '')}</div>` : '';
            if (ipLine) parts.push(ipLine);
            if (addrLine) parts.push(addrLine);
        }
        if (!parts.length) return null;
        return `<div class="section-label">KOUNT</div><div class="white-box" style="margin-bottom:10px">${parts.join('')}</div>`;
    }

    function loadKountSummary() {
        const container = document.getElementById('kount-summary');
        if (!container) return;
        chrome.storage.local.get({ kountInfo: null }, ({ kountInfo }) => {
            const html = buildKountHtml(kountInfo);
            container.innerHTML = html || '';
            attachCommonListeners(container);
            insertDnaAfterCompany();
        });
    }

    // Expose for other scripts
    window.loadKountSummary = loadKountSummary;

    const insertDnaAfterCompany = window.insertDnaAfterCompany;

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
        if (!section || !box || !content || !label) return;
        section.style.display = 'block';
        if (info && info.text) {
            content.textContent = formatIssueText(info.text);
            label.textContent = info.active ? 'ACTIVE' : 'RESOLVED';
            label.className = 'issue-status-label ' + (info.active ? 'issue-status-active' : 'issue-status-resolved');
        } else {
            const link = orderId ? `<a href="https://db.incfile.com/incfile/order/detail/${orderId}" target="_blank">${orderId}</a>` : '';
            content.innerHTML = `NO ISSUE DETECTED FROM ORDER: ${link}`;
            label.textContent = '';
            label.className = 'issue-status-label';
        }
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
        try {
            const info = getLastIssueInfo();
            fillIssueBox(info, orderId);
        } catch (err) {
            console.warn('[FENNEC (MVP)] Issue extraction failed:', err);
            fillIssueBox(null, orderId);
        }
    }
    window.checkLastIssue = checkLastIssue;

    function clearSidebar() {
        console.log('[FENNEC (MVP) DB SB] Clearing all storage and resetting sidebar to brand new state');
        
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
            fennecActiveSession: null
        });
        
        // Clear session storage
        sessionStorage.removeItem('fennecSidebarClosed');
        sessionStorage.removeItem('fennecShowTrialFloater');
        sessionStorage.removeItem('fennecCancelPending');
        
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
            'fennecActiveSession'
        ], () => {
            console.log('[FENNEC (MVP) DB SB] Cleared all storage data during sidebar clear');
        });
        
        // Clear any INT STORAGE data
        window.currentIntStorageOrderId = null;
        
        // Reset sidebar content
        const body = document.getElementById('copilot-body-content');
        if (body) body.innerHTML = '<div style="text-align:center; color:#aaa; margin-top:40px">No DB data.</div>';
        
        const dnaContainer = document.getElementById('dna-summary');
        if (dnaContainer) dnaContainer.innerHTML = '';
        
        const issueContent = document.getElementById('issue-summary-content');
        const issueLabel = document.getElementById('issue-status-label');
        if (issueContent) issueContent.innerHTML = 'No issue data yet.';
        if (issueLabel) {
            issueLabel.textContent = '';
            issueLabel.className = 'issue-status-label';
        }
        
        // Clear INT STORAGE section if it exists
        const intStorageBox = document.getElementById('int-storage-box');
        if (intStorageBox) {
            intStorageBox.innerHTML = '<div style="text-align:center;color:#aaa">No INT STORAGE data.</div>';
        }
        
        updateReviewDisplay();
        
        console.log('[FENNEC (MVP) DB SB] Sidebar cleared and reset to brand new state');
    }

    function getBillingInfo() {
        const raw = extractSingle('#vbilling .form-body', [
            {name: 'cardholder', label: 'cardholder'},
            {name: 'cardType', label: 'card type'},
            {name: 'expiry', label: 'expiration'},
            {name: 'last4', label: 'last 4'},
            {name: 'street', label: 'street'},
            {name: 'street1', label: 'street 1'},
            {name: 'street2', label: 'street 2'},
            {name: 'cityStateZipCountry', label: 'city, state, zip, country'},
            {name: 'cityStateZip', label: 'city, state, zip'},
            {name: 'country', label: 'country'},
            {name: 'address', label: 'address'}
        ]);
        if (!raw) return null;
        return {
            cardholder: raw.cardholder,
            cardType: raw.cardType,
            expiry: raw.expiry,
            last4: raw.last4,
            address: buildAddress(raw),
            street1: raw.street1 || raw.street || raw.address,
            street2: raw.street2,
            cityStateZipCountry: raw.cityStateZipCountry,
            cityStateZip: raw.cityStateZip,
            country: raw.country,
            avs: raw.avs
        };
    }
    });

    function openCancelPopup() {
        const statusBtn = document.querySelector('.btn-status-text');
        if (!statusBtn) return console.warn('[FENNEC (MVP)] Status dropdown not found');
        statusBtn.click();
        setTimeout(() => {
            const cancelLink = Array.from(document.querySelectorAll('.dropdown-menu a'))
                .find(a => /cancel.*refund/i.test(a.textContent));
            if (!cancelLink) return console.warn('[FENNEC (MVP)] Cancel option not found');
            sessionStorage.removeItem('fennecCancelPending');
            cancelLink.click();
            selectCancelReason();
            fillCancelDescription();
        }, 500);
    }

    function selectCancelReason() {
        const sel = document.querySelector('select');
        if (!sel) return setTimeout(selectCancelReason, 500);
        const opt = Array.from(sel.options)
            .find(o => /other/i.test(o.textContent));
        if (opt) {
            sel.value = opt.value;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    function fillCancelDescription() {
        const ta = document.querySelector('textarea');
        if (!ta) return setTimeout(fillCancelDescription, 500);
        ta.value = 'DUPLICATE ORDER';
    }

    function clickFraudReviewButton() {
        const btn = document.getElementById('fraud_review_action');
        if (!btn) return;
        
        // Click the fraud review button
        btn.click();
        
        // Wait for the confirmation dialog to appear and click YES
        const waitForConfirmation = () => {
            const modal = document.querySelector('.modal-dialog');
            const yesBtn = document.getElementById('fraud-review-yes-button');
            
            if (modal && yesBtn) {
                console.log('[FENNEC (MVP) DB SB] Found fraud review confirmation dialog, clicking YES');
                yesBtn.click();
            } else {
                // Retry after a short delay
                setTimeout(waitForConfirmation, 200);
            }
        };
        
        // Start waiting for the confirmation dialog
        setTimeout(waitForConfirmation, 500);
    }

    function formatDateLikeParent(text) {
        const d = new Date(text);
        if (isNaN(d)) return text;
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric'
        });
    }

    function startCancelProcedure() {
        const btn = Array.from(document.querySelectorAll('a'))
            .find(a => /mark resolved/i.test(a.textContent));
        if (btn) {
            sessionStorage.setItem('fennecCancelPending', '1');
            btn.click();
        } else {
            openCancelPopup();
        }
    }

    function autoResolveIssue(comment, cb) {
        const clickResolve = () => {
            const btn = Array.from(document.querySelectorAll('a'))
                .find(a => /mark resolved/i.test(a.textContent));
            if (btn) {
                sessionStorage.setItem('fennecAutoComment', comment);
                btn.click();
                fillComment();
            } else {
                setTimeout(clickResolve, 500);
            }
        };
        const fillComment = () => {
            const modal = document.getElementById('modalUpdateIssue');
            const ta = modal ? modal.querySelector('#comment') : null;
            const save = modal ? modal.querySelector("a[onclick*='update-issue']") : null;
            if (ta && save) {
                ta.value = comment;
                save.click();
                sessionStorage.removeItem('fennecAutoComment');
                sessionStorage.setItem('fennecAddComment', comment);
                sessionSet({
                    fennecQuickResolveDone: {
                        time: Date.now(),
                        resolved: true,
                        comment
                    }
                }, cb);
            } else {
                setTimeout(fillComment, 500);
            }
        };
        clickResolve();
    }

    function addOrderComment(comment, cb) {
        const openModal = () => {
            const btn = Array.from(document.querySelectorAll('a,button'))
                .find(el => /modalAddNote/.test(el.getAttribute('onclick') || ''));
            if (btn) {
                btn.click();
                fill();
            } else {
                setTimeout(openModal, 500);
            }
        };
        const fill = () => {
            const modal = document.getElementById('modalAddNote');
            const ta = modal ? modal.querySelector('#commentText') : null;
            const add = modal ? modal.querySelector('#btnTextSaveComment') : null;
            if (ta && add) {
                ta.value = comment;
                add.click();
                sessionSet({
                    fennecQuickResolveDone: {
                        time: Date.now(),
                        resolved: false,
                        comment
                    }
                }, cb);
            } else {
                setTimeout(fill, 500);
            }
        };
        openModal();
    }

    function processPendingComment(data) {
        if (!data) return;
        const info = getBasicOrderInfo();
        if (!info.orderId || String(data.orderId) !== String(info.orderId)) return;
        chrome.storage.local.remove('fennecPendingComment');
        const issue = getLastIssueInfo();
        
        // Handle fraud review removal for identity confirmation issues
        const after = () => { 
            if (data.release) setTimeout(clickFraudReviewButton, 500); 
        };
        
        // If removeFraudReview flag is set, also click the fraud review button
        const afterWithFraudRemoval = () => {
            if (data.release) setTimeout(clickFraudReviewButton, 500);
            if (data.removeFraudReview) {
                // Use the improved clickFraudReviewButton function which handles the confirmation dialog
                setTimeout(clickFraudReviewButton, 1000);
            }
        };
        
        if (issue && issue.active) {
            if (data.cancel) sessionStorage.setItem('fennecCancelPending', '1');
            autoResolveIssue(data.comment, data.removeFraudReview ? afterWithFraudRemoval : after);
        } else {
            if (data.comment) {
                addOrderComment(data.comment, data.removeFraudReview ? afterWithFraudRemoval : after);
            } else {
                (data.removeFraudReview ? afterWithFraudRemoval : after)();
            }
            if (data.cancel) setTimeout(openCancelPopup, 1500);
        }
    }

    function processPendingUpload(data) {
        if (!data) return;
        const info = getBasicOrderInfo();
        if (!info.orderId || String(data.orderId) !== String(info.orderId)) return;
        const m = location.pathname.match(/\/storage\/incfile\/(\d+)/);
        if (!m) return;
        chrome.storage.local.remove('fennecPendingUpload');
        const token = document.querySelector('meta[name="csrf-token"]');
        const csrf = token ? token.getAttribute('content') : '';
        const files = Array.isArray(data.files) ? data.files
            : [{ fileName: data.fileName, fileData: data.fileData, origName: data.origName, converted: data.converted }];
        const uploadNext = () => {
            if (!files.length) {
                if (data.comment || data.release) {
                    processPendingComment({ orderId: data.orderId, comment: data.comment, cancel: data.cancel, release: data.release });
                }
                return;
            }
            const file = files.shift();
            fetch(file.fileData).then(r => r.blob()).then(blob => {
                const form = new FormData();
                form.append('file', blob, file.fileName);
                return fetch(`/storage/incfile/${data.orderId}/create`, {
                    method: 'POST',
                    body: form,
                    headers: { 'X-CSRF-TOKEN': csrf },
                    credentials: 'include'
                });
            }).then(() => {
                sessionSet({ fennecUploadDone: { time: Date.now(), fileName: file.fileName, origName: file.origName, converted: !!file.converted } }, uploadNext);
            }).catch(err => { console.warn('[FENNEC (MVP)] Upload failed:', err); uploadNext(); });
        };
        uploadNext();
    }

    function processDuplicateCancel(id) {
        if (!id) return;
        const info = getBasicOrderInfo();
        if (!info.orderId || String(info.orderId) !== String(id)) return;
        chrome.storage.local.remove('fennecDupCancel');
        startCancelProcedure();
        sessionSet({ fennecDupCancelDone: { orderId: id } });
    }

    function applyUpdateFields(updates) {
        if (!updates) return;
        const selectors = {
            companyName: ['button[onclick*="modalEditCompInfo"]', '#modalEditCompInfo', '#compName1', 'button[onclick*="update-comp-info"]']
        };
        const queue = Object.keys(updates);
        function next() {
            if (!queue.length) return;
            const key = queue.shift();
            const cfg = selectors[key];
            if (!cfg) { next(); return; }
            const [btnSel, modalSel, inputSel, saveSel] = cfg;
            const btn = document.querySelector(btnSel);
            if (btn) btn.click();
            setTimeout(() => {
                const input = document.querySelector(modalSel + ' ' + inputSel);
                if (input) {
                    input.value = updates[key];
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
                const save = document.querySelector(modalSel + ' ' + saveSel);
                if (save) save.click();
                setTimeout(next, 600);
            }, 400);
        }
        next();
    }

    function processUpdateRequest(data) {
        if (!data) return;
        const info = getBasicOrderInfo();
        if (!info.orderId || String(info.orderId) !== String(data.orderId)) return;
        chrome.storage.local.remove('fennecUpdateRequest');
        applyUpdateFields(data.updates);
    }

    function openCodaSearch() {
        let overlay = document.getElementById('fennec-coda-overlay');
        if (overlay) overlay.remove();
        overlay = document.createElement('div');
        overlay.id = 'fennec-coda-overlay';
        const close = document.createElement('div');
        close.className = 'coda-close';
        close.textContent = '✕';
        close.addEventListener('click', () => overlay.remove());
        overlay.appendChild(close);
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Search KB...';
        overlay.appendChild(input);
        const btn = document.createElement('button');
        btn.className = 'copilot-button';
        btn.textContent = 'SEARCH';
        overlay.appendChild(btn);
        const results = document.createElement('div');
        results.className = 'coda-results';
        overlay.appendChild(results);


        const runSearch = () => {
            const q = input.value.trim();
            if (!q) return;
            results.textContent = "Loading...";
            fetch("https://coda.io/apis/v1/docs/QJWsDF3UZ6/search?q=" + encodeURIComponent(q), {
                headers: { "Authorization": "Bearer 758d99dd-34d0-43a5-8896-595785019945" }
            })
                .then(r => {
                    const status = r.status;
                    return r.json().catch(() => ({})).then(data => ({ status, data }));
                })
                .then(({ status, data }) => {
                    if (status !== 200) {
                        const msg = data && data.message ? data.message : "API request failed";
                        results.textContent = `Error ${status}: ${msg}`;
                        return;
                    }
                    if (!data || !data.items || !data.items.length) {
                        results.textContent = "No results";
                        return;
                    }
                    results.innerHTML = data.items.map(item => {
                        const t = item.name || item.title || "";
                        const link = item.browserLink || item.url || "#";
                        return `<div class="coda-result-item"><a href="${link}" target="_blank">${escapeHtml(t)}</a></div>`;
                    }).join("");
                })
                .catch(err => {
                    results.textContent = "Network error";
                    console.error("[FENNEC (MVP)] Coda search error:", err);
                });
        };
        btn.addEventListener('click', runSearch);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') runSearch(); });
    }

    function openEINSearch() {
        const info = getBasicOrderInfo();
        const client = getClientInfo();
        const company = getCompanyInfo();
        
        // Open the IRS EIN application page
        const url = 'https://sa.www4.irs.gov/applyein/';
        bg.openActiveTab({ url });
        
        // Store the data for the EIN automation process
        sessionStorage.setItem('fennecEINData', JSON.stringify({
            orderInfo: info,
            clientInfo: client,
            companyInfo: company,
            timestamp: Date.now()
        }));
        
        // Start the EIN automation process after a short delay
        setTimeout(() => {
            startEINAutomation();
        }, 2000);
        
        // Also set up a listener for when the page loads
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => {
                    startEINAutomation();
                }, 1000);
            });
        } else {
            // Page is already loaded
            setTimeout(() => {
                startEINAutomation();
            }, 1000);
        }
    }

    function startEINAutomation() {
        // Check if we're on the EIN application page
        if (!location.href.includes('sa.www4.irs.gov/applyein')) {
            return;
        }

        const einData = JSON.parse(sessionStorage.getItem('fennecEINData') || '{}');
        if (!einData.companyInfo || !einData.companyInfo.name) {
            console.log('[FENNEC] No company data available for EIN automation');
            return;
        }

        console.log('[FENNEC] Starting EIN automation process...');
        
        // Show detected information summary
        showEINInfoSummary(einData);
        
        // Step 1: Click "Begin Application Now" button
        const beginButton = document.querySelector('a[aria-label="Begin Application Now"]') || 
                           Array.from(document.querySelectorAll('a')).find(a => a.textContent.includes('Begin Application Now'));
        
        if (beginButton) {
            console.log('[FENNEC] Clicking Begin Application Now...');
            beginButton.click();
            
            // Wait for page load and continue to next step
            setTimeout(() => {
                step2SelectEntityType();
            }, 3000);
        } else {
            console.log('[FENNEC] Begin Application button not found, trying alternative approach...');
            // Try to find any button that might start the application
            const startButtons = Array.from(document.querySelectorAll('a, button')).filter(el => 
                el.textContent.toLowerCase().includes('begin') || 
                el.textContent.toLowerCase().includes('start') ||
                el.textContent.toLowerCase().includes('apply')
            );
            
            if (startButtons.length > 0) {
                console.log('[FENNEC] Found alternative start button, clicking...');
                startButtons[0].click();
                setTimeout(() => {
                    step2SelectEntityType();
                }, 3000);
            } else {
                console.log('[FENNEC] No start button found');
            }
        }
    }

    function step2SelectEntityType() {
        const einData = JSON.parse(sessionStorage.getItem('fennecEINData') || '{}');
        const entityType = einData.companyInfo?.type || 'LLC';
        
        console.log('[FENNEC] Detected entity type:', entityType);
        
        // Select the appropriate entity type
        let targetRadio = null;
        
        if (entityType === 'LLC') {
            // Look for LLC option
            targetRadio = document.querySelector('input[type="radio"][value="LLC"]') ||
                         Array.from(document.querySelectorAll('input[type="radio"]')).find(radio => {
                             const label = document.querySelector(`label[for="${radio.id}"]`);
                             return label && label.textContent.includes('Limited Liability Company');
                         });
        } else if (entityType === 'CORP') {
            // Look for Corporation option
            targetRadio = document.querySelector('input[type="radio"][value="CORP"]') ||
                         Array.from(document.querySelectorAll('input[type="radio"]')).find(radio => {
                             const label = document.querySelector(`label[for="${radio.id}"]`);
                             return label && (label.textContent.includes('Corporation') || 
                                            label.textContent.includes('Corp'));
                         });
        }
        
        if (targetRadio) {
            console.log('[FENNEC] Selecting', entityType, '...');
            targetRadio.click();
            targetRadio.checked = true;
            targetRadio.dispatchEvent(new Event('change', { bubbles: true }));
            
            // Find and click the Continue button
            setTimeout(() => {
                const continueBtn = document.querySelector('button[type="submit"]') ||
                                  document.querySelector('input[type="submit"]') ||
                                  Array.from(document.querySelectorAll('button')).find(btn => 
                                      btn.textContent.toLowerCase().includes('continue') ||
                                      btn.textContent.toLowerCase().includes('next')
                                  );
                
                if (continueBtn) {
                    console.log('[FENNEC] Clicking Continue...');
                    continueBtn.click();
                    setTimeout(() => {
                        step3SelectMemberType();
                    }, 3000);
                } else {
                    console.log('[FENNEC] Continue button not found');
                }
            }, 1000);
        } else {
            console.log('[FENNEC]', entityType, 'radio button not found');
        }
    }

    function step3SelectMemberType() {
        const einData = JSON.parse(sessionStorage.getItem('fennecEINData') || '{}');
        const memberType = einData.companyInfo?.memberType || 'single';
        
        console.log('[FENNEC] Detected member type:', memberType);
        
        // Select the appropriate member type
        let targetRadio = null;
        
        if (memberType === 'single') {
            // Look for Single Member option
            targetRadio = document.querySelector('input[type="radio"][value="single"]') ||
                         Array.from(document.querySelectorAll('input[type="radio"]')).find(radio => {
                             const label = document.querySelector(`label[for="${radio.id}"]`);
                             return label && (label.textContent.includes('Single Member') || 
                                            label.textContent.includes('1 member') ||
                                            label.textContent.includes('One Member'));
                         });
        } else if (memberType === 'multi') {
            // Look for Multi-Member option
            targetRadio = document.querySelector('input[type="radio"][value="multi"]') ||
                         Array.from(document.querySelectorAll('input[type="radio"]')).find(radio => {
                             const label = document.querySelector(`label[for="${radio.id}"]`);
                             return label && (label.textContent.includes('Multiple Members') || 
                                            label.textContent.includes('Multi Member') ||
                                            label.textContent.includes('2 members') ||
                                            label.textContent.includes('3 members'));
                         });
        }
        
        if (targetRadio) {
            console.log('[FENNEC] Selecting', memberType, 'member...');
            targetRadio.click();
            targetRadio.checked = true;
            targetRadio.dispatchEvent(new Event('change', { bubbles: true }));
            
            setTimeout(() => {
                const continueBtn = document.querySelector('button[type="submit"]') ||
                                  document.querySelector('input[type="submit"]') ||
                                  Array.from(document.querySelectorAll('button')).find(btn => 
                                      btn.textContent.toLowerCase().includes('continue') ||
                                      btn.textContent.toLowerCase().includes('next')
                                  );
                
                if (continueBtn) {
                    console.log('[FENNEC] Clicking Continue...');
                    continueBtn.click();
                    setTimeout(() => {
                        step4FillCompanyInfo();
                    }, 3000);
                } else {
                    console.log('[FENNEC] Continue button not found');
                }
            }, 1000);
        } else {
            console.log('[FENNEC]', memberType, 'member radio button not found');
        }
    }

    function step4FillCompanyInfo() {
        const einData = JSON.parse(sessionStorage.getItem('fennecEINData') || '{}');
        const companyInfo = einData.companyInfo || {};
        
        console.log('[FENNEC] Filling company information:', companyInfo);
        
        // Fill in the company name
        const nameInput = document.querySelector('#legalNameInput, input[name="legalNameInput"]');
        if (nameInput && companyInfo.name) {
            console.log('[FENNEC] Filling company name:', companyInfo.name);
            nameInput.value = companyInfo.name;
            nameInput.dispatchEvent(new Event('input', { bubbles: true }));
            nameInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Fill in physical address (from EIN section)
        const einAddress = companyInfo.einAddress || {};
        if (einAddress.street) {
            const streetInput = document.querySelector('input[name*="street"], input[name*="address"]');
            if (streetInput) {
                streetInput.value = einAddress.street;
                streetInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
        
        if (einAddress.city) {
            const cityInput = document.querySelector('input[name*="city"]');
            if (cityInput) {
                cityInput.value = einAddress.city;
                cityInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
        
        if (einAddress.state) {
            const stateInput = document.querySelector('input[name*="state"], select[name*="state"]');
            if (stateInput) {
                stateInput.value = einAddress.state;
                stateInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
        
        if (einAddress.zip) {
            const zipInput = document.querySelector('input[name*="zip"], input[name*="postal"]');
            if (zipInput) {
                zipInput.value = einAddress.zip;
                zipInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }

        // Fill in formation state (state where formation was ordered)
        if (companyInfo.formationState) {
            const formationStateInput = document.querySelector('input[name*="formation"], select[name*="formation"]');
            if (formationStateInput) {
                formationStateInput.value = companyInfo.formationState;
                formationStateInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        // Set start date to today if available
        const startDateInput = document.querySelector('#startDateInput, input[name="startDateInput"]');
        if (startDateInput) {
            const today = new Date();
            const formattedDate = today.toISOString().split('T')[0]; // YYYY-MM-DD format
            startDateInput.value = formattedDate;
            startDateInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // Fill in county if available
        const countyInput = document.querySelector('#countyInput, input[name="countyInput"]');
        if (countyInput && companyInfo.county) {
            countyInput.value = companyInfo.county;
            countyInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        console.log('[FENNEC] Company information filled. User can continue manually.');
        
        // Show a detailed notification to the user
        const notificationMessage = `Company information filled:
• Name: ${companyInfo.name || 'N/A'}
• Type: ${companyInfo.type || 'N/A'}
• Members: ${companyInfo.memberType || 'N/A'}
• Formation State: ${companyInfo.formationState || 'N/A'}
• Address: ${einAddress.street || 'N/A'}, ${einAddress.city || 'N/A'}, ${einAddress.state || 'N/A'}

Please review and continue with the application.`;
        
        showEINNotification(notificationMessage);
    }

    function showEINNotification(message) {
        // Create a notification overlay
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 12px;
            max-width: 400px;
            max-height: 300px;
            overflow-y: auto;
            cursor: pointer;
            white-space: pre-line;
            line-height: 1.4;
        `;
        notification.textContent = message;
        notification.title = 'Click to dismiss';
        notification.onclick = () => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        };
        document.body.appendChild(notification);
        
        // Remove notification after 15 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 15000);
    }

    // Manual trigger function for EIN automation
    function triggerEINAutomation() {
        if (location.href.includes('sa.www4.irs.gov/applyein')) {
            console.log('[FENNEC] Manual EIN automation triggered');
            startEINAutomation();
        } else {
            console.log('[FENNEC] Not on EIN application page');
        }
    }

    // Add keyboard shortcut for manual trigger (Ctrl+Shift+E)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'E') {
            triggerEINAutomation();
        }
    });

    // Add a floating button for manual trigger
    function addEINTriggerButton() {
        if (location.href.includes('sa.www4.irs.gov/applyein')) {
            const button = document.createElement('div');
            button.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: #2196F3;
                color: white;
                padding: 10px 15px;
                border-radius: 5px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                z-index: 10000;
                font-family: Arial, sans-serif;
                font-size: 12px;
                cursor: pointer;
                user-select: none;
            `;
            button.textContent = 'FENNEC EIN';
            button.title = 'Click to start EIN automation (Ctrl+Shift+E)';
            button.onclick = triggerEINAutomation;
            document.body.appendChild(button);
        }
    }

    // Add the trigger button when page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addEINTriggerButton);
    } else {
        addEINTriggerButton();
    }

    function showEINInfoSummary(einData) {
        const companyInfo = einData.companyInfo || {};
        const einAddress = companyInfo.einAddress || {};
        
        const summary = `📋 EIN Application Information Detected:

🏢 Company: ${companyInfo.name || 'Not found'}
📋 Type: ${companyInfo.type || 'LLC (default)'}
👥 Members: ${companyInfo.memberType || 'single (default)'}
🗺️ Formation State: ${companyInfo.formationState || 'Not found'}
📍 Physical Address: ${einAddress.street || 'Not found'}
    ${einAddress.city || ''}, ${einAddress.state || ''} ${einAddress.zip || ''}

🚀 Starting automation in 3 seconds...`;
        
        showEINNotification(summary);
    }

    // Opens the Coda knowledge base in a popup window covering 70% of the page
    function openKbWindow(state, type) {
        const width = Math.round(window.innerWidth * 0.7);
        const height = Math.round(window.innerHeight * 0.7);
        const left = window.screenX + Math.round((window.outerWidth - width) / 2);
        const top = window.screenY + Math.round((window.outerHeight - height) / 2);
        bg.send('openKnowledgeBaseWindow', {
            state,
            orderType: type,
            width,
            height,
            left,
            top
        });
    }

    function startFileAlong() {
        bg.send('openFilingWindow', { dbUrl: location.href });
    }

    function getLastIssueInfo() {
        function parseRow(row) {
            const cells = row.querySelectorAll('td');
            if (cells.length < 5) return null;
            const resolution = cells[4].textContent.trim();
            const text = cells[2].textContent.trim();
            const active = /mark resolved/i.test(resolution) ? true : !/resolved/i.test(resolution);
            return { text, active };
        }

        const modalRows = Array.from(document.querySelectorAll('#modalUpdateIssue table tbody tr'))
            .filter(r => r.querySelectorAll('td').length >= 5);
        if (modalRows.length) {
            const info = parseRow(modalRows[0]);
            if (info) return info;
        }

        const tableRows = Array.from(document.querySelectorAll('.issue-history table tbody tr'))
            .filter(r => r.querySelectorAll('td').length >= 5);
        if (tableRows.length) {
            const info = parseRow(tableRows[0]);
            if (info) return info;
        }

        const history = document.querySelector('.issue-history .steamline');
        if (history) {
            const item = history.querySelector('.sl-item');
            if (item) {
                const desc = item.querySelector('.desc');
                const txt = desc ? desc.textContent.trim() : item.textContent.trim();
                const icon = item.querySelector('.sl-left');
                const active = icon && icon.classList.contains('bg-red') ? true : !/resolved/i.test(txt);
                return { text: txt, active };
            }
        }
        return null;
    }

    function getChildOrdersInfo() {
        const rows = Array.from(document.querySelectorAll('.child-orders tbody tr'));
        const parse = row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 5) return null;
            const numTxt = cells[0].textContent.replace(/[^0-9]/g, '');
            const type = cells[2].textContent.trim();
            const date = formatDateLikeParent(cells[3].textContent.trim());
            const status = cells[4].textContent.trim();
            return { orderId: numTxt, type, date, status };
        };
        const info = rows.map(parse).filter(Boolean);
        info.sort((a, b) => {
            const da = Date.parse(a.date);
            const db = Date.parse(b.date);
            return (isNaN(db) ? 0 : db) - (isNaN(da) ? 0 : da);
        });
        return info;
    }

    function getActiveSubscriptions() {
        const tab = document.querySelector('#vsubscriptions');
        if (!tab) return [];
        const rows = Array.from(tab.querySelectorAll('table tbody tr'));
        return rows.filter(r => /active/i.test(getText(r))).map(r => {
            const link = r.querySelector('a[href*="/order/detail/"]');
            if (link) {
                const m = link.href.match(/detail\/(\d+)/);
                if (m) return m[1];
            }
            return null;
        }).filter(Boolean);
    }

    function getIntStorageFiles() {
        console.log('[FENNEC (MVP) DB SB] getIntStorageFiles() called');
        
        const headers = Array.from(document.querySelectorAll('h3.box-title'));
        console.log('[FENNEC (MVP) DB SB] Found headers:', headers.length, headers.map(h => h.textContent));
        
        const header = headers.find(h => /uploaded list/i.test(h.textContent));
        console.log('[FENNEC (MVP) DB SB] Found upload header:', header ? header.textContent : 'null');
        
        let rows = [];
        if (header) {
            const table = header.parentElement.querySelector('table');
            console.log('[FENNEC (MVP) DB SB] Found table:', !!table);
            if (table) {
                const tbody = table.querySelector('tbody');
                console.log('[FENNEC (MVP) DB SB] Found tbody:', !!tbody);
                if (tbody) {
                    rows = Array.from(tbody.querySelectorAll('tr'));
                    console.log('[FENNEC (MVP) DB SB] Found rows:', rows.length);
                }
            }
        }
        
        const files = rows.map(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 4) return null;
            const name = cells[0].textContent.trim();
            const uploadedBy = cells[1].textContent.trim();
            const dateText = cells[2].textContent.trim();
            const btn = row.querySelector('button');
            let url = '';
            if (btn) {
                const m = btn.getAttribute('onclick').match(/'(https?:[^']+)'/);
                if (m) url = m[1];
            }
            
            // Parse the date properly
            let date = null;
            if (dateText) {
                // Handle format like "03/03/2025 16:51:32 pm"
                const dateMatch = dateText.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})\s+(am|pm)/i);
                if (dateMatch) {
                    const [, month, day, year, hour, minute, second, ampm] = dateMatch;
                    let hour24 = parseInt(hour);
                    
                    // Handle 12-hour format conversion (only convert if hour is 1-12)
                    if (ampm.toLowerCase() === 'pm' && hour24 < 12) hour24 += 12;
                    if (ampm.toLowerCase() === 'am' && hour24 === 12) hour24 = 0;
                    
                    // Create ISO date string
                    date = `${year}-${month}-${day}T${hour24.toString().padStart(2, '0')}:${minute}:${second}`;
                } else {
                    // Try alternative format: "MM/DD/YYYY HH:MM:SS am/pm"
                    const altMatch = dateText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s+(am|pm)/i);
                    if (altMatch) {
                        const [, month, day, year, hour, minute, second, ampm] = altMatch;
                        let hour24 = parseInt(hour);
                        
                        // Handle 12-hour format conversion (only convert if hour is 1-12)
                        if (ampm.toLowerCase() === 'pm' && hour24 < 12) hour24 += 12;
                        if (ampm.toLowerCase() === 'am' && hour24 === 12) hour24 = 0;
                        
                        // Create ISO date string
                        date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour24.toString().padStart(2, '0')}:${minute}:${second}`;
                    } else {
                        // Try to parse as regular date
                        const parsedDate = new Date(dateText);
                        if (!isNaN(parsedDate.getTime())) {
                            date = parsedDate.toISOString();
                        }
                    }
                }
            }
            
            return { name, uploadedBy, date, url };
        }).filter(Boolean);
        
        console.log('[FENNEC (MVP) DB SB] getIntStorageFiles() returning files:', files.length, files);
        return files;
    }

    function getBasicOrderInfo() {
        const m = location.pathname.match(/(?:detail|storage\/incfile)\/(\d+)/);
        const orderId = m ? m[1] : '';
        console.log('[FENNEC (MVP)] getBasicOrderInfo() extracting from URL:', { 
            pathname: location.pathname, 
            match: m, 
            orderId: orderId 
        });
        let type = getOrderType();
        const pkgEl = document.getElementById('ordType');
        if (type === 'formation' && pkgEl) {
            const pkg = getText(pkgEl).toUpperCase();
            if (/SILVER|GOLD|PLATINUM/.test(pkg)) type = pkg;
        }
        const dateLi = Array.from(document.querySelectorAll('li')).find(li =>
            li.querySelector('a') && getText(li.querySelector('a')).toLowerCase() === 'date ordered'
        );
        const dateRaw = dateLi ? getText(dateLi.querySelector('span')) || '' : '';
        const date = formatDateLikeParent(dateRaw);
        const status = getText(document.querySelector('.btn-status-text')) || '';
        const result = { orderId, type, date, status };
        console.log('[FENNEC (MVP)] getBasicOrderInfo() returning:', result);
        
        // Check if this order needs state info update for family tree
        chrome.storage.local.get({ fennecPendingStateUpdate: null }, (result) => {
            if (result.fennecPendingStateUpdate === orderId) {
                // Extract state from the order page
                const state = extractStateFromOrderPage();
                if (state) {
                    chrome.storage.local.set({ 
                        fennecOrderStateInfo: { orderId, state },
                        fennecPendingStateUpdate: null 
                    });
                    console.log('[FENNEC (MVP)] State info updated for family tree:', { orderId, state });
                }
            }
        });
        
        return result;
    }

    function extractStateFromOrderPage() {
        console.log('[FENNEC (MVP)] Extracting state from order page');
        
        // Valid state abbreviations to avoid false positives like "LC" from "LLC"
        const validStates = [
            'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
            'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
            'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
            'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
            'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
            'DC', 'PR', 'VI', 'GU', 'MP', 'AS'
        ];
        
        // Only trust "State of Formation" or the state in the sidebar next to order number
        const formationElements = Array.from(document.querySelectorAll('*')).filter(el => {
            const text = getText(el);
            return text && text.includes('State of Formation:');
        });
        
        for (const element of formationElements) {
            const text = getText(element);
            console.log('[FENNEC (MVP)] Checking formation element:', text);
            const stateMatch = text.match(/State of Formation:\s*([A-Z]{2})/i);
            if (stateMatch) {
                const state = stateMatch[1];
                if (validStates.includes(state)) {
                    console.log('[FENNEC (MVP)] Found state from State of Formation:', state);
                    return state;
                }
            }
        }
        
        // Try to find state in the left-info panel next to order number (like "225061344749 - KY")
        const leftInfoElements = Array.from(document.querySelectorAll('.left-info *')).filter(el => {
            const text = getText(el);
            return text && /\d{6,12}\s*-\s*[A-Z]{2}/.test(text); // Order number - State pattern (6-12 digits)
        });
        
        for (const element of leftInfoElements) {
            const text = getText(element);
            console.log('[FENNEC (MVP)] Checking left-info element:', text);
            const stateMatch = text.match(/\d{6,12}\s*-\s*([A-Z]{2})/);
            if (stateMatch) {
                const state = stateMatch[1];
                if (validStates.includes(state)) {
                    console.log('[FENNEC (MVP)] Found state from left-info order number:', state);
                    return state;
                }
            }
        }
        
        // Try to find state in the sidebar next to order number (like "223030769292 - TX")
        const sidebarElements = Array.from(document.querySelectorAll('*')).filter(el => {
            const text = getText(el);
            return text && /\d{12}\s*-\s*[A-Z]{2}/.test(text); // Order number - State pattern
        });
        
        for (const element of sidebarElements) {
            const text = getText(element);
            console.log('[FENNEC (MVP)] Checking sidebar element:', text);
            const stateMatch = text.match(/\d{12}\s*-\s*([A-Z]{2})/);
            if (stateMatch) {
                const state = stateMatch[1];
                if (validStates.includes(state)) {
                    console.log('[FENNEC (MVP)] Found state from sidebar order number:', state);
                    return state;
                }
            }
        }
        
        console.log('[FENNEC (MVP)] No state found on order page');
        return null;
    }

    function getOrderStatus() {
        // Look for order status in the page
        const statusElements = Array.from(document.querySelectorAll('*')).filter(el => {
            const text = getText(el).toLowerCase();
            return text.includes('review') || text.includes('processing') || text.includes('hold') || 
                   text.includes('forwarded') || text.includes('shipped') || text.includes('canceled');
        });
        
        // Check for status in common locations
        const statusLabels = Array.from(document.querySelectorAll('label')).filter(l => 
            /status/i.test(getText(l))
        );
        
        let status = '';
        let statusClass = '';
        
        // Try to find status from labels
        for (const label of statusLabels) {
            const row = label.closest('.row, .form-group');
            if (row) {
                const valueEl = row.querySelector('.col-md-8 p, .col-md-8, .col-md-8 div, .col-md-8 span');
                if (valueEl) {
                    const statusText = getText(valueEl).toLowerCase();
                    if (statusText.includes('review')) {
                        status = 'REVIEW';
                        statusClass = 'copilot-tag-review';
                    } else if (statusText.includes('processing')) {
                        status = 'PROCESSING';
                        statusClass = 'copilot-tag-processing';
                    } else if (statusText.includes('hold')) {
                        status = 'HOLD';
                        statusClass = 'copilot-tag-hold';
                    } else if (statusText.includes('forwarded')) {
                        status = 'FORWARDED';
                        statusClass = 'copilot-tag-forwarded';
                    } else if (statusText.includes('shipped')) {
                        status = 'SHIPPED';
                        statusClass = 'copilot-tag-shipped';
                    } else if (statusText.includes('canceled') || statusText.includes('cancelled')) {
                        status = 'CANCELED';
                        statusClass = 'copilot-tag-canceled';
                    }
                    if (status) break;
                }
            }
        }
        
        return { status, statusClass };
    }

    function isExpeditedOrder() {
        const li = Array.from(document.querySelectorAll('li')).find(li => {
            const icon = li.querySelector('i.mdi.mdi-truck');
            const link = li.querySelector('a');
            return icon && link && /completion date/i.test(getText(link));
        });
        if (!li) return false;
        const span = li.querySelector('span.pull-right');
        return span && /expedited/i.test(getText(span));
    }

    function getOrderCost() {
        const li = Array.from(document.querySelectorAll('li')).find(li => {
            return /charge total/i.test(getText(li));
        });
        if (!li) return '';
        const span = li.querySelector('.pull-right.total');
        return span ? getText(span) : '';
    }

    function getParentOrderId() {
        const tab = document.querySelector('#vcomp') || document.querySelector('#vcompany');
        if (!tab) {
            return null;
        }
        const candidates = Array.from(
            tab.querySelectorAll("label, div, p, li, span, td, strong")
        );
        const parentEl = candidates.find(el => /parent.*order/i.test(getText(el)));
        if (!parentEl) {
            return null;
        }
        let anchor = parentEl.querySelector('a[href*="/order/detail/"]');
        if (!anchor && parentEl.nextElementSibling) {
            anchor = parentEl.nextElementSibling.querySelector('a[href*="/order/detail/"]');
        }
        if (anchor) {
            const m = anchor.href.match(/detail\/(\d+)/);
            if (m) {
                return m[1];
            }
            const textId = anchor.textContent.replace(/\D/g, '');
            if (textId) {
                return textId;
            }
        }
        let digits = parentEl.textContent.replace(/\D/g, "");
        if (!digits) {
            let valEl = parentEl.nextElementSibling;
            const container = parentEl.closest("div");
            if ((!valEl || !getText(valEl)) && container) {
                if (container.nextElementSibling && getText(container.nextElementSibling)) {
                    valEl = container.nextElementSibling;
                } else {
                    const siblings = Array.from(container.parentElement.children);
                    const idx = siblings.indexOf(container);
                    for (let i = idx + 1; i < siblings.length; i++) {
                        if (getText(siblings[i])) {
                            valEl = siblings[i];
                            break;
                        }
                    }
                }
            }
            if (valEl) {
                digits = valEl.textContent.replace(/\D/g, "");
            }
        }
        if (!digits) {
            return null;
        }
        return digits;
    }

    function getClientInfo() {
        const tab = document.querySelector('#vclient');
        if (tab) {
            const row = tab.querySelector('table tbody tr');
            if (row) {
                const cells = row.querySelectorAll('td');
                const id = cells[0] ? getText(cells[0]).trim() : '';
                const orders = cells[1] ? getText(cells[1]).trim() : '';
                const ltv = cells[2] ? getText(cells[2]).trim() : '';
                const nameCell = row.querySelector('td[id^="clientName"]');
                const contactCell = row.querySelector('td[id^="clientContact"]');
                const name = nameCell ? getText(nameCell).replace(/^\s*✓?\s*/, '') : '';
                let email = '';
                let phone = '';
                if (contactCell) {
                    const emailRegex = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/;
                    const phoneRegex = /\(?\d{3}\)?[-\s.]?\d{3}[-\s.]?\d{4}/;
                    const mailEl = contactCell.querySelector('a[href^="mailto:"]');
                    if (mailEl) {
                        const href = mailEl.getAttribute("href") || '';
                        const match = href.replace(/^mailto:/, '').match(emailRegex);
                        if (match) {
                            email = match[0];
                        } else {
                            const txtMatch = getText(mailEl).match(emailRegex);
                            if (txtMatch) email = txtMatch[0];
                        }
                    }
                    const text = getText(contactCell);
                    if (!email) {
                        const em = text.match(emailRegex);
                        if (em) email = em[0];
                    }
                    const ph = text.match(phoneRegex);
                    if (ph) phone = ph[0];
                }
                return { id, orders, ltv, name, email, phone };
            }
        }
        const contactHeader = Array.from(document.querySelectorAll('h3.box-title'))
            .find(h => getText(h).toLowerCase().includes('contact info'));
        if (contactHeader) {
            const body = contactHeader.closest('.form-body');
            if (body) {
                const nameLabel = Array.from(body.querySelectorAll('label'))
                    .find(l => getText(l).toLowerCase().startsWith('name'));
                const emailLabel = Array.from(body.querySelectorAll('label'))
                    .find(l => getText(l).toLowerCase().startsWith('email'));
                const name = nameLabel ? getText(nameLabel.parentElement.querySelector('.form-control-static')) : '';
                const email = emailLabel ? getText(emailLabel.parentElement.querySelector('.form-control-static')) : '';
                const phoneLabel = Array.from(body.querySelectorAll('label'))
                    .find(l => getText(l).toLowerCase().startsWith('phone'));
                const phone = phoneLabel ? getText(phoneLabel.parentElement.querySelector('.form-control-static')) : '';
                return { id: '', orders: '', ltv: '', name, email, phone };
            }
        }
        return { id: '', orders: '', ltv: '', name: '', email: '', phone: '' };
    }

        function getCompanyInfo() {
        const companyInfo = {
            name: '',
            type: '', // 'LLC' or 'CORP'
            memberType: '', // 'single' or 'multi'
            physicalAddress: {
                street: '',
                city: '',
                state: '',
                zip: ''
            },
            formationState: '', // State where formation was ordered
            einAddress: {
                street: '',
                city: '',
                state: '',
                zip: ''
            }
        };

        // Get company name
        const companyNameInput = document.querySelector('#compName1');
        if (companyNameInput && companyNameInput.value) {
            companyInfo.name = companyNameInput.value.trim();
        } else {
            const amendmentCompanyNameInput = document.querySelector('#amendmentCompName1');
            if (amendmentCompanyNameInput && amendmentCompanyNameInput.value) {
                companyInfo.name = amendmentCompanyNameInput.value.trim();
            } else {
                // Try to find company name in the page content
                const companyLabels = Array.from(document.querySelectorAll('label'))
                    .filter(l => getText(l).toLowerCase().includes('company name'));
                
                for (const label of companyLabels) {
                    const input = label.parentElement.querySelector('input[type="text"]');
                    if (input && input.value) {
                        companyInfo.name = input.value.trim();
                        break;
                    }
                }
            }
        }

        // Detect entity type (LLC vs CORP)
        companyInfo.type = detectEntityType();
        
        // Detect member type (single vs multi)
        companyInfo.memberType = detectMemberType();
        
        // Get formation state
        companyInfo.formationState = getFormationState();
        
        // Get EIN address (physical location)
        const einAddress = getEINAddress();
        if (einAddress) {
            companyInfo.einAddress = einAddress;
        }
        
        // Get physical address (if different from EIN address)
        const physicalAddress = getPhysicalAddress();
        if (physicalAddress) {
            companyInfo.physicalAddress = physicalAddress;
        }

        return companyInfo;
    }

    function detectEntityType() {
        // Look for entity type indicators in the page
        const pageText = document.body.textContent.toLowerCase();
        
        // Check for LLC indicators
        if (pageText.includes('llc') || 
            pageText.includes('limited liability company') ||
            pageText.includes('limited liability')) {
            return 'LLC';
        }
        
        // Check for Corporation indicators
        if (pageText.includes('corporation') || 
            pageText.includes('corp') ||
            pageText.includes('inc') ||
            pageText.includes('incorporated')) {
            return 'CORP';
        }
        
        // Check form fields for entity type
        const entityTypeInputs = document.querySelectorAll('input[type="text"], select');
        for (const input of entityTypeInputs) {
            const value = input.value.toLowerCase();
            if (value.includes('llc')) return 'LLC';
            if (value.includes('corporation') || value.includes('corp')) return 'CORP';
        }
        
        // Default to LLC if no clear indicator
        return 'LLC';
    }

    function detectMemberType() {
        // Look for member count indicators
        const pageText = document.body.textContent.toLowerCase();
        
        // Check for single member indicators
        if (pageText.includes('single member') || 
            pageText.includes('1 member') ||
            pageText.includes('one member')) {
            return 'single';
        }
        
        // Check for multi-member indicators
        if (pageText.includes('multiple members') || 
            pageText.includes('multi member') ||
            pageText.includes('2 members') ||
            pageText.includes('3 members') ||
            pageText.includes('4 members') ||
            pageText.includes('5 members')) {
            return 'multi';
        }
        
        // Check form fields for member count
        const memberInputs = document.querySelectorAll('input[type="number"], input[type="text"]');
        for (const input of memberInputs) {
            const value = input.value;
            if (value === '1' || value === 'one') return 'single';
            if (parseInt(value) > 1) return 'multi';
        }
        
        // Default to single member
        return 'single';
    }

    function getFormationState() {
        // Look for formation state in the order details
        const pageText = document.body.textContent;
        
        // Common state abbreviations
        const states = {
            'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
            'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
            'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
            'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
            'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
            'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
            'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
            'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
            'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
            'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
            'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
            'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
            'WI': 'Wisconsin', 'WY': 'Wyoming'
        };
        
        // Look for state mentions in formation context
        for (const [abbr, fullName] of Object.entries(states)) {
            if (pageText.includes(`formation in ${fullName}`) || 
                pageText.includes(`formed in ${fullName}`) ||
                pageText.includes(`state of formation: ${fullName}`) ||
                pageText.includes(`formation state: ${fullName}`)) {
                return fullName;
            }
        }
        
        // Check form fields for formation state
        const formationInputs = document.querySelectorAll('input[type="text"], select');
        for (const input of formationInputs) {
            const value = input.value;
            if (states[value] || Object.values(states).includes(value)) {
                return states[value] || value;
            }
        }
        
        return '';
    }

    function getEINAddress() {
        // Look for EIN address section
        const einSection = findEINSection();
        if (!einSection) return null;
        
        return extractAddressFromSection(einSection);
    }

    function getPhysicalAddress() {
        // Look for physical address fields
        const addressInputs = document.querySelectorAll('input[type="text"]');
        const address = { street: '', city: '', state: '', zip: '' };
        
        for (const input of addressInputs) {
            const label = document.querySelector(`label[for="${input.id}"]`);
            if (!label) continue;
            
            const labelText = getText(label).toLowerCase();
            const value = input.value.trim();
            
            if (labelText.includes('street') || labelText.includes('address')) {
                address.street = value;
            } else if (labelText.includes('city')) {
                address.city = value;
            } else if (labelText.includes('state')) {
                address.state = value;
            } else if (labelText.includes('zip') || labelText.includes('postal')) {
                address.zip = value;
            }
        }
        
        return address;
    }

    function findEINSection() {
        // Look for EIN-related sections in the page
        const sections = document.querySelectorAll('div, section');
        
        for (const section of sections) {
            const text = getText(section).toLowerCase();
            if (text.includes('ein') || text.includes('employer identification number')) {
                return section;
            }
        }
        
        return null;
    }

    function extractAddressFromSection(section) {
        const address = { street: '', city: '', state: '', zip: '' };
        
        // Look for address fields within the section
        const inputs = section.querySelectorAll('input[type="text"]');
        
        for (const input of inputs) {
            const label = document.querySelector(`label[for="${input.id}"]`);
            if (!label) continue;
            
            const labelText = getText(label).toLowerCase();
            const value = input.value.trim();
            
            if (labelText.includes('street') || labelText.includes('address')) {
                address.street = value;
            } else if (labelText.includes('city')) {
                address.city = value;
            } else if (labelText.includes('state')) {
                address.state = value;
            } else if (labelText.includes('zip') || labelText.includes('postal')) {
                address.zip = value;
            }
        }
        
        return address;
    }


    function diagnoseHoldOrders(orders, parentId, originId, originType) {
        // fall back to current order when originId missing
        if (!originId) {
            originId = typeof getBasicOrderInfo === 'function'
                ? getBasicOrderInfo().orderId
                : parentId;
        }
        originType = originType || (typeof currentOrderTypeText !== 'undefined' ? currentOrderTypeText : '');
        const isReinstatement = /reinstat/i.test(originType);
        diagnoseFloater.remove();
        diagnoseFloater.build();
        diagnoseFloater.attach();
        let overlay = diagnoseFloater.element;
        const close = document.createElement('div');
        close.className = 'diag-close';
        close.textContent = '✕';
        close.addEventListener('click', () => overlay.remove());
        overlay.appendChild(close);
        const loading = document.createElement('div');
        loading.className = 'diag-loading';
        loading.textContent = 'Gathering order info...';
        overlay.appendChild(loading);
        document.body.appendChild(overlay);

        const addCard = (r) => {
            const card = document.createElement('div');
            card.className = 'diag-card';
            const cls =
                /shipped/i.test(r.order.status) ? 'copilot-tag copilot-tag-green' :
                /review|processing/i.test(r.order.status) ? 'copilot-tag copilot-tag-yellow' :
                /canceled/i.test(r.order.status) ? 'copilot-tag copilot-tag-red' :
                /hold/i.test(r.order.status) ? 'copilot-tag copilot-tag-purple' : 'copilot-tag';

            const link = document.createElement('a');
            link.href = `${location.origin}/incfile/order/detail/${r.order.orderId}`;
            link.target = '_blank';
            link.textContent = r.order.orderId;
            link.className = 'diag-order';
            card.appendChild(link);

            const tagsDiv = document.createElement('div');
            tagsDiv.className = 'diag-tags';
            const statusSpan = document.createElement('span');
            statusSpan.className = cls;
            statusSpan.textContent = r.order.status;
            tagsDiv.appendChild(statusSpan);
            const typeSpan = document.createElement('span');
            typeSpan.className = 'copilot-tag copilot-tag-white';
            let rawType = r.order.type || '';
            let typeText = rawType.toUpperCase();
            if (/beneficial ownership information report/i.test(rawType)) {
                typeText = 'BOIR';
            }
            typeSpan.textContent = typeText;
            tagsDiv.appendChild(typeSpan);
            card.appendChild(tagsDiv);

            const issueDiv = document.createElement('div');
            issueDiv.className = 'diag-issue';
            issueDiv.textContent = r.issue;
            card.appendChild(issueDiv);

            const commentBox = document.createElement('input');
            commentBox.type = 'text';
            commentBox.className = 'diag-comment';
            if (isReinstatement) {
                commentBox.value = `The Annual Report is not required as we've filed the Reinstatement: ${originId}`;
            } else {
                commentBox.value = `The Annual Report has been filed: ${originId}`;
            }
            card.appendChild(commentBox);

            const action = document.createElement('span');
            action.className = 'copilot-tag copilot-tag-green diag-resolve';
            const status = r.order.status || '';
            let btnLabel = 'RESOLVE AND COMMENT';
            if (/review/i.test(status)) {
                btnLabel = isReinstatement ? 'COMMENT & CANCEL' : 'COMMENT';
            } else if (isReinstatement) {
                btnLabel = 'RESOLVE & CANCEL';
            }
            action.textContent = btnLabel;
            action.addEventListener('click', () => {
                const comment = commentBox.value.trim();
                const data = { orderId: r.order.orderId, comment };
                if (/cancel/i.test(btnLabel)) data.cancel = true;
                sessionSet({ fennecPendingComment: data }, () => {
                    bg.openActiveTab({ url: `${location.origin}/incfile/order/detail/${r.order.orderId}` });
                });
            });
            card.appendChild(action);

            overlay.appendChild(card);
        };

        const promises = orders.map(o => new Promise(res => {
            bg.send('fetchLastIssue', { orderId: o.orderId }, resp => {
                const result = resp && resp.issueInfo
                    ? { order: o, issue: resp.issueInfo.text, active: resp.issueInfo.active }
                    : { order: o, issue: 'On hold', active: true };
                addCard(result);
                res(result);
            });
        }));
        Promise.all(promises).then(() => loading.remove());
    }

function getLastHoldUser() {
        const trigger = document.querySelector("a[onclick*='modalTrackOrderHistory']");
        if (trigger) trigger.click();
        let attempts = 10;
        const parse = () => {
            const rows = Array.from(document.querySelectorAll('#modalTrackOrderHistory table tbody tr'));
            for (const row of rows) {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 2 && /hold status/i.test(cells[1].textContent)) {
                    const s = row.querySelector('strong');
                    if (s) return s.textContent.trim();
                }
            }
            const items = Array.from(document.querySelectorAll('#modalTrackOrderHistory .sl-item'));
            for (const item of items) {
                const link = item.querySelector('a');
                if (link && /hold status/i.test(link.textContent)) {
                    const date = item.querySelector('.sl-date');
                    if (date) {
                        const parts = date.textContent.split('-');
                        if (parts.length > 1) return parts.pop().trim();
                    }
                }
            }
            return null;
        };
    return new Promise(resolve => {
        const check = () => {
            const user = parse();
            if (user || attempts-- <= 0) {
                const closeBtn = document.querySelector('#modalTrackOrderHistory .close');
                if (closeBtn) closeBtn.click();
                resolve(user);
            } else {
                setTimeout(check, 500);
            }
        };
        check();
    });
}

    // Expose helpers so core/utils.js can access them
    window.getParentOrderId = getParentOrderId;
    window.diagnoseHoldOrders = diagnoseHoldOrders;
    window.openKbWindow = openKbWindow;
    window.startFileAlong = startFileAlong;
    window.currentOrderTypeText = currentOrderTypeText;

    function loadIntStorage(orderId) {
        console.log('[FENNEC (MVP) DB SB] loadIntStorage called for orderId:', orderId);
        
        if (!orderId) {
            console.warn('[FENNEC (MVP) DB SB] loadIntStorage: No orderId provided');
            return;
        }
        
        console.log('[FENNEC (MVP) DB SB] orderId type:', typeof orderId, 'value:', JSON.stringify(orderId));
        
        const setLoading = () => {
            const section = document.getElementById('int-storage-section');
            const box = document.getElementById('int-storage-box');
            
            console.log('[FENNEC (MVP) DB SB] INT STORAGE elements check:', {
                section: !!section,
                box: !!box,
                sectionDisplay: section ? section.style.display : 'n/a'
            });
            
            if (section) {
                section.style.display = 'block';
                console.log('[FENNEC (MVP) DB SB] INT STORAGE section made visible');
            } else {
                console.warn('[FENNEC (MVP) DB SB] INT STORAGE section not found');
            }
            
            if (box) {
                box.innerHTML = '<div style="text-align:center;color:#aaa">Loading<span class="loading-dots">...</span></div>';
                console.log('[FENNEC (MVP) DB SB] INT STORAGE loading message set');
            } else {
                console.warn('[FENNEC (MVP) DB SB] INT STORAGE box not found');
            }
        };
        
        setLoading();
        
        bg.send('fetchIntStorage', { orderId, forceRefresh: true }, resp => {
            const box = document.getElementById('int-storage-box');
            if (!box) return;
            
            const files = resp && Array.isArray(resp.files) ? resp.files : null;
            
            console.log('[FENNEC (MVP) DB SB] INT STORAGE DEBUG: Response files:', files);
            console.log('[FENNEC (MVP) DB SB] INT STORAGE DEBUG: Files length:', files ? files.length : 'null');
            
            // Always overwrite INT STORAGE data with fresh data
            chrome.storage.local.set({ 
                intStorageData: { 
                    orderId: orderId, 
                    files: files, 
                    timestamp: Date.now() 
                },
                intStorageLoaded: true,
                intStorageOrderId: orderId
            }, () => {
                console.log('[FENNEC (MVP) DB SB] INT STORAGE DEBUG: Fresh data saved - orderId:', orderId, 'files count:', files ? files.length : 'null');
                
                // Signal to GM SB that INT STORAGE loading is complete
                bg.send('intStorageLoadComplete', { 
                    orderId: orderId, 
                    success: true, 
                    filesCount: files ? files.length : 0 
                }, (response) => {
                    console.log('[FENNEC (MVP) DB SB] INT STORAGE load complete signal sent, response:', response);
                });
            });
            
            if (!files) {
                box.innerHTML = '<div style="text-align:center;color:#aaa">Failed to load</div>';
                return;
            }
            
            const list = files.map((file, idx) => {
                // Truncate name to 20 chars to prevent overflow, show ellipsis if longer
                let shortName = file.name.length > 20 ? file.name.slice(0, 17) + '...' : file.name;
                // Show file name on one row, uploader on second row
                const nameDiv = `<div class="int-doc-name" title="${escapeHtml(file.name)}" style="cursor:help;">${escapeHtml(shortName)}</div>`;
                const uploaderDiv = `<div class="int-doc-uploader">${escapeHtml(file.uploadedBy || 'Unknown')}</div>`;
                
                // Format date as MM/DD/YY and time below, with proper error handling
                let dateDiv = '';
                if (file.date) {
                    let dateObj = new Date(file.date);
                    if (!isNaN(dateObj.getTime())) {
                        // Valid date
                        let mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                        let dd = String(dateObj.getDate()).padStart(2, '0');
                        let yy = String(dateObj.getFullYear()).slice(-2);
                        let time = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                        dateDiv = `<div class="int-doc-date">${mm}/${dd}/${yy}<br><span class="int-doc-time">${time}</span></div>`;
                    } else {
                        // Invalid date
                        dateDiv = `<div class="int-doc-date">--/--/--<br><span class="int-doc-time">--:--</span></div>`;
                    }
                } else {
                    // No date provided
                    dateDiv = `<div class="int-doc-date">--/--/--<br><span class="int-doc-time">--:--</span></div>`;
                }
                
                // OPEN button with reduced padding
                const openBtn = `<button class="copilot-button int-open" style="font-size:11px;padding:3px 6px;min-width:50px;" data-url="${escapeHtml(file.url)}">OPEN</button>`;
                // Download button - small circle with download symbol
                const downloadBtn = `<button class="copilot-button int-download" style="font-size:12px;padding:4px;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;" data-url="${escapeHtml(file.url)}" title="Download">⬇</button>`;
                return `<div class="int-row" style="display:flex;align-items:center;gap:8px;margin:4px 0;"><div class="int-doc-info" style="flex:1;min-width:0;">${nameDiv}${uploaderDiv}</div><div class="int-doc-date-container" style="min-width:60px;text-align:center;">${dateDiv}</div><div style="display:flex;gap:4px;min-width:80px;justify-content:flex-end;">${openBtn}${downloadBtn}</div></div>`;
            }).join('');
            const filesHtml = list || '<div style="text-align:center;color:#aaa">No files</div>';
            const uploadHtml = `
                <div id="int-upload-drop" style="border:1px dashed #666;padding:6px;margin-top:6px;text-align:center;cursor:pointer;">Drop files or click</div>
                <input id="int-upload-input" type="file" multiple style="display:none" />
                <div id="int-upload-list"></div>
                <div style="display:flex;justify-content:center;"><button id="int-upload-btn" class="copilot-button" style="display:none;margin-top:6px">UPLOAD</button></div>`;
            
            // Add refresh button to top right corner with line break to prevent overlap
            const refreshButton = '<div id="int-refresh-btn" style="position:absolute;top:8px;right:8px;cursor:pointer;font-size:16px;color:#666;" title="Refresh INT STORAGE">↻</div>';
            box.innerHTML = refreshButton + '<br style="margin-top:20px">' + filesHtml + uploadHtml;
            
            // Re-attach common listeners after INT STORAGE content is loaded
            attachCommonListeners(box);
            box.querySelectorAll('.int-open').forEach(b => {
                b.addEventListener('click', () => { const u = b.dataset.url; if (u) openFileInPopup(u); });
            });
            
            // Download button functionality
            box.querySelectorAll('.int-download').forEach(b => {
                b.addEventListener('click', () => { 
                    const u = b.dataset.url; 
                    if (u) {
                        // Create a temporary link to trigger download
                        const link = document.createElement('a');
                        link.href = u;
                        link.download = '';
                        link.target = '_blank';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }
                });
            });
            
            // Refresh button logic
            const refreshBtn = box.querySelector('#int-refresh-btn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => {
                    console.log('[FENNEC] Manual refresh of INT STORAGE requested');
                    refreshIntStorageFromServer(orderId);
                });
            }
            
            setupIntUpload(orderId);
        });
    }

    function setupIntStoragePageRefreshDetection() {
        // Extract order ID from the current URL
        const orderId = (location.pathname.match(/\/storage\/incfile\/(\d+)/) || [])[1];
        if (!orderId) {
            console.warn('[FENNEC] Could not extract order ID from storage page URL');
            return;
        }
        
        console.log('[FENNEC] Setting up INT STORAGE page refresh detection for orderId:', orderId);
        
        // Store the current timestamp to detect page refreshes
        const currentTime = Date.now();
        sessionStorage.setItem('fennecStoragePageLoadTime', currentTime.toString());
        
        // Check if this is a page refresh (not a fresh navigation)
        const lastLoadTime = sessionStorage.getItem('fennecStoragePageLastLoadTime');
        if (lastLoadTime) {
            const timeDiff = currentTime - parseInt(lastLoadTime);
            // If the page was loaded within the last 10 seconds, it's likely a refresh after upload
            if (timeDiff < 10000) {
                console.log('[FENNEC] Detected page refresh after manual upload, triggering INT STORAGE refresh');
                
                // Wait a moment for the page to fully load, then refresh INT STORAGE
                setTimeout(() => {
                    console.log('[FENNEC] Refreshing INT STORAGE after manual upload detection');
                    refreshIntStorageAfterManualUpload(orderId);
                }, 2000);
            }
        }
        
        // Store the current load time for future comparisons
        sessionStorage.setItem('fennecStoragePageLastLoadTime', currentTime.toString());
    }
    
    function refreshIntStorageAfterManualUpload(orderId) {
        console.log('[FENNEC] Refreshing INT STORAGE after manual upload for orderId:', orderId);
        
        // Clear any cached data to force fresh load
        chrome.storage.local.remove(['intStorageData', 'intStorageCache'], () => {
            console.log('[FENNEC] Cleared cached INT STORAGE data after manual upload');
            
            // Trigger refresh in all environments that might have this order open
            bg.send('refreshIntStorageInAllEnvironments', { orderId }, (response) => {
                console.log('[FENNEC] INT STORAGE refresh in all environments response:', response);
            });
            
            // Also refresh the current page's INT STORAGE if it has a sidebar
            const currentBox = document.getElementById('int-storage-box');
            if (currentBox) {
                console.log('[FENNEC] Refreshing INT STORAGE in current page sidebar');
                loadIntStorage(orderId);
            }
        });
    }

    function setupGlobalIntStorageDrop(body, orderId) {
        // Remove existing event listeners to prevent duplicates
        const newBody = body.cloneNode(true);
        body.parentNode.replaceChild(newBody, body);
        
        // Add drag and drop event listeners to the entire sidebar body
        newBody.addEventListener('dragover', e => {
            e.preventDefault();
            e.stopPropagation();
            newBody.classList.add('dragover');
        });
        
        newBody.addEventListener('dragleave', e => {
            e.preventDefault();
            e.stopPropagation();
            // Only remove dragover class if we're leaving the sidebar entirely
            if (!newBody.contains(e.relatedTarget)) {
                newBody.classList.remove('dragover');
            }
        });
        
        newBody.addEventListener('drop', e => {
            e.preventDefault();
            e.stopPropagation();
            newBody.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                console.log('[FENNEC] Global drop detected, files:', files.length);
                if (window.fennecAutoUpload) {
                    handleGlobalIntStorageUpload(files, orderId);
                } else {
                    // Show placeholder with rename + Upload in INT STORAGE section
                    showManualUploadPlaceholder(files, orderId);
                }
            }
        });
        
        // Add click functionality to INT STORAGE title
        const intStorageLabel = newBody.querySelector('.section-label');
        if (intStorageLabel && intStorageLabel.textContent.includes('INT STORAGE')) {
            intStorageLabel.style.cursor = 'pointer';
            intStorageLabel.title = 'Click to open INT STORAGE tab';
            intStorageLabel.addEventListener('click', () => {
                openIntStorageTab(orderId);
            });
        }
    }

    function showManualUploadPlaceholder(fileList, orderId) {
        const section = document.getElementById('int-storage-section');
        if (!section) return;
        let placeholder = document.getElementById('int-upload-placeholder');
        if (!placeholder) {
            placeholder = document.createElement('div');
            placeholder.id = 'int-upload-placeholder';
            placeholder.className = 'white-box';
            placeholder.style.marginBottom = '10px';
            section.insertBefore(placeholder, section.firstChild);
        }
        const files = Array.from(fileList).map(f => ({ file: f, name: f.name }));
        window.intDroppedFilesDB = (window.intDroppedFilesDB || []).concat(files);
        const rows = window.intDroppedFilesDB.map((item, idx) => {
            const nameVal = item.name || item.file.name;
            return `<div class="dropped-file-row"><div class="dropped-file-icon">📎</div><input class="dropped-file-name" data-idx="${idx}" value="${escapeHtml(nameVal)}" /></div>`;
        }).join('');
        placeholder.innerHTML = `
            <div style="margin-bottom:6px;color:#aaa">Files ready to upload to INT STORAGE</div>
            ${rows}
            <div style=\"display:flex;gap:6px;margin-top:6px;justify-content:flex-end;\">
                <button id=\"int-upload-cancel\" class=\"copilot-button\" style=\"background:#555;\">CANCEL</button>
                <button id=\"int-upload-submit\" class=\"copilot-button\">UPLOAD</button>
            </div>
        `;
        placeholder.querySelectorAll('.dropped-file-name').forEach(input => {
            input.addEventListener('input', (e) => {
                const i = Number(e.target.getAttribute('data-idx'));
                const arr = window.intDroppedFilesDB || [];
                if (arr[i]) arr[i].name = e.target.value.trim() || arr[i].file.name;
            });
        });
        const cancelBtn = document.getElementById('int-upload-cancel');
        if (cancelBtn) cancelBtn.onclick = () => {
            window.intDroppedFilesDB = [];
            placeholder.remove();
        };
        const submitBtn = document.getElementById('int-upload-submit');
        if (submitBtn) submitBtn.onclick = () => {
            const arr = (window.intDroppedFilesDB || []).slice();
            if (!arr.length) { placeholder.remove(); return; }
            placeholder.innerHTML = '<div style="text-align:center;color:#aaa">Uploading files...</div>';
            // DB already uploads raw files (server handles PDF). Send as-is with chosen names via FormData
            const queue = arr.slice();
            const token = document.querySelector('meta[name="csrf-token"]');
            const csrf = token ? token.getAttribute('content') : '';
            const uploadNext = () => {
                if (!queue.length) { window.intDroppedFilesDB = []; setTimeout(() => placeholder.remove(), 300); refreshIntStorageFromServer(orderId); return; }
                const it = queue.shift();
                const renamedFile = new File([it.file], it.name, { type: it.file.type });
                const form = new FormData();
                form.append('file', renamedFile, renamedFile.name);
                fetch(`/storage/incfile/${orderId}/create`, { method: 'POST', body: form, headers: { 'X-CSRF-TOKEN': csrf }, credentials: 'include' })
                    .then(() => uploadNext())
                    .catch(() => uploadNext());
            };
            uploadNext();
        };
    }

    function openIntStorageTab(orderId) {
        console.log('[FENNEC] Opening INT STORAGE tab for order:', orderId);
        
        // Send message to background script to find and activate INT STORAGE tab
        chrome.runtime.sendMessage({
            action: 'openIntStorageTab',
            orderId: orderId
        }, (response) => {
            if (response && response.success) {
                console.log('[FENNEC] INT STORAGE tab opened/activated successfully');
            } else {
                console.warn('[FENNEC] Failed to open INT STORAGE tab:', response);
            }
        });
    }

    function handleGlobalIntStorageUpload(files, orderId) {
        // Show upload progress indicator
        const box = document.getElementById('int-storage-box');
        if (box) {
            box.innerHTML = '<div style="text-align:center;color:#aaa">Uploading files...</div>';
        }
        
        // Make sure INT STORAGE section is visible
        const section = document.getElementById('int-storage-section');
        if (section) {
            section.style.display = 'block';
        }
        
        const token = document.querySelector('meta[name="csrf-token"]');
        const csrf = token ? token.getAttribute('content') : '';
        const fileArray = Array.from(files);
        let uploadedCount = 0;
        let failedCount = 0;
        
        const uploadNext = () => {
            if (uploadedCount + failedCount >= fileArray.length) {
                // All uploads completed, wait a moment for server processing then refresh
                console.log('[FENNEC] All uploads completed. Success:', uploadedCount, 'Failed:', failedCount);
                
                // Wait 2 seconds for server to process uploads, then refresh
                setTimeout(() => {
                    console.log('[FENNEC] Refreshing INT STORAGE list after uploads...');
                    refreshIntStorageFromServer(orderId);
                }, 2000);
                return;
            }
            
            const file = fileArray[uploadedCount + failedCount];
            const form = new FormData();
            form.append('file', file, file.name);
            
            fetch(`/storage/incfile/${orderId}/create`, { 
                method: 'POST', 
                body: form, 
                headers: { 'X-CSRF-TOKEN': csrf }, 
                credentials: 'include' 
            })
            .then(response => {
                if (response.ok) {
                    uploadedCount++;
                    console.log('[FENNEC] Upload successful:', file.name);
                } else {
                    failedCount++;
                    console.warn('[FENNEC] Upload failed:', file.name, response.status);
                }
            })
            .catch(err => {
                failedCount++;
                console.warn('[FENNEC] Upload error:', file.name, err);
            })
            .finally(() => {
                uploadNext();
            });
        };
        
        uploadNext();
    }

    function refreshIntStorageFromServer(orderId) {
        console.log('[FENNEC] Refreshing INT STORAGE from server for orderId:', orderId);
        
        // Show loading state
        const box = document.getElementById('int-storage-box');
        if (box) {
            box.innerHTML = '<div style="text-align:center;color:#aaa">Refreshing...</div>';
        }
        
        // Clear any cached data first
                chrome.storage.local.remove(['intStorageData', 'intStorageCache'], () => {
            console.log('[FENNEC] Cleared cached INT STORAGE data');
                    
            // Wait a bit longer for server to process uploads, then fetch fresh data directly
                    setTimeout(() => {
                console.log('[FENNEC] Fetching fresh INT STORAGE data directly from server');
                
                // Directly fetch the storage page to get fresh file data
                fetch(`/storage/incfile/${orderId}`, {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    }
                })
                .then(response => {
                    if (response.ok) {
                        return response.text();
                    } else {
                        throw new Error(`HTTP ${response.status}`);
                    }
                })
                .then(html => {
                    console.log('[FENNEC] Successfully fetched fresh INT STORAGE page');
                    
                    // Parse the HTML to extract file data
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    
                    // Extract file data from the page - look for table rows in the storage table
                    const tableRows = doc.querySelectorAll('table.table tbody tr');
                    const files = [];
                    
                    console.log('[FENNEC] Found table rows:', tableRows.length);
                    
                    tableRows.forEach((row, index) => {
                        const cells = row.querySelectorAll('td');
                        if (cells.length >= 3) {
                            const fileName = cells[0]?.textContent?.trim() || `File ${index + 1}`;
                            const fileUploader = cells[1]?.textContent?.trim() || 'Unknown';
                            const fileDate = cells[2]?.textContent?.trim() || '';
                            
                            // Extract file ID from the Open button if available
                            const openButton = cells[3]?.querySelector('button[onclick]');
                            let fileId = index;
                            let fileUrl = '';
                            if (openButton) {
                                const onclick = openButton.getAttribute('onclick');
                                const match = onclick.match(/read\/(\d+)/);
                                if (match) {
                                    fileId = match[1];
                                    fileUrl = `https://db.incfile.com/storage/incfile/read/${fileId}`;
                                }
                            }
                            
                            files.push({
                                name: fileName,
                                date: fileDate,
                                uploadedBy: fileUploader,
                                id: fileId,
                                url: fileUrl
                            });
                        }
                    });
                    
                    console.log('[FENNEC] Extracted files from fresh page:', files);
                    
                    // Update the INT STORAGE display with fresh data
                    const box = document.getElementById('int-storage-box');
                    if (box) {
                        if (files.length === 0) {
                            box.innerHTML = '<div style="text-align:center;color:#aaa">No files found</div>';
                        } else {
                            const list = files.map((file, idx) => {
                                // Truncate name to 20 chars to prevent overflow, show ellipsis if longer
                                let shortName = file.name.length > 20 ? file.name.slice(0, 17) + '...' : file.name;
                                // Show file name on one row, uploader on second row
                                const nameDiv = `<div class="int-doc-name" title="${escapeHtml(file.name)}" style="cursor:help;">${escapeHtml(shortName)}</div>`;
                                const uploaderDiv = `<div class="int-doc-uploader">${escapeHtml(file.uploadedBy || 'Unknown')}</div>`;
                                
                                // Format date as MM/DD/YY and time below, with proper error handling
                                let dateDiv = '';
                                if (file.date) {
                                    // Parse date format like "07/08/2025 21:41:34 pm"
                                    const dateMatch = file.date.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(am|pm)/i);
                                    if (dateMatch) {
                                        const [, month, day, year, hour, minute, second, ampm] = dateMatch;
                                        const mm = month;
                                        const dd = day;
                                        const yy = year.slice(-2);
                                        
                                        // Convert 12-hour to 24-hour format
                                        let hour24 = parseInt(hour);
                                        if (ampm.toLowerCase() === 'pm' && hour24 !== 12) {
                                            hour24 += 12;
                                        } else if (ampm.toLowerCase() === 'am' && hour24 === 12) {
                                            hour24 = 0;
                                        }
                                        
                                        const time = `${hour24.toString().padStart(2, '0')}:${minute}`;
                                        dateDiv = `<div class="int-doc-date">${mm}/${dd}/${yy}<br><span class="int-doc-time">${time}</span></div>`;
                                    } else {
                                        // Try to parse as regular date string
                                        let dateObj = new Date(file.date);
                                        if (!isNaN(dateObj.getTime())) {
                                            let mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                                            let dd = String(dateObj.getDate()).padStart(2, '0');
                                            let yy = String(dateObj.getFullYear()).slice(-2);
                                            let time = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                                            dateDiv = `<div class="int-doc-date">${mm}/${dd}/${yy}<br><span class="int-doc-time">${time}</span></div>`;
                                        } else {
                                            // Invalid date
                                            dateDiv = `<div class="int-doc-date">--/--/--<br><span class="int-doc-time">--:--</span></div>`;
                                        }
                                    }
                                } else {
                                    // No date provided
                                    dateDiv = `<div class="int-doc-date">--/--/--<br><span class="int-doc-time">--:--</span></div>`;
                                }
                                
                                // OPEN button with reduced padding
                                const openBtn = `<button class="copilot-button int-open" style="font-size:11px;padding:3px 6px;min-width:50px;" data-url="${escapeHtml(file.url)}">OPEN</button>`;
                                // Download button - small circle with download symbol
                                const downloadBtn = `<button class="copilot-button int-download" style="font-size:12px;padding:4px;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;" data-url="${escapeHtml(file.url)}" title="Download">⬇</button>`;
                                return `<div class="int-row" style="display:flex;align-items:center;gap:8px;margin:4px 0;"><div class="int-doc-info" style="flex:1;min-width:0;">${nameDiv}${uploaderDiv}</div><div class="int-doc-date-container" style="min-width:60px;text-align:center;">${dateDiv}</div><div style="display:flex;gap:4px;min-width:80px;justify-content:flex-end;">${openBtn}${downloadBtn}</div></div>`;
                            }).join('');
                            
                            const filesHtml = list || '<div style="text-align:center;color:#aaa">No files</div>';
                            const uploadHtml = `
                                <div id="int-upload-drop" style="border:1px dashed #666;padding:6px;margin-top:6px;text-align:center;cursor:pointer;">Drop files or click</div>
                                <input id="int-upload-input" type="file" multiple style="display:none" />
                                <div id="int-upload-list"></div>
                                <div style="display:flex;justify-content:center;"><button id="int-upload-btn" class="copilot-button" style="display:none;margin-top:6px">UPLOAD</button></div>`;
                            
                            // Add refresh button to top right corner with line break to prevent overlap
                            const refreshButton = '<div id="int-refresh-btn" style="position:absolute;top:8px;right:8px;cursor:pointer;font-size:16px;color:#666;" title="Refresh INT STORAGE">↻</div>';
                            box.innerHTML = refreshButton + '<br style="margin-top:20px">' + filesHtml + uploadHtml;
                            
                            // Re-attach event listeners
                                        box.querySelectorAll('.int-open').forEach(b => {
                b.addEventListener('click', () => { const u = b.dataset.url; if (u) openFileInPopup(u); });
            });
                            
                            // Download button functionality
                            box.querySelectorAll('.int-download').forEach(b => {
                                b.addEventListener('click', () => { 
                                    const u = b.dataset.url; 
                                    if (u) {
                                        // Create a temporary link to trigger download
                                        const link = document.createElement('a');
                                        link.href = u;
                                        link.download = '';
                                        link.target = '_blank';
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                    }
                                });
                            });
                            
                            // Re-setup upload functionality
                            setupIntUpload(orderId);
                            
                            // Re-attach refresh button functionality
                            const refreshBtn = box.querySelector('#int-refresh-btn');
                            if (refreshBtn) {
                                refreshBtn.addEventListener('click', () => {
                                    console.log('[FENNEC] Manual refresh button clicked');
                                    refreshIntStorageFromServer(orderId);
                                });
                            }
                        }
                    }
                    
                    // Update stored data
                    chrome.storage.local.set({ 
                        intStorageData: { 
                            orderId: orderId, 
                            files: files, 
                            timestamp: Date.now() 
                        },
                        intStorageLoaded: true,
                        intStorageOrderId: orderId
                    }, () => {
                        console.log('[FENNEC] Updated INT STORAGE data with fresh files:', files.length);
                    });
                })
                .catch(error => {
                    console.error('[FENNEC] Error fetching fresh INT STORAGE data:', error);
                    
                    // Fallback: show error message
                    const box = document.getElementById('int-storage-box');
                    if (box) {
                        box.innerHTML = '<div style="text-align:center;color:#aaa">Failed to refresh</div>';
                    }
                });
            }, 3000); // Wait 3 seconds for server to process uploads
        });
    }

    function setupIntUpload(orderId) {
        const drop = document.getElementById('int-upload-drop');
        const input = document.getElementById('int-upload-input');
        const list = document.getElementById('int-upload-list');
        const btn = document.getElementById('int-upload-btn');
        if (!drop || !input || !list || !btn) return;
        let files = [];
        const refresh = () => {
            list.innerHTML = '';
            files.forEach(item => {
                const row = document.createElement('div');
                row.className = 'dropped-file-row';
                const icon = document.createElement('div');
                icon.className = 'dropped-file-icon';
                icon.textContent = `📎 ${item.file.name}`;
                const nameInput = document.createElement('input');
                nameInput.className = 'dropped-file-name';
                nameInput.placeholder = '[CHANGE NAME]';
                if (item.name !== item.file.name) nameInput.value = item.name;
                nameInput.addEventListener('input', e => {
                    item.name = e.target.value.trim() || item.file.name;
                    nameInput.style.color = '#000';
                });
                row.appendChild(icon);
                row.appendChild(nameInput);
                list.appendChild(row);
            });
            btn.style.display = files.length ? 'block' : 'none';
        };
        const handleFiles = newFiles => {
            files.push(...Array.from(newFiles).map(f => ({ file: f, name: f.name })));
            refresh();
        };
        drop.addEventListener('click', () => input.click());
        drop.addEventListener('dragover', e => { e.preventDefault(); drop.style.background='#333'; });
        drop.addEventListener('dragleave', () => { drop.style.background=''; });
        drop.addEventListener('drop', e => {
            e.preventDefault();
            drop.style.background='';
            handleFiles(e.dataTransfer.files || []);
        });
        input.addEventListener('change', () => { handleFiles(input.files); input.value=''; });
        btn.addEventListener('click', () => {
            if (!files.length) return;
            btn.disabled = true;
            const token = document.querySelector('meta[name="csrf-token"]');
            const csrf = token ? token.getAttribute('content') : '';
            const queue = files.slice();
            const uploadNext = () => {
                if (!queue.length) { btn.disabled = false; files = []; refresh(); loadIntStorage(orderId); return; }
                const item = queue.shift();
                const form = new FormData();
                form.append('file', item.file, item.name);
                fetch(`/storage/incfile/${orderId}/create`, { method:'POST', body: form, headers:{ 'X-CSRF-TOKEN': csrf }, credentials:'include' })
                    .then(() => uploadNext())
                    .catch(err => { console.warn('[FENNEC (MVP)] Upload failed:', err); uploadNext(); });
            };
            uploadNext();
        });
    }

    function runFraudXray() {
        if (!fraudXray) return;
        if (localStorage.getItem('fraudXrayCompleted')) {
            fraudXray = false;
            return;
        }
        if (!reviewMode) {
            reviewMode = true;
            chrome.storage.local.set({ fennecReviewMode: true });
            chrome.storage.sync.set({ fennecReviewMode: true });
            updateReviewDisplay();
        }
        const orderId = getBasicOrderInfo().orderId;
        sessionSet({ fraudReviewSession: orderId, sidebarFreezeId: orderId });
        
        // Clear any stale completion flags for this order to ensure fresh flow
        const adyenFlowKey = `fennecAdyenFlowCompleted_${orderId}`;
        const kountFlowKey = `fennecKountFlowCompleted_${orderId}`;
        localStorage.removeItem(adyenFlowKey);
        localStorage.removeItem(kountFlowKey);
        localStorage.removeItem('fraudXrayFinished');
        console.log('[FENNEC (MVP)] Starting new XRAY flow for order:', orderId, '- cleared stale completion flags');
        
        const key = 'fennecLtvRefreshed_' + orderId;
        const hadPending = sessionStorage.getItem('fraudXrayPending');
        if (hadPending) {
            // Waited for the reload needed to load the correct LTV
            // Remove the flag and continue with the XRAY flow
            sessionStorage.removeItem('fraudXrayPending');
        }
        // Proceed with XRAY even if the LTV refresh flag is missing to
        // ensure external tabs open reliably after manual page reloads.
        // Don't set fraudXray = false here - let it complete the flow first
        const info = getBasicOrderInfo();
        const client = getClientInfo();
        const parts = [];
        if (info.orderId) {
            parts.push(info.orderId);
            parts.push(`subject:"${info.orderId}"`);
        }
        if (client.email) parts.push(`"${client.email}"`);
        if (client.name) parts.push(`"${client.name}"`);
        if (!client.email && parts.length) {
            const query = parts.join(' OR ');
            const gmailUrl = `https://mail.google.com/mail/u/1/#search/${encodeURIComponent(query)}`;
            bg.openOrReuseTab({ url: gmailUrl, active: true });
        }
        if (client.email) {
            const searchUrl = `https://db.incfile.com/order-tracker/orders/order-search?fennec_email=${encodeURIComponent(client.email)}`;
            bg.openOrReuseTab({ url: searchUrl, active: false });
        }
        if (info.orderId) {
            const adyenUrl = `https://ca-live.adyen.com/ca/ca/overview/default.shtml?fennec_order=${info.orderId}`;
            sessionSet({ fennecFraudAdyen: adyenUrl });

            function findKountLink() {
                // First look for the new KOUNT 360 URL pattern (app.kount.com/event-analysis/order/)
                const direct360 = document.querySelector('a[href*="app.kount.com/event-analysis/order/"]');
                if (direct360) return direct360.href;
                
                // Then look for the old KOUNT URL pattern (kount.net/workflow/detail)
                const direct = document.querySelector('a[href*="kount.net"][href*="workflow/detail"]');
                if (direct) return direct.href;
                
                // Check iframes for both patterns
                for (const frame of document.querySelectorAll('iframe')) {
                    try {
                        const doc = frame.contentDocument;
                        if (!doc) continue;
                        
                        // Look for new KOUNT 360 pattern first
                        const a360 = doc.querySelector('a[href*="app.kount.com/event-analysis/order/"]');
                        if (a360) return a360.href;
                        
                        // Then look for old pattern
                        const a = doc.querySelector('a[href*="kount.net"][href*="workflow/detail"]');
                        if (a) return a.href;
                    } catch (e) { /* ignore cross-origin frames */ }
                }
                return null;
            }

            function openKount(retries = 40) {
                const url = findKountLink();
                if (url) {
                    console.log('[FENNEC (MVP)] Opening KOUNT URL:', url);
                    // Store the KOUNT URL for the launcher to identify
                    sessionSet({ fennecFraudKount: url });
                    // Mark that KOUNT has been opened to prevent duplicates
                    sessionStorage.setItem('fennecKountOpened', '1');
                    bg.openOrReuseTab({ url, active: true });
                } else if (retries > 0) {
                    setTimeout(() => openKount(retries - 1), 500);
                } else {
                    console.warn('[FENNEC (MVP)] Failed to find KOUNT link after all retries');
                }
            }
            
            // Check if KOUNT has already been opened to prevent duplicates
            if (!sessionStorage.getItem('fennecKountOpened')) {
                openKount();
            } else {
                console.log('[FENNEC (MVP)] KOUNT already opened, skipping duplicate');
            }
        }
        
        // Mark XRAY flow as completed after opening all tabs
        console.log('[FENNEC (MVP)] XRAY flow completed - all tabs opened for order:', orderId);
        fraudXray = false;
    }

chrome.storage.local.get({ fennecPendingComment: null }, ({ fennecPendingComment }) => {
    processPendingComment(fennecPendingComment);
});

chrome.storage.local.get({ fennecPendingUpload: null }, ({ fennecPendingUpload }) => {
    processPendingUpload(fennecPendingUpload);
});

chrome.storage.local.get({ fennecUpdateRequest: null }, ({ fennecUpdateRequest }) => {
    processUpdateRequest(fennecUpdateRequest);
});

chrome.storage.local.get({ fennecDupCancel: null }, ({ fennecDupCancel }) => {
    processDuplicateCancel(fennecDupCancel);
});

const pendingNote = sessionStorage.getItem('fennecAddComment');
if (pendingNote) {
    sessionStorage.removeItem('fennecAddComment');
    setTimeout(() => addOrderComment(pendingNote), 1500);
}

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.sidebarSessionId &&
        changes.sidebarSessionId.newValue !== getFennecSessionId()) {
        return;
    }
    if (area === 'local' && changes.fennecReviewMode) {
        reviewMode = changes.fennecReviewMode.newValue;
        updateReviewDisplay();
    }
    if (area === 'local' && changes.fennecDevMode) {
        devMode = changes.fennecDevMode.newValue;
        window.location.reload();
    }
    if (area === 'local' && changes.fennecPendingComment) {
        processPendingComment(changes.fennecPendingComment.newValue);
    }
    if (area === 'local' && changes.fennecPendingUpload) {
        processPendingUpload(changes.fennecPendingUpload.newValue);
    }
    if (area === 'local' && changes.fennecDupCancel) {
        processDuplicateCancel(changes.fennecDupCancel.newValue);
    }
    if (area === 'local' && changes.fennecUpdateRequest) {
        processUpdateRequest(changes.fennecUpdateRequest.newValue);
    }
    if (area === 'local' && (changes.sidebarDb || changes.sidebarOrderId || changes.sidebarOrderInfo)) {
        const currentId = getBasicOrderInfo().orderId;
        chrome.storage.local.get({ sidebarOrderId: null }, ({ sidebarOrderId }) => {
            if (sidebarOrderId === currentId) {
                const isStorage = /\/storage\/incfile\//.test(location.pathname);
                if (isStorage && !reviewMode) {
                    // For storage pages with REVIEW MODE off, don't load stored summary
                    // as it might contain DNA/Kount content
                    console.log('[FENNEC (MVP)] Storage page with REVIEW MODE off - skipping stored summary load');
                } else {
                    loadStoredSummary();
                }
                updateReviewDisplay();
            }
        });
    }
    if (area === 'local' && changes.adyenDnaInfo && reviewMode) {
        loadDnaSummary();
    }
    if (area === 'local' && changes.kountInfo && reviewMode) {
        loadKountSummary();
    }
    if (area === 'local' && changes.sidebarSnapshot && changes.sidebarSnapshot.newValue) {
        const sb = document.getElementById('copilot-sidebar');
        if (sb) {
            sb.innerHTML = changes.sidebarSnapshot.newValue;
            attachCommonListeners(sb);
        }
    }
});

// Refresh DNA summary when returning from Adyen
window.addEventListener('focus', () => {
    if (reviewMode) {
        loadDnaSummary();
        loadKountSummary();
    }
});
    }
}

new DBLauncher().init();
