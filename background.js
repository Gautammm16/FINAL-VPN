// Proxy error handling
chrome.proxy.onProxyError.addListener((details) => {
    console.error('Proxy error:', details);
    updateIcon(false);
});

// Update icon and badge
async function updateIcon(isEnabled, isSiteUsingProxy = false) {
    try {
        const proxyMode = localStorage.getItem('proxyMode') || 'proxyAll';

        if (!isEnabled) {
            chrome.browserAction.setIcon({
                path: 'icons/off.png'
            });
            chrome.browserAction.setBadgeText({ text: "" });
            return;
        }

        chrome.browserAction.setIcon({
            path: 'icons/on.png'
        });

        // Show badge "ON" only in proxyOnly and proxyExcept modes
        const showBadge = (proxyMode === 'proxyOnly' || proxyMode === 'proxyExcept') && isSiteUsingProxy;

        chrome.browserAction.setBadgeText({ text: showBadge ? "ON" : "" });

        if (showBadge) {
            chrome.browserAction.setBadgeBackgroundColor({ color: "#4ade80" });
            chrome.browserAction.setBadgeTextColor({ color: "#ffffff" });
        }
    } catch (error) {
        console.error('Error updating icon:', error);
    }
}

// Check if site uses proxy
function checkIfSiteUsesVPN(tabId, url) {
    try {
        if (!url) return;

        const proxyMode = localStorage.getItem('proxyMode') || 'proxyAll';
        const domainList = (localStorage.getItem('domainList') || '').split('\n')
            .filter(line => line.trim())
            .map(domain => domain.trim().toLowerCase());

        // Get the current proxy status
        chrome.proxy.settings.get({ 'incognito': false }, function(config) {
            const isEnabled = config.value.mode === 'pac_script' || config.value.mode === 'fixed_servers';

            if (!isEnabled) {
                updateIcon(false);
                return;
            }

            try {
                const hostname = new URL(url).hostname.toLowerCase();
                const isInList = domainList.some(domain =>
                    hostname === domain || hostname.endsWith('.' + domain)
                );

                let showBadge = false;
                if (proxyMode === 'proxyOnly') {
                    showBadge = isInList;
                } else if (proxyMode === 'proxyExcept') {
                    showBadge = !isInList;
                } else { // proxyAll
                    showBadge = true;
                }

                updateIcon(true, showBadge);
            } catch (error) {
                console.error('Error checking hostname:', error);
                updateIcon(true, false);
            }
        });
    } catch (error) {
        console.error('Error checking VPN status:', error);
        updateIcon(false);
    }
}

// Tab event listeners
chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (tab?.url) checkIfSiteUsesVPN(tab.id, tab.url);
    });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url || changeInfo.status === "complete") {
        checkIfSiteUsesVPN(tabId, tab.url);
    }
});

// Proxy authentication
chrome.webRequest.onAuthRequired.addListener(
    callbackFn, {
        urls: ["<all_urls>"]
    },
    ['blocking']
);
