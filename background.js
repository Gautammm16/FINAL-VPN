// // Ad blocking functionality
// let adBlockerEnabled = false;
// let adBlockList = [];
// let adsBlockedCount = 0;

// // Initialize extension
// chrome.runtime.onInstalled.addListener(async function() {
//     // Load ad blocker state from storage
//     adBlockerEnabled = localStorage.getItem('adBlockerEnabled') === 'true';
//     adsBlockedCount = parseInt(localStorage.getItem('adsBlockedCount') || '0');
    
//     // Load ad filter list
//     await loadAdBlockList();
// });

// // Load ad block list from storage or fetch default
// async function loadAdBlockList() {
//     try {
//         // Try to load from localStorage first
//         const storedList = localStorage.getItem('adBlockList');
//         if (storedList) {
//             adBlockList = JSON.parse(storedList);
//             console.log(`Loaded ${adBlockList.length} ad domains from storage`);
//             return;
//         }
        
//         // If not available, fetch default list
//         const response = await fetch('https://raw.githubusercontent.com/anudeepND/blacklist/master/adservers.txt');
//         if (!response.ok) throw new Error('Failed to fetch ad block list');
        
//         const text = await response.text();
//         // Parse domains from list (assuming format with comments and empty lines)
//         adBlockList = text.split('\n')
//             .map(line => line.trim())
//             .filter(line => line && !line.startsWith('#') && !line.startsWith('!'))
//             .map(line => {
//                 // Handle hosts file format (0.0.0.0 domain.com)
//                 const parts = line.split(/\s+/);
//                 return parts.length > 1 ? parts[1] : parts[0];
//             });
        
//         // Save to localStorage for future use
//         localStorage.setItem('adBlockList', JSON.stringify(adBlockList));
//         console.log(`Fetched ${adBlockList.length} ad domains`);
//     } catch (error) {
//         console.error('Error loading ad block list:', error);
//         // Fallback to a small set of common ad domains
//         adBlockList = [
//             'ads.google.com',
//             'googleadservices.com',
//             'doubleclick.net',
//             'adservice.google.com',
//             'pagead2.googlesyndication.com',
//             'ad.doubleclick.net',
//             'googleads.g.doubleclick.net',
//             'securepubads.g.doubleclick.net'
//         ];
//         localStorage.setItem('adBlockList', JSON.stringify(adBlockList));
//     }
// }

// // Listen for ad blocker toggle from popup
// chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
//     if (request.action === 'toggleAdBlocker') {
//         adBlockerEnabled = request.enabled;
//         localStorage.setItem('adBlockerEnabled', adBlockerEnabled);
//         console.log(`Ad blocker ${adBlockerEnabled ? 'enabled' : 'disabled'}`);
//     }
    
//     // Allow for sending response if needed
//     if (sendResponse) sendResponse({ success: true });
//     return true;
// });

// // Proxy error handling
// chrome.proxy.onProxyError.addListener((details) => {
//     console.error('Proxy error:', details);
//     updateIcon(false);
// });

// // Update icon and badge
// async function updateIcon(isEnabled, isSiteUsingProxy = false) {
//     try {
//         const proxyMode = localStorage.getItem('proxyMode') || 'proxyAll';

//         if (!isEnabled) {
//             chrome.browserAction.setIcon({
//                 path: 'icons/off.png'
//             });
//             chrome.browserAction.setBadgeText({ text: "" });
//             return;
//         }

//         chrome.browserAction.setIcon({
//             path: 'icons/on.png'
//         });

//         // Show badge "ON" only in proxyOnly and proxyExcept modes
//         const showBadge = (proxyMode === 'proxyOnly' || proxyMode === 'proxyExcept') && isSiteUsingProxy;

//         chrome.browserAction.setBadgeText({ text: showBadge ? "ON" : "" });

//         if (showBadge) {
//             chrome.browserAction.setBadgeBackgroundColor({ color: "#4ade80" });
//             chrome.browserAction.setBadgeTextColor({ color: "#ffffff" });
//         }
//     } catch (error) {
//         console.error('Error updating icon:', error);
//     }
// }

// // Check if site uses proxy
// function checkIfSiteUsesVPN(tabId, url) {
//     try {
//         if (!url) return;

//         const proxyMode = localStorage.getItem('proxyMode') || 'proxyAll';
//         const domainList = (localStorage.getItem('domainList') || '').split('\n')
//             .filter(line => line.trim())
//             .map(domain => domain.trim().toLowerCase());

//         // Get the current proxy status
//         chrome.proxy.settings.get({ 'incognito': false }, function(config) {
//             const isEnabled = config.value.mode === 'pac_script' || config.value.mode === 'fixed_servers';

//             if (!isEnabled) {
//                 updateIcon(false);
//                 return;
//             }

//             try {
//                 const hostname = new URL(url).hostname.toLowerCase();
//                 const isInList = domainList.some(domain =>
//                     hostname === domain || hostname.endsWith('.' + domain)
//                 );

//                 let showBadge = false;
//                 if (proxyMode === 'proxyOnly') {
//                     showBadge = isInList;
//                 } else if (proxyMode === 'proxyExcept') {
//                     showBadge = !isInList;
//                 } else { // proxyAll
//                     showBadge = true;
//                 }

//                 updateIcon(true, showBadge);
//             } catch (error) {
//                 console.error('Error checking hostname:', error);
//                 updateIcon(true, false);
//             }
//         });
//     } catch (error) {
//         console.error('Error checking VPN status:', error);
//         updateIcon(false);
//     }
// }

