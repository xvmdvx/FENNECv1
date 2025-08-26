// Diagnose Floater - Diagnostic overlay for order issues
class DiagnoseFloater extends Floater {
    constructor() {
        super('fennec-diagnose-overlay', 'fennec-diagnose-header', 'Diagnose Issues');
        this.issues = [];
    }

    init() {
        console.log('[FENNEC] Diagnose floater initialized');
    }
    
    build() {
        super.build();
        if (this.element) {
            this.element.className = 'fennec-diagnose-overlay';
            this.element.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                border: 2px solid #007bff;
                border-radius: 8px;
                padding: 20px;
                z-index: 10000;
                max-width: 80vw;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            `;
            
            this.element.innerHTML = `
                <div style="margin-bottom: 15px;">
                    <h3 style="margin: 0 0 10px 0; color: #333;">Order Diagnostic</h3>
                    <div id="diagnose-content">
                        <p>Loading diagnostic information...</p>
                    </div>
                </div>
                <div style="text-align: right;">
                    <button id="diagnose-close" style="padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">Close</button>
                </div>
            `;
            
            // Add close button functionality
            const closeBtn = this.element.querySelector('#diagnose-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.remove());
            }
        }
    }
    
    diagnose(orderId) {
        console.log('[FENNEC] Running diagnostic for order:', orderId);
        const content = this.element?.querySelector('#diagnose-content');
        if (content) {
            content.innerHTML = `
                <div style="margin-bottom: 10px;">
                    <strong>Order ID:</strong> ${orderId}
                </div>
                <div style="margin-bottom: 10px;">
                    <strong>Status:</strong> Analyzing...
                </div>
                <div style="margin-bottom: 10px;">
                    <strong>Issues Found:</strong> 0
                </div>
            `;
        }
    }
}

// Expose globally for use in other modules
window.DiagnoseFloater = DiagnoseFloater;
