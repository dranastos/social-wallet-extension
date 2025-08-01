// NOSTR Identity Management Utilities

// Basic cryptographic functions for NOSTR
class NostrUtils {
    static generatePrivateKey() {
        // Generate a 32-byte random private key
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    
    static async getPublicKey(privateKeyHex) {
        // WARNING: This function uses a FAKE algorithm and should NOT be used!
        // It's only kept for legacy compatibility with old chainmagic entries.
        // For real cryptographic operations, use the background script's proper secp256k1 implementation.
        // This is a placeholder that generates a valid hex public key
        const privateKeyBytes = this.hexToBytes(privateKeyHex);
        
        // Simple hash-based public key derivation (NOT CRYPTOGRAPHICALLY SECURE)
        // Using original algorithm to maintain compatibility with existing chainmagic entries
        const publicKeyBytes = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
            publicKeyBytes[i] = privateKeyBytes[i] ^ (i + 1);
        }
        
        return this.bytesToHex(publicKeyBytes);
    }
    
    static hexToBytes(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes;
    }
    
    static bytesToHex(bytes) {
        return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    
    // Bech32 encoding functions for npub/nsec
    static bech32Charset = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
    
    static bech32Polymod(values) {
        let chk = 1;
        for (let p = 0; p < values.length; ++p) {
            let top = chk >> 25;
            chk = (chk & 0x1ffffff) << 5 ^ values[p];
            for (let i = 0; i < 5; ++i) {
                chk ^= ((top >> i) & 1) ? [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3][i] : 0;
            }
        }
        return chk;
    }
    
    static bech32HrpExpand(hrp) {
        let ret = [];
        let p;
        for (p = 0; p < hrp.length; ++p) {
            ret.push(hrp.charCodeAt(p) >> 5);
        }
        ret.push(0);
        for (p = 0; p < hrp.length; ++p) {
            ret.push(hrp.charCodeAt(p) & 31);
        }
        return ret;
    }
    
    static bech32CreateChecksum(hrp, data) {
        let values = this.bech32HrpExpand(hrp).concat(data).concat([0, 0, 0, 0, 0, 0]);
        let mod = this.bech32Polymod(values) ^ 1;
        let ret = [];
        for (let p = 0; p < 6; ++p) {
            ret.push((mod >> 5 * (5 - p)) & 31);
        }
        return ret;
    }
    
    static bech32Encode(hrp, data) {
        let combined = data.concat(this.bech32CreateChecksum(hrp, data));
        let ret = hrp + '1';
        for (let p = 0; p < combined.length; ++p) {
            ret += this.bech32Charset.charAt(combined[p]);
        }
        return ret;
    }
    
    static convertBits(data, fromBits, toBits, pad = true) {
        let acc = 0;
        let bits = 0;
        let ret = [];
        let maxv = (1 << toBits) - 1;
        let maxAcc = (1 << (fromBits + toBits - 1)) - 1;
        
        for (let p = 0; p < data.length; ++p) {
            let value = data[p];
            if (value < 0 || (value >> fromBits) !== 0) {
                return null;
            }
            acc = ((acc << fromBits) | value) & maxAcc;
            bits += fromBits;
            while (bits >= toBits) {
                bits -= toBits;
                ret.push((acc >> bits) & maxv);
            }
        }
        
        if (pad) {
            if (bits) {
                ret.push((acc << (toBits - bits)) & maxv);
            }
        } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv)) {
            return null;
        }
        
