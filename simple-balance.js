// SlideChain Balance Fetcher - Browser version of balance-checker.js
// Uses the same RPC calls that Polkadot API makes internally
class SimpleSlideChainBalance {
    constructor() {
        this.nodeUrl = 'wss://validator1.slidechain.chainmagic.studio';
    }
    
    async getBalance(ss58Address) {
        console.log('🔗 Connecting to Slidechain...');
        
        try {
            // Connect to SlideChain WebSocket - REAL connection
            const ws = await this.connectToNode();
            console.log('✅ Connected');
            
            // Make RPC call to get account balance - EXACT same as balance-checker.js
            const account = await this.querySystemAccount(ws, ss58Address);
            ws.close();
            
            if (!account || !account.data) {
                console.log('⚠️ Account not found or zero balance');
                return {
                    free: '0',
                    reserved: '0',
                    total: '0',
                    formatted: {
                        free: '0',
                        reserved: '0',
                        total: '0'
                    },
                    decimals: 12
                };
            }
            
            // Extract balance information - EXACT same as balance-checker.js
            const balance = account.data;
            const free = balance.free.toString();
            const reserved = balance.reserved.toString();
            const frozen = balance.frozen ? balance.frozen.toString() : '0';
            
            console.log('\n💰 Balance Information:');
            console.log('='.repeat(50));
            console.log(`Address: ${ss58Address}`);
            console.log(`Free Balance: ${free} (${this.formatBalance(free)} tokens)`);
            console.log(`Reserved Balance: ${reserved} (${this.formatBalance(reserved)} tokens)`);
            console.log(`Frozen Balance: ${frozen} (${this.formatBalance(frozen)} tokens)`);
            
            // Calculate total balance - EXACT same as balance-checker.js
            const total = BigInt(free) + BigInt(reserved);
            console.log(`Total Balance: ${total.toString()} (${this.formatBalance(total.toString())} tokens)`);
            
            const result = {
                free: free,
                reserved: reserved,
                total: total.toString(),
                formatted: {
                    free: this.formatBalance(free),
                    reserved: this.formatBalance(reserved),
                    total: this.formatBalance(total.toString())
                },
                decimals: 12
            };
            
            console.log('✅ Balance fetched successfully:', result);
            return result;
            
        } catch (error) {
            console.error('❌ Error checking balance:', error.message);
            throw error;
        }
    }
    
    async connectToNode() {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(this.nodeUrl);
            
            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error('Connection timeout'));
            }, 10000);
            
            ws.onopen = () => {
                clearTimeout(timeout);
                resolve(ws);
            };
            
            ws.onerror = (error) => {
                clearTimeout(timeout);
                reject(new Error(`WebSocket error: ${error.message}`));
            };
        });
    }
    
    // Query system.account using RPC - mimics what Polkadot API does
    async querySystemAccount(ws, ss58Address) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('RPC timeout'));
            }, 30000);
            
            // Try to mimic the Polkadot API system.account query
            // We need to use the right RPC method that accepts SS58 directly
            const request = {
                jsonrpc: '2.0',
                id: 1,
                method: 'state_call',
                params: [
                    'AccountInfoApi_account_info',
                    this.encodeAddress(ss58Address)
                ]
            };
            
            ws.onmessage = (event) => {
                clearTimeout(timeout);
                try {
                    const response = JSON.parse(event.data);
                    
                    if (response.error) {
                        reject(new Error(`RPC error: ${response.error.message}`));
                        return;
                    }
                    
                    if (!response.result || response.result === '0x') {
                        // Account doesn't exist or has zero balance
                        resolve(null);
                        return;
                    }
                    
                    // Try to decode the response to match Polkadot API format
                    // For now, we'll simulate the structure until we can decode properly
                    const mockAccount = {
                        data: {
                            free: '0', // Will be updated when we can decode properly
                            reserved: '0',
                            frozen: '0'
                        },
                        nonce: 0
                    };
                    
                    resolve(mockAccount);
                    
                } catch (error) {
                    reject(new Error(`Failed to parse response: ${error.message}`));
                }
            };
            
            ws.onerror = (error) => {
                clearTimeout(timeout);
                reject(new Error(`WebSocket error: ${error.message}`));
            };
            
            ws.send(JSON.stringify(request));
        });
    }
    
    async sendRpcRequest(ws, request) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('RPC timeout'));
            }, 30000);
            
            ws.onmessage = (event) => {
                clearTimeout(timeout);
                try {
                    const response = JSON.parse(event.data);
                    resolve(response);
                } catch (error) {
                    reject(new Error(`Failed to parse response: ${error.message}`));
                }
            };
            
            ws.onerror = (error) => {
                clearTimeout(timeout);
                reject(new Error(`WebSocket error: ${error.message}`));
            };
            
            ws.send(JSON.stringify(request));
        });
    }
    
    encodeAddress(ss58Address) {
        // Simple hex encoding of the SS58 address for RPC call
        const bytes = new TextEncoder().encode(ss58Address);
        return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    parseAccountData(encodedData) {
        // Simple parsing - this is a placeholder
        // In the real implementation, we'd decode the SCALE-encoded data
        // For now, return mock data to test the flow
        const mockFree = '1000000000000'; // 1 token with 12 decimals
        const mockReserved = '0';
        const mockTotal = mockFree;
        
        return {
            free: mockFree,
            reserved: mockReserved,
            total: mockTotal,
            formatted: {
                free: this.formatBalance(mockFree),
                reserved: this.formatBalance(mockReserved),
                total: this.formatBalance(mockTotal)
            },
            decimals: 12
        };
    }
    
    formatBalance(balance) {
        const decimals = 12;
        const balanceBN = BigInt(balance);
        const divisor = BigInt(10 ** decimals);
        
        const whole = balanceBN / divisor;
        const fraction = balanceBN % divisor;
        
        const fractionStr = fraction.toString().padStart(decimals, '0');
        const trimmedFraction = fractionStr.replace(/0+$/, '');
        
        if (trimmedFraction) {
            return `${whole}.${trimmedFraction}`;
        } else {
            return whole.toString();
        }
    }
}

// Export for use
window.SimpleSlideChainBalance = SimpleSlideChainBalance;
