// Loads and stores sidebar options using chrome.storage.sync

document.addEventListener("DOMContentLoaded", () => {
    const reviewBox = document.getElementById("default-review");
    const widthInput = document.getElementById("sidebar-width");
    const userInput = document.getElementById("txsos-user");
    const passInput = document.getElementById("txsos-pass");
    const saveBtn = document.getElementById("save-btn");

    chrome.storage.sync.get({ defaultReviewMode: false, sidebarWidth: 340, txsosUser: "", txsosPass: "" }, (opts) => {
        reviewBox.checked = Boolean(opts.defaultReviewMode);
        widthInput.value = parseInt(opts.sidebarWidth, 10) || 340;
        userInput.value = opts.txsosUser || "";
        passInput.value = opts.txsosPass || "";
    });

    function save() {
        const width = parseInt(widthInput.value, 10) || 340;
        chrome.storage.sync.set({
            defaultReviewMode: reviewBox.checked,
            sidebarWidth: width,
            txsosUser: userInput.value,
            txsosPass: passInput.value,
            fennecReviewMode: reviewBox.checked
        });
        chrome.storage.local.set({ fennecReviewMode: reviewBox.checked });
    }

    saveBtn.addEventListener("click", save);
});
