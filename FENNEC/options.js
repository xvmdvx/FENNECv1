// Loads and stores sidebar options using chrome.storage.sync

document.addEventListener("DOMContentLoaded", () => {
    const reviewBox = document.getElementById("default-review");
    const devBox = document.getElementById("default-dev");
    const widthInput = document.getElementById("sidebar-width");
    const fontSizeSelect = document.getElementById("sidebar-font-size");
    const fontSelect = document.getElementById("sidebar-font");
    const bgColorInput = document.getElementById("sidebar-bg-color");
    const boxColorInput = document.getElementById("sidebar-box-color");
    const userInput = document.getElementById("txsos-user");
    const passInput = document.getElementById("txsos-pass");
    const saveBtn = document.getElementById("save-btn");
    const preview = document.getElementById("sidebar-preview");

    function updatePreview() {
        preview.style.setProperty("--preview-width", `${widthInput.value}px`);
        preview.style.setProperty("--preview-font-size", `${fontSizeSelect.value}px`);
        preview.style.setProperty("--preview-font", fontSelect.value);
        preview.style.setProperty("--preview-bg", bgColorInput.value);
        preview.style.setProperty("--preview-box-bg", boxColorInput.value);
    }

    chrome.storage.sync.get({
        defaultReviewMode: false,
        defaultDevMode: false,
        sidebarWidth: 340,
        sidebarFontSize: 13,
        sidebarFont: "'Inter', sans-serif",
        sidebarBgColor: "#212121",
        sidebarBoxColor: "#2e2e2e",
        txsosUser: "",
        txsosPass: ""
    }, (opts) => {
        reviewBox.checked = Boolean(opts.defaultReviewMode);
        devBox.checked = Boolean(opts.defaultDevMode);
        widthInput.value = parseInt(opts.sidebarWidth, 10) || 340;
        fontSizeSelect.value = String(opts.sidebarFontSize || 13);
        fontSelect.value = opts.sidebarFont || "'Inter', sans-serif";
        bgColorInput.value = opts.sidebarBgColor || "#212121";
        boxColorInput.value = opts.sidebarBoxColor || "#2e2e2e";
        userInput.value = opts.txsosUser || "";
        passInput.value = opts.txsosPass || "";
        updatePreview();
    });

    function save() {
        const width = parseInt(widthInput.value, 10) || 340;
        const fontSize = parseInt(fontSizeSelect.value, 10) || 13;
        chrome.storage.sync.set({
            defaultReviewMode: reviewBox.checked,
            defaultDevMode: devBox.checked,
            sidebarWidth: width,
            sidebarFontSize: fontSize,
            sidebarFont: fontSelect.value,
            sidebarBgColor: bgColorInput.value,
            sidebarBoxColor: boxColorInput.value,
            txsosUser: userInput.value,
            txsosPass: passInput.value,
            fennecReviewMode: reviewBox.checked,
            fennecDevMode: devBox.checked
        });
        chrome.storage.local.set({ fennecReviewMode: reviewBox.checked, fennecDevMode: devBox.checked });
    }

    [widthInput, fontSizeSelect, fontSelect, bgColorInput, boxColorInput].forEach(el => el.addEventListener("input", updatePreview));
    saveBtn.addEventListener("click", () => { save(); updatePreview(); });
});
