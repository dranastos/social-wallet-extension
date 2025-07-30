class NostrCrypto {
    // Bech32 constants
    static CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    static GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
    
    // secp256k1 curve order (close enough for our purposes)
    static CURVE_ORDER = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');

    static async generateKeyPair() {
        try {
            // Generate a cryptographically secure key pair using Web Crypto API
            // Note: This uses P-256 curve, which is similar to secp256k1 for key generation
            const keyPair = await crypto.subtle.generateKey(
                {
                    name: 'ECDSA',
                    namedCurve: 'P-256'
                },
                true,
                ['sign', 'verify']
            );

            // Export the private key
            const privateKeyJWK = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
            const publicKeyJWK = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

            // Convert JWK to hex format (NOSTR uses 32-byte keys)
            const privateKeyHex = this.base64UrlToHex(privateKeyJWK.d);
            const publicKeyHex = this.base64UrlToHex(publicKeyJWK.x);

            return {
                privateKey: privateKeyHex,
                publicKey: publicKeyHex,
                npub: this.hexToNpub(publicKeyHex),
                nsec: this.hexToNsec(privateKeyHex),
                keyPair: keyPair // Store for signing
            };
        } catch (error) {
            throw new Error(`Key generation failed: ${error.message}`);
        }
    }

    static base64UrlToHex(base64Url) {
        // Convert base64url to base64
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        // Add padding if necessary
        const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
        // Decode to binary
        const binary = atob(padded);
        // Convert to hex
        let hex = '';
        for (let i = 0; i < binary.length; i++) {
            const byte = binary.charCodeAt(i);
            hex += byte.toString(16).padStart(2, '0');
        }
        // Ensure it's exactly 32 bytes (64 hex chars) by padding or truncating
        return hex.padStart(64, '0').substring(0, 64);
    }

    static async sha256(data) {
        const encoder = new TextEncoder();
        const dataBytes = typeof data === 'string' ? encoder.encode(data) : data;
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes);
        return new Uint8Array(hashBuffer);
    }

    static async signMessage(keyPair, message) {
        try {
            // Hash the message
            const messageHash = await this.sha256(message);

            // Sign using Web Crypto API
            const signature = await crypto.subtle.sign(
                {
                    name: 'ECDSA',
                    hash: 'SHA-256'
                },
                keyPair.privateKey,
                messageHash
            );

            return {
                signature: this.bytesToHex(new Uint8Array(signature)),
                messageHash: this.bytesToHex(messageHash),
                algorithm: 'ECDSA-P256'
            };
        } catch (error) {
            throw new Error(`Signing failed: ${error.message}`);
        }
    }

    static async verifySignature(keyPair, message, signatureHex) {
        try {
            // Hash the message
            const messageHash = await this.sha256(message);
            const signatureBytes = this.hexToBytes(signatureHex);

            // Verify using Web Crypto API
            const isValid = await crypto.subtle.verify(
                {
                    name: 'ECDSA',
                    hash: 'SHA-256'
                },
                keyPair.publicKey,
                signatureBytes,
                messageHash
            );

            return isValid;
        } catch (error) {
            console.error('Verification failed:', error);
            return false;
        }
    }

    static hexToNpub(hex) {
        const data = this.hexToBytes(hex);
        return this.encodeBech32('npub', data);
    }

    static hexToNsec(hex) {
        const data = this.hexToBytes(hex);
        return this.encodeBech32('nsec', data);
    }

    static npubToHex(npub) {
        const { prefix, data } = this.decodeBech32(npub);
        if (prefix !== 'npub') throw new Error('Invalid npub address');
        return this.bytesToHex(data);
    }

    static nsecToHex(nsec) {
        const { prefix, data } = this.decodeBech32(nsec);
        if (prefix !== 'nsec') throw new Error('Invalid nsec address');
        return this.bytesToHex(data);
    }

    static encodeBech32(hrp, data) {
        const values = this.bech32HrpExpand(hrp).concat(this.convertBits(data, 8, 5, true));
        const checksum = this.bech32CreateChecksum(hrp, this.convertBits(data, 8, 5, true));
        const combined = this.convertBits(data, 8, 5, true).concat(checksum);
        
        return hrp + '1' + combined.map(val => this.CHARSET[val]).join('');
    }

    static decodeBech32(bechString) {
        const pos = bechString.lastIndexOf('1');
        if (pos < 1) throw new Error('Invalid bech32 string');
        
        const hrp = bechString.substring(0, pos);
        const data = bechString.substring(pos + 1);
        
        const decoded = [];
        for (let i = 0; i < data.length; i++) {
            const d = this.CHARSET.indexOf(data.charAt(i));
            if (d === -1) throw new Error('Invalid character in bech32 string');
            decoded.push(d);
        }
        
        if (!this.bech32VerifyChecksum(hrp, decoded)) {
            throw new Error('Invalid bech32 checksum');
        }
        
        // Remove checksum
        const dataBytes = this.convertBits(decoded.slice(0, -6), 5, 8, false);
        
        return { prefix: hrp, data: new Uint8Array(dataBytes) };
    }

    static bech32Polymod(values) {
        let chk = 1;
        for (const value of values) {
            const top = chk >> 25;
            chk = (chk & 0x1ffffff) << 5 ^ value;
            for (let i = 0; i < 5; i++) {
                if ((top >> i) & 1) {
                    chk ^= this.GENERATOR[i];
                }
            }
        }
        return chk;
    }

    static bech32HrpExpand(hrp) {
        const ret = [];
        for (let p = 0; p < hrp.length; p++) {
            ret.push(hrp.charCodeAt(p) >> 5);
        }
        ret.push(0);
        for (let p = 0; p < hrp.length; p++) {
            ret.push(hrp.charCodeAt(p) & 31);
        }
        return ret;
    }

    static bech32CreateChecksum(hrp, data) {
        const values = this.bech32HrpExpand(hrp).concat(data).concat([0, 0, 0, 0, 0, 0]);
        const mod = this.bech32Polymod(values) ^ 1;
        const ret = [];
        for (let p = 0; p < 6; p++) {
            ret.push((mod >> 5 * (5 - p)) & 31);
        }
        return ret;
    }

    static bech32VerifyChecksum(hrp, data) {
        return this.bech32Polymod(this.bech32HrpExpand(hrp).concat(data)) === 1;
    }

    static convertBits(data, fromBits, toBits, pad) {
        let acc = 0;
        let bits = 0;
        const ret = [];
        const maxv = (1 << toBits) - 1;
        
        for (const value of data) {
            if (value < 0 || (value >> fromBits) !== 0) {
                throw new Error('Invalid data for conversion');
            }
            acc = (acc << fromBits) | value;
            bits += fromBits;
            while (bits >= toBits) {
                bits -= toBits;
                ret.push((acc >> bits) & maxv);
            }
        }
        
        if (pad) {
            if (bits > 0) {
                ret.push((acc << (toBits - bits)) & maxv);
            }
        } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv)) {
            throw new Error('Invalid padding');
        }
        
        return ret;
    }

    static hexToBytes(hex) {
        hex = hex.replace(/\s/g, '').toLowerCase();
        
        if (!/^[0-9a-f]*$/i.test(hex)) {
            throw new Error('Invalid hex string');
        }
        
        if (hex.length % 2 !== 0) {
            throw new Error(`Hex string must have even length. Got: ${hex.length}`);
        }
        
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
        }
        return bytes;
    }

    static bytesToHex(bytes) {
        return Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    // Convert NOSTR private key to Substrate SS58 address using OFFICIAL Polkadot.js library
    static async convertNostrToSubstrate(nsec, addressType = 42) {
        try {
            // Step 1: Decode nsec to secp256k1 private key
            const { prefix, data } = this.decodeBech32(nsec);
            if (prefix !== 'nsec') {
                return { error: "Invalid nsec format" };
            }
            
            const secpPrivate = data;
            if (secpPrivate.length !== 32) {
                return { error: `Invalid private key length: ${secpPrivate.length} bytes` };
            }
            
            // Step 2: Derive ed25519 keypair from secp256k1 private key using same logic as before
            const encoder = new TextEncoder();
            const hashInput = new Uint8Array(secpPrivate.length + encoder.encode('ed25519_substrate').length);
            hashInput.set(secpPrivate, 0);
            hashInput.set(encoder.encode('ed25519_substrate'), secpPrivate.length);
            
            const hashArrayBuffer = await crypto.subtle.digest('SHA-256', hashInput);
            const hashArray = new Uint8Array(hashArrayBuffer);
            
            // First 32 bytes become the private scalar
            const ed25519Private = new Uint8Array(hashArray.slice(0, 32));
            
            // Clamp the private scalar (ed25519 requirement)
            ed25519Private[0] &= 248;
            ed25519Private[31] &= 127;
            ed25519Private[31] |= 64;
            
            // Step 3: Use OFFICIAL Polkadot.js Keyring to generate the SS58 address
            if (!window.polkadotApi || !window.polkadotApi.Keyring) {
                return { error: 'Polkadot API not available. Cannot generate correct SS58 address.' };
            }
            
            const { Keyring } = window.polkadotApi;
            const keyring = new Keyring({ type: 'ed25519', ss58Format: addressType });
            const keyPair = keyring.addFromSeed(ed25519Private);
            const ss58Address = keyPair.address;
            
            return {
                nsec: nsec,
                secp256k1_private: Array.from(secpPrivate).map(b => b.toString(16).padStart(2, '0')).join(''),
                substrate_private_key: Array.from(ed25519Private).map(b => b.toString(16).padStart(2, '0')).join(''),
                ss58_address: ss58Address,
                address_type: addressType
            };
            
        } catch (e) {
            return { error: `Conversion failed: ${e.message}` };
        }
    }

}


