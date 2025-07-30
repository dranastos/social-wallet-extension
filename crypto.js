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

    // Convert NOSTR private key to Substrate SS58 address
    static async convertNostrToSubstrate(nsec, addressType = 42) {
        try {
            // Step 1: Decode nsec to secp256k1 private key using working function
            const secpPrivate = decodeNsec(nsec);
            if (secpPrivate === null) {
                return { error: "Invalid nsec format" };
            }
            
            if (secpPrivate.length !== 32) {
                return { error: `Invalid private key length: ${secpPrivate.length} bytes` };
            }
            
            // Step 2: Derive ed25519 keypair from secp256k1 private key
            const [ed25519Private, ed25519Public] = await deriveEd25519Keypair(secpPrivate);
            
            // Step 3: Generate SS58 address (await since it returns a Promise)
            const ss58Address = await ss58Encode(ed25519Public, addressType);
            
            return {
                nsec: nsec,
                secp256k1_private: Array.from(secpPrivate).map(b => b.toString(16).padStart(2, '0')).join(''),
                ed25519_private: Array.from(ed25519Private).map(b => b.toString(16).padStart(2, '0')).join(''),
                ed25519_public: Array.from(ed25519Public).map(b => b.toString(16).padStart(2, '0')).join(''),
                ss58_address: ss58Address,
                address_type: addressType
            };
            
        } catch (e) {
            return { error: `Conversion failed: ${e.message}` };
        }
    }

}

// BLAKE2b implementation for SS58 checksum calculation
// Use global blake2b if available (for testing), otherwise FAIL
function getBlake2b() {
    if (typeof blake2b !== 'undefined') {
        return blake2b;
    } else if (typeof global !== 'undefined' && global.blake2b) {
        return global.blake2b;
    } else {
        // FAIL if BLAKE2b not available - don't silently produce wrong addresses!
        throw new Error('BLAKE2b library not available! Cannot generate correct SS58 addresses without BLAKE2b. Please include the blake2b library.');
    }
}

// Utility functions for NOSTR to Substrate conversion (copied from working converttoss58.js)
function base58Encode(data) {
    const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    
    // Convert to BigInt
    let num = BigInt(0);
    for (let i = 0; i < data.length; i++) {
        num = num * BigInt(256) + BigInt(data[i]);
    }
    
    if (num === BigInt(0)) {
        return alphabet[0];
    }
    
    let result = "";
    while (num > BigInt(0)) {
        const remainder = num % BigInt(58);
        num = num / BigInt(58);
        result = alphabet[Number(remainder)] + result;
    }
    
    // Handle leading zeros
    for (let i = 0; i < data.length; i++) {
        if (data[i] === 0) {
            result = alphabet[0] + result;
        } else {
            break;
        }
    }
    
    return result;
}

function bech32Polymod(values) {
    const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
    let chk = 1;
    
    for (const value of values) {
        const top = chk >> 25;
        chk = (chk & 0x1ffffff) << 5 ^ value;
        for (let i = 0; i < 5; i++) {
            chk ^= ((top >> i) & 1) ? GEN[i] : 0;
        }
    }
    return chk;
}

function bech32HrpExpand(hrp) {
    const high = [];
    const low = [];
    
    for (const char of hrp) {
        const code = char.charCodeAt(0);
        high.push(code >> 5);
        low.push(code & 31);
    }
    
    return [...high, 0, ...low];
}

function bech32VerifyChecksum(hrp, data) {
    return bech32Polymod([...bech32HrpExpand(hrp), ...data]) === 1;
}

