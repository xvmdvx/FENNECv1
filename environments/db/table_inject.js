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
            if (!$.fn.dataTable || !$.fn.dataTable.isDataTable(tableEl)) {
                // Retry shortly if DataTable has not finished initializing
                var tries = e.data.retry || 0;
                if (tries < 50) {
                    setTimeout(function(){
                        window.postMessage(Object.assign({}, e.data, { retry: tries + 1 }), '*');
                    }, 100);
                }
                return;
            }
            var table = $(tableEl).DataTable();
            var colCount = $(tableEl).find('thead th').length;
            (e.data.rows || []).forEach(function(html){
                var $row = $(html);
                if (!$row.length) return;
                var cells = $row.children('td');
                for (var i = cells.length; i < colCount; i++) {
                    $row.append('<td></td>');
                }
                var data = [];
                $row.children('td').each(function(){
                    data.push(this.innerHTML);
                });
                table.row.add(data);
            });
            // Show all rows so injected orders are visible
            table.page.len(-1).draw(false);
            window.postMessage({ type: 'FENNEC_ROWS_ADDED' }, '*');
        } catch (err) {
            console.error('[FENNEC] table_inject error', err);
        }
    });
})();
