// Enhanced popup functionality for FENNEC extension
class FennecPopup {
    constructor() {
        this.elements = {
            extensionToggle: document.getElementById("extension-toggle"),
            mainToggle: document.getElementById("main-toggle"),
            modeOptions: document.querySelectorAll(".mode-option"),
            envCheckboxes: {
                gmail: document.getElementById("env-gmail"),
                db: document.getElementById("env-db"),
                usps: document.getElementById("env-usps"),
                adyen: document.getElementById("env-adyen"),
                kount: document.getElementById("env-kount")
            },
            envContainers: {
                gmail: document.getElementById("env-gmail-container"),
                db: document.getElementById("env-db-container"),
                usps: document.getElementById("env-usps-container"),
                adyen: document.getElementById("env-adyen-container"),
                kount: document.getElementById("env-kount-container")
            },
            autoUploadToggle: document.getElementById("auto-upload-toggle"),
            optionsBtn: document.getElementById("options-btn"),
            resetBtn: document.getElementById("reset-btn")
        };

        this.state = {
            extensionEnabled: true,
            fennecReviewMode: false,
            environments: {
                gmail: true,
                db: true,
                usps: true,
                adyen: true,
                kount: true
            },
            autoUpload: false
        };

        this.init();
    }

    init() {
        this.loadState();
        this.bindEvents();
        this.updateUI();
    }

    loadState() {
        chrome.storage.local.get({
            extensionEnabled: true,
            fennecReviewMode: false,
            environments: this.state.environments,
            autoUpload: false
        }, (result) => {
            this.state = {
                extensionEnabled: result.extensionEnabled,
                fennecReviewMode: result.fennecReviewMode,
                environments: result.environments,
                autoUpload: result.autoUpload
            };
            this.updateUI();
        });
    }

    saveState() {
        chrome.storage.local.set({
            extensionEnabled: this.state.extensionEnabled,
            fennecReviewMode: this.state.fennecReviewMode,
            environments: this.state.environments,
            autoUpload: this.state.autoUpload
        }, () => {
            // Sync review mode to sync storage for cross-device sync
            chrome.storage.sync.set({ fennecReviewMode: this.state.fennecReviewMode });
            
            // Notify tabs about the changes
            this.notifyTabs();
        });
    }

    updateUI() {
        // Update main toggle
        this.elements.extensionToggle.checked = this.state.extensionEnabled;
        this.elements.mainToggle.classList.toggle('active', this.state.extensionEnabled);

        // Update mode toggle
        this.elements.modeOptions.forEach(option => {
            option.classList.remove('active');
            if (option.dataset.mode === (this.state.fennecReviewMode ? 'review' : 'classic')) {
                option.classList.add('active');
            }
        });

        // Update environment visibility based on mode
        this.updateEnvironmentVisibility();

        // Update environment checkboxes
        Object.keys(this.state.environments).forEach(env => {
            if (this.elements.envCheckboxes[env]) {
                this.elements.envCheckboxes[env].checked = this.state.environments[env];
            }
        });

        // Update auto upload toggle
        this.elements.autoUploadToggle.checked = this.state.autoUpload;
    }

    updateEnvironmentVisibility() {
        const isReviewMode = this.state.fennecReviewMode;
        
        // In classic mode, show only DB, Gmail, and USPS
        // In review mode, show all environments
        const classicEnvironments = ['gmail', 'db', 'usps'];
        
        Object.keys(this.elements.envContainers).forEach(env => {
            const container = this.elements.envContainers[env];
            if (container) {
                if (isReviewMode || classicEnvironments.includes(env)) {
                    container.classList.remove('hidden');
                } else {
                    container.classList.add('hidden');
                }
            }
        });
    }

    bindEvents() {
        // Main extension toggle
        this.elements.extensionToggle.addEventListener('change', (e) => {
            this.state.extensionEnabled = e.target.checked;
            this.saveState();
            this.updateUI();
        });

        // Mode toggle
        this.elements.modeOptions.forEach(option => {
            option.addEventListener('click', () => {
                const mode = option.dataset.mode;
                this.state.fennecReviewMode = mode === 'review';
                this.saveState();
                this.updateUI();
            });
        });

        // Environment checkboxes
        Object.keys(this.elements.envCheckboxes).forEach(env => {
            const checkbox = this.elements.envCheckboxes[env];
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    this.state.environments[env] = e.target.checked;
                    this.saveState();
                });
            }
        });

        // Auto upload toggle
        this.elements.autoUploadToggle.addEventListener('change', (e) => {
            this.state.autoUpload = e.target.checked;
            this.saveState();
        });

        // Buttons
        this.elements.optionsBtn.addEventListener('click', () => {
            chrome.runtime.openOptionsPage();
        });

        this.elements.resetBtn.addEventListener('click', () => {
            this.resetExtension();
        });
    }

    notifyTabs() {
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
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(
                    tab.id,
                    { 
                        action: "fennecToggle", 
                        enabled: this.state.extensionEnabled,
                        reviewMode: this.state.fennecReviewMode,
                        environments: this.state.environments,
                        autoUpload: this.state.autoUpload
                    },
                    () => {
                        if (chrome.runtime.lastError) {
                            // Tab might not be ready, reload it
                            chrome.tabs.reload(tab.id);
                        }
                    }
                );
            });
        });
    }

    resetExtension() {
        if (!confirm("Reset all FENNEC data and reload?")) return;
        
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
                        }, 1000);
                    });
                });
            });
        });
    }
}

// Initialize popup when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    new FennecPopup();
});
