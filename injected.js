// Fixed injected script that provides the NOSTR API to websites
(function() {
    'use strict';

    if (window.nostr) {
        console.log('NOSTR provider already exists');
        return;
    }

    let requestId = 0;
    const pendingRequests = new Map();

    // Listen for responses from the content script
    window.addEventListener('message', function(event) {
        if (event.source !== window || !event.data.type || event.data.type !== 'NOSTR_RESPONSE') {
            return;
        }

        const { id, result, error } = event.data;
        const request = pendingRequests.get(id);
        
        if (request) {
            pendingRequests.delete(id);
            
            if (error) {
                // Special handling for extension context invalidation
                if (error.includes('Extension context invalidated')) {
                    console.warn('🔴 Extension was reloaded. Please refresh the page to reconnect.');
                }
                request.reject(new Error(error));
            } else {
                request.resolve(result);
            }
        }
    });

    function sendRequest(method, params = {}) {
        return new Promise((resolve, reject) => {
            const id = ++requestId;
            
            pendingRequests.set(id, { resolve, reject });
            
            // Send request to content script
            window.postMessage({
                type: 'NOSTR_REQUEST',
                method: method,
                params: params,
                id: id
            }, '*');
            
            // Timeout after 30 seconds
            setTimeout(() => {
                if (pendingRequests.has(id)) {
                    pendingRequests.delete(id);
                    reject(new Error('Request timeout'));
                }
            }, 30000);
        });
    }

    // NOSTR API implementation
    window.nostr = {
        async getPublicKey() {
            console.log('🔑 NOSTR API: getPublicKey() called');
            const result = await sendRequest('getPublicKey');
            console.log('🔑 NOSTR API: getPublicKey() result:', result);
            return result;
        },

        async signEvent(event) {
            console.log('📝 NOSTR API: signEvent() called with:', event);
            
            // Ensure the event has all required fields
            const eventToSign = {
                kind: event.kind || 1,
                content: event.content || '',
                tags: event.tags || [],
                created_at: event.created_at || Math.floor(Date.now() / 1000),
                pubkey: event.pubkey // This will be set by the background script if not provided
            };
            
            console.log('📝 NOSTR API: Sending event to extension:', eventToSign);
            
            const result = await sendRequest('signEvent', { event: eventToSign });
            
            console.log('📝 NOSTR API: signEvent() result:', result);
            
            // Validate the result has the required fields
            if (!result.id || !result.sig || !result.pubkey) {
                throw new Error('Invalid signed event returned from extension');
            }
            
            return result;
        },       

        async getRelays() {
            console.log('🌐 NOSTR API: getRelays() called');
            const result = await sendRequest('getRelays');
            console.log('🌐 NOSTR API: getRelays() result:', result);
            return result || {};
        },

        async encrypt(pubkey, plaintext) {
            console.log('🔒 NOSTR API: encrypt() called');
            const result = await sendRequest('encrypt', { pubkey, plaintext });
            return result;
        },

        async decrypt(pubkey, ciphertext) {
            console.log('🔓 NOSTR API: decrypt() called');
            const result = await sendRequest('decrypt', { pubkey, ciphertext });
            return result;
        },

        // Check if the extension is unlocked and available
        async isUnlocked() {
            try {
                await this.getPublicKey();
                return true;
            } catch (error) {
                return false;
            }
        },

        // NIP-07 compatibility - some apps call this to request permission
        async enable() {
            console.log('🔓 NOSTR API: enable() called');
            try {
                const pubkey = await this.getPublicKey();
                return { enabled: true, pubkey };
            } catch (error) {
                throw new Error('User denied access or extension is locked');
            }
        }
    };

    // Dispatch event to notify the page that NOSTR provider is available
    window.dispatchEvent(new Event('nostr:provider'));

    console.log('🟢 Zap Social NOSTR provider injected successfully');
    console.log('🔍 Available methods:', Object.keys(window.nostr));
    
    // Test the connection after a short delay
    setTimeout(async () => {
        try {
            console.log('🧪 Testing Zap Social extension connection...');
            const isUnlocked = await window.nostr.isUnlocked();
            
            if (isUnlocked) {
                const pubkey = await window.nostr.getPublicKey();
                console.log('✅ Zap Social extension connection successful!');
                console.log('🔑 Public key available:', pubkey);
                console.log('🎆 Ready for NOSTR apps!');
                
                // Dispatch a custom event that NOSTR apps can listen for
                window.dispatchEvent(new CustomEvent('zap-social:ready', {
                    detail: { pubkey, provider: 'Zap Social' }
                }));
            } else {
                console.log('⚠️ Zap Social extension is installed but locked');
                console.log('💡 Please open the extension popup and generate/import keys');
            }
        } catch (error) {
            console.log('❌ Zap Social extension connection failed:', error.message);
            console.log('💡 Make sure the extension is installed and keys are generated');
        }
    }, 1000);
})();