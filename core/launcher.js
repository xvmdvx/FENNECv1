// Base Launcher class for FENNEC (MVP) environments.
// Concrete launchers should extend this class and implement the init() method.
class Launcher {
    constructor() {
        this.sidebar = null;
    }

    detect() {
        // Override with environment detection logic.
        return true;
    }

    init() {
        // Override with initialization steps for the environment.
    }
}

// Expose globally.
window.Launcher = Launcher;
