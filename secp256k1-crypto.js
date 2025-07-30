// Fixed secp256k1-crypto.js - Simplified and reliable NOSTR implementation
class NostrSecp256k1Crypto {
    // secp256k1 curve parameters
    static P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
    static N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
    static Gx = 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n;
    static Gy = 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n;

    // Generate a secp256k1 key pair
    static async generateKeyPair() {
        let privateKey;
        let attempts = 0;
        
        // Generate a valid private key
        do {
            if (attempts++ > 100) {
                throw new Error('Failed to generate valid private key');
            }
            
            const randomBytes = new Uint8Array(32);
            crypto.getRandomValues(randomBytes);
            privateKey = this.bytesToBigInt(randomBytes);
        } while (privateKey === 0n || privateKey >= this.N);

        // Calculate public key
        const publicPoint = this.pointMultiply({ x: this.Gx, y: this.Gy }, privateKey);
        
        // Convert to hex (NOSTR uses x-coordinate only)
        const privateKeyHex = this.bigIntToHex(privateKey, 64);
        const publicKeyHex = this.bigIntToHex(publicPoint.x, 64);

        return {
            privateKey: privateKeyHex,
            publicKey: publicKeyHex,
            npub: this.hexToNpub(publicKeyHex),
            nsec: this.hexToNsec(privateKeyHex),
            _fullPublicKey: publicPoint // Store full point for internal use
        };
    }

    // Calculate public key from private key
    static calculatePublicKey(privateKey) {
        return this.pointMultiply({ x: this.Gx, y: this.Gy }, privateKey);
    }

    // Sign a message hash using deterministic ECDSA
    static async signMessage(privateKeyHex, messageHashHex) {
        const privateKey = BigInt('0x' + privateKeyHex);
        const messageHash = BigInt('0x' + messageHashHex);
        
        let attempts = 0;
        while (attempts < 100) {
            try {
                // Generate deterministic k
                const k = await this.generateDeterministicK(privateKey, messageHash, attempts);
                
                // Calculate r = (k * G).x mod n
                const kG = this.pointMultiply({ x: this.Gx, y: this.Gy }, k);
                const r = kG.x % this.N;
                
                if (r === 0n) {
                    attempts++;
                    continue;
                }
                
                // Calculate s = k^-1 * (hash + r * privateKey) mod n
                const kInv = this.modInverse(k, this.N);
                let s = (kInv * (messageHash + (r * privateKey))) % this.N;
                
                if (s === 0n) {
                    attempts++;
                    continue;
                }
                
                // Ensure low s value (BIP 62)
                if (s > this.N / 2n) {
                    s = this.N - s;
                }
                
                // Return as concatenated hex (128 hex chars = 64 bytes)
                const rHex = this.bigIntToHex(r, 64);
                const sHex = this.bigIntToHex(s, 64);
                
                return rHex + sHex;
                
            } catch (error) {
                attempts++;
                if (attempts >= 100) {
                    throw new Error(`Signature generation failed after ${attempts} attempts: ${error.message}`);
                }
            }
        }
        
        throw new Error('Failed to generate valid signature');
    }

