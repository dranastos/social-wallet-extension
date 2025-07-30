// Debug script to test SlideChain balance fetching
// This will help us understand why we're getting 0 instead of the correct balance

async function debugBalance() {
    const address = '5GLnRpaqTZkDkk45ZkHw2DwZziem1RoPDSBhQoPHviK7yFqg';
    const nodeUrl = 'wss://validator1.slidechain.chainmagic.studio';
    
    console.log('🔍 Debugging balance fetch for:', address);
    console.log('🌐 Node URL:', nodeUrl);
    
    try {
        // Step 1: Connect to WebSocket
        console.log('\n1️⃣ Connecting to WebSocket...');
        const ws = new WebSocket(nodeUrl);
        
        await new Promise((resolve, reject) => {
            ws.onopen = () => {
                console.log('✅ WebSocket connected');
                resolve();
            };
            ws.onerror = reject;
            setTimeout(() => reject(new Error('Connection timeout')), 10000);
        });
        
        // Step 2: Convert SS58 to AccountId
        console.log('\n2️⃣ Converting SS58 to AccountId...');
        const accountId = ss58ToAccountId(address);
        console.log('AccountId:', accountId);
        
        // Step 3: Generate storage key
        console.log('\n3️⃣ Generating storage key...');
        const storageKey = getSystemAccountStorageKey(accountId);
        console.log('Storage key:', storageKey);
        
        // Step 4: Make RPC request
        console.log('\n4️⃣ Making RPC request...');
        const request = {
            jsonrpc: '2.0',
            id: 1,
            method: 'state_getStorage',
            params: [storageKey]
        };
        
        console.log('Request:', JSON.stringify(request, null, 2));
        
        const response = await new Promise((resolve, reject) => {
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    resolve(data);
                } catch (error) {
                    reject(error);
                }
            };
            ws.onerror = reject;
            ws.send(JSON.stringify(request));
            setTimeout(() => reject(new Error('RPC timeout')), 30000);
        });
        
        console.log('Response:', JSON.stringify(response, null, 2));
        
        // Step 5: Decode response
        console.log('\n5️⃣ Decoding response...');
        if (response.result) {
            const decoded = decodeAccountData(response.result);
            console.log('Decoded balance:', decoded);
            
            console.log('\n💰 Final Results:');
            console.log('Free Balance:', decoded.formatted.free);
            console.log('Reserved Balance:', decoded.formatted.reserved);
            console.log('Total Balance:', decoded.formatted.total);
        } else {
            console.log('❌ No result in response');
        }
        
        ws.close();
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Helper functions (copied from slidechain-balance.js)
function ss58ToAccountId(ss58Address) {
    const decoded = decodeBase58(ss58Address);
    const publicKey = decoded.slice(1, -2);
    return '0x' + Array.from(publicKey).map(b => b.toString(16).padStart(2, '0')).join('');
}

function decodeBase58(input) {
    const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let decoded = BigInt(0);
    let multi = BigInt(1);
    const s = input.split('').reverse().join('');
    
    for (let i = 0; i < s.length; i++) {
        const char = s[i];
        const charIndex = alphabet.indexOf(char);
        if (charIndex === -1) {
            throw new Error(`Invalid character in base58: ${char}`);
        }
        decoded += BigInt(charIndex) * multi;
        multi *= BigInt(58);
    }

    const bytes = [];
    while (decoded > 0) {
        bytes.unshift(Number(decoded % BigInt(256)));
        decoded = decoded / BigInt(256);
    }

    for (let i = 0; i < input.length && input[i] === '1'; i++) {
        bytes.unshift(0);
    }

    return new Uint8Array(bytes);
}

function getSystemAccountStorageKey(accountId) {
    // This is the problematic part - let's see what we generate
    const moduleHash = xxHash128('System');
    const storageHash = xxHash128('Account');
    
    const accountIdBytes = hexToBytes(accountId);
    const keyHash = blake2b128Bytes(accountIdBytes);
    const keyHashHex = bytesToHex(keyHash);
    const accountIdHex = accountId.slice(2);
    
    const result = `0x${moduleHash}${storageHash}${keyHashHex}${accountIdHex}`;
    
    console.log('Storage key components:');
    console.log('  Module hash (System):', moduleHash);
    console.log('  Storage hash (Account):', storageHash);
    console.log('  Key hash (Blake2_128):', keyHashHex);
    console.log('  Account ID hex:', accountIdHex);
    console.log('  Final storage key:', result);
    
    return result;
}

