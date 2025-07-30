// src/background.js - Uses REAL nostr-tools (current version syntax)
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools/pure';
import { nip19 } from 'nostr-tools';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

console.log('🟢 Zap Social Background script with REAL nostr-tools loaded');
console.log('🔧 nostr-tools functions available:', {
    generateSecretKey: typeof generateSecretKey,
    getPublicKey: typeof getPublicKey,
    finalizeEvent: typeof finalizeEvent,
    nip19: typeof nip19
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📨 Background received message:', request);
    
    if (request.type === 'NOSTR_REQUEST') {
        try {
            handleNostrRequest(request, sendResponse);
        } catch (e) {
            console.warn('Extension context invalidated:', e);
            sendResponse({ error: 'Extension context invalidated, please reload the page.' });
        }
        return true;
    }
});

async function handleNostrRequest(request, sendResponse) {
    const { method, params } = request;
    console.log('🔧 Handling NOSTR request:', method);
    
    try {
        switch (method) {
            case 'getPublicKey':
                await handleGetPublicKey(sendResponse);
                break;
                
            case 'signEvent':
                await handleSignEvent(params.event, sendResponse);
                break;
                
            case 'generateKeys':
                await handleGenerateKeys(sendResponse);
                break;
                
            case 'derivePublicKey':
                await handleDerivePublicKey(params.privateKeyHex, sendResponse);
                break;
                
            case 'importPrivateKey':
                await handleImportPrivateKey(params.privateKeyInput, sendResponse);
                break;
                
            case 'getRelays':
                await handleGetRelays(sendResponse);
                break;
                
            default:
                sendResponse({ error: `Unknown method: ${method}` });
        }
    } catch (error) {
        console.error('❌ Extension error:', error);
        sendResponse({ error: error.message });
    }
}

async function handleGetPublicKey(sendResponse) {
    console.log('🔑 Getting public key from storage...');
    
    try {
        chrome.storage.local.get(['nostr_public_key'], (result) => {
            if (chrome.runtime.lastError) {
                console.error('❌ Chrome storage error:', chrome.runtime.lastError);
                sendResponse({ error: 'Extension context invalidated, please reload the page.' });
                return;
            }
            
            if (result.nostr_public_key) {
                console.log('✅ Found stored public key:', result.nostr_public_key);
                sendResponse({ result: result.nostr_public_key });
            } else {
                console.log('❌ No NOSTR identity found in storage');
                sendResponse({ error: 'No NOSTR identity found. Please generate keys in the extension popup.' });
            }
        });
    } catch (error) {
        console.error('❌ Extension context error in handleGetPublicKey:', error);
        sendResponse({ error: 'Extension context invalidated, please reload the page.' });
    }
}

async function handleSignEvent(event, sendResponse) {
    console.log('📝 Starting event signing with REAL nostr-tools...');
    console.log('📄 Event to sign:', event);
    
    try {
        chrome.storage.local.get(['nostr_private_key', 'nostr_public_key'], async (result) => {
            if (chrome.runtime.lastError) {
                console.error('❌ Chrome storage error in handleSignEvent:', chrome.runtime.lastError);
                sendResponse({ error: 'Extension context invalidated, please reload the page.' });
                return;
            }
            
            if (!result.nostr_private_key || !result.nostr_public_key) {
                console.error('❌ Missing keys in storage');
                sendResponse({ error: 'No private key available. Please generate keys.' });
                return;
            }
        
        try {
            console.log('🔑 Using stored keys:', {
                hasPrivateKey: !!result.nostr_private_key,
                privateKeyLength: result.nostr_private_key?.length,
                hasPublicKey: !!result.nostr_public_key,
                publicKeyLength: result.nostr_public_key?.length
            });
            
            // Ensure event has required fields
            const eventToSign = {
                pubkey: event.pubkey || result.nostr_public_key,
                created_at: event.created_at || Math.floor(Date.now() / 1000),
                kind: event.kind || 1,
                tags: event.tags || [],
                content: event.content || ''
            };
            
            console.log('✅ Event prepared for signing with REAL nostr-tools:', eventToSign);
            
            // Convert hex private key to Uint8Array (new nostr-tools format)
            const privateKeyBytes = hexToBytes(result.nostr_private_key);
            
            // This is the EXACT same finalizeEvent function from current nostr-tools
            console.log('🔐 Calling REAL finalizeEvent...');
            const signedEvent = finalizeEvent(eventToSign, privateKeyBytes);
            
            console.log('✅ Event signed successfully with REAL nostr-tools:', {
                id: signedEvent.id,
                sig: signedEvent.sig.substring(0, 20) + '...',
                pubkey: signedEvent.pubkey,
                fullSignature: signedEvent.sig,
                signatureLength: signedEvent.sig?.length
            });
            
            // Verify the signed event has all required fields
            if (!signedEvent.id || !signedEvent.sig || !signedEvent.pubkey) {
                throw new Error('Signed event is missing required fields');
            }
            
            if (signedEvent.sig.length !== 128) {
                throw new Error(`Invalid signature length: ${signedEvent.sig.length}, expected 128`);
            }
            
            sendResponse({ result: signedEvent });
            
        } catch (error) {
            console.error('❌ Error during REAL nostr-tools signing:', error);
            console.error('Stack trace:', error.stack);
            sendResponse({ error: `REAL nostr-tools signing failed: ${error.message}` });
        }
        });
    } catch (error) {
        console.error('❌ Extension context error in handleSignEvent:', error);
        sendResponse({ error: 'Extension context invalidated, please reload the page.' });
    }
}

