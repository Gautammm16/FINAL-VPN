// Main VPN functionality
function onProxy() {
    try {
        var proxySetting = JSON.parse(localStorage.getItem('proxySetting') || '{}');
        var proxyMode = localStorage.getItem('proxyMode') || 'proxyAll';
        var domainList = (localStorage.getItem('domainList') || '').split('\n')
            .filter(line => line.trim())
            .map(domain => domain.trim().toLowerCase());

        var proxy = {
            type: proxySetting.type || 'http',
            host: proxySetting['http_host'],
            port: proxySetting['http_port']
        };

        // Check if proxy settings are valid
        if (!proxy.host || !proxy.port) {
            console.error('Invalid proxy settings');
            return null;
        }

        var proxyString = `PROXY ${proxy.host}:${proxy.port}`;
        var config = {
            mode: "pac_script",
            pacScript: {}
        };

        if (proxyMode === 'proxyAll') {
            config.pacScript.data = `
                function FindProxyForURL(url, host) {
                    return "${proxyString}";
                }
            `;
        } else if (proxyMode === 'proxyOnly') {
            var sitesArray = JSON.stringify(domainList);
            config.pacScript.data = `
                function FindProxyForURL(url, host) {
                    host = host.toLowerCase();
                    var sites = ${sitesArray};
                    for (var i = 0; i < sites.length; i++) {
                        if (dnsDomainIs(host, sites[i])) {
                            return "${proxyString}";
                        }
                    }
                    return "DIRECT";
                }
            `;
        } else if (proxyMode === 'proxyExcept') {
            var sitesArray = JSON.stringify(domainList);
            config.pacScript.data = `
                function FindProxyForURL(url, host) {
                    host = host.toLowerCase();
                    var sites = ${sitesArray};
                    for (var i = 0; i < sites.length; i++) {
                        if (dnsDomainIs(host, sites[i])) {
                            return "DIRECT";
                        }
                    }
                    return "${proxyString}";
                }
            `;
        }

        chrome.proxy.settings.set({
            value: config,
            scope: 'regular'
        }, function () {
            showNotification(true);
        });

        return proxy;
    } catch (error) {
        console.error('Error in onProxy:', error);
        return null;
    }
}

function offProxy() {
    var config = {
        mode: 'direct'
    };

    chrome.proxy.settings.set({
        value: config,
        scope: 'regular'
    }, function () {
        showNotification(false);
    });
}

function setIcon(str) {
    var icon = {
        path: 'icons/on.png'
    };
    if (str == 'off') {
        icon['path'] = 'icons/off.png';
    }
    chrome.browserAction.setIcon(icon);
}

function showNotification(isEnabled) {
    try {
        const proxySetting = JSON.parse(localStorage.getItem('proxySetting') || '{}');
        const title = isEnabled ? 'VPN Connected' : 'VPN Disconnected';
        const message = isEnabled 
            ? `Connected to: ${proxySetting.http_host || 'Unknown'}:${proxySetting.http_port || 'Unknown'}`
            : 'VPN is now disabled';
        
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/' + (isEnabled ? 'on.png' : 'off.png'),
            title: title,
            message: message
        });
    } catch (error) {
        console.error('Error showing notification:', error);
    }
}

function callbackFn(details) {
    try {
        var proxySetting = JSON.parse(localStorage.getItem('proxySetting') || '{}');
        return {
            authCredentials: {
                username: proxySetting.auth?.user || "dnrrfarc",
                password: proxySetting.auth?.pass || "cvbnihiajzzt"
            }
        };
    } catch (error) {
        console.error('Error in callbackFn:', error);
        return {
            authCredentials: {
                username: "dnrrfarc",
                password: "cvbnihiajzzt"
            }
        };
    }
}

// Ad blocking functionality integrated into the VPN extension
let adBlockFilters = null;
const ADBLOCK_FILTERS_URL = 'https://easylist.to/easylist/easylist.txt';
const ADBLOCK_STORAGE_KEY = 'adblockFilters';
const ADBLOCK_LAST_UPDATE_KEY = 'adblockLastUpdate';
const ONE_DAY = 24 * 60 * 60 * 1000; // 1 day in milliseconds

