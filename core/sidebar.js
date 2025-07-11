export default class Sidebar {
    constructor(id = 'copilot-sidebar') {
        this.id = id;
        this.element = null;
    }

    create() {
        this.element = document.createElement('div');
        this.element.id = this.id;
        return this.element;
    }

    attach(parent = document.body) {
        if (!this.element) {
            this.create();
        }
        parent.appendChild(this.element);
    }

    remove() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}
