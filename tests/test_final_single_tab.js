// Test script final para verificar que solo se abre UN tab incluso con errores de chrome.runtime
console.log('🧪 [FENNEC TEST] Iniciando test final de single tab...');

// Contador de tabs abiertos
let tabsOpened = 0;
let lastOpenedUrl = '';

// Interceptar window.open para contar tabs (después de la deduplicación)
const originalWindowOpen = window.open;
window.open = function(url, target, features) {
    tabsOpened++;
    lastOpenedUrl = url;
    console.log(`🧪 [FENNEC TEST] Tab ${tabsOpened} abierto después de deduplicación:`, url);
    return originalWindowOpen.call(this, url, target, features);
};

// Función para resetear contador
function resetTabCounter() {
    tabsOpened = 0;
    lastOpenedUrl = '';
    console.log('🧪 [FENNEC TEST] Contador de tabs reseteado');
}

// Función para verificar que solo se abre un tab
function verifySingleTab() {
    if (tabsOpened === 1) {
        console.log('✅ [FENNEC TEST] ÉXITO: Solo se abrió 1 tab después de deduplicación');
        return true;
    } else if (tabsOpened === 0) {
        console.error('❌ [FENNEC TEST] ERROR: No se abrió ningún tab');
        return false;
    } else {
        console.error(`❌ [FENNEC TEST] ERROR: Se abrieron ${tabsOpened} tabs después de deduplicación (debería ser 1)`);
        return false;
    }
}

// Función para simular click y verificar
function testClickAndVerify(element, description) {
    console.log(`🧪 [FENNEC TEST] Probando click en ${description}...`);
    
    // Resetear contador
    resetTabCounter();
    
    // Simular click
    const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
    });
    
    const result = element.dispatchEvent(clickEvent);
    console.log(`🧪 [FENNEC TEST] Click en ${description} resultó en:`, result);
    
    // Esperar un poco y verificar
    setTimeout(() => {
        const success = verifySingleTab();
        if (success) {
            console.log(`✅ [FENNEC TEST] ${description}: SOLO UN TAB ABIERTO`);
        } else {
            console.error(`❌ [FENNEC TEST] ${description}: MÚLTIPLES TABS ABIERTOS`);
        }
    }, 200);
}

// Función para verificar el sistema de deduplicación
function verifyDeduplicationSystem() {
    console.log('🧪 [FENNEC TEST] Verificando sistema de deduplicación...');
    
    // Verificar que el sistema existe
    if (typeof window.tabDeduplication === 'undefined') {
        console.error('❌ [FENNEC TEST] Sistema de deduplicación no encontrado');
        return false;
    }
    
    console.log('✅ [FENNEC TEST] Sistema de deduplicación encontrado');
    
    // Verificar que window.open está sobrescrito
    if (window.open.toString().includes('tabDeduplication')) {
        console.log('✅ [FENNEC TEST] window.open está sobrescrito con deduplicación');
    } else {
        console.error('❌ [FENNEC TEST] window.open NO está sobrescrito con deduplicación');
        return false;
    }
    
    return true;
}

// Función para verificar que chrome.runtime está disponible
function verifyChromeRuntime() {
    console.log('🧪 [FENNEC TEST] Verificando chrome.runtime...');
    
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        console.log('✅ [FENNEC TEST] chrome.runtime está disponible');
        return true;
    } else {
        console.log('⚠️ [FENNEC TEST] chrome.runtime NO está disponible (esto es normal en algunos contextos)');
        return false;
    }
}

// Función principal de test
function runFinalSingleTabTest() {
    console.log('🧪 [FENNEC TEST] ===== INICIANDO TEST FINAL DE SINGLE TAB =====');
    
    // Verificar sistema
    if (!verifyDeduplicationSystem()) {
        console.error('🧪 [FENNEC TEST] Sistema de deduplicación no está funcionando');
        return;
    }
    
    // Verificar chrome.runtime
    verifyChromeRuntime();
    
    // Test con elementos reales
    setTimeout(() => {
        const companyBoxes = document.querySelectorAll('.company-box');
        console.log('🧪 [FENNEC TEST] Company boxes encontradas:', companyBoxes.length);
        
        if (companyBoxes.length === 0) {
            console.error('🧪 [FENNEC TEST] No se encontraron company boxes');
            return;
        }
        
        // Test cada company box
        companyBoxes.forEach((box, boxIndex) => {
            console.log(`🧪 [FENNEC TEST] Probando company box ${boxIndex + 1}:`);
            
            // Test enlaces SOS
            const sosLinks = box.querySelectorAll('.copilot-sos');
            sosLinks.forEach((link, linkIndex) => {
                const description = `enlace SOS ${linkIndex + 1} (${link.dataset.query})`;
                testClickAndVerify(link, description);
            });
            
            // Test iconos de búsqueda
            const searchToggles = box.querySelectorAll('.company-search-toggle');
            searchToggles.forEach((toggle, toggleIndex) => {
                const description = `icono de búsqueda ${toggleIndex + 1}`;
                testClickAndVerify(toggle, description);
            });
        });
        
        console.log('🧪 [FENNEC TEST] ===== TEST FINAL DE SINGLE TAB COMPLETADO =====');
    }, 1000);
}

// Ejecutar después de un delay
setTimeout(runFinalSingleTabTest, 2000);

// También ejecutar cuando se detecten cambios
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.classList && node.classList.contains('company-box')) {
                        console.log('🧪 [FENNEC TEST] Nueva company-box detectada, ejecutando test final...');
                        setTimeout(runFinalSingleTabTest, 1000);
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

console.log('🧪 [FENNEC TEST] Test final de single tab cargado y observador configurado');
