class Messenger {
    constructor() {
        this.listeners = {};
        chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
            const handler = this.listeners[msg.action];
            if (typeof handler === 'function') {
                const result = handler(msg, sender, sendResponse);
                if (result) return true;
            }
        });
    }

    send(action, payload = {}, callback) {
        chrome.runtime.sendMessage(Object.assign({ action }, payload), callback);
    }

    on(action, handler) {
        this.listeners[action] = handler;
    }
}

const messenger = new Messenger();
self.fennecMessenger = messenger;

['openTab', 'openOrReuseTab', 'openActiveTab', 'openTabs', 'replaceTabs', 'closeOtherTabs', 'refocusTab', 'closeTab'].forEach(name => {
    messenger[name] = function(payload, callback) {
        if (typeof payload === 'string') payload = { url: payload };
        this.send(name, payload, callback);
    };
});