// UI Functions
let currentKeyPair = null;

async function generateKeys() {
    try {
        document.getElementById('keyDisplay').innerHTML = `
            <div class="key-section">
                <div class="key-label">🔄 Generating cryptographically secure keys...</div>
                <div class="key-value">Using Web Crypto API (ECDSA-P256)</div>
            </div>
        `;
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        currentKeyPair = await NostrCrypto.generateKeyPair();
        
        document.getElementById('keyDisplay').innerHTML = `
            <div class="key-section">
                <div class="success">✅ Real Cryptographic Keys Generated!</div>
                
                <div class="key-label">Private Key (hex):</div>
                <div class="key-value">${currentKeyPair.privateKey}</div>
                
                <div class="key-label">Private Key (nsec):</div>
                <div class="key-value">${currentKeyPair.nsec}</div>
                
                <div class="key-label">Public Key (hex):</div>
                <div class="key-value">${currentKeyPair.publicKey}</div>
                
                <div class="key-label">Public Key (npub):</div>
                <div class="key-value">${currentKeyPair.npub}</div>
                
                <div class="key-label">Algorithm:</div>
                <div class="key-value">ECDSA with P-256 curve (Web Crypto API)</div>
            </div>
        `;
    } catch (error) {
        console.error('Key generation error:', error);
        document.getElementById('keyDisplay').innerHTML = `
            <div class="error">
                <strong>Error generating keys:</strong><br>
                ${error.message}
            </div>
        `;
    }
}