function xxHash128(input) {
    // This simplified implementation might be wrong
    const bytes = new TextEncoder().encode(input);
    let hash = 0;
    for (let i = 0; i < bytes.length; i++) {
        hash = ((hash << 5) - hash + bytes[i]) & 0xffffffff;
    }
    const hash1 = (hash >>> 0).toString(16).padStart(8, '0');
    const hash2 = ((hash * 31) >>> 0).toString(16).padStart(8, '0');
    return hash1 + hash2 + hash1 + hash2;
}

function blake2b128Bytes(bytes) {
    // This should work if blake2b is loaded
    if (typeof blake2b === 'undefined') {
        console.error('❌ blake2b function not available');
        return new Uint8Array(16);
    }
    return blake2b(bytes, null, 16);
}

function hexToBytes(hex) {
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
        bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
    }
    return bytes;
}

function bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function decodeAccountData(encodedData) {
    if (!encodedData || encodedData === '0x') {
        return {
            free: '0',
            reserved: '0',
            total: '0',
            formatted: {
                free: '0.000000000000',
                reserved: '0.000000000000',
                total: '0.000000000000'
            }
        };
    }

    try {
        console.log('Raw encoded data:', encodedData);
        console.log('Data length:', encodedData.length);
        
        const data = encodedData.slice(2); // Remove 0x prefix
        const bytes = new Uint8Array(Buffer.from(data, 'hex'));
        
        console.log('Decoded bytes length:', bytes.length);
        console.log('First 32 bytes:', Array.from(bytes.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' '));
        
        // Account data structure: nonce(4) + consumers(4) + providers(4) + sufficients(4) + data
        // Data structure: free(16) + reserved(16) + misc_frozen(16) + fee_frozen(16)
        const offset = 16; // Skip nonce, consumers, providers, sufficients
        
        console.log('Using offset:', offset);
        console.log('Free balance bytes:', Array.from(bytes.slice(offset, offset + 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
        console.log('Reserved balance bytes:', Array.from(bytes.slice(offset + 16, offset + 32)).map(b => b.toString(16).padStart(2, '0')).join(' '));
        
        const free = bytesToBigInt(bytes.slice(offset, offset + 16));
        const reserved = bytesToBigInt(bytes.slice(offset + 16, offset + 32));
        const total = free + reserved;

        console.log('Parsed free balance (BigInt):', free.toString());
        console.log('Parsed reserved balance (BigInt):', reserved.toString());

        const decimals = 12;
        
        return {
            free: free.toString(),
            reserved: reserved.toString(),
            total: total.toString(),
            formatted: {
                free: formatBalance(free, decimals),
                reserved: formatBalance(reserved, decimals),
                total: formatBalance(total, decimals)
            },
            decimals: decimals
        };
    } catch (error) {
        console.error('Error decoding account data:', error);
        throw new Error(`Failed to decode account data: ${error.message}`);
    }
}

function bytesToBigInt(bytes) {
    let result = BigInt(0);
    for (let i = 0; i < bytes.length; i++) {
        result = result * BigInt(256) + BigInt(bytes[i]);
    }
    return result;
}

function formatBalance(balance, decimals = 12) {
    const divisor = BigInt(10) ** BigInt(decimals);
    const wholePart = balance / divisor;
    const fractionalPart = balance % divisor;
    
    return `${wholePart.toString()}.${fractionalPart.toString().padStart(decimals, '0')}`;
}

// Make functions available in browser console
window.debugBalance = debugBalance;

// Auto-run if blake2b is available
if (typeof blake2b !== 'undefined') {
    console.log('🚀 Auto-running debug...');
    debugBalance();
} else {
    console.log('⚠️ blake2b not loaded. Run debugBalance() manually after loading blake2b.js');
}
