// SlideChain Balance Fetcher
// This version USES the pre-loaded polkadot-api.js library for reliable balance queries.
// It replaces all manual RPC logic with the official API methods.

class SlideChainBalance {
    constructor(config = {}) {
        this.nodeUrl = config.nodeUrl || 'wss://validator1.slidechain.chainmagic.studio';
        this.api = null; // To hold the connected API instance
    }

    async getBalance(ss58Address) {
        // First, confirm the pre-loaded library is actually available.
        if (typeof window.polkadotApi === 'undefined' || typeof window.polkadotApi.ApiPromise === 'undefined') {
            const errorMessage = '❌ Polkadot API library is not available on window.polkadotApi. Cannot fetch balance.';
            console.error(errorMessage);
            throw new Error(errorMessage);
        }

        console.log('✅ Using pre-loaded @polkadot/api to fetch balance...');
        
        // Destructure the necessary classes from the global polkadotApi object.
        const { ApiPromise, WsProvider } = window.polkadotApi;

        try {
            // Create the API promise using the library's functions.
            this.api = await ApiPromise.create({
                provider: new WsProvider(this.nodeUrl),
                metadata: {
                    throwOnUnknown: false // Helps with custom chains
                }
            });

            console.log('🔗 Connected to Slidechain via the official API');

            // Get account information using the RELIABLE API call.
            // This is the same method your working `checkBalance.js` script uses.
            const account = await this.api.query.system.account(ss58Address);
            
            // The library automatically decodes the response for us.
            const balance = account.data;
            const free = balance.free.toString();
            const reserved = balance.reserved.toString();
            const frozen = balance.frozen.toString();
            const total = BigInt(free) + BigInt(reserved);
            const nonce = account.nonce.toString();

            this.logBalanceInfo(ss58Address, free, reserved, frozen, total, nonce);
            
            const result = {
                free: free,
                reserved: reserved,
                total: total.toString(),
                nonce: nonce,
                formatted: {
                    free: this.formatBalance(free),
                    reserved: this.formatBalance(reserved),
                    total: this.formatBalance(total.toString())
                },
                decimals: this.api.registry.chainDecimals[0] || 12 // Get decimals from the chain
            };
            
            console.log('✅ Balance fetched successfully:', result);
            return result;
            
        } catch (error) {
            console.error('❌ Error checking balance with @polkadot/api:', error.message);
            throw error;
        } finally {
            // Ensure we disconnect the API instance if it was created.
            if (this.api) {
                await this.api.disconnect();
                console.log('\n🔌 Disconnected from network');
            }
        }
    }

    // Helper function to format balance (assuming 12 decimal places)
    formatBalance(balance, decimals = 12) {
        const balanceBN = BigInt(balance);
        const divisor = BigInt(10 ** decimals);
        
        const whole = balanceBN / divisor;
        const fraction = balanceBN % divisor;
        
        if (fraction === 0n) {
            return whole.toString();
        }
        
        const fractionStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
        return `${whole}.${fractionStr}`;
    }

    // Helper function to log the balance details to the console
    logBalanceInfo(address, free, reserved, frozen, total, nonce) {
        console.log('\n💰 Balance Information:');
        console.log('='.repeat(50));
        console.log(`Address: ${address}`);
        console.log(`Free Balance: ${free} (${this.formatBalance(free)} tokens)`);
        console.log(`Reserved Balance: ${reserved} (${this.formatBalance(reserved)} tokens)`);
        console.log(`Frozen Balance: ${frozen} (${this.formatBalance(frozen)} tokens)`);
        console.log(`Total Balance: ${total.toString()} (${this.formatBalance(total.toString())} tokens)`);
        console.log(`Nonce: ${nonce}`);
        
        if (parseInt(nonce, 10) === 0 && BigInt(free) === 0n) {
            console.log('\n⚠️  Account appears to be uninitialized or empty');
        } else {
            console.log('\n✅ Account is active');
        }
    }
}

// Export the class to the window object so other scripts can use it.
window.SlideChainBalance = SlideChainBalance;