// // Check if a domain is in the ad block list (with subdomain matching)
// function isAdDomain(domain) {
//     if (!domain) return false;
    
//     domain = domain.toLowerCase();
    
//     // Direct match
//     if (adBlockList.includes(domain)) return true;
    
//     // Check if domain is a subdomain of any entry in the block list
//     return adBlockList.some(adDomain => 
//         domain === adDomain || domain.endsWith('.' + adDomain)
//     );
// }

// // Block ads by intercepting web requests
// chrome.webRequest.onBeforeRequest.addListener(
//     function(details) {
//         // Skip if ad blocker is disabled
//         if (!adBlockerEnabled) return { cancel: false };
        
//         try {
//             const url = new URL(details.url);
//             const domain = url.hostname;
            
//             // Check if this domain should be blocked
//             if (isAdDomain(domain)) {
//                 // Increment counter
//                 adsBlockedCount++;
//                 localStorage.setItem('adsBlockedCount', adsBlockedCount.toString());
                
//                 // Notify popup to update stats if it's open
//                 chrome.runtime.sendMessage({
//                     action: 'updateAdBlockStats',
//                     count: adsBlockedCount
//                 });
                
//                 console.log(`Ad blocked: ${domain}`);
//                 return { cancel: true };
//             }
//         } catch (error) {
//             console.error('Error in ad blocking:', error);
//         }
        
//         return { cancel: false };
//     },
//     { urls: ["<all_urls>"] },
//     ["blocking"]
// );

// // Tab event listeners
// chrome.tabs.onActivated.addListener((activeInfo) => {
//     chrome.tabs.get(activeInfo.tabId, (tab) => {
//         if (tab?.url) checkIfSiteUsesVPN(tab.id, tab.url);
//     });
// });

// chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
//     if (changeInfo.url || changeInfo.status === "complete") {
//         checkIfSiteUsesVPN(tabId, tab.url);
//     }
// });

// // Proxy authentication
// chrome.webRequest.onAuthRequired.addListener(
//     callbackFn, {
//         urls: ["<all_urls>"]
//     },
//     ['blocking']
// );


// Ad blocking functionality
let adBlockerEnabled = false;
let adsBlockedCount = 0;

// Initialize extension
chrome.runtime.onInstalled.addListener(async function() {
    // Load ad blocker state from storage
    adBlockerEnabled = localStorage.getItem('adBlockerEnabled') === 'true';
    adsBlockedCount = parseInt(localStorage.getItem('adsBlockedCount') || '0');
    
    // Load ad filter list or update if needed
    if (adBlockerEnabled) {
        await window.adBlocker.updateFilters();
    }
    
    // Initialize VPN badge monitoring
    checkAllTabsProxyStatus();
});

// Load ad block list from storage or fetch default
async function loadAdBlockList() {
    try {
        // Try to load from localStorage first
        const storedList = localStorage.getItem('adBlockList');
        if (storedList) {
            const parsedList = JSON.parse(storedList);
            console.log(`Loaded ${parsedList.length} ad domains from storage`);
            return parsedList;
        }
        
        // If not available, fetch default list
        return await window.adBlocker.updateFilters();
    } catch (error) {
        console.error('Error loading ad block list:', error);
        // Fallback to a small set of common ad domains
        const fallbackList = [
            'ads.google.com',
            'googleadservices.com',
            'doubleclick.net',
            'adservice.google.com',
            'pagead2.googlesyndication.com',
            'ad.doubleclick.net',
            'googleads.g.doubleclick.net',
            'securepubads.g.doubleclick.net'
        ];
        localStorage.setItem('adBlockList', JSON.stringify(fallbackList));
        return fallbackList;
    }
}

// Listen for ad blocker toggle from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'toggleAdBlocker') {
        adBlockerEnabled = request.enabled;
        window.adBlocker.toggle(adBlockerEnabled);
        console.log(`Ad blocker ${adBlockerEnabled ? 'enabled' : 'disabled'}`);
    }
    
    // Allow for sending response if needed
    if (sendResponse) sendResponse({ success: true });
    return true;
});

// Proxy error handling
chrome.proxy.onProxyError.addListener((details) => {
    console.error('Proxy error:', details);
    updateIcon(false);
});

// Update icon and badge
function updateIcon(isEnabled, isSiteUsingProxy = false) {
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

// Check all open tabs for their proxy status
function checkAllTabsProxyStatus() {
    chrome.tabs.query({}, function(tabs) {
        tabs.forEach(tab => {
            if (tab.url) {
                checkIfSiteUsesVPN(tab.id, tab.url);
            }
        });
    });
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

// Check if a domain is in the ad block list (with subdomain matching)
function isAdDomain(url) {
    return window.adBlocker.shouldBlock(url);
}

// Block ads by intercepting web requests
chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
        // Skip if ad blocker is disabled
        if (!adBlockerEnabled) return { cancel: false };
        
        try {
            // Check if this domain should be blocked
            if (isAdDomain(details.url)) {
                // Increment counter
                window.adBlocker.incrementCount();
                console.log(`Ad blocked: ${details.url}`);
                return { cancel: true };
            }
        } catch (error) {
            console.error('Error in ad blocking:', error);
        }
        
        return { cancel: false };
    },
    { urls: ["<all_urls>"] },
    ["blocking"]
);

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