        return ret;
    }
    
    static hexToNpub(hexPublicKey) {
        const data = this.hexToBytes(hexPublicKey);
        const words = this.convertBits(Array.from(data), 8, 5);
        return this.bech32Encode('npub', words);
    }
    
    static hexToNsec(hexPrivateKey) {
        const data = this.hexToBytes(hexPrivateKey);
        const words = this.convertBits(Array.from(data), 8, 5);
        return this.bech32Encode('nsec', words);
    }
    
    static bech32Decode(bechString) {
        if (bechString.length < 8) return null;
        if (bechString !== bechString.toLowerCase() && bechString !== bechString.toUpperCase()) {
            return null;
        }
        
        bechString = bechString.toLowerCase();
        let pos = bechString.lastIndexOf('1');
        if (pos === -1) return null;
        
        let hrp = bechString.substring(0, pos);
        let data = bechString.substring(pos + 1);
        
        if (data.length < 6) return null;
        
        let decoded = [];
        for (let p = 0; p < data.length; ++p) {
            let d = this.bech32Charset.indexOf(data.charAt(p));
            if (d === -1) return null;
            decoded.push(d);
        }
        
        if (!this.bech32VerifyChecksum(hrp, decoded)) return null;
        
        return {
            hrp: hrp,
            data: decoded.slice(0, decoded.length - 6)
        };
    }
    
    static bech32VerifyChecksum(hrp, data) {
        return this.bech32Polymod(this.bech32HrpExpand(hrp).concat(data)) === 1;
    }
    
    static nsecToHex(nsec) {
        const decoded = this.bech32Decode(nsec);
        if (!decoded || decoded.hrp !== 'nsec') return null;
        
        const bytes = this.convertBits(decoded.data, 5, 8, false);
        if (!bytes || bytes.length !== 32) return null;
        
        return this.bytesToHex(new Uint8Array(bytes));
    }
    
    static npubToHex(npub) {
        const decoded = this.bech32Decode(npub);
        if (!decoded || decoded.hrp !== 'npub') return null;
        
        const bytes = this.convertBits(decoded.data, 5, 8, false);
        if (!bytes || bytes.length !== 32) return null;
        
        return this.bytesToHex(new Uint8Array(bytes));
    }

    static getHexAndNsec(privateKey) {
        let hex = privateKey;
        let nsec = null;

        if (this.isValidNsec(privateKey)) {
            hex = this.nsecToHex(privateKey);
            nsec = privateKey;
        } else if (this.isValidPrivateKey(privateKey)) {
            nsec = this.hexToNsec(privateKey);
        } else {
            return { hex: null, nsec: null };
        }

        return { hex, nsec };
    }
    
    static isValidPrivateKey(hex) {
        if (!hex || typeof hex !== 'string') return false;
        if (hex.length !== 64) return false;
        return /^[0-9a-f]{64}$/i.test(hex);
    }
    
    static isValidNsec(nsec) {
        return this.nsecToHex(nsec) !== null;
    }
    
    static validateNostrEvent(event) {
        // Check required fields
        if (typeof event.id !== 'string' || event.id.length !== 64 || !/^[0-9a-f]{64}$/i.test(event.id)) {
            console.error('Invalid event ID:', event.id);
            return false;
        }
        
        if (typeof event.pubkey !== 'string' || event.pubkey.length !== 64 || !/^[0-9a-f]{64}$/i.test(event.pubkey)) {
            console.error('Invalid pubkey:', event.pubkey);
            return false;
        }
        
        if (typeof event.sig !== 'string' || event.sig.length !== 128 || !/^[0-9a-f]{128}$/i.test(event.sig)) {
            console.error('Invalid signature:', event.sig);
            return false;
        }
        
        if (typeof event.kind !== 'number') {
            console.error('Invalid kind:', event.kind);
            return false;
        }
        
        if (typeof event.created_at !== 'number') {
            console.error('Invalid created_at:', event.created_at);
            return false;
        }
        
        if (!Array.isArray(event.tags)) {
            console.error('Invalid tags:', event.tags);
            return false;
        }
        
        if (typeof event.content !== 'string') {
            console.error('Invalid content:', event.content);
            return false;
        }
        
        return true;
    }
    
    // Sign event using the same mechanism as the working extension
    static async signEventWithExtension(event) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'NOSTR_REQUEST',
                method: 'signEvent',
                params: { event }
            }, (response) => {
                if (response.error) {
                    reject(new Error(response.error));
                } else {
                    resolve(response.result);
                }
            });
        });
    }
    
    // Relay communication functions
    static defaultRelays = [
        'wss://nostr.chainmagic.studio',
        'wss://relay.nostr.band',
        'wss://relay.damus.io',
        'wss://nostr.wine',
        'wss://nos.lol'
    ];
    
    static async fetchProfileFromRelays(publicKeyHex, relays = this.defaultRelays) {
        console.log('🔍 NostrUtils: Fetching profile for public key:', publicKeyHex);
        console.log('🔍 NostrUtils: Using relays:', relays);
        
        const profile = {
            name: '',
            about: '',
            picture: '',
            banner: '',
            nip05: '',
            lud06: '',
            lud16: '',
            website: '',
            ethereum: '',
            base: '',
            baseAddr: ''
        };
        
        const promises = relays.map(relay => {
            console.log('🔍 NostrUtils: Creating fetch promise for relay:', relay);
            return this.fetchProfileFromRelay(publicKeyHex, relay);
        });
        
        try {
            console.log('🔍 NostrUtils: Waiting for all relay responses...');
            const results = await Promise.allSettled(promises);
            console.log('🔍 NostrUtils: All relay responses received:', results);
            
            let foundProfile = false;
            
            // Merge results from all relays, prioritizing non-empty values
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                const relayUrl = relays[i];
                
                if (result.status === 'fulfilled' && result.value) {
                    console.log(`✅ NostrUtils: Profile data from ${relayUrl}:`, result.value);
                    const relayProfile = result.value;
                    foundProfile = true;
                    
                    for (const key in profile) {
                        if (relayProfile[key] && !profile[key]) {
                            profile[key] = relayProfile[key];
                            console.log(`📝 NostrUtils: Set ${key} = ${relayProfile[key]} from ${relayUrl}`);
                        }
                    }
                } else if (result.status === 'rejected') {
                    console.log(`❌ NostrUtils: Failed to fetch from ${relayUrl}:`, result.reason);
                } else {
                    console.log(`ℹ️ NostrUtils: No profile data from ${relayUrl}`);
                }
            }
            
            console.log('🔍 NostrUtils: Final merged profile:', profile);
            console.log('🔍 NostrUtils: Found any profile data:', foundProfile);
            
            return foundProfile ? profile : null;
        } catch (error) {
            console.error('❌ NostrUtils: Error fetching profile from relays:', error);
            return null;
        }
    }
    
    static async fetchProfileFromRelay(publicKeyHex, relayUrl) {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(relayUrl);
            let timeout;
            
            const cleanup = () => {
                if (timeout) clearTimeout(timeout);
                if (ws.readyState === WebSocket.OPEN) ws.close();
            };
            
            timeout = setTimeout(() => {
                cleanup();
                resolve(null);
            }, 5000);
            
            ws.onopen = () => {
                // Request metadata event (kind 0) for the public key
                const subscription = [
                    "REQ",
                    "profile_" + Math.random().toString(36).substr(2, 9),
                    {
                        "kinds": [0],
                        "authors": [publicKeyHex],
                        "limit": 1
                    }
                ];
                
                ws.send(JSON.stringify(subscription));
            };
            
            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    
                    if (message[0] === "EVENT" && message[2] && message[2].kind === 0) {
                        const content = JSON.parse(message[2].content);
                        cleanup();
                        resolve({
                            name: content.name || content.display_name || '',
                            about: content.about || '',
                            picture: content.picture || '',
                            banner: content.banner || '',
                            nip05: content.nip05 || '',
                            lud06: content.lud06 || '',
                            lud16: content.lud16 || '',
                            website: content.website || '',
                            ethereum: content.ethereum || '',
                            base: content.base || '',
                            baseAddr: content.ethereum || content.base || content.lud16 || '',
                            displayName: content.display_name || content.name || '',
                            bio: content.about || '',
                            avatar: content.picture || '',
                            backgroundImage: content.banner || ''
                        });
                    } else if (message[0] === "EOSE") {
                        // End of stored events, no profile found
                        cleanup();
                        resolve(null);
                    }
                } catch (error) {
                    console.error('Error parsing relay message:', error);
                }
            };
            
            ws.onerror = () => {
                cleanup();
                resolve(null);
            };
            
            ws.onclose = () => {
                cleanup();
                resolve(null);
            };
        });
    }
    
    // Publish profile to Nostr relays
    static async publishProfileToRelays(privateKeyHex, profileData, relays = this.defaultRelays) {
        console.log('📤 NostrUtils: Starting profile publication to relays...');
        console.log('📤 NostrUtils: Target relays:', relays);
        console.log('📤 NostrUtils: Profile data:', profileData);
        
        try {
            const publicKeyHex = await this.getPublicKey(privateKeyHex);
            console.log('📤 NostrUtils: Public key derived:', publicKeyHex);
            
            // Create the metadata event (kind 0)
            const unsignedEvent = {
                kind: 0,
                created_at: Math.floor(Date.now() / 1000),
                tags: [],
                content: JSON.stringify({
                    name: profileData.name || profileData['display-name'] || '',
                    about: profileData.about || '',
                    picture: profileData.picture || '',
                    banner: profileData.banner || '',
                    nip05: profileData.nip05 || '',
                    lud06: profileData.lud06 || '',
                    lud16: profileData.lud16 || '',
                    website: profileData.website || ''
                }),
                pubkey: publicKeyHex
            };
            
            console.log('📤 NostrUtils: Unsigned event created:', unsignedEvent);
            
            // Use the same signing mechanism that works for the extension
            const signedEvent = await this.signEventWithExtension(unsignedEvent);
            console.log('📤 NostrUtils: Event signed successfully:', signedEvent);
            
            // Publish to relays
            console.log('📤 NostrUtils: Publishing to', relays.length, 'relays...');
            const publishPromises = relays.map(relay => this.publishToRelay(signedEvent, relay));
            const results = await Promise.allSettled(publishPromises);
            
            let successCount = 0;
            let errors = [];
            
            console.log('📤 NostrUtils: All relay publish attempts completed. Processing results...');
            
            results.forEach((result, index) => {
                const relayUrl = relays[index];
                if (result.status === 'fulfilled' && result.value) {
                    successCount++;
                    console.log(`✅ NostrUtils: Successfully published to ${relayUrl}`);
                } else {
                    const errorMsg = `${relayUrl}: ${result.reason || 'Unknown error'}`;
                    errors.push(errorMsg);
                    console.log(`❌ NostrUtils: Failed to publish to ${relayUrl}:`, result.reason);
                }
            });
            
            const result = {
                success: successCount > 0,
                successCount,
                totalRelays: relays.length,
                errors
            };
            
            console.log('📤 NostrUtils: Final publication result:', result);
            return result;
            
        } catch (error) {
            console.error('❌ NostrUtils: Error publishing profile to relays:', error);
            return {
                success: false,
                successCount: 0,
                totalRelays: relays.length,
                errors: [error.message]
            };
        }
    }
    
    static async publishToRelay(event, relayUrl) {
        console.log(`🔗 NostrUtils: Connecting to relay ${relayUrl}...`);
        
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(relayUrl);
            let timeout;
            
            const cleanup = () => {
                if (timeout) clearTimeout(timeout);
                if (ws.readyState === WebSocket.OPEN) ws.close();
            };
            
            timeout = setTimeout(() => {
                console.log(`⏰ NostrUtils: Timeout connecting to ${relayUrl}`);
                cleanup();
                reject('Timeout');
            }, 10000);
            
            ws.onopen = () => {
                console.log(`🔗 NostrUtils: Connected to ${relayUrl}, sending event...`);
                // Send the event
                const eventMessage = ["EVENT", event];
                ws.send(JSON.stringify(eventMessage));
                console.log(`📤 NostrUtils: Event sent to ${relayUrl}`);
            };
            
            ws.onmessage = (wsEvent) => {
                try {
                    const message = JSON.parse(wsEvent.data);
                    console.log(`📨 NostrUtils: Received message from ${relayUrl}:`, message);
                    
                    if (message[0] === "OK" && message[1] === event.id) {
                        const success = message[2];
                        const errorMessage = message[3];
                        
                        cleanup();
                        if (success) {
                            console.log(`✅ NostrUtils: ${relayUrl} accepted the event`);
                            resolve(true);
                        } else {
                            console.log(`❌ NostrUtils: ${relayUrl} rejected the event:`, errorMessage);
                            reject(errorMessage || 'Relay rejected event');
                        }
                    }
                } catch (error) {
                    console.error(`❌ NostrUtils: Error parsing relay response from ${relayUrl}:`, error);
                    reject(`Parse error: ${error.message}`);
                }
            };
            
            ws.onerror = (error) => {
                console.log(`❌ NostrUtils: WebSocket error with ${relayUrl}:`, error);
                cleanup();
                reject('WebSocket error');
            };
            
            ws.onclose = (closeEvent) => {
                console.log(`🔌 NostrUtils: Connection to ${relayUrl} closed. Code: ${closeEvent.code}, Reason: ${closeEvent.reason}`);
                cleanup();
                reject('Connection closed');
            };
        });
    }
    
    // Check chainmagic.studio well-known nostr.json
    static async checkChainmagicIds(publicKeyHex) {
        try {
            const response = await fetch('https://chainmagic.studio/.well-known/nostr.json');
            if (!response.ok) {
                return null;
            }
            
            const text = await response.text();
            if (!text || text.trim().length === 0) {
                return null;
            }
            
            let data;
            try {
                data = JSON.parse(text);
            } catch (parseError) {
                return null;
            }
            
            // Find matching public key in names
            if (data && data.names && typeof data.names === 'object') {
                for (const [name, pubkey] of Object.entries(data.names)) {
                    // Handle both hex and npub formats
                    let pubkeyHex = pubkey;
                    if (pubkey.startsWith('npub')) {
                        pubkeyHex = this.npubToHex(pubkey);
                    }
                    
                    if (pubkeyHex === publicKeyHex) {
                        return `${name}@chainmagic.studio`;
                    }
                }
            }
            
            return null;
        } catch (error) {
            return null;
        }
    }
    
    // Read autofollow accounts from file
    static async readAutofollowAccounts() {
        try {
            const response = await fetch('./autofollow.txt');
            if (!response.ok) {
                console.log('📄 NostrUtils: No autofollow.txt file found');
                return [];
            }
            const text = await response.text();
            const accounts = text.split('\n')
                .map(line => line.trim())
                .filter(line => line && (line.startsWith('npub') || line.match(/^[a-f0-9]{64}$/)));
            console.log('📄 NostrUtils: Found autofollow accounts:', accounts);
            return accounts;
        } catch (error) {
            console.error('❌ NostrUtils: Error reading autofollow.txt:', error);
            return [];
        }
    }
    
    // Fetch specific event from relay
    static async fetchEventFromRelay(relayUrl, filter) {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(relayUrl);
            let timeout;
            
            const cleanup = () => {
                if (timeout) clearTimeout(timeout);
                if (ws.readyState === WebSocket.OPEN) ws.close();
            };
            
            timeout = setTimeout(() => {
                cleanup();
                resolve(null);
            }, 5000);
            
            ws.onopen = () => {
                const subscription = [
                    "REQ",
                    "fetch_" + Math.random().toString(36).substr(2, 9),
                    filter
                ];
                
                ws.send(JSON.stringify(subscription));
            };
            
            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    
                    if (message[0] === "EVENT" && message[2]) {
                        cleanup();
                        resolve(message[2]);
                    } else if (message[0] === "EOSE") {
                        cleanup();
                        resolve(null);
                    }
                } catch (error) {
                    console.error('Error parsing relay message:', error);
                }
            };
            
            ws.onerror = () => {
                cleanup();
                resolve(null);
            };
            
            ws.onclose = () => {
                cleanup();
                resolve(null);
            };
        });
    }
    
    // Get current contact list from relays
    static async fetchContactList(publicKeyHex, relays = this.defaultRelays) {
        console.log('📥 NostrUtils: Fetching contact list for:', publicKeyHex);
        
        for (const relay of relays) {
            try {
                const contactEvent = await this.fetchEventFromRelay(relay, {
                    kinds: [3],
                    authors: [publicKeyHex],
                    limit: 1
                });
                
                if (contactEvent) {
                    console.log('📥 NostrUtils: Found contact list:', contactEvent);
                    return contactEvent;
                }
            } catch (error) {
                console.error(`❌ NostrUtils: Error fetching from ${relay}:`, error);
            }
        }
        
        console.log('📥 NostrUtils: No existing contact list found');
        return null;
    }
    
    // Publish contact list (kind 3) to relays
    static async publishContactList(privateKeyHex, contacts, relays = this.defaultRelays) {
        console.log('📤 NostrUtils: Publishing contact list with', contacts.length, 'contacts');
        
        try {
            const publicKeyHex = await this.getPublicKey(privateKeyHex);
            
            // Convert contacts to proper format - each contact is a p tag with pubkey
            const tags = contacts.map(contact => {
                let pubkeyHex = contact;
                
                // Convert npub to hex if needed
                if (contact.startsWith('npub')) {
                    pubkeyHex = this.npubToHex(contact);
                }
                
                if (!pubkeyHex || !pubkeyHex.match(/^[a-f0-9]{64}$/)) {
                    console.warn('⚠️ NostrUtils: Invalid contact pubkey:', contact);
                    return null;
                }
                
                return ['p', pubkeyHex];
            }).filter(tag => tag !== null);
            
            console.log('📤 NostrUtils: Contact tags:', tags);
            
            const contactEvent = {
                kind: 3,
                created_at: Math.floor(Date.now() / 1000),
                tags: tags,
                content: '', // Can contain relay recommendations in JSON format
                pubkey: publicKeyHex
            };
            
            console.log('📤 NostrUtils: Unsigned contact event:', contactEvent);
            
            // Sign the event
            const signedEvent = await this.signEventWithExtension(contactEvent);
            console.log('📤 NostrUtils: Contact event signed successfully');
            
            // Publish to relays
            const publishPromises = relays.map(relay => this.publishToRelay(signedEvent, relay));
            const results = await Promise.allSettled(publishPromises);
            
            let successCount = 0;
            let errors = [];
            
            results.forEach((result, index) => {
                const relayUrl = relays[index];
                if (result.status === 'fulfilled' && result.value) {
                    successCount++;
                    console.log(`✅ NostrUtils: Contact list published to ${relayUrl}`);
                } else {
                    const errorMsg = `${relayUrl}: ${result.reason || 'Unknown error'}`;
                    errors.push(errorMsg);
                    console.log(`❌ NostrUtils: Failed to publish contact list to ${relayUrl}:`, result.reason);
                }
            });
            
            const result = {
                success: successCount > 0,
                successCount,
                totalRelays: relays.length,
                errors
            };
            
            console.log('📤 NostrUtils: Contact list publication result:', result);
            return result;
            
        } catch (error) {
            console.error('❌ NostrUtils: Error publishing contact list:', error);
            return {
                success: false,
                successCount: 0,
                totalRelays: relays.length,
                errors: [error.message]
            };
        }
    }
    
    // Auto-follow accounts when a new profile is created
    static async handleAutofollow(privateKeyHex) {
        console.log('🔄 NostrUtils: Starting autofollow process...');
        
        try {
            const publicKeyHex = await this.getPublicKey(privateKeyHex);
            
            // Read autofollow accounts from file
            const autofollowAccounts = await this.readAutofollowAccounts();
            
            if (autofollowAccounts.length === 0) {
                console.log('📄 NostrUtils: No autofollow accounts found');
                return { success: true, message: 'No autofollow accounts configured' };
            }
            
            // Get existing contact list
            const existingContactEvent = await this.fetchContactList(publicKeyHex);
            let existingContacts = [];
            
            if (existingContactEvent && existingContactEvent.tags) {
                existingContacts = existingContactEvent.tags
                    .filter(tag => tag[0] === 'p' && tag[1])
                    .map(tag => tag[1]);
                console.log('📥 NostrUtils: Existing contacts:', existingContacts);
            }
            
            // Convert autofollow npubs to hex and check if already following
            const newContacts = [];
            const alreadyFollowing = [];
            
            for (const account of autofollowAccounts) {
                let pubkeyHex = account;
                
                if (account.startsWith('npub')) {
                    pubkeyHex = this.npubToHex(account);
                }
                
                if (pubkeyHex && pubkeyHex.match(/^[a-f0-9]{64}$/)) {
                    if (existingContacts.includes(pubkeyHex)) {
                        alreadyFollowing.push(account);
                    } else {
                        newContacts.push(pubkeyHex);
                    }
                }
            }
            
            console.log('👥 NostrUtils: Already following:', alreadyFollowing);
            console.log('👥 NostrUtils: New contacts to add:', newContacts);
            
            if (newContacts.length === 0) {
                console.log('✅ NostrUtils: Already following all autofollow accounts');
                return { success: true, message: 'Already following all autofollow accounts' };
            }
            
            // Combine existing and new contacts
            const allContacts = [...existingContacts, ...newContacts];
            
            // Publish updated contact list
            const publishResult = await this.publishContactList(privateKeyHex, allContacts);
            
            if (publishResult.success) {
                console.log(`✅ NostrUtils: Successfully added ${newContacts.length} new contacts`);
                return {
                    success: true,
                    message: `Added ${newContacts.length} new contacts to follow list`,
                    newContacts: newContacts.length,
                    publishResult
                };
            } else {
                console.error('❌ NostrUtils: Failed to publish updated contact list');
                return {
                    success: false,
                    message: 'Failed to publish updated contact list',
                    publishResult
                };
            }
            
        } catch (error) {
            console.error('❌ NostrUtils: Error in autofollow process:', error);
            return {
                success: false,
                message: `Autofollow error: ${error.message}`
            };
        }
    }
    
    // Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NostrUtils;
} else if (typeof window !== 'undefined') {
    window.NostrUtils = NostrUtils;
}