async function handleDerivePublicKey(privateKeyHex, sendResponse) {
    try {
        console.log('🔑 Deriving public key from private key with REAL nostr-tools...');
        
        // Convert hex private key to Uint8Array
        const privateKeyBytes = hexToBytes(privateKeyHex);
        console.log('✅ Private key converted to bytes:', privateKeyBytes.length, 'bytes');
        
        // Use REAL nostr-tools to derive public key
        console.log('🔧 Calling REAL getPublicKey...');
        const publicKey = getPublicKey(privateKeyBytes);
        console.log('✅ Public key derived:', publicKey.length, 'chars');
        
        // Use REAL nip19 encoding
        console.log('🔧 Calling REAL nip19.npubEncode...');
        const npub = nip19.npubEncode(publicKey);
        console.log('✅ npub generated:', npub.substring(0, 20) + '...');
        
        console.log('🔧 Calling REAL nip19.nsecEncode...');
        const nsec = nip19.nsecEncode(privateKeyBytes);
        console.log('✅ nsec generated:', nsec.substring(0, 20) + '...');
        
        console.log('✅ REAL keys derived successfully:', {
            privateKeyLength: privateKeyHex.length,
            publicKeyLength: publicKey.length,
            npubPrefix: npub.substring(0, 10),
            nsecPrefix: nsec.substring(0, 10)
        });
        
        sendResponse({ 
            result: {
                publicKey: publicKey,
                npub: npub,
                nsec: nsec
            }
        });
        
    } catch (error) {
        console.error('❌ REAL key derivation error:', error);
        console.error('Stack trace:', error.stack);
        sendResponse({ error: error.message });
    }
}

async function handleImportPrivateKey(privateKeyInput, sendResponse) {
    try {
        console.log('📥 Importing private key with REAL nostr-tools...', {
            inputType: privateKeyInput.startsWith('nsec') ? 'nsec' : 'hex',
            inputLength: privateKeyInput.length
        });
        
        let privateKeyBytes;
        let privateKeyHex;
        
        // Handle both nsec and hex formats using REAL nostr-tools
        if (privateKeyInput.startsWith('nsec')) {
            console.log('🔧 Decoding nsec with REAL nip19.decode...');
            const decoded = nip19.decode(privateKeyInput);
            if (decoded.type !== 'nsec') {
                throw new Error('Invalid nsec format');
            }
            privateKeyBytes = decoded.data;
            privateKeyHex = bytesToHex(privateKeyBytes);
            console.log('✅ nsec decoded successfully');
        } else {
            // Assume it's hex format
            if (!/^[0-9a-f]{64}$/i.test(privateKeyInput)) {
                throw new Error('Invalid private key - must be 64 hex characters or valid nsec');
            }
            privateKeyHex = privateKeyInput.toLowerCase();
            privateKeyBytes = hexToBytes(privateKeyHex);
            console.log('✅ Hex private key validated');
        }
        
        // Use REAL nostr-tools to derive public key
        console.log('🔧 Calling REAL getPublicKey...');
        const publicKey = getPublicKey(privateKeyBytes);
        console.log('✅ Public key derived:', publicKey.length, 'chars');
        
        // Use REAL nip19 encoding
        console.log('🔧 Calling REAL nip19.npubEncode...');
        const npub = nip19.npubEncode(publicKey);
        console.log('✅ npub generated:', npub.substring(0, 20) + '...');
        
        console.log('🔧 Calling REAL nip19.nsecEncode...');
        const nsec = nip19.nsecEncode(privateKeyBytes);
        console.log('✅ nsec generated:', nsec.substring(0, 20) + '...');
        
        console.log('✅ REAL key import successful:', {
            privateKeyLength: privateKeyHex.length,
            publicKeyLength: publicKey.length,
            npubPrefix: npub.substring(0, 10),
            nsecPrefix: nsec.substring(0, 10)
        });
        
        // Store the keys immediately
        chrome.storage.local.set({
            nostr_private_key: privateKeyHex,
            nostr_public_key: publicKey,
            nostr_npub: npub,
            nostr_nsec: nsec,
            generated_at: Date.now(),
            crypto_method: 'imported via real-nostr-tools'
        }, () => {
            if (chrome.runtime.lastError) {
                console.error('❌ Chrome storage error in handleImportPrivateKey:', chrome.runtime.lastError);
                sendResponse({ error: 'Extension context invalidated, please reload the page.' });
                return;
            }
            
            console.log('✅ Imported keys stored successfully');
            sendResponse({ 
                result: {
                    publicKey: publicKey,
                    npub: npub,
                    nsec: nsec,
                    privateKeyHex: privateKeyHex
                }
            });
        });
        
    } catch (error) {
        console.error('❌ REAL key import error:', error);
        console.error('Stack trace:', error.stack);
        sendResponse({ error: error.message });
    }
}

