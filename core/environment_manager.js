// Environment Manager for FENNEC (MVP)
// Handles environment detection, auto-upload settings, and environment-specific configurations

class EnvironmentManager {
    constructor() {
        this.currentEnvironment = this.detectEnvironment();
        this.settings = {
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

    detectEnvironment() {
        const url = window.location.href;
        
        if (url.includes('mail.google.com')) {
            return 'gmail';
        } else if (url.includes('incfile.com/incfile/order/detail') || 
                   url.includes('incfile.com/storage/incfile')) {
            return 'db';
        } else if (url.includes('db.incfile.com/order-tracker/orders/fraud')) {
            return 'db';
        } else if (url.includes('db.incfile.com/db-tools/scan-email-address')) {
            return 'db';
        } else if (url.includes('db.incfile.com/order-tracker/orders/order-search')) {
            return 'db';
        } else if (url.includes('tools.usps.com')) {
            return 'usps';
        } else if (url.includes('ca-live.adyen.com')) {
            return 'adyen';
        } else if (url.includes('awc.kount.net') || url.includes('app.kount.com')) {
            return 'kount';
        } else if (url.includes('sa.www4.irs.gov')) {
            return 'db'; // EIN application is handled by DB launcher
        }
        
        return 'unknown';
    }

    init() {
        this.loadSettings();
        this.setupMessageListener();
    }

    loadSettings() {
        chrome.storage.local.get({
            extensionEnabled: true,
            fennecReviewMode: false,
            environments: this.settings.environments,
            autoUpload: false
        }, (result) => {
            this.settings = {
                extensionEnabled: result.extensionEnabled,
                fennecReviewMode: result.fennecReviewMode,
                environments: result.environments,
                autoUpload: result.autoUpload
            };
            
            // Check if current environment is enabled
            if (!this.isEnvironmentEnabled()) {
                console.log(`[FENNEC] Environment ${this.currentEnvironment} is disabled`);
                return;
            }
            
            // Check if extension is enabled
            if (!this.settings.extensionEnabled) {
                console.log('[FENNEC] Extension is disabled');
                return;
            }
            
            // Initialize environment-specific features
            this.initializeEnvironment();
        });
    }

    isEnvironmentEnabled() {
        return this.settings.environments[this.currentEnvironment] === true;
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
            if (msg.action === 'fennecToggle') {
                this.handleToggleMessage(msg);
            } else if (msg.action === 'fennecReset') {
                this.handleResetMessage(msg);
            }
        });
    }

    handleToggleMessage(msg) {
        // Update settings from message
        if (msg.hasOwnProperty('enabled')) {
            this.settings.extensionEnabled = msg.enabled;
        }
        if (msg.hasOwnProperty('reviewMode')) {
            this.settings.fennecReviewMode = msg.reviewMode;
        }
        if (msg.hasOwnProperty('environments')) {
            this.settings.environments = { ...this.settings.environments, ...msg.environments };
        }
        if (msg.hasOwnProperty('autoUpload')) {
            this.settings.autoUpload = msg.autoUpload;
        }

        // Reload page if environment is now disabled or extension is disabled
        if (!this.settings.extensionEnabled || !this.isEnvironmentEnabled()) {
            window.location.reload();
        } else {
            // Re-initialize with new settings
            this.initializeEnvironment();
        }
    }

    handleResetMessage(msg) {
        if (msg.clearStorage) {
            // Clear local storage
            localStorage.clear();
            sessionStorage.clear();
            
            // Clear chrome storage for this tab
            chrome.storage.local.remove(['intStorageData', 'intStorageOrderId'], () => {
                console.log('[FENNEC] Storage cleared for reset');
            });
        }
        
        // Reload the page
        window.location.reload();
    }

    initializeEnvironment() {
        console.log(`[FENNEC] Initializing environment: ${this.currentEnvironment}`);
        
        // Set up auto-upload if enabled
        if (this.settings.autoUpload) {
            this.setupAutoUpload();
        }
        
        // Initialize environment-specific features
        switch (this.currentEnvironment) {
            case 'gmail':
                this.initializeGmail();
                break;
            case 'db':
                this.initializeDatabase();
                break;
            case 'usps':
                this.initializeUSPS();
                break;
            case 'adyen':
                this.initializeAdyen();
                break;
            case 'kount':
                this.initializeKount();
                break;

        }
    }

    setupAutoUpload() {
        // Set up drag and drop auto-upload for INT STORAGE
        if (this.currentEnvironment === 'db') {
            this.setupDatabaseAutoUpload();
        }
    }

    setupDatabaseAutoUpload() {
        // Add drag and drop event listeners for auto-upload
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
                this.handleAutoUpload(files);
            }
        });
    }

    handleAutoUpload(files) {
        // Get current order ID from the page
        const orderId = this.getCurrentOrderId();
        if (!orderId) {
            console.log('[FENNEC] No order ID found for auto-upload');
            return;
        }

        console.log(`[FENNEC] Auto-uploading ${files.length} files for order ${orderId}`);
        
        // Process files and upload to INT STORAGE
        this.processFilesForUpload(files, orderId);
    }

    getCurrentOrderId() {
        // Try to extract order ID from various sources
        const url = window.location.href;
        const urlMatch = url.match(/order\/(\d+)/);
        if (urlMatch) {
            return urlMatch[1];
        }

        // Look for order ID in page content
        const orderElements = document.querySelectorAll('[data-order-id], .order-id, #order-id');
        for (const element of orderElements) {
            const orderId = element.textContent || element.value || element.dataset.orderId;
            if (orderId && /^\d+$/.test(orderId)) {
                return orderId;
            }
        }

        return null;
    }

    processFilesForUpload(files, orderId) {
        // This would integrate with the existing INT STORAGE functionality
        // For now, just log the files
        files.forEach(file => {
            console.log(`[FENNEC] Auto-upload file: ${file.name} (${file.size} bytes)`);
        });

        // Send message to background script to handle the upload
        chrome.runtime.sendMessage({
            action: 'autoUploadFiles',
            files: files.map(f => ({ name: f.name, size: f.size, type: f.type })),
            orderId: orderId
        });
    }

    // Environment-specific initialization methods
    initializeGmail() {
        // Gmail-specific initialization
        console.log('[FENNEC] Gmail environment initialized');
    }

    initializeDatabase() {
        // Database-specific initialization
        console.log('[FENNEC] Database environment initialized');
    }

    initializeUSPS() {
        // USPS-specific initialization
        console.log('[FENNEC] USPS environment initialized');
    }

    initializeAdyen() {
        // Adyen-specific initialization
        console.log('[FENNEC] Adyen environment initialized');
    }

    initializeKount() {
        // Kount-specific initialization
        console.log('[FENNEC] Kount environment initialized');
    }



    // Utility methods
    getSettings() {
        return this.settings;
    }

    isReviewMode() {
        return this.settings.fennecReviewMode;
    }

    isAutoUploadEnabled() {
        return this.settings.autoUpload;
    }

    getCurrentEnvironment() {
        return this.currentEnvironment;
    }
}

// Initialize environment manager
window.fennecEnvironmentManager = new EnvironmentManager();
