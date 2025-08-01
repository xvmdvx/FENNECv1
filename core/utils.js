// Common utilities for FENNEC (POO) content scripts.
// Provides escapeHtml and attachCommonListeners helpers.

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function applySidebarDesign(sidebar, opts) {
    if (!sidebar || !opts) return;
    if (opts.sidebarBgColor) {
        sidebar.style.setProperty('--sb-bg', opts.sidebarBgColor);
    }
    if (opts.sidebarBoxColor) {
        sidebar.style.setProperty('--sb-box-bg', opts.sidebarBoxColor);
    }
    const fs = parseInt(opts.sidebarFontSize, 10);
    if (fs) {
        sidebar.style.setProperty('--sb-font-size', fs + 'px');
    }
    if (opts.sidebarFont) {
        sidebar.style.setProperty('--sb-font-family', opts.sidebarFont);
    }
}
window.applySidebarDesign = applySidebarDesign;

function buildSidebarHeader() {
    return `
        <div class="copilot-header">
            <span id="qa-toggle" class="quick-actions-toggle">☰</span>
            <div class="copilot-title">
                <img src="${chrome.runtime.getURL('fennec_icon.png')}" class="copilot-icon" alt="FENNEC (POO)" />
                <span>FENNEC (POO)</span>
            </div>
            <button id="copilot-clear-tabs">🗑</button>
            <button id="copilot-close">✕</button>
        </div>`;
}
window.buildSidebarHeader = buildSidebarHeader;

function getFennecSessionId() {
    let id = sessionStorage.getItem('fennecSessionId');
    if (!id) {
        id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        sessionStorage.setItem('fennecSessionId', id);
    }
    return id;
}
window.getFennecSessionId = getFennecSessionId;

// Handle reset messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'fennecReset' && message.clearStorage) {
        console.log('[FENNEC (POO)] Clearing all storage for reset...');
        
        // Clear session storage
        sessionStorage.clear();
        
        // Clear local storage
        localStorage.clear();
        
        // Clear any FENNEC-related items specifically
        const fennecKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.includes('fennec')) {
                fennecKeys.push(key);
            }
        }
        fennecKeys.forEach(key => localStorage.removeItem(key));
        
        console.log('[FENNEC (POO)] Storage cleared successfully');
        sendResponse({ success: true });
    }
});

function sessionSet(data, cb) {
    const obj = Object.assign({}, data, { sidebarSessionId: getFennecSessionId() });
    chrome.storage.local.set(obj, cb);
}
window.sessionSet = sessionSet;

function insertDnaAfterCompany() {
    const dnaBox = document.querySelector('.copilot-dna');
    const compBox = document.querySelector('#copilot-sidebar .company-box');
    if (!dnaBox || !compBox) return;
    const parent = compBox.parentElement;
    if (dnaBox.parentElement !== parent || dnaBox.previousElementSibling !== compBox) {
        parent.insertBefore(dnaBox, compBox.nextSibling);
    }
}
window.insertDnaAfterCompany = insertDnaAfterCompany;

function applyStandardSectionOrder(container = document.getElementById('db-summary-section')) {
    if (!container) return;
    const pairFor = label => {
        const lbl = Array.from(container.querySelectorAll('.section-label'))
            .find(el => el.textContent.trim().toUpperCase() === label);
        return lbl ? [lbl, lbl.nextElementSibling] : null;
    };
    const order = [
        pairFor('COMPANY:'),
        pairFor('BILLING:'),
        pairFor('CLIENT:'),
        pairFor('AGENT:'),
        pairFor('MEMBERS:') || pairFor('DIRECTORS:'),
        pairFor('SHAREHOLDERS:'),
        pairFor('OFFICERS:')
    ].filter(Boolean);
    order.forEach(([lbl, box]) => {
        container.appendChild(lbl);
        if (box) container.appendChild(box);
    });
}
window.applyStandardSectionOrder = applyStandardSectionOrder;

function abbreviateOrderType(type) {
    const t = (type || '').toLowerCase();
    if (t.includes('annual report')) return 'AR';
    if (t.includes('state filings bundle')) return 'SFB';
    if (t.includes('foreign qualification')) return 'FQ';
    if (t.includes('assumed business name')) return 'ABN';
    if (t.includes('sales tax registration')) return 'SALES TAX';
    if (t.includes('registered agent change')) return 'RA CHANGE';
    if (t.includes('trade name search')) return 'TRADENAME';
    if (t.includes('beneficial ownership information report')) return 'BOIR';
    return type;
}
window.abbreviateOrderType = abbreviateOrderType;

