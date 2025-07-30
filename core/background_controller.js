// Skeleton controller wrapping service worker message handling.
class BackgroundController {
    constructor() {
        this.pendingUrls = new Set();
        this.replacingWindows = new Set();
        chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
            const fn = this[msg.action];
            if (typeof fn === 'function') {
                return fn.call(this, msg, sender, sendResponse);
            }
        });
    }

    openTab(msg, sender) {
        const opts = { url: msg.url, active: Boolean(msg.active) };
        if (msg.windowId) {
            opts.windowId = msg.windowId;
        } else if (sender && sender.tab) {
            opts.windowId = sender.tab.windowId;
        }
        chrome.tabs.create(opts);
        if (msg.refocus && sender && sender.tab) {
            chrome.storage.local.get({ fennecReturnTab: null }, ({ fennecReturnTab }) => {
                if (!fennecReturnTab) {
                    chrome.storage.local.set({ fennecReturnTab: sender.tab.id });
                }
            });
        }
    }

    openOrReuseTab(msg, sender) {
        const urlKey = msg.url;
        if (this.pendingUrls.has(urlKey)) return;
        this.pendingUrls.add(urlKey);
        const finalize = () => this.pendingUrls.delete(urlKey);

        const query = { url: `${msg.url}*` };
        chrome.tabs.query(query, (tabs) => {
            const tab = tabs && tabs[0];
            if (tab) {
                // Track existing tab if it's part of XRAY flow
                chrome.storage.local.get({ fraudReviewSession: null, xrayOpenedTabs: [] }, ({ fraudReviewSession, xrayOpenedTabs }) => {
                    console.log('[FENNEC (POO)] TAB TRACKING: Checking existing tab - fraudReviewSession:', fraudReviewSession, 'tab ID:', tab.id);
                    if (fraudReviewSession && !xrayOpenedTabs.includes(tab.id)) {
                        const updatedTabs = [...xrayOpenedTabs, tab.id];
                        chrome.storage.local.set({ xrayOpenedTabs: updatedTabs });
                        console.log('[FENNEC (POO)] TAB TRACKING: Tracked existing XRAY tab:', tab.url, 'ID:', tab.id);
                    } else {
                        console.log('[FENNEC (POO)] TAB TRACKING: Not tracking existing tab - fraudReviewSession:', fraudReviewSession, 'already tracked:', xrayOpenedTabs.includes(tab.id));
                    }
                });
                chrome.tabs.update(tab.id, { active: Boolean(msg.active) }, finalize);
            } else {
                const opts = { url: msg.url, active: Boolean(msg.active) };
                if (msg.windowId) {
                    opts.windowId = msg.windowId;
                } else if (sender && sender.tab) {
                    opts.windowId = sender.tab.windowId;
                }
                chrome.tabs.create(opts, (newTab) => {
                    // Track tabs opened during XRAY flow
                    chrome.storage.local.get({ fraudReviewSession: null, xrayOpenedTabs: [] }, ({ fraudReviewSession, xrayOpenedTabs }) => {
                        console.log('[FENNEC (POO)] TAB TRACKING: Checking new tab - fraudReviewSession:', fraudReviewSession, 'new tab ID:', newTab ? newTab.id : 'null');
                        if (fraudReviewSession && newTab) {
                            // Only track if we're in a fraud review session
                            const updatedTabs = [...xrayOpenedTabs, newTab.id];
                            chrome.storage.local.set({ xrayOpenedTabs: updatedTabs });
                            console.log('[FENNEC (POO)] TAB TRACKING: Tracked new XRAY tab:', newTab.url, 'ID:', newTab.id);
                        } else {
                            console.log('[FENNEC (POO)] TAB TRACKING: Not tracking new tab - fraudReviewSession:', fraudReviewSession, 'newTab:', !!newTab);
                        }
                    });
                    finalize();
                });
            }
            if (msg.refocus && sender && sender.tab) {
                chrome.storage.local.get({ fennecReturnTab: null }, ({ fennecReturnTab }) => {
                    if (!fennecReturnTab) {
                        chrome.storage.local.set({ fennecReturnTab: sender.tab.id });
                    }
                });
            }
        });
    }

    openActiveTab(msg) {
        chrome.tabs.create({ url: msg.url, active: true });
    }

    openTabs(msg, sender) {
        const optsBase = { active: false };
        if (msg.windowId) {
            optsBase.windowId = msg.windowId;
        } else if (sender && sender.tab) {
            optsBase.windowId = sender.tab.windowId;
        }
        (msg.urls || []).forEach(url => {
            const opts = Object.assign({ url }, optsBase);
            chrome.tabs.create(opts);
        });
    }

    replaceTabs(msg, sender) {
        if (!sender.tab) return;
        const winId = sender.tab.windowId;
        if (msg.refocus) {
            chrome.storage.local.get({ fennecReturnTab: null }, ({ fennecReturnTab }) => {
                if (!fennecReturnTab) {
                    chrome.storage.local.set({ fennecReturnTab: sender.tab.id });
                }
            });
        }
        if (this.replacingWindows.has(winId)) return;
        this.replacingWindows.add(winId);
        chrome.tabs.query({ windowId: winId }, (tabs) => {
            const isDbOrGmail = (tab) =>
                tab.url && (tab.url.includes('mail.google.com') || tab.url.includes('db.incfile.com'));
            const toClose = tabs.filter(t => t.id !== sender.tab.id && isDbOrGmail(t)).map(t => t.id);
            const finalize = () => {
                (msg.urls || []).forEach((url, idx) => {
                    const active = msg.activeFirst && idx === 0;
                    chrome.tabs.create({ url, active, windowId: winId });
                });
                setTimeout(() => this.replacingWindows.delete(winId), 1000);
            };
            if (toClose.length) {
                chrome.tabs.remove(toClose, finalize);
            } else {
                finalize();
            }
        });
    }

    closeOtherTabs(msg, sender) {
        if (!sender.tab) return;
        chrome.tabs.query({ windowId: sender.tab.windowId }, (tabs) => {
            const toClose = tabs.filter(t => t.id !== sender.tab.id).map(t => t.id);
            if (toClose.length) chrome.tabs.remove(toClose);
        });
    }

    closeTab(msg, sender) {
        if (sender.tab) chrome.tabs.remove(sender.tab.id);
    }

    refocusTab() {
        chrome.storage.local.get({ fennecReturnTab: null }, ({ fennecReturnTab }) => {
            if (fennecReturnTab) {
                chrome.tabs.update(fennecReturnTab, { active: true }, () => {
                    if (chrome.runtime.lastError) {
                        console.error('[Copilot] Error focusing tab:', chrome.runtime.lastError.message);
                    }
                    chrome.storage.local.set({ fennecReturnTab: null });
                });
            } else {
                chrome.tabs.query({ url: 'https://db.incfile.com/order-tracker/orders/fraud*' }, tabs => {
                    const tab = tabs && tabs[0];
                    if (tab) {
                        chrome.tabs.update(tab.id, { active: true });
                    }
                });
            }
        });
    }

    focusDnaTab() {
        chrome.tabs.query({ url: '*showOilSplashList.shtml*' }, tabs => {
            const tab = tabs && tabs[0];
            if (tab) chrome.tabs.update(tab.id, { active: true });
        });
    }

    closeTabsByIds(msg, sender, sendResponse) {
        if (!msg.tabIds || !Array.isArray(msg.tabIds)) {
            sendResponse({ success: false, error: 'Invalid tab IDs' });
            return;
        }
        
        console.log('[FENNEC (POO)] Closing tabs by IDs:', msg.tabIds);
        
        // Filter out any invalid tab IDs and close the valid ones
        chrome.tabs.query({}, (allTabs) => {
            const validTabIds = msg.tabIds.filter(tabId => 
                allTabs.some(tab => tab.id === tabId)
            );
            
            if (validTabIds.length > 0) {
                chrome.tabs.remove(validTabIds, () => {
                    console.log('[FENNEC (POO)] Successfully closed tabs by IDs');
                    sendResponse({ success: true, closedCount: validTabIds.length });
                });
            } else {
                console.log('[FENNEC (POO)] No valid tabs found to close');
                sendResponse({ success: false, error: 'No valid tabs found' });
            }
        });
    }

    closeTabsByUrlPatterns(msg, sender, sendResponse) {
        if (!msg.patterns || !Array.isArray(msg.patterns)) {
            sendResponse({ success: false, error: 'Invalid patterns' });
            return;
        }
        
        console.log('[FENNEC (POO)] Closing tabs by URL patterns:', msg.patterns);
        
        chrome.tabs.query({}, (allTabs) => {
            const tabsToClose = [];
            
            allTabs.forEach(tab => {
                if (tab.url) {
                    const matchesPattern = msg.patterns.some(pattern => {
                        if (pattern === 'db.incfile.com/incfile/order/detail/') {
                            return tab.url.includes(pattern) && tab.url.includes('fraud_xray=1');
                        } else if (pattern === 'db.incfile.com/order-tracker/orders/order-search') {
                            return tab.url.includes(pattern) && tab.url.includes('fennec_email=');
                        } else {
                            return tab.url.includes(pattern);
                        }
                    });
                    
                    if (matchesPattern) {
                        console.log('[FENNEC (POO)] Found tab to close by URL pattern:', tab.url);
                        tabsToClose.push(tab.id);
                    }
                }
            });
            
            if (tabsToClose.length > 0) {
                chrome.tabs.remove(tabsToClose, () => {
                    console.log('[FENNEC (POO)] Successfully closed tabs by URL patterns');
                    sendResponse({ success: true, closedCount: tabsToClose.length });
                });
            } else {
                console.log('[FENNEC (POO)] No tabs found matching URL patterns');
                sendResponse({ success: false, error: 'No matching tabs found' });
            }
        });
    }

    closeTabsByTitles(msg, sender, sendResponse) {
        if (!msg.patterns || !Array.isArray(msg.patterns)) {
            sendResponse({ success: false, error: 'Invalid patterns' });
            return;
        }
        
        console.log('[FENNEC (POO)] Closing tabs by title patterns:', msg.patterns);
        
        chrome.tabs.query({}, (allTabs) => {
            const tabsToClose = [];
            
            allTabs.forEach(tab => {
                const title = tab.title || '';
                const matchesPattern = msg.patterns.some(pattern => title.includes(pattern));
                
                if (matchesPattern) {
                    console.log('[FENNEC (POO)] Found tab to close by title pattern:', title);
                    tabsToClose.push(tab.id);
                }
            });
            
            if (tabsToClose.length > 0) {
                chrome.tabs.remove(tabsToClose, () => {
                    console.log('[FENNEC (POO)] Successfully closed tabs by title patterns');
                    sendResponse({ success: true, closedCount: tabsToClose.length });
                });
            } else {
                console.log('[FENNEC (POO)] No tabs found matching title patterns');
                sendResponse({ success: false, error: 'No matching tabs found' });
            }
        });
    }

    reset(msg, sender, sendResponse) {
        console.log('[FENNEC (POO)] Background reset triggered');
        
        // Clear background storage
        this.pendingUrls.clear();
        this.replacingWindows.clear();
        
        // Clear any background-specific storage
        chrome.storage.local.remove(['fennecReturnTab'], () => {
            console.log('[FENNEC (POO)] Background storage cleared');
            sendResponse({ success: true });
        });
    }
    
    closeFlowTabs(msg, sender, sendResponse) {
        console.log('[FENNEC (POO)] TAB CLEANUP: closeFlowTabs called');
        
        chrome.storage.local.get({ xrayOpenedTabs: [], fraudReviewSession: null }, ({ xrayOpenedTabs, fraudReviewSession }) => {
            console.log('[FENNEC (POO)] TAB CLEANUP: Retrieved from storage - xrayOpenedTabs:', xrayOpenedTabs);
            console.log('[FENNEC (POO)] TAB CLEANUP: Retrieved from storage - fraudReviewSession:', fraudReviewSession);
            
            if (xrayOpenedTabs.length > 0) {
                // Verify tabs still exist before trying to close them
                chrome.tabs.query({}, (allTabs) => {
                    const existingTabIds = allTabs.map(tab => tab.id);
                    const tabsToClose = xrayOpenedTabs.filter(tabId => existingTabIds.includes(tabId));
                    const nonExistentTabs = xrayOpenedTabs.filter(tabId => !existingTabIds.includes(tabId));
                    
                    console.log('[FENNEC (POO)] TAB CLEANUP: All existing tab IDs:', existingTabIds);
                    console.log('[FENNEC (POO)] TAB CLEANUP: Tabs to close:', tabsToClose);
                    console.log('[FENNEC (POO)] TAB CLEANUP: Non-existent tabs:', nonExistentTabs);
                    
                    if (tabsToClose.length > 0) {
                        console.log('[FENNEC (POO)] TAB CLEANUP: Attempting to close tabs:', tabsToClose);
                        chrome.tabs.remove(tabsToClose, () => {
                            console.log('[FENNEC (POO)] TAB CLEANUP: Successfully closed tabs');
                            // Clear the tracked tabs
                            chrome.storage.local.remove(['xrayOpenedTabs', 'fraudReviewSession'], () => {
                                console.log('[FENNEC (POO)] TAB CLEANUP: Cleared tab tracking from storage');
                                sendResponse({ success: true, closedCount: tabsToClose.length, totalTracked: xrayOpenedTabs.length });
                            });
                        });
                    } else {
                        console.log('[FENNEC (POO)] TAB CLEANUP: No tabs to close, clearing tracking only');
                        // No tabs to close, just clear tracking
                        chrome.storage.local.remove(['xrayOpenedTabs', 'fraudReviewSession'], () => {
                            console.log('[FENNEC (POO)] TAB CLEANUP: Cleared tab tracking from storage');
                            sendResponse({ success: true, closedCount: 0, totalTracked: xrayOpenedTabs.length });
                        });
                    }
                });
            } else {
                console.log('[FENNEC (POO)] TAB CLEANUP: No tracked tabs found');
                sendResponse({ success: true, closedCount: 0, totalTracked: 0 });
            }
        });
        return true;
    }
    
    triggerIntStorageLoad(msg, sender, sendResponse) {
        console.log('[FENNEC (POO)] Triggering INT STORAGE load for order:', msg.orderId);
        
        // Find DB tab and send message to load INT STORAGE
        chrome.tabs.query({ url: '*://db.incfile.com/*' }, (tabs) => {
            if (tabs.length > 0) {
                const dbTab = tabs[0];
                console.log('[FENNEC (POO)] Found DB tab, sending INT STORAGE load message:', dbTab.id);
                chrome.tabs.sendMessage(dbTab.id, { 
                    action: 'loadIntStorage', 
                    orderId: msg.orderId 
                }, (response) => {
                    console.log('[FENNEC (POO)] DB tab INT STORAGE load response:', response);
                    sendResponse({ success: true, message: 'INT STORAGE load triggered' });
                });
            } else {
                console.log('[FENNEC (POO)] No DB tab found to trigger INT STORAGE load');
                sendResponse({ success: false, error: 'No DB tab found' });
            }
        });
        return true;
    }
    
    intStorageLoadComplete(msg, sender, sendResponse) {
        console.log('[FENNEC (POO)] INT STORAGE load complete for order:', msg.orderId, 'files count:', msg.filesCount);
        
        // Forward the completion signal to GM SB
        chrome.tabs.query({ url: '*://mail.google.com/*' }, (tabs) => {
            if (tabs.length > 0) {
                const gmailTab = tabs[0];
                console.log('[FENNEC (POO)] Forwarding INT STORAGE completion to GM tab:', gmailTab.id);
                chrome.tabs.sendMessage(gmailTab.id, { 
                    action: 'intStorageLoadComplete', 
                    orderId: msg.orderId,
                    success: msg.success,
                    filesCount: msg.filesCount
                }, (response) => {
                    console.log('[FENNEC (POO)] GM tab INT STORAGE completion response:', response);
                    sendResponse({ success: true, message: 'Completion signal forwarded' });
                });
            } else {
                console.log('[FENNEC (POO)] No GM tab found to forward INT STORAGE completion');
                sendResponse({ success: false, error: 'No GM tab found' });
            }
        });
        return true;
    }
}

self.BackgroundController = BackgroundController;
self.fennecBackground = new BackgroundController();