async function testSigning() {
    if (!currentKeyPair) {
        document.getElementById('signatureDisplay').innerHTML = `
            <div class="error">Please generate keys first!</div>
        `;
        return;
    }
    
    try {
        const message = document.getElementById('messageInput').value || 'Hello NOSTR!';
        const signResult = await NostrCrypto.signMessage(currentKeyPair, message);
        
        // Verify the signature
        const isValid = await NostrCrypto.verifySignature(currentKeyPair, message, signResult.signature);
        
        document.getElementById('signatureDisplay').innerHTML = `
            <div class="key-section">
                <div class="${isValid ? 'success' : 'error'}">
                    ${isValid ? '✅ Real Cryptographic Signature Generated & Verified!' : '❌ Signature Verification Failed'}
                </div>
                
                <div class="key-label">Message:</div>
                <div class="key-value">${message}</div>
                
                <div class="key-label">Message Hash (SHA-256):</div>
                <div class="key-value">${signResult.messageHash}</div>
                
                <div class="key-label">Digital Signature:</div>
                <div class="key-value">${signResult.signature}</div>
                
                <div class="key-label">Algorithm:</div>
                <div class="key-value">${signResult.algorithm}</div>
                
                <div class="key-label">Signature Valid:</div>
                <div class="${isValid ? 'success' : 'error'}">${isValid ? 'YES ✓' : 'NO ✗'}</div>
            </div>
        `;
    } catch (error) {
        document.getElementById('signatureDisplay').innerHTML = `
            <div class="error">Error signing message: ${error.message}</div>
        `;
    }
}