function storeSidebarSnapshot(sidebar) {
    if (!sidebar) return;
    sessionSet({ sidebarSnapshot: sidebar.innerHTML });
}
window.storeSidebarSnapshot = storeSidebarSnapshot;

function loadSidebarSnapshot(sidebar, cb) {
    if (!sidebar) { if (typeof cb === 'function') cb(); return; }
    chrome.storage.local.get({ sidebarSnapshot: null, sidebarSessionId: null },
        ({ sidebarSnapshot, sidebarSessionId }) => {
        if (sidebarSnapshot && sidebarSessionId === getFennecSessionId()) {
            sidebar.innerHTML = sidebarSnapshot;
            attachCommonListeners(sidebar);
        }
        if (typeof cb === 'function') cb();
    });
}
window.loadSidebarSnapshot = loadSidebarSnapshot;

function attachCommonListeners(rootEl) {
    if (!rootEl) return;
    rootEl.querySelectorAll('.copilot-address').forEach(el => {
        el.addEventListener('click', e => {
            e.preventDefault();
            const addr = el.dataset.address;
            if (!addr) return;
            navigator.clipboard.writeText(addr).catch(err => console.warn('[Copilot] Clipboard', err));
            window.open('https://www.google.com/search?q=' + encodeURIComponent(addr), '_blank');
        });
    });
    rootEl.querySelectorAll('.copilot-usps').forEach(el => {
        el.addEventListener('click', e => {
            e.preventDefault();
            const addr = el.dataset.address;
            if (!addr) return;
            const url = 'https://tools.usps.com/zip-code-lookup.htm?byaddress&fennec_addr=' + encodeURIComponent(addr);
            window.open(url, '_blank');
        });
    });
    rootEl.querySelectorAll('.copilot-copy, .copilot-copy-icon').forEach(el => {
        el.addEventListener('click', () => {
            const text = el.dataset.copy;
            if (!text) return;
            navigator.clipboard.writeText(text).catch(err => console.warn('[Copilot] Clipboard', err));
        });
    });
    rootEl.querySelectorAll('.copilot-sos').forEach(el => {
        el.addEventListener('click', e => {
            e.preventDefault();
            const url = el.dataset.url;
            const query = el.dataset.query;
            const type = el.dataset.type || 'name';
            if (!url || !query) return;
            navigator.clipboard.writeText(query).catch(err => console.warn('[Copilot] Clipboard', err));
            chrome.runtime.sendMessage({ action: 'sosSearch', url, query, searchType: type });
        });
    });
    rootEl.querySelectorAll('.copilot-kb').forEach(el => {
        el.addEventListener('click', e => {
            e.preventDefault();
            const state = el.dataset.state;
            const otype = el.dataset.otype || '';
            if (!state) return;
            if (typeof window.openKbWindow === 'function') {
                window.openKbWindow(state, otype);
            } else {
                chrome.runtime.sendMessage({ action: 'openKnowledgeBaseWindow', state, orderType: otype });
            }
        });
    });
    rootEl.querySelectorAll('.company-purpose .copilot-copy').forEach(el => {
        el.addEventListener('click', () => {
            const text = el.dataset.copy;
            if (!text) return;
            window.open('https://www.google.com/search?q=' + encodeURIComponent(text), '_blank');
        });
    });
    rootEl.querySelectorAll('.copilot-name').forEach(el => {
        el.addEventListener('click', e => {
            e.preventDefault();
            const text = el.dataset.copy;
            if (!text) return;
            navigator.clipboard.writeText(text).catch(err => console.warn('[Copilot] Clipboard', err));
        });
    });
    // Quick Summary Toggle Handler
    const qsToggle = rootEl.querySelector('#qs-toggle') || document.getElementById('qs-toggle');
    if (qsToggle && !qsToggle.dataset.listenerAttached) {
        qsToggle.dataset.listenerAttached = 'true';
        qsToggle.addEventListener('click', () => {
            console.log('[FENNEC (POO)] Quick Summary toggle clicked');
            const box = document.getElementById('quick-summary');
            if (!box) return;
            if (box.style.maxHeight && parseInt(box.style.maxHeight) > 0) {
                box.style.maxHeight = '0px';
                box.classList.add('quick-summary-collapsed');
            } else {
                box.classList.remove('quick-summary-collapsed');
                box.style.maxHeight = box.scrollHeight + 'px';
            }
        });
    }
    
    // Family Tree Handler
    const ftIcon = rootEl.querySelector('#family-tree-icon') || document.getElementById('family-tree-icon');
    
    if (ftIcon && !ftIcon.dataset.listenerAttached) {
        ftIcon.dataset.listenerAttached = 'true';
        console.log('[FENNEC (POO)] Attaching click listener to family tree icon');
        
        // Add a test click listener first to see if events are working
        ftIcon.addEventListener('click', (event) => {
            console.log('[FENNEC (POO)] TEST: Any click event detected on family tree icon');
        });
        
        ftIcon.addEventListener('click', (event) => {
            console.log('[FENNEC (POO)] Family Tree icon clicked - handler triggered!', {
                event: event,
                target: event.target,
                currentTarget: event.currentTarget
            });
            let container = document.getElementById('family-tree-orders');
            if (!container) {
                const qs = document.getElementById('quick-summary');
                if (qs) {
                    container = document.createElement('div');
                    container.id = 'family-tree-orders';
                    container.className = 'ft-collapsed';
                    qs.insertAdjacentElement('afterend', container);
                } else {
                    return;
                }
            }
            if (container.style.maxHeight && parseInt(container.style.maxHeight) > 0) {
                container.style.maxHeight = '0';
                container.classList.add('ft-collapsed');
                return;
            }
            container.classList.remove('ft-collapsed');
            if (container.dataset.loaded === 'true') {
                requestAnimationFrame(() => {
                    container.style.maxHeight = container.scrollHeight + 'px';
                });
                return;
            }
            console.log('[FENNEC (POO)] getParentOrderId function available:', typeof getParentOrderId === 'function');
            const parentId = typeof getParentOrderId === 'function' ? getParentOrderId() : null;
            console.log('[FENNEC (POO)] Detected parent order ID:', parentId);
            if (!parentId) {
                console.warn('[FENNEC (POO)] Parent order not found');
                alert('Parent order not found');
                return;
            }
            
            console.log('[FENNEC (POO)] Family tree - Setting icon to loading state');
            ftIcon.style.opacity = '0.5';
            ftIcon.style.pointerEvents = 'none';
            
            console.log('[FENNEC (POO)] Family tree - Sending fetchChildOrders message for parentId:', parentId);
            
            // Add timeout to detect if background script isn't responding
            let timeoutId = setTimeout(() => {
                console.error('[FENNEC (POO)] Family tree - TIMEOUT: fetchChildOrders request took longer than 15 seconds');
                ftIcon.style.opacity = '1';
                ftIcon.style.pointerEvents = 'auto';
                alert('Family tree loading timed out. Check console for details.');
            }, 15000);
            
            chrome.runtime.sendMessage({ action: 'fetchChildOrders', orderId: parentId }, (resp) => {
                clearTimeout(timeoutId);
                
                if (chrome.runtime.lastError) {
                    console.error('[FENNEC (POO)] Family tree - Chrome runtime error:', chrome.runtime.lastError.message);
                    ftIcon.style.opacity = '1';
                    ftIcon.style.pointerEvents = 'auto';
                    alert('Family tree error: ' + chrome.runtime.lastError.message);
                    return;
                }
                
                console.log('[FENNEC (POO)] Family tree - Received fetchChildOrders response:', resp);
                ftIcon.style.opacity = '1';
                ftIcon.style.pointerEvents = 'auto';
                
                if (!resp || !resp.childOrders || !resp.parentInfo) {
                    console.warn('[FENNEC (POO)] Family tree - Invalid response received:', {
                        hasResp: !!resp,
                        hasChildOrders: resp ? !!resp.childOrders : false,
                        hasParentInfo: resp ? !!resp.parentInfo : false
                    });
                    return;
                }
                
                console.log('[FENNEC (POO)] Family tree - Valid response received, building family tree UI');
                const box = document.createElement('div');
                box.className = 'white-box';
                box.style.marginBottom = '10px';
                let html = '';
                const parent = resp.parentInfo;

                // Determine duplicate orders by type when status is REVIEW/PROCESSING/HOLD
                const allOrders = [parent].concat(resp.childOrders);
                const dupMap = {};
                allOrders.forEach(o => {
                    if (/review|processing|hold/i.test(o.status || '')) {
                        const key = (abbreviateOrderType(o.type) || '').toLowerCase();
                        if (!dupMap[key]) dupMap[key] = [];
                        dupMap[key].push(o);
                    }
                });
                const dupIds = new Set();
                Object.values(dupMap).forEach(list => {
                    if (list.length > 1) list.forEach(o => dupIds.add(String(o.orderId)));
                });

                const pStatusClass =
                    /shipped/i.test(parent.status) ? 'copilot-tag copilot-tag-green' :
                    /review|processing/i.test(parent.status) ? 'copilot-tag copilot-tag-yellow' :
                    /canceled/i.test(parent.status) ? 'copilot-tag copilot-tag-red' :
                    /hold/i.test(parent.status) ? 'copilot-tag copilot-tag-purple' : 'copilot-tag';
                html += `<div class="section-label">PARENT</div>`;
                html += `<div class="ft-grid">` +
                    `<div><b><a href="#" class="ft-link" data-id="${escapeHtml(parent.orderId)}">${escapeHtml(parent.orderId)}</a></b>` +
                    `${dupIds.has(String(parent.orderId)) ? ` <span class="ft-cancel" data-id="${escapeHtml(parent.orderId)}">❌</span>` : ''}</div>` +
                    `<div class="ft-type">${escapeHtml(abbreviateOrderType(parent.type)).toUpperCase()}</div>` +
                    `<div class="ft-date">${escapeHtml(parent.date)}</div>` +
                    `<div><span class="${pStatusClass} ft-status" data-id="${escapeHtml(parent.orderId)}">${escapeHtml(parent.status)}</span></div>` +
                    `</div>`;
                html += `<div class="section-label">CHILD</div>`;
                html += resp.childOrders.map(o => {
                    const cls =
                        /shipped/i.test(o.status) ? 'copilot-tag copilot-tag-green' :
                        /review|processing/i.test(o.status) ? 'copilot-tag copilot-tag-yellow' :
                        /canceled/i.test(o.status) ? 'copilot-tag copilot-tag-red' :
                        /hold/i.test(o.status) ? 'copilot-tag copilot-tag-purple' : 'copilot-tag';
                    return `
                            <div class="ft-grid">
                                <div><b><a href="#" class="ft-link" data-id="${escapeHtml(o.orderId)}">${escapeHtml(o.orderId)}</a></b>` +
                                `${dupIds.has(String(o.orderId)) ? ` <span class="ft-cancel" data-id="${escapeHtml(o.orderId)}">❌</span>` : ''}</div>
                                <div class="ft-type">${escapeHtml(abbreviateOrderType(o.type)).toUpperCase()}</div>
                                <div class="ft-date">${escapeHtml(o.date)}</div>
                                <div><span class="${cls} ft-status" data-id="${escapeHtml(o.orderId)}">${escapeHtml(o.status)}</span></div>
                            </div>`;
                }).join('');
                html += `<div style="text-align:center; margin-top:8px;">
                            <button id="ar-diagnose-btn" class="copilot-button">🩺 DIAGNOSE</button>
                        </div>`;
                box.innerHTML = html;
                container.innerHTML = '';
                container.appendChild(box);
                container.dataset.loaded = 'true';
                const extra = parseInt(box.style.marginBottom) || 0;
                requestAnimationFrame(() => {
                    container.style.maxHeight = (container.scrollHeight + extra) + 'px';
                    container.classList.remove('ft-collapsed');
                });
                container.querySelectorAll('.ft-link').forEach(a => {
                    a.addEventListener('click', e => {
                        e.preventDefault();
                        const id = a.dataset.id;
                        if (id) {
                            chrome.runtime.sendMessage({
                                action: 'openOrReuseTab',
                                url: `${location.origin}/incfile/order/detail/${id}`,
                                active: false
                            });
                        }
                    });
                });
                container.querySelectorAll('.ft-cancel').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const id = btn.dataset.id;
                        if (!id) return;
                        if (!confirm('Cancel and refund order ' + id + '?')) return;
                        chrome.storage.local.set({ fennecDupCancel: id }, () => {
                            chrome.runtime.sendMessage({
                                action: 'openOrReuseTab',
                                url: `${location.origin}/incfile/order/detail/${id}`,
                                active: true
                            });
                        });
                    });
                });

                if (!window.ftDupListener) {
                    chrome.storage.onChanged.addListener((changes, area) => {
                        if (area === 'local' && changes.fennecDupCancelDone) {
                            const data = changes.fennecDupCancelDone.newValue || {};
                            const span = container.querySelector(`.ft-status[data-id="${data.orderId}"]`);
                            if (span) {
                                span.textContent = 'CANCELED';
                                span.className = 'copilot-tag copilot-tag-red ft-status';
                            }
                        }
                    });
                    window.ftDupListener = true;
                }
                const diagBtn = container.querySelector('#ar-diagnose-btn');
                if (diagBtn && typeof diagnoseHoldOrders === 'function') {
                    diagBtn.addEventListener('click', () => {
                        const relevant = resp.childOrders.filter(o => {
                            const status = o.status || '';
                            const type = o.type || '';
                            return /hold/i.test(status) ||
                                ((/amendment/i.test(type) || /reinstat/i.test(type)) && /review/i.test(status));
                        });
                        if (!relevant.length) {
                            alert('No applicable orders found');
                            return;
                        }
                        const current = typeof getBasicOrderInfo === 'function'
                            ? getBasicOrderInfo().orderId
                            : null;
                        const typeText = typeof currentOrderTypeText !== 'undefined' ? currentOrderTypeText : null;
                        diagnoseHoldOrders(relevant, parent.orderId, current, typeText);
                    });
                }
            });
        });
    }

    rootEl.querySelectorAll('.company-search-toggle').forEach(el => {
        el.addEventListener('click', () => {
            const box = el.closest('.white-box');
            if (box && typeof toggleCompanySearch === 'function') {
                toggleCompanySearch(box);
            }
        });
    });
}

