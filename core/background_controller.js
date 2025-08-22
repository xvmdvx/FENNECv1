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
                    if (fraudReviewSession && !xrayOpenedTabs.includes(tab.id)) {
                        const updatedTabs = [...xrayOpenedTabs, tab.id];
                        chrome.storage.local.set({ xrayOpenedTabs: updatedTabs });
                    } else {
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
                        if (fraudReviewSession && newTab) {
                            // Only track if we're in a fraud review session
                            const updatedTabs = [...xrayOpenedTabs, newTab.id];
                            chrome.storage.local.set({ xrayOpenedTabs: updatedTabs });
                        } else {
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
        
        
        // Filter out any invalid tab IDs and close the valid ones
        chrome.tabs.query({}, (allTabs) => {
            const validTabIds = msg.tabIds.filter(tabId => 
                allTabs.some(tab => tab.id === tabId)
            );
            
            if (validTabIds.length > 0) {
                chrome.tabs.remove(validTabIds, () => {
                    sendResponse({ success: true, closedCount: validTabIds.length });
                });
            } else {
                sendResponse({ success: false, error: 'No valid tabs found' });
            }
        });
    }

    closeTabsByUrlPatterns(msg, sender, sendResponse) {
        if (!msg.patterns || !Array.isArray(msg.patterns)) {
            sendResponse({ success: false, error: 'Invalid patterns' });
            return;
        }
        
        
        chrome.tabs.query({}, (allTabs) => {
            const tabsToClose = [];
            
            allTabs.forEach(tab => {
                // Skip the excluded tab (current tab)
                if (msg.excludeTabId && tab.id === msg.excludeTabId) {
                    return;
                }
                
                if (tab.url) {
                    const matchesPattern = msg.patterns.some(pattern => {
                        return tab.url.includes(pattern);
                    });
                    
                    if (matchesPattern) {
                        tabsToClose.push(tab.id);
                    }
                }
            });
            
            if (tabsToClose.length > 0) {
                chrome.tabs.remove(tabsToClose, () => {
                    sendResponse({ success: true, closedCount: tabsToClose.length });
                });
            } else {
                sendResponse({ success: false, error: 'No matching tabs found' });
            }
        });
    }

    closeTabsByTitles(msg, sender, sendResponse) {
        if (!msg.patterns || !Array.isArray(msg.patterns)) {
            sendResponse({ success: false, error: 'Invalid patterns' });
            return;
        }
        
        
        chrome.tabs.query({}, (allTabs) => {
            const tabsToClose = [];
            
            allTabs.forEach(tab => {
                const title = tab.title || '';
                const matchesPattern = msg.patterns.some(pattern => title.includes(pattern));
                
                if (matchesPattern) {
                    tabsToClose.push(tab.id);
                }
            });
            
            if (tabsToClose.length > 0) {
                chrome.tabs.remove(tabsToClose, () => {
                    sendResponse({ success: true, closedCount: tabsToClose.length });
                });
            } else {
                sendResponse({ success: false, error: 'No matching tabs found' });
            }
        });
    }

    getCurrentTabId(msg, sender, sendResponse) {
        if (!sender || !sender.tab) {
            sendResponse(null);
            return;
        }
        
        sendResponse(sender.tab.id);
    }

    queryTabs(msg, sender, sendResponse) {
        if (!msg.url) {
            sendResponse([]);
            return;
        }
        
        chrome.tabs.query({ url: msg.url }, (tabs) => {
            sendResponse(tabs);
        });
    }

    getTab(msg, sender, sendResponse) {
        if (!msg.tabId) {
            sendResponse(null);
            return;
        }
        
        chrome.tabs.get(msg.tabId, (tab) => {
            if (chrome.runtime.lastError) {
                sendResponse(null);
            } else {
                sendResponse(tab);
            }
        });
    }

    reset(msg, sender, sendResponse) {
        
        // Clear background storage
        this.pendingUrls.clear();
        this.replacingWindows.clear();
        
        // Clear any background-specific storage
        chrome.storage.local.remove(['fennecReturnTab'], () => {
            sendResponse({ success: true });
        });
    }
    
    closeFlowTabs(msg, sender, sendResponse) {
        
        chrome.storage.local.get({ xrayOpenedTabs: [], fraudReviewSession: null }, ({ xrayOpenedTabs, fraudReviewSession }) => {
            
            if (xrayOpenedTabs.length > 0) {
                // Verify tabs still exist before trying to close them
                chrome.tabs.query({}, (allTabs) => {
                    const existingTabIds = allTabs.map(tab => tab.id);
                    const tabsToClose = xrayOpenedTabs.filter(tabId => existingTabIds.includes(tabId));
                    const nonExistentTabs = xrayOpenedTabs.filter(tabId => !existingTabIds.includes(tabId));
                    
                    
                    if (tabsToClose.length > 0) {
                        chrome.tabs.remove(tabsToClose, () => {
                            // Clear the tracked tabs
                            chrome.storage.local.remove(['xrayOpenedTabs', 'fraudReviewSession'], () => {
                                sendResponse({ success: true, closedCount: tabsToClose.length, totalTracked: xrayOpenedTabs.length });
                            });
                        });
                    } else {
                        // No tabs to close, just clear tracking
                        chrome.storage.local.remove(['xrayOpenedTabs', 'fraudReviewSession'], () => {
                            sendResponse({ success: true, closedCount: 0, totalTracked: xrayOpenedTabs.length });
                        });
                    }
                });
            } else {
                sendResponse({ success: true, closedCount: 0, totalTracked: 0 });
            }
        });
        return true;
    }
    
    triggerIntStorageLoad(msg, sender, sendResponse) {
        
        // Find DB tab and send message to load INT STORAGE
        chrome.tabs.query({ url: '*://db.incfile.com/*' }, (tabs) => {
            if (tabs.length > 0) {
                const dbTab = tabs[0];
                chrome.tabs.sendMessage(dbTab.id, { 
                    action: 'loadIntStorage', 
                    orderId: msg.orderId 
                }, (response) => {
                    sendResponse({ success: true, message: 'INT STORAGE load triggered' });
                });
            } else {
                // No DB tab found, create one and then trigger the load
                console.log('[FENNEC (MVP) BG] No DB tab found, creating one for INT STORAGE load');
                chrome.tabs.create({ 
                    url: 'https://db.incfile.com/incfile/order/detail/' + msg.orderId + '?fennec_int_storage=1', 
                    active: false 
                }, (newTab) => {
                    // Wait for the tab to load, then trigger INT STORAGE load
                    const checkTabReady = () => {
                        chrome.tabs.get(newTab.id, (tab) => {
                            if (chrome.runtime.lastError) {
                                // Tab was closed
                                sendResponse({ success: false, error: 'DB tab was closed' });
                                return;
                            }
                            
                            if (tab.status === 'complete') {
                                // Tab is ready, trigger INT STORAGE load
                                chrome.tabs.sendMessage(tab.id, { 
                                    action: 'loadIntStorage', 
                                    orderId: msg.orderId 
                                }, (response) => {
                                    sendResponse({ success: true, message: 'INT STORAGE load triggered in new DB tab' });
                                });
                            } else {
                                // Tab still loading, check again in 1 second
                                setTimeout(checkTabReady, 1000);
                            }
                        });
                    };
                    
                    // Start checking after a short delay
                    setTimeout(checkTabReady, 2000);
                });
            }
        });
        return true;
    }
    
    intStorageLoadComplete(msg, sender, sendResponse) {
        
        // Forward the completion signal to GM SB
        chrome.tabs.query({ url: '*://mail.google.com/*' }, (tabs) => {
            if (tabs.length > 0) {
                const gmailTab = tabs[0];
                chrome.tabs.sendMessage(gmailTab.id, { 
                    action: 'intStorageLoadComplete', 
                    orderId: msg.orderId,
                    success: msg.success,
                    filesCount: msg.filesCount
                }, (response) => {
                    sendResponse({ success: true, message: 'Completion signal forwarded' });
                });
            } else {
                sendResponse({ success: false, error: 'No GM tab found' });
            }
        });
        return true;
    }
}

self.BackgroundController = BackgroundController;
self.fennecBackground = new BackgroundController();
