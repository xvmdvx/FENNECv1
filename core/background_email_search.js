import "./background_controller.js";

// Mute tagged console output in background context without affecting control flow
// (e.g., `return console.warn(...)` still returns undefined).
if (!globalThis.__fennecLogSilencerInstalled) {
    try {
        const TAGS_TO_MUTE = ["[FENNEC (MVP)]", "[FENNEC (MVP) DB SB]"];
        const originalConsole = {
            log: console.log.bind(console),
            info: console.info ? console.info.bind(console) : console.log.bind(console),
            warn: console.warn ? console.warn.bind(console) : console.log.bind(console),
            error: console.error ? console.error.bind(console) : console.log.bind(console),
            debug: console.debug ? console.debug.bind(console) : console.log.bind(console)
        };
        const shouldMute = (args) => {
            const first = args && args[0];
            return typeof first === 'string' && TAGS_TO_MUTE.some(tag => first.startsWith(tag));
        };
        ["log", "info", "warn", "error", "debug"].forEach(method => {
            console[method] = function(...args) {
                if (shouldMute(args)) return;
                return originalConsole[method](...args);
            };
        });
        globalThis.__fennecLogSilencerInstalled = true;
    } catch {}
}
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
    try {
        chrome.contextMenus.removeAll(() => {
            chrome.contextMenus.create({
                id: 'fennec_usps_verify',
                title: 'USPS VERIFY “%s”',
                contexts: ['selection']
            });
        });
    } catch {}
});

