(function() {
    if (window.__fennecCsvHook) return;
    window.__fennecCsvHook = true;
    const origBlob = window.Blob;
    window.Blob = function(data, opts) {
        if (Array.isArray(data) && typeof data[0] === 'string') {
            try {
                window.postMessage({ type: 'FENNEC_CSV_CAPTURE', csv: data[0] }, '*');
            } catch (e) {}
            window.Blob = origBlob;
        }
        return new origBlob(data, opts);
    };
})();