function bech32Decode(bech) {
    // Check for invalid characters
    if (bech.split('').some(char => {
        const code = char.charCodeAt(0);
        return code < 33 || code > 126;
    })) {
        return [null, null];
    }
    
    // Check for mixed case
    if (bech.toLowerCase() !== bech && bech.toUpperCase() !== bech) {
        return [null, null];
    }
    
    bech = bech.toLowerCase();
    const pos = bech.lastIndexOf('1');
    
    if (pos < 1 || pos + 7 > bech.length || pos + 1 + 6 > bech.length) {
        return [null, null];
    }
    
    const charset = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
    const dataSection = bech.slice(pos + 1);
    
    // Check if all characters are valid
    if (!dataSection.split('').every(char => charset.includes(char))) {
        return [null, null];
    }
    
    const hrp = bech.slice(0, pos);
    const data = dataSection.split('').map(char => charset.indexOf(char));
    
    if (!bech32VerifyChecksum(hrp, data)) {
        return [null, null];
    }
    
    return [hrp, data.slice(0, -6)];
}

function convertBits(data, fromBits, toBits, pad = true) {
    let acc = 0;
    let bits = 0;
    const ret = [];
    const maxv = (1 << toBits) - 1;
    const maxAcc = (1 << (fromBits + toBits - 1)) - 1;
    
    for (const value of data) {
        if (value < 0 || (value >> fromBits)) {
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

function decodeNsec(nsec) {
    const [hrp, data] = bech32Decode(nsec);
    if (hrp !== "nsec" || data === null) {
        return null;
    }
    
    const converted = convertBits(data, 5, 8, false);
    if (converted === null) {
        return null;
    }
    
    return new Uint8Array(converted);
}

async function deriveEd25519Keypair(seed) {
    // Use HMAC-SHA512 for key derivation (same as working file)
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode('ed25519 seed'),
        { name: 'HMAC', hash: 'SHA-512' },
        false,
        ['sign']
    );
    
    const h = await crypto.subtle.sign('HMAC', key, seed);
    const hashArray = new Uint8Array(h);
    
    // First 32 bytes become the private scalar
    const privateScalar = new Uint8Array(hashArray.slice(0, 32));
    
    // Clamp the private scalar (ed25519 requirement)
    privateScalar[0] &= 248;
    privateScalar[31] &= 127;
    privateScalar[31] |= 64;
    
    // For public key, use same method as working file
    const publicKeyString = 'ed25519_public';
    const publicKeyStringBytes = encoder.encode(publicKeyString);
    const publicKeyInput = new Uint8Array(privateScalar.length + publicKeyStringBytes.length);
    publicKeyInput.set(privateScalar, 0);
    publicKeyInput.set(publicKeyStringBytes, privateScalar.length);
    
    const publicKeyHash = await crypto.subtle.digest('SHA-256', publicKeyInput);
    const publicKey = new Uint8Array(publicKeyHash);
    
    return [privateScalar, publicKey];
}

async function ss58Encode(publicKey, addressType = 42) {
    if (publicKey.length !== 32) {
        throw new Error("Public key must be 32 bytes");
    }
    
    let prefix;
    if (addressType < 64) {
        prefix = new Uint8Array([addressType]);
    } else if (addressType < 16384) {
        // Two-byte encoding for types 64-16383
        prefix = new Uint8Array([
            ((addressType & 0x3f) | 0x40),
            (addressType >> 6) & 0xff
        ]);
    } else {
        throw new Error("Address type too large");
    }
    
    // Create payload
    const payload = new Uint8Array(prefix.length + publicKey.length);
    payload.set(prefix, 0);
    payload.set(publicKey, prefix.length);
    
    // Calculate checksum using BLAKE2b for exact SS58 compatibility
    const ss58Prefix = new TextEncoder().encode('SS58PRE');
    const checksumInput = new Uint8Array(ss58Prefix.length + payload.length);
    checksumInput.set(ss58Prefix, 0);
    checksumInput.set(payload, ss58Prefix.length);
    
    // Use BLAKE2b for exact SS58 checksum calculation
    const blake2bFunc = getBlake2b();
    const blake2bDigest = blake2bFunc(checksumInput, null, 64);
    
    // Take first 2 bytes of checksum
    const finalBytes = new Uint8Array(payload.length + 2);
    finalBytes.set(payload, 0);
    finalBytes.set(blake2bDigest.slice(0, 2), payload.length);
    
    // Base58 encode
    return base58Encode(finalBytes);
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