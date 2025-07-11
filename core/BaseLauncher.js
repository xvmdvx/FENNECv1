import Sidebar from './sidebar.js';

export default class BaseLauncher {
    constructor() {
        this.sidebar = new Sidebar();
    }

    showFloatingIcon(callback) {
        if (document.getElementById('fennec-floating-icon')) return;
        const icon = document.createElement('img');
        icon.id = 'fennec-floating-icon';
        icon.src = chrome.runtime.getURL('fennec_icon.png');
        icon.alt = 'FENNEC';
        icon.addEventListener('click', () => {
            icon.remove();
            sessionStorage.removeItem('fennecSidebarClosed');
            if (typeof callback === 'function') callback();
        });
        document.body.appendChild(icon);
    }

    ensureFloatingIcon(callback) {
        if (!document.getElementById('fennec-floating-icon')) {
            this.showFloatingIcon(callback);
        }
    }
}
