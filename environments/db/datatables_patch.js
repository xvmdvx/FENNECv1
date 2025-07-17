(function(){
    if (window.__fennecDtPatch) return;
    window.__fennecDtPatch = true;
    function setErrMode(){
        var jq = window.jQuery || window.$;
        if (jq && jq.fn && jq.fn.dataTable && jq.fn.dataTable.ext){
            jq.fn.dataTable.ext.errMode = function(){ /* no-op */ };
            jq(document).on('error.dt', function(e){
                e.preventDefault();
            });
            return true;
        }
        return false;
    }

    function apply(){
        if (!setErrMode()) setTimeout(apply, 50);
    }

    apply();
})();
