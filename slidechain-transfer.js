// SlideChain Transfer Module
class SlideChainTransfer {
    constructor() {
        this.api = null;
        this.isConnected = false;
        this.wsEndpoint = 'wss://validator1.slidechain.chainmagic.studio';
    }

    // Connect to SlideChain network
    async connect() {
        console.log('🔗 Connecting to SlideChain...');
        
        try {
            // Check if Polkadot API is available
            if (!window.polkadotApi || !window.polkadotApi.ApiPromise) {
                throw new Error('Polkadot API not available. Please ensure polkadot-api.js is loaded.');
            }

            const { ApiPromise, WsProvider } = window.polkadotApi;
            
            // Create API with explicit metadata hash handling
            this.api = await ApiPromise.create({
                provider: new WsProvider(this.wsEndpoint),
                metadata: {
                    throwOnUnknown: false
                }
            });

            this.isConnected = true;
            console.log('✅ Connected to SlideChain');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to connect to SlideChain:', error);
            this.isConnected = false;
            throw error;
        }
    }

    // Disconnect from SlideChain
    async disconnect() {
        if (this.api) {
            await this.api.disconnect();
            this.api = null;
            this.isConnected = false;
            console.log('🔌 Disconnected from SlideChain');
        }
    }

    // Validate SS58 address format
    isValidAddress(address) {
        try {
            if (!this.api) return false;
            
            // Use Polkadot API to validate address format
            const decoded = this.api.createType('AccountId32', address);
            return decoded.toString() === address;
        } catch (error) {
            return false;
        }
    }

    // Get account balance
    async getBalance(address) {
        if (!this.isConnected || !this.api) {
            await this.connect();
        }

        try {
            const account = await this.api.query.system.account(address);
            const balance = account.data;
            
            return {
                free: balance.free.toString(),
                reserved: balance.reserved.toString(),
                total: balance.free.add(balance.reserved).toString(),
                formatted: {
                    free: this.formatBalance(balance.free),
                    reserved: this.formatBalance(balance.reserved),
                    total: this.formatBalance(balance.free.add(balance.reserved))
                }
            };
        } catch (error) {
            console.error('Error fetching balance:', error);
            throw error;
        }
    }

    // Format balance from wei to tokens
    formatBalance(balance) {
        const decimals = 12; // SlideChain typically uses 12 decimals
        const balanceString = balance.toString();
        
        if (balanceString.length <= decimals) {
            return '0.' + '0'.repeat(decimals - balanceString.length) + balanceString;
        } else {
            const integerPart = balanceString.slice(0, -decimals);
            const fractionalPart = balanceString.slice(-decimals);
            return integerPart + '.' + fractionalPart;
        }
    }

    // Convert tokens to wei (smallest unit)
    parseAmount(amount) {
        const decimals = 12;
        const amountString = amount.toString();
        
        if (amountString.includes('.')) {
            const [integer, fractional] = amountString.split('.');
            const paddedFractional = fractional.padEnd(decimals, '0').slice(0, decimals);
            return integer + paddedFractional;
        } else {
            return amountString + '0'.repeat(decimals);
        }
    }

    // Estimate transaction fee
    async estimateFee(fromAddress, toAddress, amount) {
        if (!this.isConnected || !this.api) {
            await this.connect();
        }

        try {
            const transfer = this.api.tx.balances.transferAllowDeath(toAddress, amount);
            const paymentInfo = await transfer.paymentInfo(fromAddress);
            
            return {
                fee: paymentInfo.partialFee.toString(),
                formatted: this.formatBalance(paymentInfo.partialFee)
            };
        } catch (error) {
            console.error('Error estimating fee:', error);
            throw error;
        }
    }

