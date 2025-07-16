(function(){
    if (window.__fennecDtPatch) return;
    window.__fennecDtPatch = true;
    var jq = window.jQuery || window.$;
    if (jq && jq.fn && jq.fn.dataTable) {
        jq.fn.dataTable.ext.errMode = 'none';
    }
})();