// Initialize ad-blocking stats or create if not exists
function initAdBlockStats() {
    if (!localStorage.getItem('adsBlockedCount')) {
        localStorage.setItem('adsBlockedCount', '0');
    }
}

// Update ad block stats
function incrementAdBlockCount() {
    try {
        const currentCount = parseInt(localStorage.getItem('adsBlockedCount') || '0');
        localStorage.setItem('adsBlockedCount', (currentCount + 1).toString());
        
        // Notify popup to update stats if it's open
        chrome.runtime.sendMessage({
            action: 'updateAdBlockStats',
            count: currentCount + 1
        });
    } catch (error) {
        console.error('Error updating ad-blocking stats:', error);
    }
}

// Toggle ad blocker
function toggleAdBlocker(enable) {
    localStorage.setItem('adBlockerEnabled', enable ? 'true' : 'false');
    console.log('Ad blocker', enable ? 'enabled' : 'disabled');
    
    if (enable) {
        // Force update filters if enabling
        updateAdBlockFilters();
    }
}

// Check if URL should be blocked
function shouldBlockAd(url) {
    // Check if ad blocker is enabled
    const adBlockerEnabled = localStorage.getItem('adBlockerEnabled') === 'true';
    if (!adBlockerEnabled || !url) return false;
    
    try {
        // Load ad block list from localStorage
        const adBlockList = JSON.parse(localStorage.getItem('adBlockList') || '[]');
        const urlObj = new URL(url);
        const domain = urlObj.hostname.toLowerCase();
        
        // Check if domain or any parent domain is in the block list
        return adBlockList.some(adDomain => 
            domain === adDomain || domain.endsWith('.' + adDomain)
        );
    } catch (error) {
        console.error('Error checking if URL should be blocked:', error);
        return false;
    }
}

// Update ad blocking filters
async function updateAdBlockFilters() {
    try {
        console.log('Updating ad-blocking filters...');
        const response = await fetch(ADBLOCK_FILTERS_URL);
        if (!response.ok) throw new Error('Failed to fetch filters');
        
        const text = await response.text();
        
        // Parse and save a simpler version for domain blocking
        const domains = text.split('\n')
            .filter(line => line.includes('||') && line.includes('^'))
            .map(line => {
                const match = line.match(/\|\|([a-z0-9.-]+)\^/);
                return match ? match[1] : null;
            })
            .filter(Boolean);
        
        // Take unique domains, limit to 5000 for performance
        const uniqueDomains = [...new Set(domains)].slice(0, 5000);
        
        localStorage.setItem('adBlockList', JSON.stringify(uniqueDomains));
        localStorage.setItem(ADBLOCK_LAST_UPDATE_KEY, Date.now().toString());
        console.log(`Ad-blocking filters updated successfully (${uniqueDomains.length} domains)`);
        
        return uniqueDomains;
    } catch (error) {
        console.error('Error updating ad-blocking filters:', error);
        return null;
    }
}

// Initialize ad blocker
function initAdBlocker() {
    initAdBlockStats();
    
    // Check if filters need updating
    const lastUpdate = parseInt(localStorage.getItem(ADBLOCK_LAST_UPDATE_KEY) || '0');
    if (Date.now() - lastUpdate > ONE_DAY) {
        updateAdBlockFilters();
    }
    
    // Setup web request listener for ad blocking
    const adBlockerEnabled = localStorage.getItem('adBlockerEnabled') === 'true';
    if (adBlockerEnabled) {
        console.log('Ad blocker initialized');
    }
}

// Export ad blocking functions
window.adBlocker = {
    init: initAdBlocker,
    toggle: toggleAdBlocker,
    shouldBlock: shouldBlockAd,
    updateFilters: updateAdBlockFilters,
    incrementCount: incrementAdBlockCount
};

// Initialize on load
initAdBlocker();