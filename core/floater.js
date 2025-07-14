// Base class for floating overlays used across environments.
class Floater {
    constructor(id, headerId = null, headerText = '') {
        this.id = id;
        this.headerId = headerId;
        this.headerText = headerText;
        this.element = null;
        this.header = null;
    }

    exists() {
        return document.getElementById(this.id);
    }

    build() {
        this.element = document.createElement('div');
        this.element.id = this.id;
        if (this.headerId) {
            this.header = document.createElement('div');
            this.header.id = this.headerId;
            this.header.textContent = this.headerText;
        }
    }

    attach(parent = document.body) {
        if (this.header && !document.getElementById(this.headerId)) {
            parent.appendChild(this.header);
        }
        if (this.element && !this.exists()) {
            parent.appendChild(this.element);
        }
    }

    remove() {
        if (this.element) this.element.remove();
        if (this.header) this.header.remove();
    }
}

// Expose globally for existing scripts.
window.Floater = Floater;
