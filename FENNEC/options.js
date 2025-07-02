// Loads and stores sidebar options using chrome.storage.sync

document.addEventListener("DOMContentLoaded", () => {
    const reviewBox = document.getElementById("default-review");
    const devBox = document.getElementById("default-dev");
    const themeSelect = document.getElementById("sidebar-theme");
    const widthInput = document.getElementById("sidebar-width");
    const fontSizeSelect = document.getElementById("sidebar-font-size");
    const fontSelect = document.getElementById("sidebar-font");
    const bgColorInput = document.getElementById("sidebar-bg-color");
    const boxColorInput = document.getElementById("sidebar-box-color");
    const headerFontSizeInput = document.getElementById("header-font-size");
    const headerBold = document.getElementById("header-bold");
    const line1SizeInput = document.getElementById("line1-size");
    const line1Bold = document.getElementById("line1-bold");
    const line2SizeInput = document.getElementById("line2-size");
    const line2Bold = document.getElementById("line2-bold");
    const line3SizeInput = document.getElementById("line3-size");
    const line3Bold = document.getElementById("line3-bold");
    const buttonColorInput = document.getElementById("button-color");
    const buttonRadiusInput = document.getElementById("button-radius");
    const iconSetSelect = document.getElementById("icon-set");
    const userInput = document.getElementById("txsos-user");
    const passInput = document.getElementById("txsos-pass");
    const saveBtn = document.getElementById("save-btn");
    const preview = document.getElementById("sidebar-preview");

    const customSections = Array.from(document.querySelectorAll('.custom-only'));

    function toggleCustom() {
        const show = themeSelect.value === 'custom';
        customSections.forEach(div => div.style.display = show ? 'flex' : 'none');
    }

    function updatePreview() {
        preview.style.setProperty("--preview-width", `${widthInput.value}px`);
        preview.style.setProperty("--preview-font-size", `${fontSizeSelect.value}px`);
        preview.style.setProperty("--preview-font", fontSelect.value);
        preview.style.setProperty("--preview-bg", bgColorInput.value);
        preview.style.setProperty("--preview-box-bg", boxColorInput.value);
        preview.style.setProperty("--header-font-size", `${headerFontSizeInput.value}px`);
        preview.style.setProperty("--header-bold", headerBold.checked ? '700' : '400');
        preview.style.setProperty("--line1-size", `${line1SizeInput.value}px`);
        preview.style.setProperty("--line1-bold", line1Bold.checked ? '700' : '400');
        preview.style.setProperty("--line2-size", `${line2SizeInput.value}px`);
        preview.style.setProperty("--line2-bold", line2Bold.checked ? '700' : '400');
        preview.style.setProperty("--line3-size", `${line3SizeInput.value}px`);
        preview.style.setProperty("--line3-bold", line3Bold.checked ? '700' : '400');
        preview.style.setProperty("--button-color", buttonColorInput.value);
        preview.style.setProperty("--button-radius", `${buttonRadiusInput.value}px`);
    }

    chrome.storage.sync.get({
        theme: 'classic',
        defaultReviewMode: false,
        defaultDevMode: false,
        sidebarWidth: 340,
        sidebarFontSize: 13,
        sidebarFont: "'Inter', sans-serif",
        sidebarBgColor: "#212121",
        sidebarBoxColor: "#2e2e2e",
        headerFontSize: 14,
        headerBold: true,
        line1Size: 13,
        line1Bold: false,
        line2Size: 13,
        line2Bold: false,
        line3Size: 13,
        line3Bold: false,
        buttonColor: "#333333",
        buttonRadius: 6,
        iconSet: 'default',
        txsosUser: "",
        txsosPass: ""
    }, (opts) => {
        themeSelect.value = opts.theme || 'classic';
        reviewBox.checked = Boolean(opts.defaultReviewMode);
        devBox.checked = Boolean(opts.defaultDevMode);
        widthInput.value = parseInt(opts.sidebarWidth, 10) || 340;
        fontSizeSelect.value = String(opts.sidebarFontSize || 13);
        fontSelect.value = opts.sidebarFont || "'Inter', sans-serif";
        bgColorInput.value = opts.sidebarBgColor || "#212121";
        boxColorInput.value = opts.sidebarBoxColor || "#2e2e2e";
        headerFontSizeInput.value = parseInt(opts.headerFontSize,10) || 14;
        headerBold.checked = Boolean(opts.headerBold);
        line1SizeInput.value = parseInt(opts.line1Size,10) || 13;
        line1Bold.checked = Boolean(opts.line1Bold);
        line2SizeInput.value = parseInt(opts.line2Size,10) || 13;
        line2Bold.checked = Boolean(opts.line2Bold);
        line3SizeInput.value = parseInt(opts.line3Size,10) || 13;
        line3Bold.checked = Boolean(opts.line3Bold);
        buttonColorInput.value = opts.buttonColor || '#333333';
        buttonRadiusInput.value = parseInt(opts.buttonRadius,10) || 6;
        iconSetSelect.value = opts.iconSet || 'default';
        userInput.value = opts.txsosUser || "";
        passInput.value = opts.txsosPass || "";
        toggleCustom();
        updatePreview();
    });

    function applyTheme(theme) {
        if (theme === 'classic') {
            widthInput.value = 340;
            fontSizeSelect.value = '13';
            fontSelect.value = "'Inter', sans-serif";
            bgColorInput.value = '#212121';
            boxColorInput.value = '#2e2e2e';
            headerFontSizeInput.value = 14;
            headerBold.checked = true;
            line1SizeInput.value = 13;
            line1Bold.checked = false;
            line2SizeInput.value = 13;
            line2Bold.checked = false;
            line3SizeInput.value = 13;
            line3Bold.checked = false;
            buttonColorInput.value = '#333333';
            buttonRadiusInput.value = 6;
            iconSetSelect.value = 'default';
        } else if (theme === 'light') {
            widthInput.value = 340;
            fontSizeSelect.value = '13';
            fontSelect.value = "'Inter', sans-serif";
            bgColorInput.value = '#ffffff';
            boxColorInput.value = '#f4f4f4';
            headerFontSizeInput.value = 14;
            headerBold.checked = true;
            line1SizeInput.value = 13;
            line1Bold.checked = false;
            line2SizeInput.value = 13;
            line2Bold.checked = false;
            line3SizeInput.value = 13;
            line3Bold.checked = false;
            buttonColorInput.value = '#005a9c';
            buttonRadiusInput.value = 6;
            iconSetSelect.value = 'default';
        }
        toggleCustom();
        updatePreview();
    }

    function save() {
        const width = parseInt(widthInput.value, 10) || 340;
        const fontSize = parseInt(fontSizeSelect.value, 10) || 13;
        chrome.storage.sync.set({
            theme: themeSelect.value,
            defaultReviewMode: reviewBox.checked,
            defaultDevMode: devBox.checked,
            sidebarWidth: width,
            sidebarFontSize: fontSize,
            sidebarFont: fontSelect.value,
            sidebarBgColor: bgColorInput.value,
            sidebarBoxColor: boxColorInput.value,
            headerFontSize: parseInt(headerFontSizeInput.value,10) || 14,
            headerBold: headerBold.checked,
            line1Size: parseInt(line1SizeInput.value,10) || 13,
            line1Bold: line1Bold.checked,
            line2Size: parseInt(line2SizeInput.value,10) || 13,
            line2Bold: line2Bold.checked,
            line3Size: parseInt(line3SizeInput.value,10) || 13,
            line3Bold: line3Bold.checked,
            buttonColor: buttonColorInput.value,
            buttonRadius: parseInt(buttonRadiusInput.value,10) || 6,
            iconSet: iconSetSelect.value,
            txsosUser: userInput.value,
            txsosPass: passInput.value,
            fennecReviewMode: reviewBox.checked,
            fennecDevMode: devBox.checked
        });
        chrome.storage.local.set({ fennecReviewMode: reviewBox.checked, fennecDevMode: devBox.checked });
    }

    [widthInput, fontSizeSelect, fontSelect, bgColorInput, boxColorInput,
     headerFontSizeInput, line1SizeInput, line2SizeInput, line3SizeInput,
     buttonColorInput, buttonRadiusInput].forEach(el => el.addEventListener("input", updatePreview));
    [headerBold, line1Bold, line2Bold, line3Bold].forEach(el => el.addEventListener('change', updatePreview));
    themeSelect.addEventListener('change', () => applyTheme(themeSelect.value));
    iconSetSelect.addEventListener('change', updatePreview);
    saveBtn.addEventListener("click", () => { save(); updatePreview(); });
});