    // Verify a signature using the public key
    static async verifySignature(publicKeyHex, messageHashHex, signatureHex) {
        try {
            if (signatureHex.length !== 128) {
                console.error('Invalid signature length:', signatureHex.length);
                return false;
            }
            
            const r = BigInt('0x' + signatureHex.slice(0, 64));
            const s = BigInt('0x' + signatureHex.slice(64, 128));
            const messageHash = BigInt('0x' + messageHashHex);
            
            // Basic validation
            if (r === 0n || s === 0n || r >= this.N || s >= this.N) {
                console.error('Signature values out of range');
                return false;
            }
            
            // Reconstruct public key point from x-coordinate
            const publicKeyX = BigInt('0x' + publicKeyHex);
            
            // Try both possible y values (even and odd)
            const publicKeyEven = this.reconstructPublicKey(publicKeyX, false);
            const publicKeyOdd = this.reconstructPublicKey(publicKeyX, true);
            
            if (!publicKeyEven && !publicKeyOdd) {
                console.error('Could not reconstruct public key');
                return false;
            }
            
            // Try verification with both possible public keys
            const verifyWithKey = (pubKey) => {
                try {
                    // Verify: r == (s^-1 * (hash * G + r * pubkey)).x mod n
                    const sInv = this.modInverse(s, this.N);
                    const u1 = (messageHash * sInv) % this.N;
                    const u2 = (r * sInv) % this.N;
                    
                    const point1 = this.pointMultiply({ x: this.Gx, y: this.Gy }, u1);
                    const point2 = this.pointMultiply(pubKey, u2);
                    const result = this.pointAdd(point1, point2);
                    
                    return (result.x % this.N) === r;
                } catch (error) {
                    return false;
                }
            };
            
            // Try verification with both possible y coordinates
            if (publicKeyEven && verifyWithKey(publicKeyEven)) {
                return true;
            }
            if (publicKeyOdd && verifyWithKey(publicKeyOdd)) {
                return true;
            }
            
            return false;
            
        } catch (error) {
            console.error('Signature verification error:', error);
            return false;
        }
    }

    // Reconstruct public key point from x-coordinate
    static reconstructPublicKey(x, isOdd) {
        try {
            // Calculate y² = x³ + 7 (mod p)
            const ySq = (this.modPow(x, 3n, this.P) + 7n) % this.P;
            const y = this.modSqrt(ySq, this.P);
            
            if (y === null) {
                return null;
            }
            
            // Choose the correct y based on parity
            const yToUse = (y % 2n === 1n) === isOdd ? y : this.P - y;
            
            return { x, y: yToUse };
        } catch (error) {
            console.error('Public key reconstruction error:', error);
            return null;
        }
    }

    // Generate deterministic k with retry mechanism
    static async generateDeterministicK(privateKey, messageHash, nonce = 0) {
        // Create deterministic k using HMAC-like approach with nonce
        const privateKeyBytes = this.bigIntToBytes(privateKey, 32);
        const messageHashBytes = this.bigIntToBytes(messageHash, 32);
        const nonceBytes = this.bigIntToBytes(BigInt(nonce), 4);
        
        // Combine private key, message hash, and nonce
        const combined = new Uint8Array(68);
        combined.set(privateKeyBytes, 0);
        combined.set(messageHashBytes, 32);
        combined.set(nonceBytes, 64);
        
        // Hash to get deterministic random
        const hash = await this.sha256(combined);
        let k = this.bytesToBigInt(hash);
        
        // Ensure k is in valid range
        if (k === 0n || k >= this.N) {
            k = ((k % (this.N - 1n)) + 1n);
        }
        
        return k;
    }

    // Point operations
    static pointMultiply(point, scalar) {
        if (scalar === 0n) {
            return { x: 0n, y: 0n, infinity: true };
        }
        
        let result = { x: 0n, y: 0n, infinity: true };
        let addend = point;
        
        while (scalar > 0n) {
            if (scalar & 1n) {
                result = this.pointAdd(result, addend);
            }
            addend = this.pointDouble(addend);
            scalar >>= 1n;
        }
        
        return result;
    }

    static pointAdd(p1, p2) {
        if (p1.infinity) return p2;
        if (p2.infinity) return p1;
        
        if (p1.x === p2.x) {
            if (p1.y === p2.y) {
                return this.pointDouble(p1);
            } else {
                return { x: 0n, y: 0n, infinity: true };
            }
        }
        
        const slope = this.modDiv(p2.y - p1.y, p2.x - p1.x, this.P);
        const x3 = (slope * slope - p1.x - p2.x) % this.P;
        const y3 = (slope * (p1.x - x3) - p1.y) % this.P;
        
        return {
            x: x3 < 0n ? x3 + this.P : x3,
            y: y3 < 0n ? y3 + this.P : y3,
            infinity: false
        };
    }

