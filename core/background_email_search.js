import "./background_controller.js";
// Background worker handling tab management and other extension messages
// Use a declarative rule to strip the Origin header from local Mistral API
// requests so Ollama accepts them without CORS errors.
function registerMistralRule() {
    chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1],
        addRules: [{
            id: 1,
            priority: 1,
            action: {
                type: "modifyHeaders",
                requestHeaders: [{ header: "origin", operation: "remove" }]
            },
            condition: {
                urlFilter: "http://127.0.0.1:11434/",
                resourceTypes: ["xmlhttprequest"]
            }
        }]
    });
}

registerMistralRule();

// Background script functionality
chrome.runtime.onInstalled.addListener(() => {
    // Extension installed/updated
});

chrome.runtime.onStartup.addListener(() => {
    // Browser startup
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'testMessage') {
        sendResponse({ success: true, received: message });
        return true;
    }
    
    if (fennecBackground[message.action]) {
        const result = fennecBackground[message.action](message, sender, sendResponse);
        if (result) return true;
        return;
    }

    if (message.action === "checkLastIssue" && message.orderId) {
        const orderId = message.orderId;
        let base = "https://db.incfile.com";
        if (sender && sender.tab && sender.tab.url) {
            try {
                const url = new URL(sender.tab.url);
                if (url.hostname.endsWith("incfile.com")) {
                    base = url.origin;
                }
            } catch (err) {
                console.warn("[Copilot] Invalid sender URL", sender.tab.url);
            }
        }
        const query = { url: `${base}/incfile/order/detail/${orderId}*` };
        let attempts = 15;
        let delay = 1000;

        const tryFetch = () => {
            chrome.tabs.query(query, (tabs) => {
                const tab = tabs && tabs[0];
                if (!tab || tab.status !== "complete") {
                    if (attempts > 0) {
                        setTimeout(() => {
                            attempts--;
                            delay = Math.min(delay * 1.5, 10000);
                            tryFetch();
                        }, delay);
                    } else {
                        console.warn(`[Copilot] Issue check timed out for order ${orderId}`);
                        sendResponse({ issueInfo: null });
                    }
                    return;
                }
                chrome.tabs.sendMessage(tab.id, { action: "getLastIssue" }, (resp) => {
                    if (chrome.runtime.lastError) {
                        if (attempts > 0) {
                            setTimeout(() => {
                                attempts--;
                                delay = Math.min(delay * 1.5, 10000);
                                tryFetch();
                            }, delay);
                        } else {
                            console.warn(`[Copilot] Issue check timed out for order ${orderId}`);
                            sendResponse({ issueInfo: null });
                        }
                        return;
                    }
                    sendResponse(resp);
                });
            });
        };

        tryFetch();
        return true;
    }

    if (message.action === "checkHoldUser" && message.orderId) {
        const orderId = message.orderId;
        let base = "https://db.incfile.com";
        if (sender && sender.tab && sender.tab.url) {
            try {
                const url = new URL(sender.tab.url);
                if (url.hostname.endsWith("incfile.com")) {
                    base = url.origin;
                }
            } catch (err) {
                console.warn("[Copilot] Invalid sender URL", sender.tab.url);
            }
        }
        const query = { url: `${base}/incfile/order/detail/${orderId}*` };
        let attempts = 15;
        let delay = 1000;

        const tryFetch = () => {
            chrome.tabs.query(query, (tabs) => {
                const tab = tabs && tabs[0];
                if (!tab || tab.status !== "complete") {
                    if (attempts > 0) {
                        setTimeout(() => {
                            attempts--;
                            delay = Math.min(delay * 1.5, 10000);
                            tryFetch();
                        }, delay);
                    } else {
                        console.warn(`[Copilot] Hold user check timed out for order ${orderId}`);
                        sendResponse({ holdUser: null });
                    }
                    return;
                }
                chrome.tabs.sendMessage(tab.id, { action: "getHoldUser" }, (resp) => {
                    if (chrome.runtime.lastError) {
                        if (attempts > 0) {
                            setTimeout(() => {
                                attempts--;
                                delay = Math.min(delay * 1.5, 10000);
                                tryFetch();
                            }, delay);
                        } else {
                            console.warn(`[Copilot] Hold user check timed out for order ${orderId}`);
                            sendResponse({ holdUser: null });
                        }
                        return;
                    }
                    sendResponse(resp);
                });
            });
        };

        tryFetch();
        return true;
    }

    if (message.action === "fetchChildOrders" && message.orderId) {
        console.log('[FENNEC (POO)] fetchChildOrders handler started for orderId:', message.orderId);
        const orderId = message.orderId;
        let base = "https://db.incfile.com";
        if (sender && sender.tab && sender.tab.url) {
            try {
                const url = new URL(sender.tab.url);
                if (url.hostname.endsWith("incfile.com")) {
                    base = url.origin;
                }
            } catch (err) {
                console.warn("[Copilot] Invalid sender URL", sender.tab.url);
            }
        }
        const url = `${base}/incfile/order/detail/${orderId}?fennec_no_store=1`;
        const query = { url: `${url}*` };
        let attempts = 15;
        let delay = 1000;
        let createdTabId = null;
        
        console.log('[FENNEC (POO)] fetchChildOrders - Target URL:', url);

        const openAndQuery = () => {
            console.log('[FENNEC (POO)] fetchChildOrders - Querying tabs with query:', query);
            chrome.tabs.query(query, (tabs) => {
                let tab = tabs && tabs[0];
                const ensureLoaded = () => {
                    if (!tab || tab.status !== "complete") {
                        if (attempts > 0) {
                            if (!tab && !createdTabId) {
                                console.log('[FENNEC (POO)] fetchChildOrders - Creating new background tab for parent order');
                                chrome.tabs.create({ url, active: false, windowId: sender.tab ? sender.tab.windowId : undefined }, t => {
                                    tab = t;
                                    createdTabId = t.id;
                                    console.log('[FENNEC (POO)] fetchChildOrders - Created tab with ID:', t.id);
                                });
                            } else {
                                console.log('[FENNEC (POO)] fetchChildOrders - Using existing tab or waiting for creation');
                            }
                            setTimeout(() => {
                                attempts--;
                                delay = Math.min(delay * 1.5, 10000);
                                chrome.tabs.query(query, qs => { tab = qs && qs[0]; ensureLoaded(); });
                            }, delay);
                        } else {
                            console.warn(`[Copilot] Child order fetch timed out for ${orderId}`);
                            sendResponse({ childOrders: null, parentInfo: null });
                            if (createdTabId) chrome.tabs.remove(createdTabId);
                        }
                        return;
                    }
                    console.log('[FENNEC (POO)] fetchChildOrders - Sending getChildOrders message to tab:', tab.id);
                    chrome.tabs.sendMessage(tab.id, { action: "getChildOrders" }, resp => {
                        if (chrome.runtime.lastError) {
                            console.warn("[FENNEC (POO)] fetchChildOrders - Child order extraction error:", chrome.runtime.lastError.message);
                            sendResponse({ childOrders: null, parentInfo: null });
                            if (createdTabId) chrome.tabs.remove(createdTabId);
                            return;
                        }
                        console.log('[FENNEC (POO)] fetchChildOrders - Received response:', resp);
                        sendResponse(resp);
                        if (createdTabId) chrome.tabs.remove(createdTabId);
                    });
                };
                ensureLoaded();
            });
        };

        openAndQuery();
        return true;
    }

    if (message.action === "fetchLastIssue" && message.orderId) {
        const orderId = message.orderId;
        let base = "https://db.incfile.com";
        if (sender && sender.tab && sender.tab.url) {
            try {
                const url = new URL(sender.tab.url);
                if (url.hostname.endsWith("incfile.com")) {
                    base = url.origin;
                }
            } catch (err) {
                console.warn("[Copilot] Invalid sender URL", sender.tab.url);
            }
        }
        const url = `${base}/incfile/order/detail/${orderId}`;
        const query = { url: `${url}*` };
        let attempts = 15;
        let delay = 1000;
        let createdTabId = null;

        const openAndFetch = () => {
            chrome.tabs.query(query, (tabs) => {
                let tab = tabs && tabs[0];
                const ensureLoaded = () => {
                    if (!tab || tab.status !== "complete") {
                        if (attempts > 0) {
                            if (!tab) {
                                chrome.tabs.create({ url, active: false, windowId: sender.tab ? sender.tab.windowId : undefined }, t => {
                                    tab = t;
                                    createdTabId = t.id;
                                });
                            }
                            setTimeout(() => {
                                attempts--;
                                delay = Math.min(delay * 1.5, 10000);
                                chrome.tabs.query(query, qs => { tab = qs && qs[0]; ensureLoaded(); });
                            }, delay);
                        } else {
                            console.warn(`[Copilot] Issue fetch timed out for ${orderId}`);
                            sendResponse({ issueInfo: null });
                            if (createdTabId) chrome.tabs.remove(createdTabId);
                        }
                        return;
                    }
                    chrome.tabs.sendMessage(tab.id, { action: "getLastIssue" }, resp => {
                        if (chrome.runtime.lastError || !resp || !resp.issueInfo) {
                            chrome.tabs.sendMessage(tab.id, { action: "getHoldUser" }, hold => {
                                if (chrome.runtime.lastError) {
                                    console.warn("[Copilot] Hold user fetch error:", chrome.runtime.lastError.message);
                                    sendResponse({ issueInfo: null });
                                } else {
                                    const user = hold && hold.holdUser ? `On hold by ${hold.holdUser}` : "On hold";
                                    sendResponse({ issueInfo: { text: user, active: true } });
                                }
                                if (createdTabId) chrome.tabs.remove(createdTabId);
                            });
                        } else {
                            sendResponse(resp);
                            if (createdTabId) chrome.tabs.remove(createdTabId);
                        }
                    });
                };
                ensureLoaded();
            });
        };

        openAndFetch();
        return true;
    }

    if (message.action === "fetchIntStorage" && message.orderId) {
        const orderId = message.orderId;
        console.log('[FENNEC (POO) BG] fetchIntStorage called for orderId:', orderId);
        
        // Prevent multiple simultaneous requests for the same order
        const requestKey = `intStorage_${orderId}`;
        if (globalThis.activeRequests && globalThis.activeRequests[requestKey]) {
            console.log('[FENNEC (POO) BG] Request already in progress for orderId:', orderId);
            sendResponse({ files: null, error: "Request already in progress" });
            return true;
        }
        
        // Initialize global active requests tracker  
        if (!globalThis.activeRequests) globalThis.activeRequests = {};
        globalThis.activeRequests[requestKey] = true;
        
        // Cleanup function to remove active request tracking
        const cleanup = () => {
            delete globalThis.activeRequests[requestKey];
        };
        
        // Check if INT STORAGE data is already cached for this order
        chrome.storage.local.get({ intStorageCache: {} }, ({ intStorageCache }) => {
            const cacheKey = `order_${orderId}`;
            const cachedData = intStorageCache[cacheKey];
            
            // If we have cached data and it's recent (less than 5 minutes old), return it immediately
            if (cachedData && cachedData.timestamp && (Date.now() - cachedData.timestamp) < 300000) {
                cleanup();
                sendResponse(cachedData.data);
                return;
            }
            
            // No cached data or expired, fetch from storage page
            let base = "https://db.incfile.com";
            if (sender && sender.tab && sender.tab.url) {
                try {
                    const url = new URL(sender.tab.url);
                    if (url.hostname.endsWith("incfile.com")) {
                        base = url.origin;
                    }
                } catch (err) {
                    console.warn("[Copilot] Invalid sender URL", sender.tab.url);
                }
            }
            const url = `${base}/storage/incfile/${orderId}`;
            console.log('[FENNEC (POO) BG] Opening URL:', url);
            const query = { url: `${url}*` };
            let attempts = 15;
            let delay = 1000;
            let createdTabId = null;

            const openAndFetch = () => {
                chrome.tabs.query(query, tabs => {
                    let tab = tabs && tabs[0];
                    const ensureLoaded = () => {
                        console.log('[FENNEC (POO) BG] Tab status check:', tab ? { id: tab.id, status: tab.status } : 'no tab');
                        if (!tab || tab.status !== "complete") {
                            if (attempts > 0) {
                                if (!tab) {
                                    console.log('[FENNEC (POO) BG] Creating new tab for URL:', url);
                                    chrome.tabs.create({ url, active: false, windowId: sender.tab ? sender.tab.windowId : undefined }, t => {
                                        tab = t;
                                        createdTabId = t.id;
                                        console.log('[FENNEC (POO) BG] Created tab:', t.id);
                                    });
                                }
                                setTimeout(() => {
                                    attempts--;
                                    delay = Math.min(delay * 1.5, 10000);
                                    chrome.tabs.query(query, qs => { tab = qs && qs[0]; ensureLoaded(); });
                                }, delay);
                            } else {
                                console.log('[FENNEC (POO) BG] Tab loading timeout, attempts exhausted');
                                cleanup();
                                sendResponse({ files: null });
                                if (createdTabId) chrome.tabs.remove(createdTabId);
                            }
                            return;
                        }
                        console.log('[FENNEC (POO) BG] Sending getIntStorageList to tab:', tab.id);
                        
                        // Add retry mechanism for content script injection
                        let retryCount = 0;
                        const maxRetries = 5;
                        
                        const sendGetIntStorageList = () => {
                            chrome.tabs.sendMessage(tab.id, { action: "getIntStorageList" }, resp => {
                                console.log('[FENNEC (POO) BG] getIntStorageList response:', resp);
                                if (chrome.runtime.lastError || !resp) {
                                    const msg = chrome.runtime.lastError ? chrome.runtime.lastError.message : "no response";
                                    console.error('[FENNEC (POO) BG] getIntStorageList error:', msg);
                                    
                                    // Retry if content script might not be ready yet
                                    if (retryCount < maxRetries && /Could not establish connection|Receiving end does not exist/i.test(msg)) {
                                        retryCount++;
                                        console.log('[FENNEC (POO) BG] Retrying getIntStorageList, attempt:', retryCount);
                                        setTimeout(sendGetIntStorageList, 1000);
                                        return;
                                    }
                                    
                                    cleanup();
                                    sendResponse({ files: null, error: msg });
                                } else {
                                    // Cache the data for future requests
                                    const cacheData = {
                                        data: resp,
                                        timestamp: Date.now()
                                    };
                                    chrome.storage.local.get({ intStorageCache: {} }, ({ intStorageCache: currentCache }) => {
                                        currentCache[cacheKey] = cacheData;
                                        chrome.storage.local.set({ intStorageCache: currentCache });
                                    });
                                    
                                    cleanup();
                                    sendResponse(resp);
                                }
                                if (createdTabId) chrome.tabs.remove(createdTabId);
                            });
                        };
                        
                        // Start the retry mechanism with initial delay to allow content script to initialize
                        setTimeout(sendGetIntStorageList, 2000);
                    };
                    ensureLoaded();
                });
            };

            openAndFetch();
        });
        return true;
    }

    function fetchEmailOrders(winId, email, callback) {
        console.log('[FENNEC (POO)] fetchEmailOrders', { winId, email });
        const encoded = email ? encodeURIComponent(email) : null;
        const queryTabs = () => {
            chrome.tabs.query({ windowId: winId }, tabs => {
                const searchTabs = tabs.filter(t => t.url &&
                    (t.url.includes('/order-tracker/orders/order-search') ||
                     t.url.includes('/db-tools/scan-email-address')));
                console.log('[FENNEC (POO)] available search tabs', searchTabs.map(t => t.url));
                let searchTab = null;
                if (encoded) searchTab = searchTabs.find(t => t.url.includes('fennec_email=' + encoded));
                if (!searchTab) searchTab = searchTabs.find(t => t.active) || searchTabs[0];

                let createdTabId = null;
                const startFetch = () => {
                    if (!searchTab) {
                        if (!encoded) { callback(null); return; }
                        const url = `https://db.incfile.com/order-tracker/orders/order-search?fennec_email=${encoded}`;
                        chrome.tabs.create({ url, active: false, windowId: winId }, t => {
                            searchTab = t;
                            createdTabId = t.id;
                            runFetch();
                        });
                    } else {
                        chrome.tabs.update(searchTab.id, { active: false }, runFetch);
                    }
                };

                let attempts = 8;
                const runFetch = () => {
                    console.log('[FENNEC (POO)] getEmailOrders attempt', { attempts_left: attempts, tabId: searchTab.id });
                    chrome.tabs.sendMessage(searchTab.id, { action: 'getEmailOrders' }, resp => {
                        if (chrome.runtime.lastError || !resp) {
                            const msg = chrome.runtime.lastError ? chrome.runtime.lastError.message : 'no response';
                            if (/Could not establish connection|Receiving end does not exist/i.test(msg) && attempts > 0) {
                                attempts--;
                                setTimeout(runFetch, 1000);
                                return;
                            }
                            console.warn('[FENNEC (POO)] getEmailOrders failed:', msg);
                            callback(null);
                        } else {
                            console.log('[FENNEC (POO)] getEmailOrders response', resp);
                            const orders = Array.isArray(resp.orders) ? resp.orders : [];
                            const counts = { cxl: 0, pending: 0, shipped: 0, transferred: 0 };
                            orders.forEach(o => {
                                const s = String(o.status || '').toUpperCase();
                                if (/CANCEL/.test(s)) counts.cxl++;
                                else if (/TRANSFERRED/.test(s)) counts.transferred++;
                                else if (/SHIPPED/.test(s)) counts.shipped++;
                                else if (/PROCESSING|REVIEW|HOLD/.test(s)) counts.pending++;
                            });
                            counts.total = typeof resp.total === 'number' ? resp.total : orders.length;
                            callback({ orders, counts });
                        }
                    });
                };

                startFetch();
            });
        };

        queryTabs();
    }

    function checkOrderSubs(orderId, winId, done) {
        const url = `https://db.incfile.com/incfile/order/detail/${orderId}?fennec_sub_check=1`;
        const query = { url: `${url}*` };
        let attempts = 10;
        let delay = 1000;
        let createdTabId = null;
        const openAndCheck = () => {
            chrome.tabs.query(query, tabs => {
                let tab = tabs && tabs[0];
                const ensureLoaded = () => {
                    if (!tab || tab.status !== 'complete') {
                        if (attempts > 0) {
                            if (!tab && !createdTabId) {
                                chrome.tabs.create({ url, active: false, windowId: winId }, t => { tab = t; createdTabId = t.id; });
                            }
                            setTimeout(() => {
                                attempts--;
                                delay = Math.min(delay * 1.5, 10000);
                                chrome.tabs.query(query, qs => { tab = qs && qs[0]; ensureLoaded(); });
                            }, delay);
                        } else {
                            if (createdTabId) chrome.tabs.remove(createdTabId);
                            done([]);
                        }
                        return;
                    }
                    chrome.tabs.sendMessage(tab.id, { action: 'getActiveSubs' }, resp => {
                        const subs = resp && Array.isArray(resp.subs) ? resp.subs : [];
                        if (createdTabId) chrome.tabs.remove(createdTabId);
                        done(subs);
                    });
                };
                ensureLoaded();
            });
        };
        openAndCheck();
    }

    if (message.action === 'countEmailOrders' && sender.tab) {
        const winId = sender.tab.windowId;
        fetchEmailOrders(winId, message.email, info => {
            if (!info) {
                sendResponse({ orderCount: 0, statusCounts: null, ltv: message.ltv });
                return;
            }
            sendResponse({ orderCount: info.counts.total, statusCounts: info.counts, ltv: message.ltv });
        });
        return true;
    }

    if (message.action === 'detectSubscriptions' && message.email && sender.tab) {
        console.log('[FENNEC (POO)] detectSubscriptions request for', message.email);
        const winId = sender.tab.windowId;
        fetchEmailOrders(winId, message.email, info => {
            if (!info) { sendResponse({ orderCount: 0, activeSubs: [], ltv: message.ltv }); return; }
            const ids = info.orders.filter(o => /SHIPPED/i.test(o.status) || /PROCESSING|REVIEW|HOLD/i.test(o.status)).map(o => o.orderId);
            const active = [];
            const next = () => {
                const id = ids.shift();
                if (!id) {
                    sendResponse({ orderCount: info.counts.total, statusCounts: info.counts, activeSubs: active, ltv: message.ltv });
                    return;
                }
                checkOrderSubs(id, winId, subs => { if (subs && subs.length) active.push(...subs); next(); });
            };
            next();
        });
        return true;
    }

    if (message.action === "sosSearch" && message.url && message.query) {
        const openSearchTab = () => {
            chrome.tabs.create({ url: message.url, active: true }, (tab) => {
                if (chrome.runtime.lastError) {
                    console.error("[Copilot] Error opening SOS tab:", chrome.runtime.lastError.message);
                    return;
                }
                const inject = (tabId) => {
                    chrome.scripting.executeScript({
                        target: { tabId },
                        func: (q, type) => {
                            const patterns = type === "id"
                                ? ["id", "number", "document", "control", "filing", "account"]
                                : ["name", "business", "entity", "organization", "company", "keyword", "search"];
                            const skip = ["login", "email", "user", "password"];
                            // Some SOS sites, like Wyoming, load their search
                            // fields slowly or behind security checks.
                            // Give them more time before giving up.
                            let attempts = 20; // was 10
                            const run = () => {
                                const inputs = Array.from(document.querySelectorAll("input[type='text'],input[type='search'],input:not([type]),textarea"));
                                const field = inputs.find(i => {
                                    if (i.type === 'hidden' || !(i.offsetWidth || i.offsetHeight || i.getClientRects().length)) return false;
                                    const attrs = (i.name || "") + " " + (i.id || "") + " " + (i.placeholder || "") + " " + (i.getAttribute("aria-label") || "");
                                    const txt = attrs.toLowerCase();
                                    if (skip.some(p => txt.includes(p))) return false;
                                    return patterns.some(p => txt.includes(p));
                                });
                                if (field) {
                                    field.focus();
                                    field.value = q;
                                    field.dispatchEvent(new Event("input", { bubbles: true }));
                                    const form = field.form;
                                    const btn = form ? form.querySelector("button[type=\"submit\"],input[type=\"submit\"]") : null;
                                    if (btn) {
                                        btn.click();
                                    } else if (form) {
                                        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
                                    } else {
                                        field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
                                        field.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true }));
                                    }
                                } else if (attempts-- > 0) {
                                    setTimeout(run, 500);
                                }
                            };
                            run();
                        },
                        args: [message.query, message.searchType]
                    });
                };
                const listener = (tabId, info) => {
                    if (tabId === tab.id && info.status === "complete") {
                        chrome.tabs.onUpdated.removeListener(listener);
                        inject(tabId);
                    }
                };
                chrome.tabs.onUpdated.addListener(listener);
            });
        };

        openSearchTab();
        return;
    }

    if (message.action === "openKnowledgeBase" && message.state) {
        const state = message.state;
        const type = message.orderType || "";
        const url = "https://coda.io/d/Bizee-Filing-Department_dQJWsDF3UZ6/Knowledge-Base_suQao1ou";
        chrome.tabs.create({ url, active: true }, (tab) => {
            if (chrome.runtime.lastError) {
                console.error("[Copilot] Error opening KB tab:", chrome.runtime.lastError.message);
                return;
            }
            const inject = (tabId) => {
                chrome.scripting.executeScript({
                    target: { tabId },
                    func: (state, type) => {
                        function clickExact(txt) {
                            const nodes = Array.from(document.querySelectorAll("a,button,span,div"));
                            const target = nodes.find(n => n.textContent && n.textContent.trim().toLowerCase() === txt.toLowerCase());
                            if (target) { target.click(); return true; }
                            return false;
                        }

                        function clickStateAnchor(stateName) {
                            const slug = stateName.replace(/\s+/g, "-");
                            const sel = `a[href*='/${slug}_']`;
                            const el = document.querySelector(sel);
                            if (el) { el.click(); return true; }
                            return clickExact(stateName);
                        }

                        let tries = 40;
                        const run = () => {
                            if (clickStateAnchor(state)) {
                                if (type) {
                                    let typeTries = 40;
                                    const tryType = () => {
                                        if (!clickExact(type) && typeTries-- > 0) {
                                            setTimeout(tryType, 500);
                                        }
                                    };
                                    setTimeout(tryType, 500);
                                }
                            } else if (tries-- > 0) {
                                setTimeout(run, 500);
                            }
                        };
                        run();
                    },
                    args: [state, type]
                });
            };
            const listener = (tabId, info) => {
                if (tabId === tab.id && info.status === "complete") {
                    chrome.tabs.onUpdated.removeListener(listener);
                    inject(tabId);
                }
            };
            chrome.tabs.onUpdated.addListener(listener);
        });
        return;
    }

    if (message.action === "openKnowledgeBaseWindow" && message.state) {
        const state = message.state;
        const type = message.orderType || "";
        const url = "https://coda.io/d/Bizee-Filing-Department_dQJWsDF3UZ6/Knowledge-Base_suQao1ou";
        const width = message.width || 800;
        const height = message.height || 600;
        const left = message.left;
        const top = message.top;
        const opts = { url, type: "popup", width, height };
        if (typeof left === "number") opts.left = left;
        if (typeof top === "number") opts.top = top;
        chrome.windows.create(opts, (win) => {
            if (chrome.runtime.lastError) {
                console.error("[Copilot] Error opening KB window:", chrome.runtime.lastError.message);
                return;
            }
            const tab = win.tabs && win.tabs[0];
            if (!tab || !tab.id) return;
            const inject = (tabId) => {
                chrome.scripting.executeScript({
                    target: { tabId },
                    func: (state, type) => {
                        function clickExact(txt) {
                            const nodes = Array.from(document.querySelectorAll("a,button,span,div"));
                            const target = nodes.find(n => n.textContent && n.textContent.trim().toLowerCase() === txt.toLowerCase());
                            if (target) { target.click(); return true; }
                            return false;
                        }

                        function clickStateAnchor(stateName) {
                            const slug = stateName.replace(/\s+/g, "-");
                            const sel = `a[href*='/${slug}_']`;
                            const el = document.querySelector(sel);
                            if (el) { el.click(); return true; }
                            return clickExact(stateName);
                        }

                        let tries = 40;
                        const run = () => {
                            if (clickStateAnchor(state)) {
                                if (type) {
                                    let typeTries = 40;
                                    const tryType = () => {
                                        if (!clickExact(type) && typeTries-- > 0) {
                                            setTimeout(tryType, 500);
                                        }
                                    };
                                    setTimeout(tryType, 500);
                                }
                            } else if (tries-- > 0) {
                                setTimeout(run, 500);
                            }
                        };
                        run();
                    },
                    args: [state, type]
                });
            };
            const listener = (tabId, info) => {
                if (tabId === tab.id && info.status === "complete") {
                    chrome.tabs.onUpdated.removeListener(listener);
                    inject(tabId);
                }
            };
            chrome.tabs.onUpdated.addListener(listener);
        });
        return;
    }

    if (message.action === "openFilingWindow") {
        const txUrl = "https://direct.sos.state.tx.us/acct/acct-login.asp";
        chrome.windows.create({ url: txUrl, type: "popup" }, (win) => {
            if (chrome.runtime.lastError) {
                console.error("[Copilot] Error opening filing window:", chrome.runtime.lastError.message);
            }
        });
        return;
    }

    if (message.action === "navigateKbFrame" && message.state && sender.tab) {
        const state = message.state;
        const type = message.orderType || "";
        chrome.scripting.executeScript({
            target: { tabId: sender.tab.id, allFrames: true },
            func: (state, type) => {
                if (!location.hostname.includes('coda.io')) return;
                function clickExact(txt) {
                    const nodes = Array.from(document.querySelectorAll('a,button,span,div'));
                    const target = nodes.find(n => n.textContent && n.textContent.trim().toLowerCase() === txt.toLowerCase());
                    if (target) { target.click(); return true; }
                    return false;
                }

                function clickStateAnchor(stateName) {
                    const slug = stateName.replace(/\s+/g, '-');
                    const sel = `a[href*='/${slug}_']`;
                    const el = document.querySelector(sel);
                    if (el) { el.click(); return true; }
                    return clickExact(stateName);
                }

                let tries = 40;
                const run = () => {
                    if (clickStateAnchor(state)) {
                        if (type) {
                            let typeTries = 40;
                            const tryType = () => {
                                if (!clickExact(type) && typeTries-- > 0) {
                                    setTimeout(tryType, 500);
                                }
                            };
                            setTimeout(tryType, 500);
                        }
                    } else if (tries-- > 0) {
                        setTimeout(run, 500);
                    }
                };
                run();
            },
            args: [state, type]
        });
        return;
    }

    if (message.action === "mistralGenerate" && message.prompt) {
        const body = {
            model: "mistral",
            prompt: message.prompt,
            stream: false
        };
        fetch("http://127.0.0.1:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        })
            .then(r => r.json())
            .then(j => sendResponse({ text: j.response || "" }))
            .catch(err => {
                console.warn("[Copilot] Mistral fetch error:", err);
                sendResponse({ text: "Error" });
            });
        return true;
    }

    if (message.action === "focusDbSearch") {
        const encoded = message.email ? encodeURIComponent(message.email) : null;
        chrome.storage.local.get({ fennecReturnTab: null }, data => {
            chrome.tabs.query({ windowId: sender.tab.windowId }, tabs => {
                let tab = null;
                if (encoded) {
                    tab = tabs.find(t => t.url && t.url.includes("/order-tracker/orders/order-search") && t.url.includes("fennec_email=" + encoded));
                }
                if (!tab) {
                    tab = tabs.find(t => t.url && t.url.includes("/order-tracker/orders/order-search"));
                }
                const updates = {};
                if (!data.fennecReturnTab && sender.tab) {
                    updates.fennecReturnTab = sender.tab.id;
                }
                if (tab) {
                    updates.fennecDbSearchTab = tab.id;
                    chrome.storage.local.set(updates, () => {
                        chrome.tabs.update(tab.id, { active: true }, () => {
                            if (chrome.runtime.lastError) {
                                console.error("[Copilot] Error focusing DB search tab:", chrome.runtime.lastError.message);
                            }
                            sendResponse({});
                        });
                    });
                } else if (encoded) {
                    const url = "https://db.incfile.com/order-tracker/orders/order-search?fennec_email=" + encoded;
                    chrome.tabs.create({ url, active: true, windowId: sender.tab.windowId }, newTab => {
                        if (chrome.runtime.lastError) {
                            console.error("[Copilot] Error opening DB search tab:", chrome.runtime.lastError.message);
                            sendResponse({});
                            return;
                        }
                        updates.fennecDbSearchTab = newTab.id;
                        chrome.storage.local.set(updates, () => {
                            sendResponse({});
                        });
                    });
                } else {
                    if (data.fennecReturnTab) {
                        chrome.tabs.update(data.fennecReturnTab, { active: true }, () => {
                            if (chrome.runtime.lastError) {
                                console.error("[Copilot] Error focusing tab:", chrome.runtime.lastError.message);
                            }
                            chrome.storage.local.set({ fennecReturnTab: null }, () => {
                                sendResponse({});
                            });
                        });
                    } else {
                        sendResponse({});
                    }
                }
            });
        });
        return true;
    }

    if (message.action === "dbEmailSearchResults" && sender.tab) {
        chrome.storage.local.get({ fennecDbSearchTab: null, fennecReturnTab: null }, data => {
            const finalize = () => chrome.storage.local.set({ fennecDbSearchTab: null, fennecReturnTab: null });
            if (data.fennecDbSearchTab === sender.tab.id) {
                chrome.tabs.query({ url: "https://db.incfile.com/order-tracker/orders/fraud*" }, tabs => {
                    const tab = tabs && tabs[0];
                    if (tab) {
                        chrome.tabs.update(tab.id, { active: true });
                    }
                    finalize();
                });
            }
        });
        return;
    }

    if (message.action === "refocusTab") {
        chrome.storage.local.get({ fennecReturnTab: null }, ({ fennecReturnTab }) => {
            if (fennecReturnTab) {
                chrome.tabs.update(fennecReturnTab, { active: true }, () => {
                    if (chrome.runtime.lastError) {
                        console.error("[Copilot] Error focusing tab:", chrome.runtime.lastError.message);
                    }
                    chrome.storage.local.set({ fennecReturnTab: null });
                });
            }
        });
        return;
    }
    
    // Debug: Log unhandled messages
    console.log('[FENNEC (POO)] Message reached end without handling:', message.action, message);
});
