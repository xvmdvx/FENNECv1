(function(){
    if (window.__fennecDtPatch) return;
    window.__fennecDtPatch = true;
    function applyPatch() {
        var jq = window.jQuery || window.$;
        if (jq && jq.fn && jq.fn.dataTable) {
            jq.fn.dataTable.ext.errMode = 'none';
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyPatch);
    } else {
        applyPatch();
    }
})();