    static pointDouble(point) {
        if (point.infinity) return point;
        
        const slope = this.modDiv(3n * point.x * point.x, 2n * point.y, this.P);
        const x3 = (slope * slope - 2n * point.x) % this.P;
        const y3 = (slope * (point.x - x3) - point.y) % this.P;
        
        return {
            x: x3 < 0n ? x3 + this.P : x3,
            y: y3 < 0n ? y3 + this.P : y3,
            infinity: false
        };
    }

    // Modular arithmetic helpers
    static modDiv(a, b, mod) {
        return (a * this.modInverse(b, mod)) % mod;
    }

    static modInverse(a, mod) {
        let [oldR, r] = [a, mod];
        let [oldS, s] = [1n, 0n];
        
        while (r !== 0n) {
            const quotient = oldR / r;
            [oldR, r] = [r, oldR - quotient * r];
            [oldS, s] = [s, oldS - quotient * s];
        }
        
        return oldS < 0n ? oldS + mod : oldS;
    }

    static modPow(base, exp, mod) {
        let result = 1n;
        base = base % mod;
        while (exp > 0n) {
            if (exp % 2n === 1n) {
                result = (result * base) % mod;
            }
            exp = exp >> 1n;
            base = (base * base) % mod;
        }
        return result;
    }

    static modSqrt(a, p) {
        // For secp256k1, p ≡ 3 (mod 4), so we can use simple method
        if (this.modPow(a, (p - 1n) / 2n, p) !== 1n) {
            return null; // Not a quadratic residue
        }
        
        return this.modPow(a, (p + 1n) / 4n, p);
    }

    // Utility functions
    static async sha256(data) {
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return new Uint8Array(hashBuffer);
    }

    static bytesToBigInt(bytes) {
        let result = 0n;
        for (const byte of bytes) {
            result = (result << 8n) + BigInt(byte);
        }
        return result;
    }

    static bigIntToBytes(bigint, length = 32) {
        const bytes = new Uint8Array(length);
        for (let i = length - 1; i >= 0; i--) {
            bytes[i] = Number(bigint & 0xFFn);
            bigint >>= 8n;
        }
        return bytes;
    }

    static bigIntToHex(bigint, length) {
        return bigint.toString(16).padStart(length, '0');
    }

    static bytesToHex(bytes) {
        return Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    static hexToBytes(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
        }
        return bytes;
    }

    // Bech32 encoding for NOSTR addresses
    static CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    static GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

    static hexToNpub(hex) {
        const data = this.hexToBytes(hex);
        return this.encodeBech32('npub', data);
    }

    static hexToNsec(hex) {
        const data = this.hexToBytes(hex);
        return this.encodeBech32('nsec', data);
    }

