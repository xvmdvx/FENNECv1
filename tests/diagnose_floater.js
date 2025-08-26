class DiagnoseFloater extends Floater {
    constructor() {
        super('fennec-diagnose-overlay');
    }
    ensure(parent = document.body) {
        if (!this.element) this.build();
        this.attach(parent);
    }
}

window.DiagnoseFloater = DiagnoseFloater;
