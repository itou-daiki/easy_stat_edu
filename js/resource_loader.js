const pendingResources = new Map();

function createLoadError(kind, url) {
    return new Error(`${kind}を読み込めませんでした: ${url}`);
}

function loadElementOnce(key, createElement, isReady, timeoutMs) {
    if (isReady?.()) return Promise.resolve();
    if (pendingResources.has(key)) return pendingResources.get(key);

    const promise = new Promise((resolve, reject) => {
        const element = createElement();
        let settled = false;
        const finish = error => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeoutId);
            element.onload = null;
            element.onerror = null;
            if (error) {
                pendingResources.delete(key);
                element.remove();
                reject(error);
                return;
            }
            resolve();
        };
        const timeoutId = window.setTimeout(
            () => finish(createLoadError('外部リソース', key)),
            timeoutMs
        );
        element.onload = () => finish(isReady && !isReady() ? createLoadError('ライブラリ', key) : null);
        element.onerror = () => finish(createLoadError('外部リソース', key));
        document.head.appendChild(element);
    });
    pendingResources.set(key, promise);
    return promise;
}

export function loadScriptOnce(url, options = {}) {
    const absoluteUrl = new URL(url, document.baseURI).href;
    return loadElementOnce(
        `script:${absoluteUrl}`,
        () => {
            const script = document.createElement('script');
            script.src = absoluteUrl;
            script.async = true;
            if (new URL(absoluteUrl).origin !== window.location.origin) script.crossOrigin = 'anonymous';
            return script;
        },
        options.isReady,
        Number(options.timeoutMs) || 20_000
    );
}

export function loadStylesheetOnce(url, options = {}) {
    const absoluteUrl = new URL(url, document.baseURI).href;
    return loadElementOnce(
        `style:${absoluteUrl}`,
        () => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = absoluteUrl;
            if (new URL(absoluteUrl).origin !== window.location.origin) link.crossOrigin = 'anonymous';
            return link;
        },
        null,
        Number(options.timeoutMs) || 20_000
    );
}