chrome.runtime.onStartup.addListener(() => {
    // Browser startup
    try {
        chrome.contextMenus.removeAll(() => {
            chrome.contextMenus.create({
                id: 'fennec_usps_verify',
                title: 'USPS VERIFY “%s”',
                contexts: ['selection']
            });
        });
    } catch {}
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'testMessage') {
        sendResponse({ success: true, received: message });
        return true;
    }
    
    // Auto-upload files handler
    if (message.action === 'autoUploadFiles') {
        console.log('[FENNEC (MVP) BG] Auto-upload request received:', message);
        
        const { files, orderId } = message;
        
        // Store the files for processing
        chrome.storage.local.get({ autoUploadQueue: [] }, (result) => {
            const queue = result.autoUploadQueue;
            const uploadItem = {
                id: Date.now(),
                orderId: orderId,
                files: files,
                timestamp: new Date().toISOString(),
                status: 'pending'
            };
            
            queue.push(uploadItem);
            
            chrome.storage.local.set({ autoUploadQueue: queue }, () => {
                console.log('[FENNEC (MVP) BG] Files queued for auto-upload:', uploadItem);
                
                // Notify content script about the upload
                chrome.tabs.query({ url: "*://*.incfile.com/*" }, (tabs) => {
                    tabs.forEach(tab => {
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'autoUploadQueued',
                            uploadItem: uploadItem
                        }, () => {
                            if (chrome.runtime.lastError) {
                                // Tab might not be ready
                            }
                        });
                    });
                });
                
                sendResponse({ success: true, uploadId: uploadItem.id });
            });
        });
        return true;
    }
    
    // USPS auto-close and focus management
    if (message.action === 'returnFocusToDB') {
        const address = message.address;
        console.log('[FENNEC (MVP) BG] Returning focus to DB tab for address:', address);
        
        // Get the stored source tab info for this address
        const uspsKey = `usps_source_${address}`;
        chrome.storage.local.get({ [uspsKey]: null }, (result) => {
            const sourceInfo = result[uspsKey];
            
            if (sourceInfo && sourceInfo.tabId) {
                // Try to focus the specific source tab
                chrome.tabs.get(sourceInfo.tabId, (tab) => {
                    if (chrome.runtime.lastError) {
                        console.log('[FENNEC (MVP) BG] Source tab not found for address:', address);
                        sendResponse({ success: false, error: 'Source tab not found' });
                    } else {
                        // Focus the specific source tab
                        chrome.tabs.update(sourceInfo.tabId, { active: true }, () => {
                            console.log('[FENNEC (MVP) BG] Successfully focused source DB tab:', sourceInfo.tabId);
                            sendResponse({ success: true, tabId: sourceInfo.tabId });
                        });
                    }
                });
            } else {
                console.log('[FENNEC (MVP) BG] No source tab info found for address:', address);
                sendResponse({ success: false, error: 'No source tab info found' });
            }
        });
        return true;
    }
    
    if (message.action === 'checkTabActivity') {
        const address = message.address;
        console.log('[FENNEC (MVP) BG] Checking tab activity for address:', address);
        
        // Check if the current tab (USPS tab) is still active
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                const currentTab = tabs[0];
                const isUspsTab = currentTab.url && currentTab.url.includes('tools.usps.com');
                // If USPS tab is still active, user manually activated it, so DON'T close
                const shouldClose = !isUspsTab; // Close if it's NOT the USPS tab (user switched away)
                
                console.log('[FENNEC (MVP) BG] Tab activity check - isUspsTab:', isUspsTab, 'shouldClose:', shouldClose);
                sendResponse({ shouldClose: shouldClose, tabId: currentTab.id });
            } else {
                sendResponse({ shouldClose: false, error: 'No active tab found' });
            }
        });
        return true;
    }
    
    if (message.action === 'openUspsAndStoreSource') {
        const url = message.url;
        const address = message.address;
        console.log('[FENNEC (MVP) BG] Opening USPS and storing source tab for address:', address);
        
        // Store the source tab info
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                const sourceTab = tabs[0];
                const uspsKey = `usps_source_${address}`;
                
                chrome.storage.local.set({ [uspsKey]: { tabId: sourceTab.id, url: sourceTab.url } }, () => {
                    console.log('[FENNEC (MVP) BG] Stored source tab info for address:', address, 'tabId:', sourceTab.id);
                    
                    // Open USPS tab
                    chrome.tabs.create({ url: url, active: false }, (uspsTab) => {
                        console.log('[FENNEC (MVP) BG] USPS tab opened:', uspsTab.id);
                        
                        // Activate the USPS tab after a short delay to ensure it loads
                        setTimeout(() => {
                            chrome.tabs.update(uspsTab.id, { active: true }, () => {
                                console.log('[FENNEC (MVP) BG] USPS tab activated:', uspsTab.id);
                            });
                        }, 100);
                        
                        sendResponse({ success: true, uspsTabId: uspsTab.id, sourceTabId: sourceTab.id });
                    });
                });
            } else {
                console.log('[FENNEC (MVP) BG] No source tab found');
                sendResponse({ success: false, error: 'No source tab found' });
            }
        });
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
        console.log('[FENNEC (MVP)] fetchChildOrders handler started for orderId:', message.orderId);
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
        
        console.log('[FENNEC (MVP)] fetchChildOrders - Target URL:', url);

        const openAndQuery = () => {
            console.log('[FENNEC (MVP)] fetchChildOrders - Querying tabs with query:', query);
            chrome.tabs.query(query, (tabs) => {
                let tab = tabs && tabs[0];
                const ensureLoaded = () => {
                    if (!tab || tab.status !== "complete") {
                        if (attempts > 0) {
                            if (!tab && !createdTabId) {
                                console.log('[FENNEC (MVP)] fetchChildOrders - Creating new background tab for parent order');
                                chrome.tabs.create({ url, active: false, windowId: sender.tab ? sender.tab.windowId : undefined }, t => {
                                    tab = t;
                                    createdTabId = t.id;
                                    console.log('[FENNEC (MVP)] fetchChildOrders - Created tab with ID:', t.id);
                                });
                            } else {
                                console.log('[FENNEC (MVP)] fetchChildOrders - Using existing tab or waiting for creation');
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
                    console.log('[FENNEC (MVP)] fetchChildOrders - Sending getChildOrders message to tab:', tab.id);
                    chrome.tabs.sendMessage(tab.id, { action: "getChildOrders" }, resp => {
                        if (chrome.runtime.lastError) {
                            console.warn("[FENNEC (MVP)] fetchChildOrders - Child order extraction error:", chrome.runtime.lastError.message);
                            sendResponse({ childOrders: null, parentInfo: null });
                            if (createdTabId) chrome.tabs.remove(createdTabId);
                            return;
                        }
                        console.log('[FENNEC (MVP)] fetchChildOrders - Received response:', resp);
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

    if (message.action === "findAndRefreshIntStorageTab" && message.orderId) {
        const orderId = message.orderId;
        console.log('[FENNEC (MVP) BG] findAndRefreshIntStorageTab called for orderId:', orderId);
        
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
        console.log('[FENNEC (MVP) BG] Looking for INT STORAGE tab:', url);
        
        const query = { url: `${url}*` };
        chrome.tabs.query(query, tabs => {
            let tab = tabs && tabs[0];
            if (tab) {
                console.log('[FENNEC (MVP) BG] Found existing INT STORAGE tab, refreshing:', tab.id);
                chrome.tabs.reload(tab.id, {}, () => {
                    console.log('[FENNEC (MVP) BG] INT STORAGE tab refreshed successfully');
                    sendResponse({ success: true, message: 'Tab refreshed', tabId: tab.id });
                });
            } else {
                console.log('[FENNEC (MVP) BG] No INT STORAGE tab found, creating new one');
                chrome.tabs.create({ url, active: false, windowId: sender.tab ? sender.tab.windowId : undefined }, newTab => {
                    console.log('[FENNEC (MVP) BG] Created new INT STORAGE tab:', newTab.id);
                    sendResponse({ success: true, message: 'New tab created', tabId: newTab.id });
                });
            }
        });
        
        return true;
    }

    if (message.action === "openIntStorageTab" && message.orderId) {
        const orderId = message.orderId;
        console.log('[FENNEC (MVP) BG] openIntStorageTab called for orderId:', orderId);
        
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
        console.log('[FENNEC (MVP) BG] Looking for INT STORAGE tab to open/activate:', url);
        
        const query = { url: `${url}*` };
        chrome.tabs.query(query, tabs => {
            let tab = tabs && tabs[0];
            if (tab) {
                console.log('[FENNEC (MVP) BG] Found existing INT STORAGE tab, activating:', tab.id);
                chrome.tabs.update(tab.id, { active: true }, () => {
                    chrome.windows.update(tab.windowId, { focused: true }, () => {
                        console.log('[FENNEC (MVP) BG] INT STORAGE tab activated successfully');
                        sendResponse({ success: true, message: 'Tab activated', tabId: tab.id });
                    });
                });
            } else {
                console.log('[FENNEC (MVP) BG] No INT STORAGE tab found, creating new one');
                chrome.tabs.create({ url, active: true, windowId: sender.tab ? sender.tab.windowId : undefined }, newTab => {
                    console.log('[FENNEC (MVP) BG] Created new INT STORAGE tab:', newTab.id);
                    sendResponse({ success: true, message: 'New tab created and activated', tabId: newTab.id });
                });
            }
        });
        
        return true;
    }

    if (message.action === "closeIntStorageTab" && message.orderId) {
        const orderId = message.orderId;
        console.log('[FENNEC (MVP) BG] closeIntStorageTab called for orderId:', orderId);
        
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
        console.log('[FENNEC (MVP) BG] Looking for INT STORAGE tab to close:', url);
        
        const query = { url: `${url}*` };
        chrome.tabs.query(query, tabs => {
            if (tabs && tabs.length > 0) {
                const tabIds = tabs.map(tab => tab.id);
                console.log('[FENNEC (MVP) BG] Closing INT STORAGE tabs:', tabIds);
                chrome.tabs.remove(tabIds, () => {
                    console.log('[FENNEC (MVP) BG] INT STORAGE tabs closed successfully');
                    sendResponse({ success: true, message: 'Tabs closed', closedCount: tabIds.length });
                });
            } else {
                console.log('[FENNEC (MVP) BG] No INT STORAGE tabs found to close');
                sendResponse({ success: true, message: 'No tabs to close' });
            }
        });
        
        return true;
    }

    if (message.action === "refreshIntStorageInAllEnvironments" && message.orderId) {
        const orderId = message.orderId;
        console.log('[FENNEC (MVP) BG] refreshIntStorageInAllEnvironments called for orderId:', orderId);
        
        // Find all tabs that might have sidebars with this order's INT STORAGE
        chrome.tabs.query({}, tabs => {
            const relevantTabs = tabs.filter(tab => {
                // Check if tab URL contains the order ID or is a DB/Gmail page
                return tab.url && (
                    tab.url.includes(orderId) ||
                    tab.url.includes('db.incfile.com') ||
                    tab.url.includes('mail.google.com')
                );
            });
            
            console.log('[FENNEC (MVP) BG] Found relevant tabs for INT STORAGE refresh:', relevantTabs.length);
            
            let refreshCount = 0;
            const totalTabs = relevantTabs.length;
            
            if (totalTabs === 0) {
                sendResponse({ success: true, message: 'No relevant tabs found', refreshedCount: 0 });
                return;
            }
            
            relevantTabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, { 
                    action: 'refreshIntStorageForOrder', 
                    orderId: orderId 
                }, response => {
                    refreshCount++;
                    console.log(`[FENNEC (MVP) BG] Tab ${tab.id} refresh response:`, response);
                    
                    if (refreshCount >= totalTabs) {
                        console.log('[FENNEC (MVP) BG] All tabs processed for INT STORAGE refresh');
                        sendResponse({ 
                            success: true, 
                            message: 'INT STORAGE refreshed in all environments', 
                            refreshedCount: refreshCount 
                        });
                    }
                });
            });
        });
        
        return true;
    }

    if (message.action === "fetchIntStorage" && message.orderId) {
        const orderId = message.orderId;
        console.log('[FENNEC (MVP) BG] fetchIntStorage called for orderId:', orderId);
        
        // Prevent multiple simultaneous requests for the same order
        const requestKey = `intStorage_${orderId}`;
        if (globalThis.activeRequests && globalThis.activeRequests[requestKey]) {
            console.log('[FENNEC (MVP) BG] Request already in progress for orderId:', orderId);
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
            console.log('[FENNEC (MVP) BG] Opening URL:', url);
            const query = { url: `${url}*` };
            let attempts = 15;
            let delay = 1000;
            let createdTabId = null;

            const openAndFetch = () => {
                chrome.tabs.query(query, tabs => {
                    let tab = tabs && tabs[0];
                    const ensureLoaded = () => {
                        console.log('[FENNEC (MVP) BG] Tab status check:', tab ? { id: tab.id, status: tab.status } : 'no tab');
                        if (!tab || tab.status !== "complete") {
                            if (attempts > 0) {
                                if (!tab) {
                                    console.log('[FENNEC (MVP) BG] Creating new tab for URL:', url);
                                    chrome.tabs.create({ url, active: false, windowId: sender.tab ? sender.tab.windowId : undefined }, t => {
                                        tab = t;
                                        createdTabId = t.id;
                                        console.log('[FENNEC (MVP) BG] Created tab:', t.id);
                                    });
                                }
                                setTimeout(() => {
                                    attempts--;
                                    delay = Math.min(delay * 1.5, 10000);
                                    chrome.tabs.query(query, qs => { tab = qs && qs[0]; ensureLoaded(); });
                                }, delay);
                            } else {
                                console.log('[FENNEC (MVP) BG] Tab loading timeout, attempts exhausted');
                                cleanup();
                                sendResponse({ files: null });
                                if (createdTabId) chrome.tabs.remove(createdTabId);
                            }
                            return;
                        }
                        console.log('[FENNEC (MVP) BG] Sending getIntStorageList to tab:', tab.id);
                        
                        // Add retry mechanism for content script injection
                        let retryCount = 0;
                        const maxRetries = 5;
                        
                        const sendGetIntStorageList = () => {
                            chrome.tabs.sendMessage(tab.id, { action: "getIntStorageList" }, resp => {
                                console.log('[FENNEC (MVP) BG] getIntStorageList response:', resp);
                                if (chrome.runtime.lastError || !resp) {
                                    const msg = chrome.runtime.lastError ? chrome.runtime.lastError.message : "no response";
                                    console.error('[FENNEC (MVP) BG] getIntStorageList error:', msg);
                                    
                                    // Retry if content script might not be ready yet
                                    if (retryCount < maxRetries && /Could not establish connection|Receiving end does not exist/i.test(msg)) {
                                        retryCount++;
                                        console.log('[FENNEC (MVP) BG] Retrying getIntStorageList, attempt:', retryCount);
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
        console.log('[FENNEC (MVP)] fetchEmailOrders', { winId, email });
        const encoded = email ? encodeURIComponent(email) : null;
        const queryTabs = () => {
            chrome.tabs.query({ windowId: winId }, tabs => {
                const searchTabs = tabs.filter(t => t.url &&
                    (t.url.includes('/order-tracker/orders/order-search') ||
                     t.url.includes('/db-tools/scan-email-address')));
                console.log('[FENNEC (MVP)] available search tabs', searchTabs.map(t => t.url));
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
                    console.log('[FENNEC (MVP)] getEmailOrders attempt', { attempts_left: attempts, tabId: searchTab.id });
                    chrome.tabs.sendMessage(searchTab.id, { action: 'getEmailOrders' }, resp => {
                        if (chrome.runtime.lastError || !resp) {
                            const msg = chrome.runtime.lastError ? chrome.runtime.lastError.message : 'no response';
                            if (/Could not establish connection|Receiving end does not exist/i.test(msg) && attempts > 0) {
                                attempts--;
                                setTimeout(runFetch, 1000);
                                return;
                            }
                            console.warn('[FENNEC (MVP)] getEmailOrders failed:', msg);
                            callback(null);
                        } else {
                            console.log('[FENNEC (MVP)] getEmailOrders response', resp);
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
                sendResponse({ orderCount: 0, statusCounts: null, ltv: message.ltv, orders: [] });
                return;
            }
            sendResponse({ orderCount: info.counts.total, statusCounts: info.counts, ltv: message.ltv, orders: info.orders });
        });
        return true;
    }

    if (message.action === 'detectSubscriptions' && message.email && sender.tab) {
        console.log('[FENNEC (MVP)] detectSubscriptions request for', message.email);
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
        console.log('[FENNEC (MVP)] Background: Received SOS search request:', message);
        
        const openSearchTab = () => {
            chrome.tabs.create({ url: message.url, active: true }, (tab) => {
                if (chrome.runtime.lastError) {
                    console.error("[FENNEC (MVP)] Error opening SOS tab:", chrome.runtime.lastError.message);
                    return;
                }
                
                console.log('[FENNEC (MVP)] Background: Created SOS search tab:', tab.id);
                
                const inject = (tabId) => {
                    console.log('[FENNEC (MVP)] Background: Injecting search script into tab:', tabId);
                    
                    chrome.scripting.executeScript({
                        target: { tabId },
                        func: (q, type) => {
                            console.log('[FENNEC (MVP)] Content script: Starting SOS search injection:', { query: q, type });
                            
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
                                console.log('[FENNEC (MVP)] Content script: Found inputs:', inputs.length);
                                
                                const field = inputs.find(i => {
                                    if (i.type === 'hidden' || !(i.offsetWidth || i.offsetHeight || i.getClientRects().length)) return false;
                                    const attrs = (i.name || "") + " " + (i.id || "") + " " + (i.placeholder || "") + " " + (i.getAttribute("aria-label") || "");
                                    const txt = attrs.toLowerCase();
                                    if (skip.some(p => txt.includes(p))) return false;
                                    return patterns.some(p => txt.includes(p));
                                });
                                
                                if (field) {
                                    console.log('[FENNEC (MVP)] Content script: Found search field:', field);
                                    field.focus();
                                    field.value = q;
                                    field.dispatchEvent(new Event("input", { bubbles: true }));
                                    const form = field.form;
                                    const btn = form ? form.querySelector("button[type=\"submit\"],input[type=\"submit\"]") : null;
                                    if (btn) {
                                        console.log('[FENNEC (MVP)] Content script: Clicking submit button');
                                        btn.click();
                                    } else if (form) {
                                        console.log('[FENNEC (MVP)] Content script: Submitting form');
                                        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
                                    } else {
                                        console.log('[FENNEC (MVP)] Content script: Sending Enter key events');
                                        field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
                                        field.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true }));
                                    }
                                } else if (attempts-- > 0) {
                                    console.log('[FENNEC (MVP)] Content script: Search field not found, retrying... (attempts left:', attempts, ')');
                                    setTimeout(run, 500);
                                } else {
                                    console.error('[FENNEC (MVP)] Content script: Could not find search field after all attempts');
                                }
                            };
                            run();
                        },
                        args: [message.query, message.searchType]
                    }, (result) => {
                        if (chrome.runtime.lastError) {
                            console.error('[FENNEC (MVP)] Background: Error executing search script:', chrome.runtime.lastError);
                        } else {
                            console.log('[FENNEC (MVP)] Background: Search script executed successfully');
                        }
                    });
                };
                
                const listener = (tabId, info) => {
                    if (tabId === tab.id && info.status === "complete") {
                        console.log('[FENNEC (MVP)] Background: Tab loaded completely, injecting script');
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

    if (message.action === "uspsCmraResult") {
        console.log('[FENNEC (MVP) BG] Received USPS CMRA result:', message);
        
        // Store the CMRA result for the sidebar to access
        chrome.storage.local.set({
            uspsCmraResults: {
                [message.address]: {
                    isCMRA: message.isCMRA,
                    cmraValue: message.cmraValue,
                    timestamp: Date.now()
                }
            }
        }, () => {
            // Notify all sidebar tabs about the CMRA result
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    if (tab.url && (tab.url.includes('mail.google.com') || tab.url.includes('db.incfile.com'))) {
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'uspsCmraResult',
                            address: message.address,
                            isCMRA: message.isCMRA,
                            cmraValue: message.cmraValue
                        }).catch(() => {
                            // Ignore errors for tabs that don't have content scripts
                        });
                    }
                });
            });
        });
        return true;
    }
    
    // Debug: Log unhandled messages
    console.log('[FENNEC (MVP)] Message reached end without handling:', message.action, message);
});

// Normalize freeform text into best-effort USPS address string
function normalizeAddressForUsps(input) {
    if (!input) return '';
    const STATE_MAP = {
        'ALABAMA':'AL','ALASKA':'AK','ARIZONA':'AZ','ARKANSAS':'AR','CALIFORNIA':'CA','COLORADO':'CO','CONNECTICUT':'CT','DELAWARE':'DE','FLORIDA':'FL','GEORGIA':'GA','HAWAII':'HI','IDAHO':'ID','ILLINOIS':'IL','INDIANA':'IN','IOWA':'IA','KANSAS':'KS','KENTUCKY':'KY','LOUISIANA':'LA','MAINE':'ME','MARYLAND':'MD','MASSACHUSETTS':'MA','MICHIGAN':'MI','MINNESOTA':'MN','MISSISSIPPI':'MS','MISSOURI':'MO','MONTANA':'MT','NEBRASKA':'NE','NEVADA':'NV','NEW HAMPSHIRE':'NH','NEW JERSEY':'NJ','NEW MEXICO':'NM','NEW YORK':'NY','NORTH CAROLINA':'NC','NORTH DAKOTA':'ND','OHIO':'OH','OKLAHOMA':'OK','OREGON':'OR','PENNSYLVANIA':'PA','RHODE ISLAND':'RI','SOUTH CAROLINA':'SC','SOUTH DAKOTA':'SD','TENNESSEE':'TN','TEXAS':'TX','UTAH':'UT','VERMONT':'VT','VIRGINIA':'VA','WASHINGTON':'WA','WEST VIRGINIA':'WV','WISCONSIN':'WI','WYOMING':'WY','DISTRICT OF COLUMBIA':'DC'
    };
    const toAbbr = (s) => {
        if (!s) return '';
        const up = s.trim().toUpperCase();
        if (/^[A-Z]{2}$/.test(up)) return up;
        return STATE_MAP[up] || '';
    };

    // Break into lines first to filter noise like company names/county
    const raw = String(input).replace(/[\t\r]+/g, '\n');
    let lines = raw.split(/\n+/).map(s => s.trim()).filter(Boolean);

    // Remove obvious non-address lines
    lines = lines.filter(l => !/^company\b/i.test(l))
                 .filter(l => !/\bcounty\b/i.test(l))
                 .filter(l => !/United States|USA\b/i.test(l));
    // Remove labels
    lines = lines.map(l => l.replace(/^(physical|mailing|principal|address):\s*/i, '').trim());

    // Pick street line: first line that starts with a number
    let street = lines.find(l => /^\d{1,7}\s+/.test(l)) || '';
    // If not found, try in the whole string
    if (!street) {
        const m = raw.match(/\b(\d{1,7}[^\n,]*)/);
        if (m) street = m[1].trim();
    }

    // Find line with city/state/zip across remaining text
    const joined = lines.join(' ');
    let city = '', state = '', zip = '';
    let m = joined.match(/([A-Za-z\.\-\s']+?),?\s+(?:([A-Za-z]{2})|([A-Za-z][A-Za-z\s]+))\s+(\d{5}(?:-\d{4})?)/);
    if (m) {
        city = (m[1] || '').trim();
        state = toAbbr(m[2] || m[3] || '');
        zip = (m[4] || '').trim();
    }

    // Extract line2 if present anywhere
    const line2Match = joined.match(/\b(apt|suite|ste|unit|#|floor|fl|room|rm)\b\s*([\w-]+)\b/i);
    const line2 = line2Match ? `${line2Match[1]} ${line2Match[2]}`.replace(/\s+/g,' ').toUpperCase() : '';

    // Fallback: if we still cannot detect city/state/zip, try comma-based parse
    if (!city || !state || !zip) {
        let text = String(input).replace(/[\t\n\r]+/g, ' ');
        text = text.replace(/\s{2,}/g, ' ').replace(/,?\s*(US|USA|United States)\s*$/i, '');
        const m2 = text.match(/(.+?),\s*([^,]+?),\s*([A-Za-z]{2}|[A-Za-z][A-Za-z\s]+)\s+(\d{5}(?:-\d{4})?)/);
        if (m2) {
            street = street || (m2[1] || '').trim();
            city = city || (m2[2] || '').trim();
            state = state || toAbbr(m2[3] || '');
            zip = zip || (m2[4] || '').trim();
        }
    }

    // Build canonical string: Street[, Line2], City, ST ZIP
    let parts = [];
    if (street) parts.push(street);
    if (line2) parts.push(line2);
    let head = parts.join(', ');
    let tail = [city, state, zip].filter(Boolean).join(' ').replace(/\s{2,}/g,' ').trim();
    if (city && state) tail = `${city}, ${state} ${zip}`.trim();
    const normalized = head && tail ? `${head}, ${tail}` : (head || tail);
    return (normalized || String(input).trim()).trim();
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== 'fennec_usps_verify') return;
    const raw = info.selectionText || '';
    const address = normalizeAddressForUsps(raw);
    if (!address) return;
    
    // Perform smart copy of the address
    console.log('[FENNEC (MVP) BG] USPS validation triggered for address:', address);
    
    // Store the address for smart copy in the content script
    chrome.storage.sync.set({ 
        smartCopyAddress: {
            fullAddress: address,
            components: null, // Will be parsed by content script
            timestamp: Date.now(),
            source: 'usps_context_menu'
        }
    }, () => {
        console.log('[FENNEC (MVP) BG] Smart copy data stored for USPS validation');
    });
    
    // Add to address history
    chrome.storage.sync.get({ addressHistory: [] }, (result) => {
        let addressHistory = result.addressHistory || [];
        
        // Remove duplicate if exists
        addressHistory = addressHistory.filter(item => 
            item.fullAddress !== address
        );
        
        // Add new address to beginning
        const newEntry = {
            fullAddress: address,
            components: null, // Will be parsed by content script
            timestamp: Date.now(),
            source: 'usps_context_menu'
        };
        addressHistory.unshift(newEntry);
        
        // Keep only last 5 addresses
        addressHistory = addressHistory.slice(0, 5);
        
        // Save updated history
        chrome.storage.sync.set({ addressHistory: addressHistory }, () => {
            console.log('[FENNEC (MVP) BG] Address history updated for USPS validation');
        });
    });
    
    // Open USPS validation page
    const url = 'https://tools.usps.com/zip-code-lookup.htm?byaddress&fennec_addr=' + encodeURIComponent(address);
    // Store source tab and open USPS in background then focus
    chrome.storage.local.set({ ['usps_source_' + address]: { tabId: tab?.id, url: tab?.url || '' } }, () => {
        chrome.tabs.create({ url, active: true }, () => {});
    });
});
