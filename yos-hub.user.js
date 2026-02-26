
// ==UserScript==
// @name         YOS Hub
// @version      3.1.0
// @description  YOS Hub universel v3.1 - Point d'entrée unique pour toutes les fonctionnalités YOS.
// @author       Manus
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @match        https://gemini.google.com/*
// @match        https://www.perplexity.ai/*
// @match        https://perplexity.ai/*
// @match        https://manus.im/*
// @namespace    https://github.com/yj000018/yos-scripts
// @updateURL    https://raw.githubusercontent.com/yj000018/yos-scripts/main/yos-hub.user.js
// @downloadURL  https://raw.githubusercontent.com/yj000018/yos-scripts/main/yos-hub.user.js
// @supportURL   https://github.com/yj000018/yos-scripts/issues
// @run-at       document-idle
// @run-in       both
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';

    const YOS_API_ENDPOINT = 'https://yos-archiver-endpoint.fly.dev';
    const YOS_API_KEY = 'yos-4a43cb42f754b233a3fc458e3213ddcfc6805454';
    const NOTION_BASE_YOS_ARCHIVES_ID = '31235e21-8cf8-8126-9212-f5a0eebadce0';
    const PAGE_YOS_PARENT_ID = '30535e21-8cf8-8014-acb7-e40e2938f89e';
    const DEFAULT_EMAIL = 'yannick.jolliet@gmail.com';

    // Design colors
    const COLOR_DARK_BG = '#0d0d0f';
    const COLOR_PANEL_BG = '#141418';
    const COLOR_ACCENT_PURPLE = '#7c3aed';
    const COLOR_LIGHT_PURPLE = '#a78bfa';
    const COLOR_WHITE_TEXT = '#ffffff';

    // Platform detection selectors
    const PLATFORM_SELECTORS = {
        'chat.openai.com': { name: 'ChatGPT', selector: '.text-token-text-primary' },
        'claude.ai': { name: 'Claude', selector: '.font-claude-message' },
        'gemini.google.com': { name: 'Gemini', selector: '.model-response-text' },
        'perplexity.ai': { name: 'Perplexity', selector: '.prose' },
        'manus.im': { name: 'Manus', selector: '.message-content' }
    };

    // Add global styles
    GM_addStyle(`
        body {
            background-color: ${COLOR_DARK_BG} !important;
        }
        .yos-fab {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background-color: ${COLOR_ACCENT_PURPLE};
            color: ${COLOR_WHITE_TEXT};
            font-size: 24px;
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            z-index: 10000;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
            transition: background-color 0.3s ease;
        }
        .yos-fab:hover {
            background-color: ${COLOR_LIGHT_PURPLE};
        }
        .yos-panel {
            position: fixed;
            bottom: 80px; /* Above FAB */
            right: 20px;
            width: 340px;
            max-height: 80vh;
            overflow-y: auto;
            background-color: ${COLOR_PANEL_BG};
            color: ${COLOR_WHITE_TEXT};
            border-radius: 12px;
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
            z-index: 9999;
            display: none;
            flex-direction: column;
            padding: 15px;
            box-sizing: border-box;
        }
        .yos-panel.open {
            display: flex;
        }
        .yos-panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid #333;
        }
        .yos-panel-header h3 {
            margin: 0;
            font-size: 18px;
            color: ${COLOR_WHITE_TEXT};
            display: flex;
            align-items: center;
        }
        .yos-panel-header .yos-logo {
            font-size: 24px;
            font-weight: bold;
            color: ${COLOR_ACCENT_PURPLE};
            margin-right: 8px;
        }
        .yos-panel-header .yos-source {
            font-size: 12px;
            color: #aaa;
            margin-left: 10px;
        }
        .yos-close-btn {
            background: none;
            border: none;
            color: ${COLOR_WHITE_TEXT};
            font-size: 20px;
            cursor: pointer;
        }
        .yos-search-bar {
            width: 100%;
            padding: 10px;
            margin-bottom: 15px;
            border: 1px solid #333;
            border-radius: 8px;
            background-color: #222;
            color: ${COLOR_WHITE_TEXT};
            box-sizing: border-box;
        }
        .yos-category-accordion {
            margin-bottom: 10px;
            border: 1px solid #333;
            border-radius: 8px;
            overflow: hidden;
        }
        .yos-category-header {
            background-color: #2a2a2a;
            padding: 12px 15px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-weight: bold;
            color: ${COLOR_WHITE_TEXT};
        }
        .yos-category-header:hover {
            background-color: #3a3a3a;
        }
        .yos-category-header .yos-icon {
            margin-right: 10px;
        }
        .yos-category-content {
            padding: 0 15px;
            background-color: ${COLOR_PANEL_BG};
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease-out;
        }
        .yos-category-content.open {
            max-height: 500px; /* Adjust as needed */
            padding: 10px 15px;
        }
        .yos-action-item {
            padding: 8px 0;
            cursor: pointer;
            color: #ccc;
            transition: color 0.2s ease;
        }
        .yos-action-item:hover {
            color: ${COLOR_ACCENT_PURPLE};
        }
        .yos-spinner {
            border: 4px solid rgba(255, 255, 255, 0.3);
            border-top: 4px solid ${COLOR_ACCENT_PURPLE};
            border-radius: 50%;
            width: 20px;
            height: 20px;
            animation: spin 1s linear infinite;
            margin-left: 10px;
            display: none;
        }
        .yos-spinner.active {
            display: inline-block;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .yos-toast {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: rgba(0, 0, 0, 0.8);
            color: ${COLOR_WHITE_TEXT};
            padding: 10px 20px;
            border-radius: 8px;
            z-index: 10001;
            opacity: 0;
            transition: opacity 0.3s ease-in-out;
        }
        .yos-toast.show {
            opacity: 1;
        }
        .yos-badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: bold;
            margin-left: 5px;
            color: ${COLOR_WHITE_TEXT};
        }
        .yos-badge.yos {
            background-color: ${COLOR_ACCENT_PURPLE};
        }
        .yos-badge.archive {
            background-color: #666;
        }
        .yos-badge.deleted {
            background-color: #dc3545;
            text-decoration: line-through;
        }
    `);

    function getPlatformInfo() {
        const hostname = window.location.hostname;
        for (const key in PLATFORM_SELECTORS) {
            if (hostname.includes(key)) {
                return PLATFORM_SELECTORS[key];
            }
        }
        return { name: 'Unknown', selector: null };
    }

    function extractConversationContent(selector) {
        if (!selector) return 'No content selector for this platform.';
        const elements = document.querySelectorAll(selector);
        let content = '';
        elements.forEach(el => {
            content += el.innerText + '\n\n';
        });
        return content.trim();
    }

    async function callYOSApi(action, data) {
        const spinner = document.querySelector('.yos-spinner');
        spinner.classList.add('active');
        try {
            const response = await fetch(`${YOS_API_ENDPOINT}/${action}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-YOS-API-KEY': YOS_API_KEY
                },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || 'API call failed');
            }
            showToast('Action YOS réussie !', 'success');
            return result;
        } catch (error) {
            console.error('YOS API Error:', error);
            showToast(`Erreur YOS: ${error.message}`, 'error');
            return null;
        } finally {
            spinner.classList.remove('active');
        }
    }

    function showToast(message, type = 'info') {
        let toast = document.querySelector('.yos-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.classList.add('yos-toast');
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.style.backgroundColor = type === 'success' ? '#28a745' : (type === 'error' ? '#dc3545' : 'rgba(0,0,0,0.8)');
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    function copyToClipboard(text) {
        GM_setClipboard(text);
        showToast('Commande copiée dans le presse-papier !', 'info');
    }

    function createFAB() {
        const fab = document.createElement('div');
        fab.classList.add('yos-fab');
        fab.textContent = 'Y';
        document.body.appendChild(fab);

        fab.addEventListener('click', () => {
            const panel = document.querySelector('.yos-panel');
            panel.classList.toggle('open');
        });
    }

    function createPanel() {
        const panel = document.createElement('div');
        panel.classList.add('yos-panel');

        const platformInfo = getPlatformInfo();

        panel.innerHTML = `
            <div class="yos-panel-header">
                <h3><span class="yos-logo">Y</span> YOS Hub <span class="yos-source">(${platformInfo.name})</span></h3>
                <div class="yos-spinner"></div>
                <button class="yos-close-btn">&times;</button>
            </div>
            <input type="text" class="yos-search-bar" placeholder="Rechercher des actions...">
            <div class="yos-categories">
                <!-- Categories will be injected here -->
            </div>
        `;
        document.body.appendChild(panel);

        panel.querySelector('.yos-close-btn').addEventListener('click', () => {
            panel.classList.remove('open');
        });

        const categoriesContainer = panel.querySelector('.yos-categories');
        const searchBar = panel.querySelector('.yos-search-bar');

        const categories = [
            { name: 'MÉMOIRE', icon: '🧠', actions: [
                { name: 'Push to YOS', command: 'y.mem.push', apiAction: 'push' },
                { name: 'Archive', command: 'y.mem.archive', apiAction: 'archive' },
                { name: 'Push + Archive', command: 'y.mem.push_archive', apiAction: 'push_archive' },
                { name: 'Rechercher', command: 'y.mem.search' }
            ]},
            { name: 'SÉCURITÉ', icon: '🔐', actions: [
                { name: 'Login', command: 'y.sec.login' },
                { name: 'Vérifier accès', command: 'y.sec.check_access' }
            ]},
            { name: 'RECHERCHE', icon: '🔍', actions: [
                { name: 'Web', command: 'y.search.web' },
                { name: 'Analyser page', command: 'y.search.analyze_page' }
            ]},
            { name: 'CONTENU', icon: '✍️', actions: [
                { name: 'Résumer', command: 'y.content.summarize' },
                { name: 'Extraire', command: 'y.content.extract' }
            ]},
            { name: 'GESTION', icon: '📋', actions: [
                { name: 'Créer tâche', command: 'y.manage.create_task' },
                { name: 'Projet', command: 'y.manage.project' }
            ]},
            { name: 'SYSTÈME', icon: '⚙️', actions: [
                { name: 'Aide', command: 'y.sys.help' },
                { name: 'Statut', command: 'y.sys.status' }
            ]}
        ];

        function renderCategories(filter = '') {
            categoriesContainer.innerHTML = '';
            categories.forEach(category => {
                const filteredActions = category.actions.filter(action =>
                    action.name.toLowerCase().includes(filter.toLowerCase()) ||
                    action.command.toLowerCase().includes(filter.toLowerCase())
                );

                if (filteredActions.length > 0) {
                    const categoryDiv = document.createElement('div');
                    categoryDiv.classList.add('yos-category-accordion');
                    categoryDiv.innerHTML = `
                        <div class="yos-category-header">
                            <div><span class="yos-icon">${category.icon}</span>${category.name}</div>
                            <span>&#9660;</span>
                        </div>
                        <div class="yos-category-content">
                            <!-- Actions will be injected here -->
                        </div>
                    `;
                    categoriesContainer.appendChild(categoryDiv);

                    const header = categoryDiv.querySelector('.yos-category-header');
                    const content = categoryDiv.querySelector('.yos-category-content');
                    const arrow = header.querySelector('span');

                    header.addEventListener('click', () => {
                        content.classList.toggle('open');
                        arrow.innerHTML = content.classList.contains('open') ? '&#9650;' : '&#9660;';
                    });

                    filteredActions.forEach(action => {
                        const actionItem = document.createElement('div');
                        actionItem.classList.add('yos-action-item');
                        actionItem.textContent = action.name;
                        actionItem.addEventListener('click', async () => {
                            if (category.name === 'MÉMOIRE' && action.apiAction) {
                                const conversationContent = extractConversationContent(platformInfo.selector);
                                if (conversationContent) {
                                    const payload = {
                                        content: conversationContent,
                                        platform: platformInfo.name,
                                        url: window.location.href,
                                        notionBaseId: NOTION_BASE_YOS_ARCHIVES_ID,
                                        notionParentId: PAGE_YOS_PARENT_ID,
                                        email: DEFAULT_EMAIL
                                    };
                                    const result = await callYOSApi(action.apiAction, payload);
                                    if (result) {
                                        // Handle badge injection for sidebar (conceptual, requires specific DOM knowledge of each platform)
                                        // For demonstration, we'll just log and show a toast
                                        console.log(`YOS Memory action '${action.name}' successful. Result:`, result);
                                        showToast(`YOS Memory: ${action.name} completed.`, 'success');
                                        // Example of setting a badge (this part is highly dependent on target site's DOM)
                                        // GM_setValue('yos_badge_status_' + window.location.href, 'yos');
                                        // injectBadgeToSidebar(); // This function would need to be implemented per platform
                                    }
                                } else {
                                    showToast('Impossible d\'extraire le contenu de la conversation.', 'error');
                                }
                            } else {
                                copyToClipboard(action.command);
                                showToast(`Copié → Ouvre Manus et tape: ${action.command}`, 'info');
                            }
                        });
                        content.appendChild(actionItem);
                    });
                }
            });
        }

        searchBar.addEventListener('input', (e) => {
            renderCategories(e.target.value);
        });

        renderCategories(); // Initial render
    }

    // Function to inject badges (conceptual, highly platform-dependent)
    function injectBadgeToSidebar() {
        // This is a placeholder. Actual implementation would require specific DOM manipulation
        // for each platform (ChatGPT, Claude, Gemini, etc.) to find their sidebar elements
        // and inject a badge. It would also need to read GM_getValue for persistence.
        console.log('Attempting to inject YOS badge to sidebar...');
        // Example: Find a common sidebar element and append a badge
        // const sidebar = document.querySelector('.sidebar-selector-for-platform');
        // if (sidebar) {
        //     const badgeStatus = GM_getValue('yos_badge_status_' + window.location.href, null);
        //     if (badgeStatus) {
        //         const badge = document.createElement('span');
        //         badge.classList.add('yos-badge', badgeStatus);
        //         badge.textContent = badgeStatus.toUpperCase();
        //         sidebar.appendChild(badge);
        //     }
        // }
    }

    // Initialize YOS Hub
    function initYOSHub() {
        // Avoid double injection
        if (document.getElementById('yos-fab')) return;
        createFAB();
        createPanel();
        injectBadgeToSidebar();
    }

    // SPA-aware initialization with retry
    // Manus, ChatGPT, Claude are SPAs — DOM loads async after page load
    function waitForBodyAndInit() {
        if (document.body) {
            initYOSHub();
        } else {
            setTimeout(waitForBodyAndInit, 100);
        }
    }

    // Handle SPA navigation (pushState / replaceState)
    function patchHistory() {
        const _push = history.pushState.bind(history);
        const _replace = history.replaceState.bind(history);
        history.pushState = function() {
            _push.apply(history, arguments);
            setTimeout(initYOSHub, 500); // Re-inject after SPA navigation
        };
        history.replaceState = function() {
            _replace.apply(history, arguments);
            setTimeout(initYOSHub, 500);
        };
        window.addEventListener('popstate', function() {
            setTimeout(initYOSHub, 500);
        });
    }

    // MutationObserver fallback — watches for DOM changes (React hydration)
    function observeAndInit() {
        const observer = new MutationObserver(function(mutations) {
            if (!document.getElementById('yos-fab') && document.body) {
                initYOSHub();
            }
        });
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: false });
        }
    }

    // Boot sequence
    patchHistory();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            waitForBodyAndInit();
            observeAndInit();
        });
    } else {
        waitForBodyAndInit();
        observeAndInit();
    }

    // Hard retry after 2s and 5s as final fallback
    setTimeout(initYOSHub, 2000);
    setTimeout(initYOSHub, 5000);

})();
