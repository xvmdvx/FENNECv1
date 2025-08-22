// Floater used for the Fraud Review summary overlay.
class TrialFloater extends Floater {
    constructor() {
        // Do not create or attach a header for the Trial Floater
        super('fennec-trial-overlay', null, '');
    }

    adjustHeader() {
        if (!this.header) return;
        const sidebarEl = document.getElementById('copilot-sidebar');
        let baseSize = 13;
        if (sidebarEl) {
            const s = window.getComputedStyle(sidebarEl).fontSize;
            const n = parseFloat(s);
            if (!isNaN(n)) baseSize = n;
        }
        this.header.style.setProperty('font-size', (baseSize + 26) + 'px', 'important');
        this.header.style.setProperty('line-height', '1.2', 'important');
        this.header.style.setProperty('padding', '8px 0', 'important');
        this.header.style.setProperty('border-radius', '12px', 'important');
        this.header.style.setProperty('text-shadow', '0 0 4px #fff, 0 0 8px #fff', 'important');
        this.header.style.setProperty('box-shadow', '0 0 0 2px #fff inset', 'important');
        this.header.style.setProperty('background-color', 'inherit', 'important');
        this.header.style.setProperty('-webkit-text-stroke', '1px #fff', 'important');
    }

    ensure(parent = document.body) {
        if (!this.element) this.build();
        this.attach(parent);
        this.adjustHeader();
    }
}

window.TrialFloater = TrialFloater;
