class UpdateFloater extends Floater {
    constructor() {
        super('fennec-update-overlay', 'fennec-update-title', 'UPDATE ORDER INFO');
    }
    ensure(parent = document.body) {
        if (!this.element) {
            this.build();
            this.element.style.opacity = '0';
        }
        this.attach(parent);
        requestAnimationFrame(() => {
            if (this.element) this.element.style.opacity = '1';
        });
    }
}

window.UpdateFloater = UpdateFloater;
