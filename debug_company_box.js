// Debug script para probar la funcionalidad de company-box
console.log('🔍 [FENNEC DEBUG] Iniciando debug de company-box...');

// Función para verificar si los elementos existen
function debugCompanyBoxElements() {
    console.log('🔍 [FENNEC DEBUG] Verificando elementos de company-box...');
    
    // Buscar company-box
    const companyBoxes = document.querySelectorAll('.company-box');
    console.log('🔍 [FENNEC DEBUG] Company boxes encontradas:', companyBoxes.length);
    
    companyBoxes.forEach((box, index) => {
        console.log(`🔍 [FENNEC DEBUG] Company box ${index + 1}:`, {
            element: box,
            state: box.dataset.state,
            innerHTML: box.innerHTML.substring(0, 200) + '...'
        });
        
        // Buscar enlaces copilot-sos
        const sosLinks = box.querySelectorAll('.copilot-sos');
        console.log(`🔍 [FENNEC DEBUG] Company box ${index + 1} - Enlaces SOS:`, sosLinks.length);
        
        sosLinks.forEach((link, linkIndex) => {
            console.log(`🔍 [FENNEC DEBUG] Enlace SOS ${linkIndex + 1}:`, {
                element: link,
                url: link.dataset.url,
                query: link.dataset.query,
                type: link.dataset.type,
                innerHTML: link.innerHTML
            });
        });
        
        // Buscar icono de búsqueda
        const searchToggles = box.querySelectorAll('.company-search-toggle');
        console.log(`🔍 [FENNEC DEBUG] Company box ${index + 1} - Iconos de búsqueda:`, searchToggles.length);
        
        searchToggles.forEach((toggle, toggleIndex) => {
            console.log(`🔍 [FENNEC DEBUG] Icono de búsqueda ${toggleIndex + 1}:`, {
                element: toggle,
                innerHTML: toggle.innerHTML,
                hasListener: toggle._companySearchToggleHandler ? 'YES' : 'NO'
            });
        });
    });
}

// Función para verificar event listeners
function debugEventListeners() {
    console.log('🔍 [FENNEC DEBUG] Verificando event listeners...');
    
    // Verificar copilot-sos
    const sosLinks = document.querySelectorAll('.copilot-sos');
    console.log('🔍 [FENNEC DEBUG] Enlaces copilot-sos encontrados:', sosLinks.length);
    
    sosLinks.forEach((link, index) => {
        console.log(`🔍 [FENNEC DEBUG] Enlace SOS ${index + 1}:`, {
            element: link,
            url: link.dataset.url,
            query: link.dataset.query,
            type: link.dataset.type
        });
        
        // Agregar listener de prueba
        link.addEventListener('click', (e) => {
            console.log('🔍 [FENNEC DEBUG] CLICK EN ENLACE SOS DETECTADO!', {
                url: link.dataset.url,
                query: link.dataset.query,
                type: link.dataset.type
            });
            e.preventDefault();
            e.stopPropagation();
            
            // Simular la funcionalidad
            if (link.dataset.url && link.dataset.query) {
                console.log('🔍 [FENNEC DEBUG] Abriendo URL SOS:', link.dataset.url);
                window.open(link.dataset.url, '_blank');
            }
        });
    });
    
    // Verificar company-search-toggle
    const searchToggles = document.querySelectorAll('.company-search-toggle');
    console.log('🔍 [FENNEC DEBUG] Iconos de búsqueda encontrados:', searchToggles.length);
    
    searchToggles.forEach((toggle, index) => {
        console.log(`🔍 [FENNEC DEBUG] Icono de búsqueda ${index + 1}:`, {
            element: toggle,
            innerHTML: toggle.innerHTML
        });
        
        // Agregar listener de prueba
        toggle.addEventListener('click', (e) => {
            console.log('🔍 [FENNEC DEBUG] CLICK EN ICONO DE BÚSQUEDA DETECTADO!');
            e.preventDefault();
            e.stopPropagation();
            
            const box = toggle.closest('.white-box');
            if (box) {
                console.log('🔍 [FENNEC DEBUG] Company box encontrada:', box);
                if (typeof toggleCompanySearch === 'function') {
                    console.log('🔍 [FENNEC DEBUG] Llamando toggleCompanySearch...');
                    toggleCompanySearch(box);
                } else {
                    console.error('🔍 [FENNEC DEBUG] toggleCompanySearch no está disponible');
                }
            } else {
                console.error('🔍 [FENNEC DEBUG] No se encontró company box');
            }
        });
    });
}

// Función para verificar funciones disponibles
function debugAvailableFunctions() {
    console.log('🔍 [FENNEC DEBUG] Verificando funciones disponibles...');
    
    console.log('🔍 [FENNEC DEBUG] toggleCompanySearch disponible:', typeof toggleCompanySearch === 'function');
    console.log('🔍 [FENNEC DEBUG] buildSosUrl disponible:', typeof buildSosUrl === 'function');
    console.log('🔍 [FENNEC DEBUG] attachCommonListeners disponible:', typeof attachCommonListeners === 'function');
    
    if (typeof buildSosUrl === 'function') {
        console.log('🔍 [FENNEC DEBUG] Probando buildSosUrl...');
        const testStates = ['California', 'Texas', 'New York'];
        testStates.forEach(state => {
            const nameUrl = buildSosUrl(state, null, 'name');
            const idUrl = buildSosUrl(state, null, 'id');
            console.log(`🔍 [FENNEC DEBUG] ${state}:`, { nameUrl, idUrl });
        });
    }
}

// Función para forzar la re-aplicación de listeners
function forceReattachListeners() {
    console.log('🔍 [FENNEC DEBUG] Forzando re-aplicación de listeners...');
    
    const sidebar = document.getElementById('copilot-sidebar');
    if (sidebar && typeof attachCommonListeners === 'function') {
        console.log('🔍 [FENNEC DEBUG] Llamando attachCommonListeners...');
        attachCommonListeners(sidebar);
    } else {
        console.error('🔍 [FENNEC DEBUG] No se pudo encontrar sidebar o attachCommonListeners');
    }
}

// Ejecutar debug completo
function runFullDebug() {
    console.log('🔍 [FENNEC DEBUG] ===== INICIANDO DEBUG COMPLETO =====');
    
    debugCompanyBoxElements();
    debugEventListeners();
    debugAvailableFunctions();
    forceReattachListeners();
    
    console.log('🔍 [FENNEC DEBUG] ===== DEBUG COMPLETO FINALIZADO =====');
}

// Ejecutar después de un pequeño delay para asegurar que el DOM esté listo
setTimeout(runFullDebug, 1000);

// También ejecutar cuando se detecten cambios en el DOM
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.classList && node.classList.contains('company-box')) {
                        console.log('🔍 [FENNEC DEBUG] Nueva company-box detectada, ejecutando debug...');
                        setTimeout(runFullDebug, 100);
                    }
                }
            });
        }
    });
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

console.log('🔍 [FENNEC DEBUG] Debug script cargado y observador configurado');
