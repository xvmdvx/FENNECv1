// Handles enable/disable toggle and provides a quick link to Options
const toggle = document.getElementById("extension-toggle");
const optionsBtn = document.getElementById("options-btn");
const reviewToggle = document.getElementById("review-toggle");
const resetBtn = document.getElementById("reset-btn");
let lastReviewMode = false;

function loadState() {
    chrome.storage.local.get({ extensionEnabled: true, fennecReviewMode: false }, ({ extensionEnabled, fennecReviewMode }) => {
        toggle.checked = Boolean(extensionEnabled);
        reviewToggle.checked = Boolean(fennecReviewMode);
        lastReviewMode = reviewToggle.checked;
    });
}

function saveState() {
    const reviewChanged = reviewToggle.checked !== lastReviewMode;
    chrome.storage.local.set({ extensionEnabled: toggle.checked, fennecReviewMode: reviewToggle.checked }, () => {
        chrome.storage.sync.set({ fennecReviewMode: reviewToggle.checked }, () => {
            const urls = [
                "https://mail.google.com/*",
                "https://*.incfile.com/incfile/order/detail/*",
                "https://*.incfile.com/storage/incfile/*",
                "https://db.incfile.com/order-tracker/orders/fraud*",
                "https://tools.usps.com/*"
            ];

            chrome.tabs.query({ url: urls }, tabs => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(
                        tab.id,
                        { action: "fennecToggle", enabled: toggle.checked },
                        () => {
                            if (chrome.runtime.lastError || reviewChanged) {
                                chrome.tabs.reload(tab.id);
                            }
                        }
                    );
                });
                lastReviewMode = reviewToggle.checked;
            });
        });
    });
}

function resetExtension() {
    if (!confirm("Reset all FENNEC (POO) data and reload?")) return;
    
    // Clear all storage types
    chrome.storage.local.clear(() => {
        chrome.storage.sync.clear(() => {
            // Send reset message to background script
            chrome.runtime.sendMessage({ action: 'reset' }, () => {
                // Clear session storage and local storage for all tabs
                const urls = [
                    "https://mail.google.com/*",
                    "https://*.incfile.com/incfile/order/detail/*",
                    "https://*.incfile.com/storage/incfile/*",
                    "https://db.incfile.com/order-tracker/orders/fraud*",
                    "https://tools.usps.com/*",
                    "https://*.adyen.com/*",
                    "https://*.kount.com/*"
                ];
                
                chrome.tabs.query({ url: urls }, tabs => {
                    // Clear storage and reload each tab
                    tabs.forEach(tab => {
                        chrome.tabs.sendMessage(
                            tab.id,
                            { 
                                action: "fennecReset",
                                clearStorage: true
                            },
                            () => {
                                // Always reload the tab to ensure fresh state
                                chrome.tabs.reload(tab.id, { bypassCache: true });
                            }
                        );
                    });
                    
                    // Reload the extension after clearing storage
                    setTimeout(() => {
                        chrome.runtime.reload();
                    }, 1000); // Small delay to ensure tabs are reloading
                });
            });
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    loadState();
    toggle.addEventListener("change", saveState);
    reviewToggle.addEventListener("change", saveState);
    optionsBtn.addEventListener("click", () => chrome.runtime.openOptionsPage());
    resetBtn.addEventListener("click", resetExtension);
});
