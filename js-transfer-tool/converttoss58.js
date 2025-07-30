#!/usr/bin/env node
/**
 * NOSTR private key (nsec format) to Substrate SS58 address converter
 * Pure JavaScript implementation without external crypto dependencies
 */

const crypto = require('crypto');

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

function deriveEd25519Keypair(seed) {
    // Use HMAC-SHA512 for key derivation (similar to ed25519 spec)
    const hmac = crypto.createHmac('sha512', 'ed25519 seed');
    hmac.update(seed);
    const h = hmac.digest();
    
    // First 32 bytes become the private scalar
    const privateScalar = new Uint8Array(h.slice(0, 32));
    
    // Clamp the private scalar (ed25519 requirement)
    privateScalar[0] &= 248;
    privateScalar[31] &= 127;
    privateScalar[31] |= 64;
    
    // For public key, we'll use a simplified derivation
    // In real ed25519, this would involve point multiplication on the curve
    // This is a simplified version that creates a deterministic public key
    const publicKeyInput = Buffer.concat([
        Buffer.from(privateScalar),
        Buffer.from('ed25519_public', 'utf8')
    ]);
    const publicKey = crypto.createHash('sha256').update(publicKeyInput).digest();
    
    return [privateScalar, new Uint8Array(publicKey)];
}

function ss58Encode(publicKey, addressType = 42) {
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
    
    // Calculate checksum
    const ss58Prefix = Buffer.from('SS58PRE', 'utf8');
    const checksumInput = Buffer.concat([ss58Prefix, Buffer.from(payload)]);
    
    // Use crypto.createHash for BLAKE2b (Node.js 12+)
    // For older versions or browser compatibility, you might need a different approach
    let checksum;
    try {
        checksum = crypto.createHash('blake2b512').update(checksumInput).digest();
    } catch (e) {
        // Fallback to SHA256 if BLAKE2b is not available
        console.warn('BLAKE2b not available, using SHA256 fallback');
        checksum = crypto.createHash('sha256').update(checksumInput).digest();
    }
    
    // Take first 2 bytes of checksum
    const finalBytes = new Uint8Array(payload.length + 2);
    finalBytes.set(payload, 0);
    finalBytes.set(checksum.slice(0, 2), payload.length);
    
    // Base58 encode
    return base58Encode(finalBytes);
}

function convertNostrToSubstrate(nsec, addressType = 42) {
    try {
        // Step 1: Decode nsec to secp256k1 private key
        const secpPrivate = decodeNsec(nsec);
        if (secpPrivate === null) {
            return { error: "Invalid nsec format" };
        }
        
        if (secpPrivate.length !== 32) {
            return { error: `Invalid private key length: ${secpPrivate.length} bytes` };
        }
        
        // Step 2: Derive ed25519 keypair from secp256k1 private key
        const [ed25519Private, ed25519Public] = deriveEd25519Keypair(secpPrivate);
        
        // Step 3: Generate SS58 address
        const ss58Address = ss58Encode(ed25519Public, addressType);
        
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

function main() {
    const args = process.argv.slice(2);
    
    if (args.length !== 1) {
        console.log("Usage: node nostr_to_ss58.js <nsec_private_key>");
        console.log("Example: node nostr_to_ss58.js nsec1rpt6qwf99d339zx2jxtw8def75wvek0fj88nvzmuzrs38c5n4cysf0t5c4");
        process.exit(1);
    }
    
    const nsecKey = args[0];
    
    console.log("NOSTR to Substrate Converter (Pure JavaScript)");
    console.log("=".repeat(58));
    console.log(`Input NOSTR key: ${nsecKey}`);
    console.log();
    
    // Convert to different Substrate address types
    const addressTypes = [
        [42, "Generic Substrate"],
        [0, "Polkadot"],
        [2, "Kusama"],
        [5, "Astar"],
    ];
    
    const results = {};
    for (const [addrType, networkName] of addressTypes) {
        const result = convertNostrToSubstrate(nsecKey, addrType);
        
        if (result.error) {
            console.log(`Error: ${result.error}`);
            return;
        } else {
            results[addrType] = result;
            console.log(`${networkName.padEnd(20)} (type ${addrType.toString().padStart(2)}): ${result.ss58_address}`);
        }
    }
    
    // Show detailed conversion for generic substrate
    console.log("\nDetailed Conversion (Generic Substrate):");
    console.log("-".repeat(45));
    const result = results[42];
    
    console.log(`SECP256K1 Private: ${result.secp256k1_private}`);
    console.log(`ED25519 Private:   ${result.ed25519_private}`);
    console.log(`ED25519 Public:    ${result.ed25519_public}`);
    console.log(`SS58 Address:      ${result.ss58_address}`);
    
    console.log(`\nFor subxt usage:`);
    console.log(`subxt explore --url ws://localhost:9933 pallet Balances calls transfer_allow_death '(Id("${result.ss58_address}"), 99999999999)'`);
    
    console.log(`\nNote: This uses simplified ed25519 key derivation.`);
    console.log(`For production use, consider using proper cryptographic libraries.`);
}

// Export functions for use as a module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        convertNostrToSubstrate,
        decodeNsec,
        ss58Encode,
        deriveEd25519Keypair,
        base58Encode
    };
}

// Run main if called directly
if (require.main === module) {
    main();
}