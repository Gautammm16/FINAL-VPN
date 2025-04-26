document.addEventListener('DOMContentLoaded', async function () {
    // UI Elements
    const toggleButton = document.querySelector('.btn-power');
    const settingsButton = document.getElementById('openSettings');
    const promoBlock = document.querySelector('.promo');
    const siteDomainElement = document.querySelector('.site-domain');
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');
    const customSelect = document.querySelector('.custom-select');
    const selectedOption = customSelect.querySelector('.selected-option');
    const optionsContainer = customSelect.querySelector('.options-container');
    const defaultText = 'Select server';

    // Initial state
    selectedOption.innerHTML = `${defaultText}<span class="select-arrow"></span>`;

    // Load proxy list and country info
    const proxyList = localStorage.getItem('proxyList') || '';
    const proxyInfoList = JSON.parse(localStorage.getItem('proxyInfoList') || '[]');
    const currentProxyIndex = localStorage.getItem('currentProxyIndex') || '0';

    // Manage promo block visibility
    if (proxyInfoList.length > 0) {
        promoBlock.style.display = 'none';
    } else {
        promoBlock.style.display = 'block';
    }

    // Handle dropdown toggle
    selectedOption.addEventListener('click', () => {
        optionsContainer.classList.toggle('show');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!customSelect.contains(e.target)) {
            optionsContainer.classList.remove('show');
        }
    });

    // Settings button handler
    settingsButton.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
        window.close();
    });

    // Power toggle button handler
    toggleButton.addEventListener('click', () => {
        const isEnabled = toggleButton.classList.contains('active');

        if (isEnabled) {
            offProxy();
            setIcon('off');
            updateButtonState(false);
            updateVPNStatus(false);
        } else {
            const proxy = onProxy();
            if (proxy) {
                setIcon('on');
                updateButtonState(true);
                updateVPNStatus(true);
            }
        }
    });

    // Format proxy display
    function formatProxyDisplay(proxyStr, proxyInfo) {
        if (!proxyStr) return { type: 'ERROR', displayAddress: 'Not configured' };

        try {
            let parts = proxyStr.split(':');
            let host, type;

            if (parts.length === 5) {
                // Format with explicit type
                [type, host] = parts;
            } else if (parts.length === 4) {
                // Standard format
                [host] = parts;
                type = proxyInfo?.type || 'HTTP';
            } else {
                return { type: 'ERROR', displayAddress: 'Invalid format' };
            }

            return {
                type: type.toUpperCase(),
                displayAddress: host
            };
        } catch (error) {
            console.error('Error formatting proxy:', error);
            return { type: 'ERROR', displayAddress: 'Invalid format' };
        }
    }

    // Update current site domain
    function updateCurrentSite() {
        chrome.tabs.query({ active: true, lastFocusedWindow: true }, function (tabs) {
            if (tabs[0] && tabs[0].url) {
                try {
                    const url = new URL(tabs[0].url);
                    if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:') {
                        siteDomainElement.textContent = 'Chrome page';
                    } else {
                        siteDomainElement.textContent = url.hostname;
                    }
                } catch (e) {
                    console.error('Error parsing URL:', e);
                    siteDomainElement.textContent = 'Invalid URL';
                }
            } else {
                siteDomainElement.textContent = 'No active tab';
            }
        });
    }

    // Update VPN status display
    function updateVPNStatus(isEnabled) {
        if (isEnabled) {
            statusDot.classList.remove('inactive');
            statusText.classList.remove('inactive');
            statusText.classList.add('active');
            statusText.textContent = 'VPN Active';
        } else {
            statusDot.classList.add('inactive');
            statusText.classList.remove('active');
            statusText.classList.add('inactive');
            statusText.textContent = 'VPN Inactive';
        }
    }

    // Handle proxy selection change
    function handleProxyChange(index) {
        const proxyInfo = proxyInfoList[index];
        if (!proxyInfo) return;

        const parts = proxyInfo.proxy.split(':');
        let host, port, user, pass;

        if (parts.length === 5) {
            [, host, port, user, pass] = parts;
        } else {
            [host, port, user, pass] = parts;
        }

        const proxySetting = {
            'type': proxyInfo.type,
            'http_host': host,
            'http_port': port,
            'auth': {
                'enable': true,
                'user': user,
                'pass': pass
            }
        };
        localStorage.setItem('proxySetting', JSON.stringify(proxySetting));
        localStorage.setItem('currentProxyIndex', index);

        chrome.proxy.settings.get({ 'incognito': false }, function (config) {
            if (config.value.mode === 'pac_script') {
                onProxy();
            }
        });
    }

    // Update power button state
    function updateButtonState(isEnabled) {
        if (isEnabled) {
            toggleButton.classList.remove('inactive');
            toggleButton.classList.add('active');
        } else {
            toggleButton.classList.remove('active');
            toggleButton.classList.add('inactive');
        }
    }

    // Fill proxy dropdown options
    proxyInfoList.forEach((proxyInfo, index) => {
        const { type, displayAddress } = formatProxyDisplay(proxyInfo.proxy, proxyInfo);
        if (type === 'ERROR') return;

        const option = document.createElement('div');
        option.className = 'option';
        option.innerHTML = `
            <span class="proxy-type ${type.toLowerCase()}">${type}</span>
            ${displayAddress}
            <span class="flag">${proxyInfo.countryInfo?.flag || ''}</span>
        `;
        option.dataset.index = index;

        option.addEventListener('click', () => {
            selectedOption.innerHTML = option.innerHTML + '<span class="select-arrow"></span>';
            optionsContainer.classList.remove('show');
            handleProxyChange(index);
        });

        optionsContainer.appendChild(option);
    });

    // Set current proxy in selector
    if (proxyInfoList.length > 0) {
        const currentProxy = proxyInfoList[currentProxyIndex];
        if (currentProxy) {
            const { type, displayAddress } = formatProxyDisplay(currentProxy.proxy, currentProxy);
            selectedOption.innerHTML = `
                <span class="proxy-type ${type.toLowerCase()}">${type}</span>
                ${displayAddress}
                <span class="flag">${currentProxy.countryInfo?.flag || ''}</span>
                <span class="select-arrow"></span>
            `;
        }
    }

    // Check current proxy state
    chrome.proxy.settings.get({ 'incognito': false }, function (config) {
        try {
            const isEnabled = config.value.mode === 'pac_script' || config.value.mode === 'fixed_servers';
            updateButtonState(isEnabled);
            updateVPNStatus(isEnabled);
            setIcon(isEnabled ? 'on' : 'off');
        } catch (error) {
            console.error('Error checking proxy state:', error);
            updateButtonState(false);
            updateVPNStatus(false);
            setIcon('off');
        }
    });

    // Initialize site info
    updateCurrentSite();
});
