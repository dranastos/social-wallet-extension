// Content script for Zap Social NOSTR provider
(function() {
    'use strict';

    // Inject the provider script into the page
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    script.onload = function() {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(script);

    // Listen for messages from the injected script
    window.addEventListener('message', function(event) {
        if (event.source !== window || !event.data.type || event.data.type !== 'NOSTR_REQUEST') {
            return;
        }

        const { method, params, id } = event.data;

        // Forward the request to the background script with error handling
        try {
            chrome.runtime.sendMessage({
                type: 'NOSTR_REQUEST',
                method: method,
                params: params,
                id: id
            }, (response) => {
                // Check if the extension context is still valid
                if (chrome.runtime.lastError) {
                    console.warn('Extension context invalidated:', chrome.runtime.lastError.message);
                    // Send error response back to the injected script
                    window.postMessage({
                        type: 'NOSTR_RESPONSE',
                        id: id,
                        result: null,
                        error: 'Extension context invalidated. Please reload the page.'
                    }, '*');
                    return;
                }
                
                // Send the response back to the injected script
                window.postMessage({
                    type: 'NOSTR_RESPONSE',
                    id: id,
                    result: response?.result || null,
                    error: response?.error || null
                }, '*');
            });
        } catch (error) {
            console.warn('Failed to send message to background script:', error);
            // Send error response back to the injected script
            window.postMessage({
                type: 'NOSTR_RESPONSE',
                id: id,
                result: null,
                error: 'Extension context invalidated. Please reload the page.'
            }, '*');
        }
    });
})();