function toggleCompanySearch(box) {
    if (!box) return;
    const mode = box.dataset.mode || 'info';
    const state = box.dataset.state || '';
    if (mode === 'search') {
        box.innerHTML = box.dataset.infoHtml || '';
        box.dataset.mode = 'info';
        attachCommonListeners(box);
        return;
    }
    box.dataset.infoHtml = box.innerHTML;
    box.dataset.mode = 'search';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Search name';
    const idInput = document.createElement('input');
    idInput.type = 'text';
    idInput.placeholder = 'Search ID';
    const form = document.createElement('div');
    form.className = 'company-search-form';
    form.appendChild(nameInput);
    form.appendChild(idInput);
    box.innerHTML = '';
    box.appendChild(form);
    const searchIcon = document.createElement('span');
    searchIcon.className = 'company-search-toggle';
    searchIcon.textContent = '🔍';
    box.appendChild(searchIcon);
    const doSearch = (type) => {
        const q = type === 'name' ? nameInput.value.trim() : idInput.value.trim();
        if (!q) return;
        if (typeof buildSosUrl !== 'function') return;
        const url = buildSosUrl(state, null, type);
        if (!url) return;
        chrome.runtime.sendMessage({ action: 'sosSearch', url, query: q, searchType: type });
    };
    nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch('name'); });
    idInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch('id'); });
    attachCommonListeners(box);
}
window.toggleCompanySearch = toggleCompanySearch;