    static encodeBech32(hrp, data) {
        const values = this.convertBits(data, 8, 5, true);
        const checksum = this.bech32CreateChecksum(hrp, values);
        const combined = values.concat(checksum);
        
        return hrp + '1' + combined.map(val => this.CHARSET[val]).join('');
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

    static bech32CreateChecksum(hrp, data) {
        const values = this.bech32HrpExpand(hrp).concat(data).concat([0, 0, 0, 0, 0, 0]);
        const mod = this.bech32Polymod(values) ^ 1;
        const ret = [];
        for (let p = 0; p < 6; p++) {
            ret.push((mod >> 5 * (5 - p)) & 31);
        }
        return ret;
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
}

// Test functions embedded directly
async function runCryptoTests() {
    console.log('🧪 Starting comprehensive crypto tests...');
    
    try {
        // Test 1: Key generation
        console.log('\n📝 Test 1: Key Generation');
        const keyPair = await NostrSecp256k1Crypto.generateKeyPair();
        console.log('Generated key pair:', keyPair);
        
        const validPrivateKey = /^[0-9a-f]{64}$/i.test(keyPair.privateKey);
        const validPublicKey = /^[0-9a-f]{64}$/i.test(keyPair.publicKey);
        const validNpub = keyPair.npub.startsWith('npub1');
        const validNsec = keyPair.nsec.startsWith('nsec1');
        
        console.log('✅ Key generation test:', {
            validPrivateKey,
            validPublicKey,
            validNpub,
            validNsec,
            passed: validPrivateKey && validPublicKey && validNpub && validNsec
        });
        
        // Test 2: Simple message signing
        console.log('\n📝 Test 2: Simple Message Signing');
        const testMessage = 'Hello NOSTR!';
        const messageBytes = new TextEncoder().encode(testMessage);
        const messageHash = await NostrSecp256k1Crypto.sha256(messageBytes);
        const messageHashHex = NostrSecp256k1Crypto.bytesToHex(messageHash);
        
        console.log('Message:', testMessage);
        console.log('Message hash:', messageHashHex);
        
        const signature = await NostrSecp256k1Crypto.signMessage(keyPair.privateKey, messageHashHex);
        console.log('Signature:', signature);
        console.log('Signature length:', signature.length);
        
        const isValid = await NostrSecp256k1Crypto.verifySignature(keyPair.publicKey, messageHashHex, signature);
        console.log('✅ Simple signing test:', { signature, isValid, passed: isValid });
        
        // Test 3: NOSTR event signing
        console.log('\n📝 Test 3: NOSTR Event Signing');
        const event = {
            pubkey: keyPair.publicKey,
            created_at: Math.floor(Date.now() / 1000),
            kind: 1,
            tags: [],
            content: 'Test NOSTR event'
        };
        
        // Create event data for hashing (NOSTR format)
        const eventData = [
            0, // Reserved field
            event.pubkey,
            event.created_at,
            event.kind,
            event.tags,
            event.content
        ];
        
        const eventString = JSON.stringify(eventData);
        console.log('Event data string:', eventString);
        
        const eventHashBytes = await NostrSecp256k1Crypto.sha256(new TextEncoder().encode(eventString));
        const eventId = NostrSecp256k1Crypto.bytesToHex(eventHashBytes);
        console.log('Event ID:', eventId);
        
        const eventSignature = await NostrSecp256k1Crypto.signMessage(keyPair.privateKey, eventId);
        console.log('Event signature:', eventSignature);
        
        const eventValid = await NostrSecp256k1Crypto.verifySignature(keyPair.publicKey, eventId, eventSignature);
        console.log('✅ NOSTR event test:', { eventSignature, eventValid, passed: eventValid });
        
        // Test 4: Key consistency
        console.log('\n📝 Test 4: Key Consistency Check');
        const derivedPublicKey = NostrSecp256k1Crypto.calculatePublicKey(BigInt('0x' + keyPair.privateKey));
        const expectedPublicKeyHex = NostrSecp256k1Crypto.bigIntToHex(derivedPublicKey.x, 64);
        const keysMatch = expectedPublicKeyHex === keyPair.publicKey;
        console.log('✅ Key consistency test:', { 
            generated: keyPair.publicKey,
            derived: expectedPublicKeyHex,
            keysMatch,
            passed: keysMatch
        });
        
        // Summary
        console.log('\n📊 TEST SUMMARY');
        const allPassed = validPrivateKey && validPublicKey && validNpub && validNsec && 
                         isValid && eventValid && keysMatch;
        
        console.log('🎯 Overall result:', allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
        
        return {
            keyGeneration: validPrivateKey && validPublicKey && validNpub && validNsec,
            simpleSigning: isValid,
            nostrEvent: eventValid,
            keyConsistency: keysMatch,
            overall: allPassed,
            keyPair: keyPair
        };
        
    } catch (error) {
        console.error('❌ Test suite failed:', error);
        console.error('Stack trace:', error.stack);
        return { overall: false, error: error.message };
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.NostrSecp256k1Crypto = NostrSecp256k1Crypto;
    window.runCryptoTests = runCryptoTests;
}