// Test script para verificar que la deduplicación de tabs funciona
console.log('🧪 [FENNEC TEST] Iniciando test de deduplicación de tabs...');

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

// Función para simular múltiples clicks rápidos y verificar deduplicación
function testRapidClicks(element, description) {
    console.log(`🧪 [FENNEC TEST] Probando clicks rápidos en ${description}...`);
    
    // Resetear contador
    resetTabCounter();
    
    // Simular múltiples clicks rápidos
    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            
            const result = element.dispatchEvent(clickEvent);
            console.log(`🧪 [FENNEC TEST] Click ${i + 1} en ${description} resultó en:`, result);
        }, i * 50); // 50ms entre clicks
    }
    
    // Esperar y verificar
    setTimeout(() => {
        const success = verifySingleTab();
        if (success) {
            console.log(`✅ [FENNEC TEST] ${description}: DEDUPLICACIÓN FUNCIONA - SOLO UN TAB`);
        } else {
            console.error(`❌ [FENNEC TEST] ${description}: DEDUPLICACIÓN FALLÓ - MÚLTIPLES TABS`);
        }
    }, 500);
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

// Función para testear el sistema de deduplicación directamente
function testDeduplicationDirectly() {
    console.log('🧪 [FENNEC TEST] Probando deduplicación directamente...');
    
    const testUrl = 'https://example.com/test';
    
    // Resetear el sistema
    if (typeof window.resetTabDeduplication === 'function') {
        window.resetTabDeduplication();
    }
    
    // Simular múltiples llamadas a window.open
    console.log('🧪 [FENNEC TEST] Simulando múltiples llamadas a window.open...');
    
    const results = [];
    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            const result = window.open(testUrl, '_blank');
            results.push(result);
            console.log(`🧪 [FENNEC TEST] Llamada ${i + 1} a window.open:`, result ? 'ABIERTO' : 'BLOQUEADO');
        }, i * 100);
    }
    
    // Verificar resultados después de un delay
    setTimeout(() => {
        const openedTabs = results.filter(r => r !== null).length;
        if (openedTabs === 1) {
            console.log('✅ [FENNEC TEST] DEDUPLICACIÓN DIRECTA FUNCIONA: Solo 1 tab abierto');
        } else {
            console.error(`❌ [FENNEC TEST] DEDUPLICACIÓN DIRECTA FALLÓ: ${openedTabs} tabs abiertos`);
        }
    }, 1000);
}

// Función principal de test
function runDeduplicationTest() {
    console.log('🧪 [FENNEC TEST] ===== INICIANDO TEST DE DEDUPLICACIÓN =====');
    
    // Verificar sistema
    if (!verifyDeduplicationSystem()) {
        console.error('🧪 [FENNEC TEST] Sistema de deduplicación no está funcionando');
        return;
    }
    
    // Test directo del sistema
    testDeduplicationDirectly();
    
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
            
            // Test enlaces SOS con clicks rápidos
            const sosLinks = box.querySelectorAll('.copilot-sos');
            sosLinks.forEach((link, linkIndex) => {
                const description = `enlace SOS ${linkIndex + 1} (${link.dataset.query})`;
                testRapidClicks(link, description);
            });
        });
        
        console.log('🧪 [FENNEC TEST] ===== TEST DE DEDUPLICACIÓN COMPLETADO =====');
    }, 1500);
}

// Ejecutar después de un delay
setTimeout(runDeduplicationTest, 2000);

// También ejecutar cuando se detecten cambios
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.classList && node.classList.contains('company-box')) {
                        console.log('🧪 [FENNEC TEST] Nueva company-box detectada, ejecutando test de deduplicación...');
                        setTimeout(runDeduplicationTest, 1000);
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

console.log('🧪 [FENNEC TEST] Test de deduplicación cargado y observador configurado');
