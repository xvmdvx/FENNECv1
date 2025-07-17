(function(){
    if (window.__fennecTableInject) return;
    window.__fennecTableInject = true;
    window.addEventListener('message', function(e) {
        if (e.source !== window || !e.data || e.data.type !== 'FENNEC_ADD_ROWS') return;
        try {
            var $ = window.jQuery || window.$;
            if (!$) return;
            var tableEl = document.getElementById('tableStatusResults');
            if (!tableEl || typeof $(tableEl).DataTable !== 'function') return;
            var table = $(tableEl).DataTable();
            (e.data.rows || []).forEach(function(html){
                var $row = $(html);
                if ($row.length) table.row.add($row[0]);
            });
            // Show all rows so injected orders are visible
            table.page.len(-1).draw(false);
            window.postMessage({ type: 'FENNEC_ROWS_ADDED' }, '*');
        } catch (err) {
            console.error('[FENNEC] table_inject error', err);
        }
    });
})();