    // Create and submit transfer transaction
    async transfer(nsecPrivateKey, toAddress, amount, onStatusUpdate) {
        if (!this.isConnected || !this.api) {
            await this.connect();
        }

        try {
            // Validate inputs
            if (!this.isValidAddress(toAddress)) {
                throw new Error('Invalid destination address format');
            }

            // Create keypair from NOSTR private key using the exact same logic as the popup
            const fromKeyPair = await this.createKeyPair(nsecPrivateKey);

            if (!fromKeyPair || !fromKeyPair.address) {
                throw new Error('Invalid key pair provided');
            }

            // Convert amount to wei (smallest unit)
            const amountWei = this.api.createType('Balance', this.parseAmount(amount));
            
            // Get current account info
            const account = await this.api.query.system.account(fromKeyPair.address);
            const currentNonce = account.nonce.toNumber();
            
            // Debug: Log balance and amount details
            console.log('🔍 Transfer Debug Info:');
            console.log('  From address:', fromKeyPair.address);
            console.log('  To address:', toAddress);
            console.log('  Input amount:', amount);
            console.log('  Parsed amount (wei):', this.parseAmount(amount));
            console.log('  Amount wei as Balance type:', amountWei.toString());
            console.log('  Account free balance:', account.data.free.toString());
            console.log('  Account free balance (formatted):', this.formatBalance(account.data.free));
            console.log('  Account reserved balance:', account.data.reserved.toString());
            console.log('  Account nonce:', currentNonce);
            
            // Check if this matches the displayed SS58 address
            const displayedAddress = document.getElementById('slidechain-address')?.value;
            console.log('  Displayed SS58 address:', displayedAddress);
            console.log('  Addresses match:', fromKeyPair.address === displayedAddress);
            
            // Estimate fee before checking balance
            const transfer = this.api.tx.balances.transferKeepAlive(toAddress, amountWei);
            const feeInfo = await transfer.paymentInfo(fromKeyPair.address);
            console.log('Payment Info:', JSON.stringify(feeInfo.toJSON(), null, 2));
            const estimatedFee = feeInfo.partialFee;
            
            console.log('  Estimated fee (wei):', estimatedFee.toString());
            console.log('  Estimated fee (formatted):', this.formatBalance(estimatedFee));
            
            // Check if we have enough balance for amount + fees
            const totalRequired = amountWei.add(estimatedFee);
            console.log('  Total required (amount + fee):', totalRequired.toString());
            console.log('  Total required (formatted):', this.formatBalance(totalRequired));
            
            if (account.data.free.lt(totalRequired)) {
                throw new Error(`Insufficient balance for transaction. Account has ${this.formatBalance(account.data.free)}, but need ${this.formatBalance(totalRequired)} (amount: ${this.formatBalance(amountWei)} + fee: ${this.formatBalance(estimatedFee)})`);
            }
            
            onStatusUpdate('Creating transfer transaction...', 'loading');
            
            onStatusUpdate(`Fee estimate: ${this.formatBalance(estimatedFee)} tokens. Signing transaction...`, 'loading');
            
            // Sign and send transaction
            const result = await new Promise((resolve, reject) => {
                let resolved = false;
                
                const resolveOnce = (result) => {
                    if (!resolved) {
                        resolved = true;
                        resolve(result);
                    }
                };
                
                transfer.signAndSend(fromKeyPair, {
                    nonce: currentNonce,
                    mode: 0, // Disable metadata hash
                    metadataHash: null,
                    era: 0 // Immortal era
                }, (result) => {
                    console.log(`Transaction status: ${result.status.type}`);
                    
                    if (result.status.isInBlock) {
                        onStatusUpdate(`Transaction included in block: ${result.status.asInBlock}`, 'loading');
                        
                        // Check for successful transfer event
                        const transferEvent = result.events.find(({ event }) => 
                            event.section === 'balances' && event.method === 'Transfer'
                        );
                        
                        if (transferEvent) {
                            const [from, to, transferAmount] = transferEvent.event.data;
                            resolveOnce({
                                success: true,
                                blockHash: result.status.asInBlock.toString(),
                                txHash: transfer.hash.toString(),
                                transferEvent: {
                                    from: from.toString(),
                                    to: to.toString(),
                                    amount: transferAmount.toString(),
                                    formattedAmount: this.formatBalance(transferAmount)
                                }
                            });
                            return;
                        }
                        
                        // Check for failure
                        const failEvent = result.events.find(({ event }) =>
                            event.section === 'system' && event.method === 'ExtrinsicFailed'
                        );
                        
                        if (failEvent) {
                            const [dispatchError] = failEvent.event.data;
                            let errorMessage = 'Transaction failed';
                            
                            if (dispatchError.isModule) {
                                const decoded = this.api.registry.findMetaError(dispatchError.asModule);
                                errorMessage = `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
                            } else {
                                errorMessage = dispatchError.toString();
                            }
                            
                            resolveOnce({
                                success: false,
                                error: errorMessage,
                                blockHash: result.status.asInBlock.toString()
                            });
                        }
                    }
                    
                    if (result.status.isFinalized) {
                        onStatusUpdate(`Transaction finalized in block: ${result.status.asFinalized}`, 'success');
                        
                        if (!resolved) {
                            resolveOnce({
                                success: true,
                                blockHash: result.status.asFinalized.toString(),
                                txHash: transfer.hash.toString(),
                                finalized: true
                            });
                        }
                    }
                })
                .catch(reject);
                
                // Timeout after 30 seconds
                setTimeout(() => {
                    if (!resolved) {
                        reject(new Error('Transaction timeout - transaction may still be processing'));
                    }
                }, 30000);
            });
            
            return result;
            
        } catch (error) {
            console.error('Transfer error:', error);
            throw error;
        }
    }

    // Create a Substrate KeyPair from NOSTR private key
    async createKeyPair(nsecPrivateKey) {
        try {
            // Use the exact same conversion logic as the popup's generateSlidechainAddress function
            if (!window.NostrCrypto) {
                throw new Error('NostrCrypto module not available');
            }
            
            const conversionResult = await window.NostrCrypto.convertNostrToSubstrate(nsecPrivateKey, 42);
            
            if (conversionResult.error) {
                throw new Error(conversionResult.error);
            }
            
            if (!conversionResult.substrate_private_key) {
                throw new Error('No substrate private key returned from conversion');
            }
            
            // Create keyring and add the key
            if (!window.polkadotApi.Keyring) {
                throw new Error('Polkadot Keyring not available');
            }
            
            const { Keyring } = window.polkadotApi;
            // The key derivation from NOSTR uses ed25519, so we must use the same type here
            // Also set SS58 format to 42 (same as popup)
            const keyring = new Keyring({ type: 'ed25519', ss58Format: 42 });
            
            // Add the converted key to the keyring
            const hexToUint8Array = (hex) => {
                if (!hex || typeof hex !== 'string') {
                    throw new Error('Invalid hex string provided to hexToUint8Array');
                }
                const bytes = new Uint8Array(hex.length / 2);
                for (let i = 0; i < hex.length; i += 2) {
                    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
                }
                return bytes;
            };
            
            const keyPair = keyring.addFromSeed(
                hexToUint8Array(conversionResult.substrate_private_key)
            );
            
            console.log('✅ Created Substrate KeyPair (ed25519):', {
                address: keyPair.address,
                expectedAddress: conversionResult.ss58_address,
                publicKey: Array.from(keyPair.publicKey).map(b => b.toString(16).padStart(2, '0')).join(''),
                addressesMatch: keyPair.address === conversionResult.ss58_address,
                usesPolkadotKeyring: true
            });
            
            return keyPair;
            
        } catch (error) {
            console.error('Error creating key pair:', error);
            throw error;
        }
    }
}

// Export for use in popup
window.SlideChainTransfer = SlideChainTransfer;
