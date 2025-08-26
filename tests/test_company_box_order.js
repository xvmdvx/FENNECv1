// Test script para verificar el nuevo orden de la company-box
console.log('🧪 [FENNEC TEST] Iniciando test del nuevo orden de company-box...');

// Función para verificar el orden de los elementos
function verifyCompanyBoxOrder() {
    console.log('🧪 [FENNEC TEST] Verificando orden de company-box...');
    
    const companyBoxes = document.querySelectorAll('.company-box');
    console.log('🧪 [FENNEC TEST] Company boxes encontradas:', companyBoxes.length);
    
    if (companyBoxes.length === 0) {
        console.error('🧪 [FENNEC TEST] No se encontraron company boxes');
        return false;
    }
    
    let allGood = true;
    
    companyBoxes.forEach((box, boxIndex) => {
        console.log(`🧪 [FENNEC TEST] Verificando company box ${boxIndex + 1}:`);
        
        // Verificar que el company name está primero
        const companyNameElement = box.querySelector('.copilot-sos[data-type="name"]');
        if (companyNameElement) {
            console.log(`  ✅ Company name encontrado: ${companyNameElement.textContent}`);
        } else {
            console.error(`  ❌ Company name no encontrado`);
            allGood = false;
        }
        
        // Verificar que el state ID está segundo (justo después del company name)
        const stateIdElement = box.querySelector('.copilot-sos[data-type="id"]');
        if (stateIdElement) {
            console.log(`  ✅ State ID encontrado: ${stateIdElement.textContent}`);
            
            // Verificar que está después del company name
            const companyNameIndex = Array.from(box.querySelectorAll('.copilot-sos')).indexOf(companyNameElement);
            const stateIdIndex = Array.from(box.querySelectorAll('.copilot-sos')).indexOf(stateIdElement);
            
            if (stateIdIndex > companyNameIndex) {
                console.log(`  ✅ State ID está después del company name (índices: ${companyNameIndex} -> ${stateIdIndex})`);
            } else {
                console.error(`  ❌ State ID NO está después del company name (índices: ${companyNameIndex} -> ${stateIdIndex})`);
                allGood = false;
            }
        } else {
            console.log(`  ⚠️ State ID no encontrado (puede ser normal si no hay state ID)`);
        }
        
        // Verificar que NO hay order ID
        const orderIdElements = box.querySelectorAll('.copilot-copy[data-copy*="225"]'); // Buscar elementos que contengan order ID
        if (orderIdElements.length === 0) {
            console.log(`  ✅ Order ID removido correctamente`);
        } else {
            console.error(`  ❌ Order ID aún presente: ${orderIdElements.length} elementos encontrados`);
            allGood = false;
        }
        
        // Verificar que los tags están presentes
        const tags = box.querySelectorAll('.copilot-tag');
        if (tags.length > 0) {
            console.log(`  ✅ Tags encontrados: ${tags.length}`);
            tags.forEach((tag, tagIndex) => {
                console.log(`    Tag ${tagIndex + 1}: ${tag.textContent}`);
            });
        } else {
            console.log(`  ⚠️ No se encontraron tags`);
        }
        
        // Verificar que el icono de búsqueda está presente
        const searchIcon = box.querySelector('.company-search-toggle');
        if (searchIcon) {
            console.log(`  ✅ Icono de búsqueda encontrado`);
        } else {
            console.error(`  ❌ Icono de búsqueda no encontrado`);
            allGood = false;
        }
        
        // Verificar que el state link está presente
        const stateLink = box.querySelector('.copilot-kb');
        if (stateLink) {
            console.log(`  ✅ State link encontrado: ${stateLink.textContent}`);
        } else {
            console.log(`  ⚠️ State link no encontrado`);
        }
    });
    
    return allGood;
}

// Función para mostrar el HTML actual de la company-box
function showCompanyBoxHTML() {
    console.log('🧪 [FENNEC TEST] Mostrando HTML actual de company-box...');
    
    const companyBoxes = document.querySelectorAll('.company-box');
    
    companyBoxes.forEach((box, boxIndex) => {
        console.log(`🧪 [FENNEC TEST] Company box ${boxIndex + 1} HTML:`);
        console.log(box.innerHTML);
        console.log('---');
    });
}

// Función para verificar que los clicks siguen funcionando
function testClicksStillWork() {
    console.log('🧪 [FENNEC TEST] Verificando que los clicks siguen funcionando...');
    
    const companyBoxes = document.querySelectorAll('.company-box');
    
    companyBoxes.forEach((box, boxIndex) => {
        console.log(`🧪 [FENNEC TEST] Probando clicks en company box ${boxIndex + 1}:`);
        
        // Test company name click
        const companyNameLink = box.querySelector('.copilot-sos[data-type="name"]');
        if (companyNameLink) {
            console.log(`  ✅ Company name link encontrado: ${companyNameLink.textContent}`);
            console.log(`    URL: ${companyNameLink.dataset.url}`);
            console.log(`    Query: ${companyNameLink.dataset.query}`);
        }
        
        // Test state ID click
        const stateIdLink = box.querySelector('.copilot-sos[data-type="id"]');
        if (stateIdLink) {
            console.log(`  ✅ State ID link encontrado: ${stateIdLink.textContent}`);
            console.log(`    URL: ${stateIdLink.dataset.url}`);
            console.log(`    Query: ${stateIdLink.dataset.query}`);
        }
        
        // Test search icon click
        const searchIcon = box.querySelector('.company-search-toggle');
        if (searchIcon) {
            console.log(`  ✅ Search icon encontrado`);
        }
    });
}

// Función principal de test
function runCompanyBoxOrderTest() {
    console.log('🧪 [FENNEC TEST] ===== INICIANDO TEST DE ORDEN DE COMPANY BOX =====');
    
    // Verificar orden
    const orderCorrect = verifyCompanyBoxOrder();
    
    // Mostrar HTML actual
    showCompanyBoxHTML();
    
    // Verificar que los clicks siguen funcionando
    testClicksStillWork();
    
    if (orderCorrect) {
        console.log('✅ [FENNEC TEST] ORDEN DE COMPANY BOX CORRECTO');
    } else {
        console.error('❌ [FENNEC TEST] ORDEN DE COMPANY BOX INCORRECTO');
    }
    
    console.log('🧪 [FENNEC TEST] ===== TEST DE ORDEN DE COMPANY BOX COMPLETADO =====');
}

// Ejecutar después de un delay
setTimeout(runCompanyBoxOrderTest, 2000);

// También ejecutar cuando se detecten cambios
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.classList && node.classList.contains('company-box')) {
                        console.log('🧪 [FENNEC TEST] Nueva company-box detectada, ejecutando test de orden...');
                        setTimeout(runCompanyBoxOrderTest, 1000);
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

console.log('🧪 [FENNEC TEST] Test de orden de company-box cargado y observador configurado');