// Standardized sidebar template for REVIEW MODE across all environments
function buildStandardizedReviewModeSidebar(reviewMode = false, devMode = false, includeXrayButton = false) {
    return `
        ${buildSidebarHeader()}
        <div class="order-summary-header">
            ${includeXrayButton ? `<button id="btn-xray" class="copilot-button">🩻 XRAY</button>` : ''}
            <span id="family-tree-icon" class="family-tree-icon" style="display:none">🌳</span> 
            ORDER SUMMARY 
            <span id="qs-toggle" class="quick-summary-toggle">⚡</span>
        </div>
        <div class="copilot-body" id="copilot-body-content">
            <div id="db-summary-section">
                <div style="text-align:center; color:#888; margin-top:20px;">Cargando resumen...</div>
            </div>
            ${reviewMode ? `<div class="copilot-dna">
                <div id="dna-summary" style="margin-top:16px"></div>
                <div id="kount-summary" style="margin-top:10px"></div>
            </div>` : ''}
            <div id="fraud-summary-section"></div>
            <div id="issue-summary-section" style="display:none; margin-top:10px;">
                <div class="section-label">ISSUES:</div>
                <div class="issue-summary-box" id="issue-summary-box">
                    <strong>ISSUE <span id="issue-status-label" class="issue-status-label"></span></strong><br>
                    <div id="issue-summary-content" style="color:#ccc; font-size:13px; white-space:pre-line;">No issue data yet.</div>
                </div>
            </div>
            <div id="int-storage-section" style="display:none; margin-top:10px;">
                <div class="section-label">INT STORAGE:</div>
                <div id="int-storage-box" class="white-box" style="margin-bottom:10px">
                    <div style="text-align:center;color:#aaa">Loading...</div>
                </div>
            </div>
            ${devMode ? `<div class="copilot-footer"><button id="copilot-refresh" class="copilot-button">🔄 REFRESH</button></div>` : ''}
            <div class="copilot-footer"><button id="copilot-clear" class="copilot-button">🧹 CLEAR</button></div>
            ${devMode ? `
            <div id="mistral-chat" class="mistral-box">
                <div id="mistral-log" class="mistral-log"></div>
                <div class="mistral-input-row">
                    <input id="mistral-input" type="text" placeholder="Ask Mistral..." />
                    <button id="mistral-send" class="copilot-button">Send</button>
                </div>
            </div>` : ''}
            <div id="review-mode-label" class="review-mode-label" style="display:none; margin-top:4px; text-align:center; font-size:11px;">REVIEW MODE</div>
        </div>
    `;
}

