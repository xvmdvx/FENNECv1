// Test script para verificar que los clicks en company-box funcionan
console.log('🧪 [FENNEC TEST] Iniciando test de company-box...');

// Función para simular clicks en elementos
function simulateClick(element, description) {
    console.log(`🧪 [FENNEC TEST] Simulando click en ${description}:`, element);
    
    if (!element) {
        console.error(`🧪 [FENNEC TEST] Elemento no encontrado para ${description}`);
        return false;
    }
    
    try {
        // Crear un evento de click
        const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
        });
        
        // Dispatch del evento
        const result = element.dispatchEvent(clickEvent);
        console.log(`🧪 [FENNEC TEST] Click en ${description} resultó en:`, result);
        return result;
    } catch (error) {
        console.error(`🧪 [FENNEC TEST] Error al simular click en ${description}:`, error);
        return false;
    }
}

// Función para verificar que los elementos existen y tienen los datos correctos
function verifyElements() {
    console.log('🧪 [FENNEC TEST] Verificando elementos...');
    
    const companyBoxes = document.querySelectorAll('.company-box');
    console.log('🧪 [FENNEC TEST] Company boxes encontradas:', companyBoxes.length);
    
    if (companyBoxes.length === 0) {
        console.error('🧪 [FENNEC TEST] No se encontraron company boxes');
        return false;
    }
    
    let allGood = true;
    
    companyBoxes.forEach((box, index) => {
        console.log(`🧪 [FENNEC TEST] Verificando company box ${index + 1}:`);
        
        // Verificar enlaces SOS
        const sosLinks = box.querySelectorAll('.copilot-sos');
        console.log(`  - Enlaces SOS: ${sosLinks.length}`);
        
        sosLinks.forEach((link, linkIndex) => {
            const hasUrl = !!link.dataset.url;
            const hasQuery = !!link.dataset.query;
            const hasType = !!link.dataset.type;
            
            console.log(`    Enlace ${linkIndex + 1}: URL=${hasUrl}, Query=${hasQuery}, Type=${hasType}`);
            
            if (!hasUrl || !hasQuery) {
                console.error(`    ❌ Enlace ${linkIndex + 1} falta datos`);
                allGood = false;
            }
        });
        
        // Verificar iconos de búsqueda
        const searchToggles = box.querySelectorAll('.company-search-toggle');
        console.log(`  - Iconos de búsqueda: ${searchToggles.length}`);
        
        if (searchToggles.length === 0) {
            console.error(`  ❌ Company box ${index + 1} no tiene icono de búsqueda`);
            allGood = false;
        }
    });
    
    return allGood;
}

// Función para probar los clicks
function testClicks() {
    console.log('🧪 [FENNEC TEST] Probando clicks...');
    
    const companyBoxes = document.querySelectorAll('.company-box');
    
    companyBoxes.forEach((box, boxIndex) => {
        console.log(`🧪 [FENNEC TEST] Probando company box ${boxIndex + 1}:`);
        
        // Probar clicks en enlaces SOS
        const sosLinks = box.querySelectorAll('.copilot-sos');
        sosLinks.forEach((link, linkIndex) => {
            console.log(`  Probando click en enlace SOS ${linkIndex + 1}...`);
            const success = simulateClick(link, `enlace SOS ${linkIndex + 1}`);
            if (success) {
                console.log(`  ✅ Click en enlace SOS ${linkIndex + 1} exitoso`);
            } else {
                console.error(`  ❌ Click en enlace SOS ${linkIndex + 1} falló`);
            }
        });
        
        // Probar click en icono de búsqueda
        const searchToggles = box.querySelectorAll('.company-search-toggle');
        searchToggles.forEach((toggle, toggleIndex) => {
            console.log(`  Probando click en icono de búsqueda ${toggleIndex + 1}...`);
            const success = simulateClick(toggle, `icono de búsqueda ${toggleIndex + 1}`);
            if (success) {
                console.log(`  ✅ Click en icono de búsqueda ${toggleIndex + 1} exitoso`);
            } else {
                console.error(`  ❌ Click en icono de búsqueda ${toggleIndex + 1} falló`);
            }
        });
    });
}

// Función principal de test
function runCompanyBoxTest() {
    console.log('🧪 [FENNEC TEST] ===== INICIANDO TEST DE COMPANY BOX =====');
    
    // Verificar que los elementos existen
    const elementsExist = verifyElements();
    if (!elementsExist) {
        console.error('🧪 [FENNEC TEST] ❌ Test falló: elementos no encontrados');
        return;
    }
    
    // Verificar que las funciones están disponibles
    console.log('🧪 [FENNEC TEST] Verificando funciones disponibles:');
    console.log('  - toggleCompanySearch:', typeof toggleCompanySearch === 'function');
    console.log('  - buildSosUrl:', typeof buildSosUrl === 'function');
    console.log('  - ensureCompanyBoxListeners:', typeof ensureCompanyBoxListeners === 'function');
    
    // Forzar la aplicación de listeners
    if (typeof ensureCompanyBoxListeners === 'function') {
        console.log('🧪 [FENNEC TEST] Aplicando listeners...');
        ensureCompanyBoxListeners();
    }
    
    // Esperar un poco y luego probar los clicks
    setTimeout(() => {
        testClicks();
        console.log('🧪 [FENNEC TEST] ===== TEST DE COMPANY BOX COMPLETADO =====');
    }, 500);
}

// Ejecutar el test después de un delay para asegurar que el DOM esté listo
setTimeout(runCompanyBoxTest, 2000);

// También ejecutar cuando se detecten cambios en el DOM
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.classList && node.classList.contains('company-box')) {
                        console.log('🧪 [FENNEC TEST] Nueva company-box detectada, ejecutando test...');
                        setTimeout(runCompanyBoxTest, 1000);
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

console.log('🧪 [FENNEC TEST] Test script cargado y observador configurado');
