import { getLocale } from './i18n.js';
import { MANUAL_CONTENT_EN, MANUAL_SIDEBAR_EN } from './manual_content_en.js?v=20260829-quality-v1';

let japaneseSidebarHtml = '';
let japaneseContentHtml = '';

function renderManualLocale() {
    const sidebar = document.querySelector('.sidebar');
    const content = document.querySelector('.content-area');
    if (!sidebar || !content) return;

    if (getLocale() === 'en') {
        sidebar.innerHTML = MANUAL_SIDEBAR_EN;
        content.innerHTML = MANUAL_CONTENT_EN;
    } else {
        sidebar.innerHTML = japaneseSidebarHtml;
        content.innerHTML = japaneseContentHtml;
    }
}

export function initializeManualI18n() {
    const sidebar = document.querySelector('.sidebar');
    const content = document.querySelector('.content-area');
    if (!sidebar || !content) return;

    japaneseSidebarHtml = sidebar.innerHTML;
    japaneseContentHtml = content.innerHTML;
    renderManualLocale();
    document.addEventListener('easystat:localechange', renderManualLocale);
}
