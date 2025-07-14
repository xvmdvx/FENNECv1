// Sidebar class for FENNEC content scripts.
// This wrapper helps move toward an object-oriented layout without breaking
// existing procedural code. All methods rely on the same DOM structure used
// previously.
class Sidebar {
    constructor(id = 'copilot-sidebar') {
        this.id = id;
        this.element = null;
    }

    exists() {
        return document.getElementById(this.id);
    }

    build(html) {
        const container = document.createElement('div');
        container.id = this.id;
        container.innerHTML = html;
        this.element = container;
    }

    attach(parent = document.body) {
        if (this.element && !this.exists()) {
            parent.appendChild(this.element);
        }
    }

    remove() {
        const el = this.exists();
        if (el) el.remove();
    }

    applyDesign(opts) {
        if (typeof applySidebarDesign === 'function') {
            applySidebarDesign(this.element, opts);
        }
    }
}

// Expose globally for existing scripts.
window.Sidebar = Sidebar;
