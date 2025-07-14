// Skeleton controller wrapping service worker message handling.
class BackgroundController {
    constructor() {
        this.pendingUrls = new Set();
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
                chrome.tabs.update(tab.id, { active: Boolean(msg.active) }, finalize);
            } else {
                const opts = { url: msg.url, active: Boolean(msg.active) };
                if (msg.windowId) {
                    opts.windowId = msg.windowId;
                } else if (sender && sender.tab) {
                    opts.windowId = sender.tab.windowId;
                }
                chrome.tabs.create(opts, finalize);
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
        chrome.tabs.query({ windowId: sender.tab.windowId }, (tabs) => {
            const isDbOrGmail = (tab) =>
                tab.url && (tab.url.includes('mail.google.com') || tab.url.includes('db.incfile.com'));
            const toClose = tabs.filter(t => t.id !== sender.tab.id && isDbOrGmail(t)).map(t => t.id);
            const openAll = () => msg.urls.forEach(url => {
                chrome.tabs.create({ url, active: false, windowId: sender.tab.windowId });
            });
            if (toClose.length) {
                chrome.tabs.remove(toClose, openAll);
            } else {
                openAll();
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

    refocusTab() {
        chrome.storage.local.get({ fennecReturnTab: null }, ({ fennecReturnTab }) => {
            if (fennecReturnTab) chrome.tabs.update(fennecReturnTab, { active: true });
            chrome.storage.local.set({ fennecReturnTab: null });
        });
    }
}

self.BackgroundController = BackgroundController;
self.fennecBackground = new BackgroundController();
