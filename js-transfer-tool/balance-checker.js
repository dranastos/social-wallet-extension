const { ApiPromise, WsProvider } = require('@polkadot/api');

async function checkBalance() {
    console.log('🔗 Connecting to Slidechain...');
    
    // Create API connection
    const api = await ApiPromise.create({
        provider: new WsProvider('wss://validator1.slidechain.chainmagic.studio'),
        metadata: {
            throwOnUnknown: false
        }
    });

    console.log('✅ Connected');

    // The address that received the transfer
    const destinationAddress = '5GLnRpaqTZkDkk45ZkHw2DwZziem1RoPDSBhQoPHviK7yFqg';
    
    try {
        // Get account information
        const account = await api.query.system.account(destinationAddress);
        
        // Extract balance information
        const balance = account.data;
        const free = balance.free.toString();
        const reserved = balance.reserved.toString();
        const frozen = balance.frozen.toString();
        
        console.log('\n💰 Balance Information:');
        console.log('='.repeat(50));
        console.log(`Address: ${destinationAddress}`);
        console.log(`Free Balance: ${free} (${formatBalance(free)} tokens)`);
        console.log(`Reserved Balance: ${reserved} (${formatBalance(reserved)} tokens)`);
        console.log(`Frozen Balance: ${frozen} (${formatBalance(frozen)} tokens)`);
        
        // Calculate total balance
        const total = BigInt(free) + BigInt(reserved);
        console.log(`Total Balance: ${total.toString()} (${formatBalance(total.toString())} tokens)`);
        
        // Account nonce
        console.log(`Nonce: ${account.nonce.toString()}`);
        
        // Check if account exists (has been initialized)
        if (account.nonce.toNumber() === 0 && BigInt(free) === 0n) {
            console.log('\n⚠️  Account appears to be uninitialized or empty');
        } else {
            console.log('\n✅ Account is active with balance');
        }
        
    } catch (error) {
        console.error('❌ Error checking balance:', error.message);
    } finally {
        await api.disconnect();
        console.log('\n🔌 Disconnected from network');
    }
}

// Helper function to format balance (assuming 12 decimal places like DOT)
function formatBalance(balance) {
    const decimals = 12; // Adjust this based on your chain's token decimals
    const balanceBN = BigInt(balance);
    const divisor = BigInt(10 ** decimals);
    
    const whole = balanceBN / divisor;
    const fraction = balanceBN % divisor;
    
    // Format with decimals
    const fractionStr = fraction.toString().padStart(decimals, '0');
    const trimmedFraction = fractionStr.replace(/0+$/, '');
    
    if (trimmedFraction) {
        return `${whole}.${trimmedFraction}`;
    } else {
        return whole.toString();
    }
}

// Run the balance check
checkBalance().catch(console.error);