// Ad-blocking functionality
const ADBLOCK_FILTERS_URL = 'https://easylist.to/easylist/easylist.txt';
const ADBLOCK_STORAGE_KEY = 'adblockFilters';
const ADBLOCK_LAST_UPDATE_KEY = 'adblockLastUpdate';
const ADBLOCK_ENABLED_KEY = 'adblockEnabled';
const ADBLOCK_STATS_KEY = 'adblockStats';
const ONE_DAY = 24 * 60 * 60 * 1000; // 1 day in milliseconds

// Initialize ad-blocking stats
if (!localStorage.getItem(ADBLOCK_STATS_KEY)) {
    localStorage.setItem(ADBLOCK_STATS_KEY, JSON.stringify({ 
        blocked: 0, 
        lastReset: Date.now() 
    }));
}

// Parse filter rules from EasyList format
function parseFilters(text) {
    const lines = text.split('\n');
    const urlFilters = [];
    const domainFilters = [];
    
    for (const line of lines) {
        // Skip comments, empty lines and element hiding rules
        if (!line || line.startsWith('!') || line.startsWith('##') || line.includes('#@#')) {
            continue;
        }
        
        // Skip exception rules
        if (line.startsWith('@@')) {
            continue;
        }
        
        // Handle domain-specific options
        if (line.includes('$domain=')) {
            const parts = line.split('$domain=');
            const domains = parts[1].split(',')[0].split('|');
            
            for (const domain of domains) {
                if (!domain.startsWith('~')) {
                    domainFilters.push({
                        pattern: parts[0],
                        domain: domain
                    });
                }
            }
            continue;
        }
        
        // Basic URL filters
        if (line.includes('||')) {
            // Domain anchor
            const pattern = line.replace(/\|\|/, '')
                .replace(/\^$/, '')
                .replace(/\*/, '.*');
            
            if (pattern && !pattern.includes('#')) {
                urlFilters.push(pattern);
            }
        } else if (line.startsWith('|') && line.endsWith('|')) {
            // Exact match
            const pattern = line.substring(1, line.length - 1);
            if (pattern && !pattern.includes('#')) {
                urlFilters.push(pattern);
            }
        } else if (!line.includes('#')) {
            // Simple pattern
            const pattern = line.replace(/\*/, '.*')
                .replace(/\^/, '[^a-zA-Z0-9_.%-]');
            
            if (pattern) {
                urlFilters.push(pattern);
            }
        }
    }
    
    return { urlFilters, domainFilters };
}

// Download and update filters
async function updateFilters() {
    try {
        console.log('Updating ad-blocking filters...');
        const response = await fetch(ADBLOCK_FILTERS_URL);
        if (!response.ok) throw new Error('Failed to fetch filters');
        
        const text = await response.text();
        const filters = parseFilters(text);
        
        // Save only a subset of rules to avoid performance issues
        const limitedFilters = {
            urlFilters: filters.urlFilters.slice(0, 5000),
            domainFilters: filters.domainFilters.slice(0, 1000)
        };
        
        localStorage.setItem(ADBLOCK_FILTERS_URL, JSON.stringify(limitedFilters));
        localStorage.setItem(ADBLOCK_LAST_UPDATE_KEY, Date.now().toString());
        console.log('Ad-blocking filters updated successfully');
        
        return limitedFilters;
    } catch (error) {
        console.error('Error updating ad-blocking filters:', error);
        return null;
    }
}

// Get filters, update if needed
async function getFilters() {
    const lastUpdate = parseInt(localStorage.getItem(ADBLOCK_LAST_UPDATE_KEY) || '0');
    const storedFilters = localStorage.getItem(ADBLOCK_FILTERS_URL);
    
    // Update filters if they're older than a day or don't exist
    if (!storedFilters || Date.now() - lastUpdate > ONE_DAY) {
        return await updateFilters();
    }
    
    try {
        return JSON.parse(storedFilters);
    } catch (error) {
        console.error('Error parsing stored filters:', error);
        return await updateFilters();
    }
}