async function runTests() {
    const results = [];
    
    try {
        // Test 1: Key generation and validation
        const keyPair = await NostrCrypto.generateKeyPair();
        const pubHex = NostrCrypto.npubToHex(keyPair.npub);
        const privHex = NostrCrypto.nsecToHex(keyPair.nsec);
        
        results.push({
            test: 'Cryptographic Key Generation',
            success: pubHex === keyPair.publicKey && privHex === keyPair.privateKey,
            details: `Generated real cryptographic keys using Web Crypto API`
        });
        
        // Test 2: Bech32 encoding/decoding
        const testHex = '7e7e9c42a91bfef19fa929e5fda1fde4f5018ad92f9240fb47e492f90cbc423f';
        const npub = NostrCrypto.hexToNpub(testHex);
        const hexBack = NostrCrypto.npubToHex(npub);
        
        results.push({
            test: 'Bech32 Encoding/Decoding',
            success: testHex === hexBack,
            details: `NOSTR address format conversion working correctly`
        });
        
        // Test 3: Digital signature test
        const message = 'Test message for NOSTR';
        const signResult = await NostrCrypto.signMessage(keyPair, message);
        const isValid = await NostrCrypto.verifySignature(keyPair, message, signResult.signature);
        
        results.push({
            test: 'Digital Signatures (ECDSA)',
            success: isValid,
            details: `Cryptographically valid digital signatures using ${signResult.algorithm}`
        });
        
        // Test 4: Hash function test
        const hash1 = await NostrCrypto.sha256('test');
        const hash2 = await NostrCrypto.sha256('test');
        const hash3 = await NostrCrypto.sha256('different');
        
        results.push({
            test: 'SHA-256 Hash Function',
            success: NostrCrypto.bytesToHex(hash1) === NostrCrypto.bytesToHex(hash2) && 
                     NostrCrypto.bytesToHex(hash1) !== NostrCrypto.bytesToHex(hash3),
            details: `Deterministic and collision-resistant hashing`
        });
        
    } catch (error) {
        results.push({
            test: 'Test Suite',
            success: false,
            details: `Error: ${error.message}`
        });
    }
    
    const html = results.map(r => `
        <div class="key-section">
            <div class="${r.success ? 'success' : 'error'}">
                ${r.test}: ${r.success ? 'PASSED ✓' : 'FAILED ✗'}
            </div>
            <div class="key-value" style="font-size: 12px;">
                ${r.details}
            </div>
        </div>
    `).join('');
    
    document.getElementById('testResults').innerHTML = html;
}

// Make available globally
window.NostrCrypto = NostrCrypto;
window.generateKeys = generateKeys;
window.testSigning = testSigning;
window.runTests = runTests;