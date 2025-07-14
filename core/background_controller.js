// Skeleton controller wrapping service worker message handling.
class BackgroundController {
    constructor() {
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