// Check if a URL matches any filter
function matchesFilter(url, filters) {
    if (!filters || !url) return false;
    
    const { urlFilters, domainFilters } = filters;
    const urlString = url.toLowerCase();
    
    // Check URL patterns
    for (const pattern of urlFilters) {
        if (urlString.includes(pattern)) {
            return true;
        }
    }
    
    // Check domain-specific patterns
    try {
        const hostname = new URL(url).hostname;
        for (const filter of domainFilters) {
            if (hostname.includes(filter.domain) && urlString.includes(filter.pattern)) {
                return true;
            }
        }
    } catch (error) {
        // Invalid URL, ignore
    }
    
    return false;
}

// Update ad-blocking stats
function updateStats() {
    try {
        const statsJson = localStorage.getItem(ADBLOCK_STATS_KEY);
        const stats = JSON.parse(statsJson) || { blocked: 0, lastReset: Date.now() };
        stats.blocked++;
        localStorage.setItem(ADBLOCK_STATS_KEY, JSON.stringify(stats));
    } catch (error) {
        console.error('Error updating ad-blocking stats:', error);
    }
}

// Get current ad-blocking stats
function getStats() {
    try {
        const statsJson = localStorage.getItem(ADBLOCK_STATS_KEY);
        return JSON.parse(statsJson) || { blocked: 0, lastReset: Date.now() };
    } catch (error) {
        console.error('Error getting ad-blocking stats:', error);
        return { blocked: 0, lastReset: Date.now() };
    }
}

// Reset ad-blocking stats
function resetStats() {
    localStorage.setItem(ADBLOCK_STATS_KEY, JSON.stringify({ 
        blocked: 0, 
        lastReset: Date.now() 
    }));
}

// Initialize ad-blocking
async function initAdBlock() {
    const isEnabled = localStorage.getItem(ADBLOCK_ENABLED_KEY) !== 'false';
    
    if (isEnabled) {
        const filters = await getFilters();
        
        if (filters) {
            console.log('Ad-blocking initialized with', 
                filters.urlFilters.length, 'URL filters and', 
                filters.domainFilters.length, 'domain filters');
        }
    }
}

// Toggle ad-blocking state
function toggleAdBlock(enable) {
    localStorage.setItem(ADBLOCK_ENABLED_KEY, enable ? 'true' : 'false');
    console.log('Ad-blocking', enable ? 'enabled' : 'disabled');
    
    // Force update filters if enabling
    if (enable) {
        updateFilters();
    }
}

// Function to set up the request blocking listener
function setupAdBlockListeners() {
    const isEnabled = localStorage.getItem(ADBLOCK_ENABLED_KEY) !== 'false';
    if (!isEnabled) return;
    
    chrome.webRequest.onBeforeRequest.addListener(
        async function(details) {
            try {
                const isAdBlockEnabled = localStorage.getItem(ADBLOCK_ENABLED_KEY) !== 'false';
                if (!isAdBlockEnabled) return { cancel: false };
                
                const filters = await getFilters();
                if (!filters) return { cancel: false };
                
                if (matchesFilter(details.url, filters)) {
                    updateStats();
                    return { cancel: true };
                }
            } catch (error) {
                console.error('Error in ad-blocking listener:', error);
            }
            
            return { cancel: false };
        },
        { urls: ["<all_urls>"] },
        ["blocking"]
    );
}

// Export functions
window.adBlock = {
    init: initAdBlock,
    toggle: toggleAdBlock,
    getStats: getStats,
    resetStats: resetStats,
    updateFilters: updateFilters,
    isEnabled: () => localStorage.getItem(ADBLOCK_ENABLED_KEY) !== 'false'
};

// Initialize on load
initAdBlock();
setupAdBlockListeners();