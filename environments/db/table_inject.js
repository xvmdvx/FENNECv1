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
                setTimeout(function(){ window.postMessage(e.data, '*'); }, 100);
                return;
            }
            var table = $(tableEl).DataTable();
            var colCount = $(tableEl).find('thead th').length;
            (e.data.rows || []).forEach(function(html){
                var $row = $(html);
                if (!$row.length) return;
                var cells = $row.children('td');
                var data = [];
                for (var i = 0; i < colCount; i++) {
                    var cell = cells[i] ? cells[i].innerHTML : '';
                    data.push(cell);
                }
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