async function handleGenerateKeys(sendResponse) {
    try {
        console.log('🔑 Generating new keypair with REAL nostr-tools...');
        
        // Use the current nostr-tools functions
        console.log('🔧 Calling REAL generateSecretKey...');
        const privateKeyBytes = generateSecretKey();
        const privateKey = bytesToHex(privateKeyBytes); // Convert to hex for storage
        console.log('✅ Private key generated:', privateKey.length, 'chars');
        
        console.log('🔧 Calling REAL getPublicKey...');
        const publicKey = getPublicKey(privateKeyBytes);
        console.log('✅ Public key generated:', publicKey.length, 'chars');
        
        // Use REAL nip19 encoding
        console.log('🔧 Calling REAL nip19.npubEncode...');
        const npub = nip19.npubEncode(publicKey);
        console.log('✅ npub generated:', npub.substring(0, 20) + '...');
        
        console.log('🔧 Calling REAL nip19.nsecEncode...');
        const nsec = nip19.nsecEncode(privateKeyBytes);
        console.log('✅ nsec generated:', nsec.substring(0, 20) + '...');
        
        console.log('✅ REAL keys generated successfully:', {
            privateKeyLength: privateKey.length,
            publicKeyLength: publicKey.length,
            npubPrefix: npub.substring(0, 10),
            nsecPrefix: nsec.substring(0, 10)
        });
        
        // Store the keys
        chrome.storage.local.set({
            nostr_private_key: privateKey,
            nostr_public_key: publicKey,
            nostr_npub: npub,
            nostr_nsec: nsec,
            generated_at: Date.now(),
            crypto_method: 'real-nostr-tools-current'
        }, () => {
            console.log('✅ REAL keys stored successfully');
            sendResponse({ 
                result: {
                    publicKey: publicKey,
                    npub: npub,
                    nsec: nsec
                }
            });
        });
    } catch (error) {
        console.error('❌ REAL key generation error:', error);
        console.error('Stack trace:', error.stack);
        sendResponse({ error: error.message });
    }
}

async function handleGetRelays(sendResponse) {
    const defaultRelays = {
        'wss://relay.damus.io': { read: true, write: true },
        'wss://nos.lol': { read: true, write: true },
        'wss://relay.snort.social': { read: true, write: true }
    };
    
    sendResponse({ result: defaultRelays });
}

// Note: hexToBytes and bytesToHex are now imported from @noble/hashes/utils

// Extension installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('🟢 Zap Social NOSTR extension installed with REAL nostr-tools');
    
    // Test that the real functions are available
    console.log('🧪 Testing REAL nostr-tools functions...');
    try {
        const testKey = generateSecretKey();
        const testPubkey = getPublicKey(testKey);
        console.log('✅ REAL nostr-tools functions working correctly');
        console.log('Test key lengths:', { private: testKey.length, public: testPubkey.length });
    } catch (error) {
        console.error('❌ REAL nostr-tools functions not working:', error);
    }
});

console.log('🟢 Background script loaded with REAL nostr-tools');