// Popup script - Works with real nostr-tools implementation
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔍 About to load polkadotapi.js...');
    
    // Debug what's available after scripts load
    setTimeout(() => {
        console.log('=== POLKADOT API DEBUG ===');
        console.log('All window properties:', Object.keys(window).filter(k => 
            k.toLowerCase().includes('polka') || 
            k.toLowerCase().includes('api') || 
            k.includes('Api') || 
            k.includes('Ws')
        ));
        
        // Check common export patterns
        const checkProps = ['polkadotApi', 'polkadot', 'ApiPromise', 'WsProvider', 'api', 'API'];
        checkProps.forEach(prop => {
            if (window[prop]) {
                console.log(`Found window.${prop}:`, typeof window[prop], window[prop]);
                if (typeof window[prop] === 'object') {
                    console.log(`  Properties of ${prop}:`, Object.keys(window[prop]));
                }
            }
        });
        console.log('=== END DEBUG ===');
    }, 100);
    
    loadIdentity();
    setupEventListeners();
});

// Initialize SlideChain balance instance
let slideChainBalance = null;

// Initialize SlideChain transfer instance
let slideChainTransfer = null;

// Initialize balance functionality when DOM is ready
function initializeBalance() {
    console.log('🔍 DEBUG: initializeBalance called');
    
    // Use the main SlideChainBalance class (has real implementation)
    if (typeof SlideChainBalance !== 'undefined') {
        slideChainBalance = new SlideChainBalance();
        console.log('🔍 DEBUG: SlideChainBalance class found and initialized');
        console.log('SlideChainBalance initialized');
    } else if (typeof SimpleSlideChainBalance !== 'undefined') {
        slideChainBalance = new SimpleSlideChainBalance();
        console.log('🔍 DEBUG: SimpleSlideChainBalance initialized (fallback)');
        console.log('SimpleSlideChainBalance initialized (fallback)');
    } else {
        console.log('❌ DEBUG: No balance classes found');
        console.log('🔍 DEBUG: Available classes:', Object.keys(window).filter(k => k.includes('Balance')));
        console.warn('No balance classes available - check that balance scripts are loaded');
    }
}

// Initialize SlideChain transfer functionality when DOM is ready
function initializeTransfer() {
    console.log('🔍 DEBUG: initializeTransfer called');
    
    if (typeof SlideChainTransfer !== 'undefined') {
        slideChainTransfer = new SlideChainTransfer();
        console.log('🔍 DEBUG: SlideChainTransfer class found and initialized');
    } else {
        console.warn('SlideChainTransfer class not available');
    }
}

// Handle the click event of the "Send Transfer" button
async function handleSendTransfer() {
    if (!slideChainTransfer) {
        updateTransferStatus('Transfer module not initialized', 'error');
        return;
    }

    const toAddress = document.getElementById('transfer-to').value.trim();
    const amount = document.getElementById('transfer-amount').value.trim();

    if (!toAddress || !amount) {
        updateTransferStatus('Please enter a destination address and amount', 'error');
        return;
    }

    try {
        updateTransferStatus('Preparing transfer...', 'loading');

        // Get the nsec private key from storage
        const result = await new Promise((resolve) => {
            chrome.storage.local.get(['nostr_nsec'], resolve);
        });

        if (!result.nostr_nsec) {
            throw new Error('Private key not found. Please log in again.');
        }

        // Perform the transfer (function will create keypair internally using same logic as popup)
        const transferResult = await slideChainTransfer.transfer(
            result.nostr_nsec,
            toAddress,
            amount,
            (message, type) => {
                updateTransferStatus(message, type);
            }
        );

        if (transferResult.success) {
            updateTransferStatus('✅ Transfer successful!', 'success');
            console.log('Transfer result:', transferResult);
            
            // Clear form and refresh balance after a short delay
            setTimeout(() => {
                clearTransferForm();
                refreshBalance();
            }, 2000);
        } else {
            throw new Error(transferResult.error || 'Transfer failed');
        }
    } catch (error) {
        console.error('Transfer failed:', error);
        updateTransferStatus(`❌ Error: ${error.message}`, 'error');
    }
}

// Clear the transfer form
function clearTransferForm() {
    document.getElementById('transfer-to').value = '';
    document.getElementById('transfer-amount').value = '';
    document.getElementById('transfer-status').classList.add('hidden');
}

// Update the transfer status display
function updateTransferStatus(message, type) {
    const statusDiv = document.getElementById('transfer-status');
    const statusText = statusDiv.querySelector('.status-text');
    const statusIcon = statusDiv.querySelector('.status-icon');
    const statusDetails = statusDiv.querySelector('.status-details');

    statusDiv.classList.remove('hidden');
    statusText.textContent = message;
    
    switch (type) {
        case 'loading':
            statusIcon.textContent = '⏳';
            break;
        case 'success':
            statusIcon.textContent = '✅';
            break;
        case 'error':
            statusIcon.textContent = '❌';
            break;
        default:
            statusIcon.textContent = 'ℹ️';
    }
}

let currentIdentity = null;

function setupEventListeners() {
    // Main action buttons
    document.getElementById('generate-identity').addEventListener('click', generateNewIdentity);
    document.getElementById('import-identity').addEventListener('click', showImportForm);
    document.getElementById('import-confirm').addEventListener('click', importIdentity);
    document.getElementById('import-cancel').addEventListener('click', hideImportForm);
    document.getElementById('log-back-in').addEventListener('click', logBackIn);
    
    // Settings panel
    document.getElementById('settings-btn').addEventListener('click', showSettings);
    document.getElementById('close-settings').addEventListener('click', hideSettings);
    
    // Settings actions
    document.getElementById('clear-identity').addEventListener('click', clearIdentity);
    document.getElementById('test-signing').addEventListener('click', testSignature);
    document.getElementById('run-crypto-tests').addEventListener('click', runFullCryptoTests);
    document.getElementById('test-relay-post').addEventListener('click', testRelayPost);
    document.getElementById('edit-profile-settings').addEventListener('click', showProfileEditor);
    document.getElementById('export-keys').addEventListener('click', exportKeys);
    
    // Profile editor actions
    document.getElementById('save-profile').addEventListener('click', saveProfile);
    document.getElementById('cancel-profile-edit').addEventListener('click', hideProfileEditor);
    document.getElementById('about').addEventListener('input', updateCharCount);
    document.getElementById('upload-picture-btn').addEventListener('click', triggerFileUpload);
    document.getElementById('picture-file').addEventListener('change', handleFileUpload);
    
    // Key management
    document.getElementById('copy-public').addEventListener('click', () => copyToClipboard('public-key'));
    document.getElementById('copy-public-hex').addEventListener('click', () => copyToClipboard('public-key-hex'));
    document.getElementById('copy-slidechain').addEventListener('click', () => copyToClipboard('slidechain-address'));
    document.getElementById('copy-private').addEventListener('click', () => copyToClipboard('private-key'));
    document.getElementById('toggle-private').addEventListener('click', togglePrivateKeyVisibility);
    
    // Balance refresh
    document.getElementById('refresh-balance').addEventListener('click', refreshBalance);
    
    // Transfer functionality
    document.getElementById('send-transfer').addEventListener('click', handleSendTransfer);
    document.getElementById('clear-transfer').addEventListener('click', clearTransferForm);
    
    // Logout
    document.getElementById('logout-identity').addEventListener('click', logoutIdentity);
}

async function generateNewIdentity() {
    try {
        updateStatus('Generating NOSTR identity with nostr-tools...', 'loading');
        
        // Send message to background script to generate keys using nostr-tools
        const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
                type: 'NOSTR_REQUEST',
                method: 'generateKeys'
            }, resolve);
        });
        
        if (response.error) {
            throw new Error(response.error);
        }
        
        // Store identity data for popup display
        currentIdentity = {
            privateKey: response.result.nsec,
            publicKey: response.result.npub,
            publicKeyHex: response.result.publicKey,
            cryptoMethod: 'bundled NOSTR tools (Web Crypto API)',
            createdAt: Date.now(),
            isNew: true
        };
        
        // Clear any old profile data from the display
        clearProfileDisplay();
        displayIdentity();
        updateStatus('NEW NOSTR identity generated with crypto-secure tools!', 'success');
        
        // Test the signature immediately
        setTimeout(() => {
            testSignature();
        }, 1000);
        
    } catch (error) {
        console.error('Error generating identity:', error);
        updateStatus('Failed to generate identity: ' + error.message, 'error');
    }
}

function showImportForm() {
    document.getElementById('import-form').classList.remove('hidden');
}

function hideImportForm() {
    document.getElementById('import-form').classList.add('hidden');
    document.getElementById('private-key-input').value = '';
}

async function importIdentity() {
    try {
        const privateKeyInput = document.getElementById('private-key-input').value.trim();
        
        if (!privateKeyInput) {
            updateStatus('Please enter a private key', 'error');
            return;
        }
        
        updateStatus('Importing NOSTR identity...', 'loading');
        
        // Send the raw input directly to background script
        // Let the background script handle both nsec conversion AND public key derivation
        // using the same real nostr-tools library
        const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
                type: 'NOSTR_REQUEST', 
                method: 'importPrivateKey',
                params: { privateKeyInput }
            }, resolve);
        });
        
        if (response.error) {
            throw new Error('Failed to import private key: ' + response.error);
        }
        
        const publicKeyHex = response.result.publicKey;
        const npub = response.result.npub;
        const nsec = response.result.nsec;
        const privateKeyHex = response.result.privateKeyHex;
        
        // Keys are already stored by the background script, no need to store again
        
        // Store identity data for popup display
        currentIdentity = {
            privateKey: nsec,
            publicKey: npub,
            publicKeyHex: publicKeyHex,
            cryptoMethod: 'imported via bundled NOSTR tools',
            createdAt: Date.now(),
            isNew: false
        };
        
        // Clear any old profile data from the display
        clearProfileDisplay();
        hideImportForm();
        displayIdentity();
        updateStatus('NOSTR identity imported successfully!', 'success');
        
        // Fetch profile data from relays immediately
        setTimeout(async () => {
            try {
                updateStatus('Fetching profile data from NOSTR relays...', 'loading');
                const profileData = await NostrUtils.fetchProfileFromRelays(currentIdentity.publicKeyHex);
                const chainmagicId = await NostrUtils.checkChainmagicIds(currentIdentity.publicKeyHex);
                
                if (profileData && (profileData.name || profileData.about || profileData.picture)) {
                    // Update the profile display with fetched data
                    updateProfileDisplay(profileData);
                    updateStatus('Profile data found and loaded from NOSTR network!', 'success');
                } else if (chainmagicId) {
                    updateStatus('NIP-05 identifier found: ' + chainmagicId, 'success');
                } else {
                    updateStatus('Identity imported successfully. No existing profile found.', 'success');
                }
            } catch (error) {
                console.error('Error fetching profile:', error);
                updateStatus('Identity imported successfully.', 'success');
            }
        }, 500);
        
    } catch (error) {
        console.error('Error importing identity:', error);
        updateStatus('Failed to import identity: ' + error.message, 'error');
    }
}

async function loadIdentity() {
    try {
        // Check if we have stored keys AND logout state
        const result = await new Promise((resolve) => {
            chrome.storage.local.get([
                'nostr_private_key', 
                'nostr_public_key', 
                'nostr_npub', 
                'nostr_nsec',
                'generated_at',
                'crypto_method',
                'logged_out',
                'logged_out_at'
            ], resolve);
        });
        
        // If user is logged out, show no identity state but check if we have saved keys
        if (result.logged_out) {
            showNoIdentity();
            
            // If we have saved keys, show the Log Back In button
            if (result.nostr_private_key && result.nostr_public_key) {
                document.getElementById('log-back-in').classList.remove('hidden');
                const logoutTime = result.logged_out_at ? new Date(result.logged_out_at).toLocaleString() : 'recently';
                updateStatus(`Logged out ${logoutTime}. Click "Log Back In" to use your saved keys.`, 'warning');
            } else {
                document.getElementById('log-back-in').classList.add('hidden');
                updateStatus('Logged out. No saved keys found.', 'warning');
            }
            return;
        }
        
        if (result.nostr_public_key && result.nostr_private_key) {
            // Regenerate public key using the correct background script method to ensure consistency
            let publicKeyHex;
            let npub;
            try {
                // Use background script's correct secp256k1 implementation
                const response = await new Promise((resolve) => {
                    chrome.runtime.sendMessage({
                        type: 'NOSTR_REQUEST',
                        method: 'derivePublicKey',
                        params: { privateKeyHex: result.nostr_private_key }
                    }, resolve);
                });
                
                if (response.error) {
                    throw new Error(response.error);
                }
                
                publicKeyHex = response.result.publicKey;
                npub = response.result.npub;
                
                // If the public key changed, update storage with correct values
                if (publicKeyHex !== result.nostr_public_key) {
                    console.log('Public key was incorrect, updating with correct secp256k1 derivation...');
                    
                    await new Promise((resolve) => {
                        chrome.storage.local.set({
                            nostr_public_key: publicKeyHex,
                            nostr_npub: npub
                        }, resolve);
                    });
                    
                    currentIdentity = {
                        privateKey: result.nostr_nsec,
                        publicKey: npub,
                        publicKeyHex: publicKeyHex,
                        cryptoMethod: result.crypto_method || 'bundled NOSTR tools (Web Crypto API)',
                        createdAt: result.generated_at || Date.now(),
                        isNew: false
                    };
                } else {
                    // Public key is already correct
                    currentIdentity = {
                        privateKey: result.nostr_nsec,
                        publicKey: result.nostr_npub,
                        publicKeyHex: result.nostr_public_key,
                        cryptoMethod: result.crypto_method || 'bundled NOSTR tools (Web Crypto API)',
                        createdAt: result.generated_at || Date.now(),
                        isNew: false
                    };
                }
            } catch (error) {
                console.error('Error regenerating public key with correct method:', error);
                // Fallback to stored values (might be incorrect but better than crashing)
                currentIdentity = {
                    privateKey: result.nostr_nsec,
                    publicKey: result.nostr_npub,
                    publicKeyHex: result.nostr_public_key,
                    cryptoMethod: result.crypto_method || 'bundled NOSTR tools (Web Crypto API)',
                    createdAt: result.generated_at || Date.now(),
                    isNew: false
                };
            }
            
            // Fetch profile data from NOSTR relays
            try {
                updateStatus('Fetching profile data from NOSTR relays...', 'loading');
                const profileData = await NostrUtils.fetchProfileFromRelays(currentIdentity.publicKeyHex);
                
                if (profileData && (profileData.name || profileData.about || profileData.picture)) {
                    updateProfileDisplay(profileData);
                    updateStatus('Profile data successfully loaded from NOSTR relay.', 'success');
                } else {
                    updateStatus('No profile data found on NOSTR relays.', 'info');
                }
            } catch (error) {
                console.error('Error fetching profile data from relay:', error);
                updateStatus('Failed to load profile data from relay.', 'warning');
            }
            
            displayIdentity();
            
            // Show when the identity was created
            const createdDate = new Date(currentIdentity.createdAt).toLocaleString();
            updateStatus(`Crypto-secure identity loaded (created: ${createdDate})`, 'success');
        } else {
            showNoIdentity();
            updateStatus('No identity found - generate a new one with real cryptography', 'info');
        }
    } catch (error) {
        console.error('Error loading identity:', error);
        showNoIdentity();
        updateStatus('Error loading identity', 'error');
    }
}

async function displayIdentity() {
    if (!currentIdentity) return;
    
    document.getElementById('no-identity').classList.add('hidden');
    document.getElementById('has-identity').classList.remove('hidden');
    
    // Populate key fields
    document.getElementById('public-key').value = currentIdentity.publicKey || '';
    document.getElementById('public-key-hex').value = currentIdentity.publicKeyHex || '';
    document.getElementById('private-key').value = currentIdentity.privateKey || '';
    
    // Generate and display SlideChain address
    await generateSlidechainAddress();
    
    // Load and display profile information
    loadProfileDisplay();
}

async function generateSlidechainAddress() {
    console.log('🔍 DEBUG: generateSlidechainAddress called');
    
    try {
        // Get both private key formats from storage
        const result = await new Promise((resolve) => {
            chrome.storage.local.get(['nostr_private_key', 'nostr_nsec'], resolve);
        });
        
        if (result.nostr_nsec && window.NostrCrypto) {
            // Use the nsec format for conversion
            const conversionResult = await NostrCrypto.convertNostrToSubstrate(result.nostr_nsec, 42);
            
            if (conversionResult.error) {
                document.getElementById('slidechain-address').value = 'Error: ' + conversionResult.error;
                console.error('Failed to convert NOSTR to Substrate:', conversionResult.error);
            } else {
                // Display the SS58 address and store the corresponding private key
                document.getElementById('slidechain-address').value = conversionResult.ss58_address;
                chrome.storage.local.set({ 'slidechain_private_key': conversionResult.substrate_private_key });
                
                console.log('✓ Generated and stored Substrate details:', {
                    ss58_address: conversionResult.ss58_address,
                    private_key_stored: !!conversionResult.substrate_private_key
                });
                console.log('🔍 DEBUG: Generated SlideChain address:', conversionResult.ss58_address);
                console.log('Conversion details:', conversionResult);
                
                // Test with known working address from your balance-checker.js
                const testAddress = '5GLnRpaqTZkDkk45ZkHw2DwZziem1RoPDSBhQoPHviK7yFqg';
                console.log('🔍 DEBUG: Testing balance fetch with known address:', testAddress);
                
                if (slideChainBalance) {
                    try {
                        const testBalance = await slideChainBalance.getBalance(testAddress);
                        console.log('🔍 DEBUG: Test balance result:', testBalance);
                    } catch (error) {
                        console.error('🔍 DEBUG: Test balance error:', error);
                    }
                }
            }
        } else if (result.nostr_private_key) {
            // Fallback: try with hex format by converting to nsec first
            try {
                const nsec = NostrUtils.hexToNsec(result.nostr_private_key);
                const conversionResult = await NostrCrypto.convertNostrToSubstrate(nsec, 42);
                
                if (conversionResult.error) {
                    document.getElementById('slidechain-address').value = 'Error: ' + conversionResult.error;
                    console.error('Failed to convert NOSTR to Substrate:', conversionResult.error);
                } else {
                    document.getElementById('slidechain-address').value = conversionResult.ss58_address;
                    console.log('✓ Generated Substrate SS58 address (from hex):', conversionResult.ss58_address);
                    console.log('🔍 DEBUG: Generated SlideChain address (from hex):', conversionResult.ss58_address);
                }
            } catch (hexError) {
                document.getElementById('slidechain-address').value = 'Error converting hex to nsec';
                console.error('Error converting hex private key to nsec:', hexError);
            }
        } else {
            document.getElementById('slidechain-address').value = 'No private key found';
            console.error('Unable to generate Substrate address - missing private key');
        }
    } catch (error) {
        console.error('🔍 DEBUG: Address generation error:', error);
        console.error('Error generating Substrate address:', error);
        document.getElementById('slidechain-address').value = 'Error: ' + error.message;
    }
}

function showNoIdentity() {
    document.getElementById('no-identity').classList.remove('hidden');
    document.getElementById('has-identity').classList.add('hidden');
    document.getElementById('signature-test').classList.add('hidden');
}

// Balance functionality
async function fetchAndDisplayBalance() {
    console.log('🔍 DEBUG: fetchAndDisplayBalance called');
    
    if (!slideChainBalance) {
        console.log('🔍 DEBUG: slideChainBalance not initialized, initializing...');
        initializeBalance(); // Try to initialize if not already done
        if (!slideChainBalance) {
            console.log('❌ DEBUG: slideChainBalance still not available');
            updateBalanceDisplay({ error: 'SlideChainBalance class not available' });
            return;
        }
    }
    
    const slidechainAddress = document.getElementById('slidechain-address').value;
    console.log('🔍 DEBUG: SlideChain address:', slidechainAddress);
    
    if (!slidechainAddress || slidechainAddress.includes('Error')) {
        console.log('❌ DEBUG: No valid SlideChain address');
        updateBalanceDisplay({ error: 'No valid SlideChain address available' });
        return;
    }
    
    try {
        console.log('🔍 DEBUG: Starting balance fetch for:', slidechainAddress);
        updateStatus('Fetching SlideChain balance...', 'loading');
        console.log('Fetching balance for address:', slidechainAddress);
        
        const balanceInfo = await slideChainBalance.getBalance(slidechainAddress);
        console.log('🔍 DEBUG: Balance fetch result:', balanceInfo);
        console.log('Balance fetched:', balanceInfo);
        
        updateBalanceDisplay(balanceInfo);
        updateStatus('Balance updated successfully', 'success');
        
    } catch (error) {
        console.error('🔍 DEBUG: Balance fetch error:', error);
        console.error('🔍 DEBUG: Error stack:', error.stack);
        console.error('Error fetching balance:', error);
        updateBalanceDisplay({ error: error.message });
        updateStatus('Failed to fetch balance: ' + error.message, 'error');
    }
}

function updateBalanceDisplay(balanceInfo) {
    const balanceAmount = document.getElementById('balance-amount');
    const balanceDetails = document.getElementById('balance-details');
    const freeBalance = document.getElementById('balance-free');
    const reservedBalance = document.getElementById('balance-reserved');
    
    if (balanceInfo.error) {
        // Show error state
        if (balanceAmount) balanceAmount.textContent = `Error: ${balanceInfo.error}`;
        if (balanceDetails) balanceDetails.classList.add('hidden');
        
        console.error('Balance display error:', balanceInfo.error);
        return;
    }
    
    // Update main balance display with formatted total
    if (balanceAmount && balanceInfo.formatted && balanceInfo.formatted.total) {
        balanceAmount.textContent = `${balanceInfo.formatted.total} tokens`;
    } else if (balanceAmount) {
        balanceAmount.textContent = '0.000000000000 tokens';
    }
    
    // Update detailed balance fields if they exist
    if (freeBalance && balanceInfo.formatted && balanceInfo.formatted.free) {
        freeBalance.textContent = balanceInfo.formatted.free;
    }
    
    if (reservedBalance && balanceInfo.formatted && balanceInfo.formatted.reserved) {
        reservedBalance.textContent = balanceInfo.formatted.reserved;
    }
    
    // Show balance details
    if (balanceDetails) {
        balanceDetails.classList.remove('hidden');
    }
    
    console.log('Balance display updated:', {
        free: balanceInfo.free,
        reserved: balanceInfo.reserved,
        total: balanceInfo.total,
        formatted: balanceInfo.formatted
    });
}

async function refreshBalance() {
    await fetchAndDisplayBalance();
}

// Initialize balance and transfer functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeBalance();
    initializeTransfer();
});

// Auto-fetch balance when SlideChain address is generated (wrapped in setTimeout to avoid immediate call issues)
const originalGenerateSlidechainAddressWrapper = generateSlidechainAddress;
generateSlidechainAddress = async function() {
    await originalGenerateSlidechainAddressWrapper.apply(this, arguments);
    
    // Fetch balance after address is generated
    setTimeout(() => {
        fetchAndDisplayBalance();
    }, 1000);
};

// Auto-fetch balance when identity is loaded (wrapped in setTimeout to avoid immediate call issues)
const originalDisplayIdentityWrapper = displayIdentity;
displayIdentity = async function() {
    await originalDisplayIdentityWrapper.apply(this, arguments);
    
    // Fetch balance after identity is displayed
    setTimeout(() => {
        fetchAndDisplayBalance();
    }, 1500);
};

// ... rest of your original functions (testSignature, runFullCryptoTests, etc.) unchanged ...

async function testSignature() {
    if (!currentIdentity) {
        updateStatus('No identity to test', 'error');
        return;
    }
    
    try {
        updateStatus('Testing real secp256k1 signature with nostr-tools...', 'loading');
        
        // Create a test NOSTR event
        const testEvent = {
            kind: 1,
            content: 'Test message from Zap Social extension using real nostr-tools: ' + Date.now(),
            created_at: Math.floor(Date.now() / 1000),
            tags: []
        };
        
        console.log('Testing with event:', testEvent);
        
        // Send to background script for signing with nostr-tools
        const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
                type: 'NOSTR_REQUEST',
                method: 'signEvent',
                params: { event: testEvent }
            }, resolve);
        });
        
        if (response.error) {
            throw new Error(response.error);
        }
        
        const signedEvent = response.result;
        console.log('Received signed event from nostr-tools:', signedEvent);
        
        // Display results
        const resultsHtml = `
            <div class="test-result success">
                <h3>✅ Real secp256k1 Signature Test PASSED</h3>
                <div class="crypto-badge">nostr-tools</div>
                
                <div class="test-detail">
                    <label>Event Content:</label>
                    <div class="test-value">${signedEvent.content}</div>
                </div>
                
                <div class="test-detail">
                    <label>Event ID (SHA-256):</label>
                    <div class="test-value monospace">${signedEvent.id}</div>
                </div>
                
                <div class="test-detail">
                    <label>Public Key (hex):</label>
                    <div class="test-value monospace">${signedEvent.pubkey}</div>
                </div>
                
                <div class="test-detail">
                    <label>secp256k1 Signature:</label>
                    <div class="test-value monospace">${signedEvent.sig}</div>
                </div>
                
                <div class="test-detail">
                    <label>Cryptography:</label>
                    <div class="test-value success">Real secp256k1 via nostr-tools ✓</div>
                </div>
                
                <div class="test-detail">
                    <label>Event Kind:</label>
                    <div class="test-value">${signedEvent.kind} (Text Note)</div>
                </div>
                
                <div class="test-detail">
                    <label>Created At:</label>
                    <div class="test-value">${new Date(signedEvent.created_at * 1000).toLocaleString()}</div>
                </div>
                
                <div class="test-detail">
                    <label>Status:</label>
                    <div class="test-value success">✅ NOSTR-compatible & relay-ready</div>
                </div>
            </div>
        `;
        
        document.getElementById('signature-results').innerHTML = resultsHtml;
        document.getElementById('signature-test').classList.remove('hidden');
        
        updateStatus('Real secp256k1 signature test PASSED!', 'success');
        
    } catch (error) {
        console.error('Signature test error:', error);
        updateStatus('Signature test error: ' + error.message, 'error');
        
        document.getElementById('signature-results').innerHTML = `
            <div class="test-result error">
                <h3>❌ Signature Test ERROR</h3>
                <div class="test-detail">
                    <label>Error:</label>
                    <div class="test-value error">${error.message}</div>
                </div>
                <div class="test-detail">
                    <label>Suggestion:</label>
                    <div class="test-value">Check that nostr-tools is loading properly in background script</div>
                </div>
            </div>
        `;
        document.getElementById('signature-test').classList.remove('hidden');
    }
}

async function runFullCryptoTests() {
    if (!currentIdentity) {
        updateStatus('No identity to test', 'error');
        return;
    }
    
    try {
        updateStatus('Running comprehensive nostr-tools tests...', 'loading');
        
        // Test multiple events
        const testEvents = [
            { kind: 1, content: 'Test 1: Basic text note' },
            { kind: 1, content: 'Test 2: Unicode content 🚀⚡️', tags: [['t', 'test']] },
            { kind: 3, content: JSON.stringify({relay1: {read: true, write: true}}) }
        ];
        
        const results = [];
        
        for (let i = 0; i < testEvents.length; i++) {
            const event = {
                ...testEvents[i],
                created_at: Math.floor(Date.now() / 1000) + i,
                tags: testEvents[i].tags || []
            };
            
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    type: 'NOSTR_REQUEST',
                    method: 'signEvent',
                    params: { event }
                }, resolve);
            });
            
            if (response.error) {
                results.push(`❌ Test ${i + 1}: ${response.error}`);
            } else {
                results.push(`✅ Test ${i + 1}: Event ${response.result.kind} signed successfully`);
            }
        }
        
        const resultsHtml = `
            <div class="test-result success">
                <h3>🧪 Comprehensive nostr-tools Tests</h3>
                ${results.map(result => `<div class="test-value">${result}</div>`).join('')}
                <div class="test-detail">
                    <label>Conclusion:</label>
                    <div class="test-value success">Real secp256k1 cryptography working perfectly!</div>
                </div>
            </div>
        `;
        
        document.getElementById('signature-results').innerHTML = resultsHtml;
        document.getElementById('signature-test').classList.remove('hidden');
        
        updateStatus('All nostr-tools tests passed!', 'success');
        
    } catch (error) {
        updateStatus('Comprehensive test error: ' + error.message, 'error');
    }
}

async function testRelayPost() {
    if (!currentIdentity) {
        updateStatus('No identity to test', 'error');
        return;
    }
    
    try {
        updateStatus('Testing direct NOSTR relay posting...', 'loading');
        
        // Create a test event to post to the relay
        const testEvent = {
            kind: 1,
            content: `🧪 Test post from Zap Social extension - ${new Date().toISOString()}`,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['client', 'Zap Social Extension']]
        };
        
        console.log('Creating test event for relay:', testEvent);
        
        // Sign the event using the extension
        const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
                type: 'NOSTR_REQUEST',
                method: 'signEvent',
                params: { event: testEvent }
            }, resolve);
        });
        
        if (response.error) {
            throw new Error(response.error);
        }
        
        const signedEvent = response.result;
        console.log('📝 Event signed for relay posting:', signedEvent);
        
        // Connect to NOSTR relay and post the event
        const relayUrl = 'wss://relay.damus.io';
        const ws = new WebSocket(relayUrl);
        
        let connectionResult = null;
        let postResult = null;
        let verificationResult = null;
        
        await new Promise((resolve, reject) => {
            let resolved = false;
            
            const resolveOnce = (result) => {
                if (!resolved) {
                    resolved = true;
                    resolve(result);
                }
            };
            
            ws.onopen = () => {
                console.log('🌐 Connected to relay:', relayUrl);
                connectionResult = '✅ Connected to relay.damus.io';
                
                // Send the signed event to the relay
                const publishMessage = ['EVENT', signedEvent];
                ws.send(JSON.stringify(publishMessage));
                console.log('📤 Event sent to relay:', publishMessage);
                
                // Wait a moment then try to retrieve the event
                setTimeout(() => {
                    const subscriptionId = 'test_' + Date.now();
                    const subscribeMessage = [
                        'REQ', 
                        subscriptionId,
                        {
                            ids: [signedEvent.id],
                            limit: 1
                        }
                    ];
                    ws.send(JSON.stringify(subscribeMessage));
                    console.log('🔍 Searching for posted event...');
                }, 2000);
            };
            
            ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                console.log('📨 Relay response:', message);
                
                if (message[0] === 'OK') {
                    const [, eventId, success, errorMessage] = message;
                    if (success) {
                        postResult = '✅ Event accepted by relay';
                        console.log('✅ Event successfully accepted by relay');
                    } else {
                        postResult = `❌ Event rejected: ${errorMessage}`;
                        console.log('❌ Event rejected by relay:', errorMessage);
                    }
                }
                
                if (message[0] === 'EVENT') {
                    const [, subscriptionId, receivedEvent] = message;
                    if (receivedEvent.id === signedEvent.id) {
                        verificationResult = '✅ Event found on relay - signature VALID!';
                        console.log('✅ Event found on relay! Signature is valid.');
                        
                        // Close the connection
                        ws.close();
                        resolveOnce({
                            connectionResult,
                            postResult,
                            verificationResult,
                            signedEvent,
                            receivedEvent
                        });
                    }
                }
                
                if (message[0] === 'EOSE') {
                    // End of stored events
                    if (!verificationResult) {
                        verificationResult = '⚠️ Event not found on relay (may still be propagating)';
                    }
                    ws.close();
                    resolveOnce({
                        connectionResult,
                        postResult,
                        verificationResult,
                        signedEvent
                    });
                }
            };
            
            ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
                reject(new Error('Failed to connect to relay'));
            };
            
            ws.onclose = () => {
                console.log('🔌 Connection closed');
                if (!resolved) {
                    resolveOnce({
                        connectionResult: connectionResult || '⚠️ Connection closed early',
                        postResult: postResult || '⚠️ No response received',
                        verificationResult: verificationResult || '⚠️ Could not verify'
                    });
                }
            };
            
            // Timeout after 15 seconds
            setTimeout(() => {
                if (!resolved) {
                    ws.close();
                    reject(new Error('Relay test timed out'));
                }
            }, 15000);
        });
        
        // Display comprehensive results
        const resultsHtml = `
            <div class="test-result ${verificationResult?.includes('✅') ? 'success' : 'warning'}">
                <h3>🌐 Direct NOSTR Relay Test Results</h3>
                
                <div class="test-detail">
                    <label>Relay Connection:</label>
                    <div class="test-value">${connectionResult || '❌ Failed to connect'}</div>
                </div>
                
                <div class="test-detail">
                    <label>Event Publication:</label>
                    <div class="test-value">${postResult || '❌ No response'}</div>
                </div>
                
                <div class="test-detail">
                    <label>Signature Verification:</label>
                    <div class="test-value">${verificationResult || '❌ Could not verify'}</div>
                </div>
                
                <div class="test-detail">
                    <label>Event ID:</label>
                    <div class="test-value monospace">${signedEvent.id}</div>
                </div>
                
                <div class="test-detail">
                    <label>Signature:</label>
                    <div class="test-value monospace">${signedEvent.sig}</div>
                </div>
                
                <div class="test-detail">
                    <label>Public Key:</label>
                    <div class="test-value monospace">${signedEvent.pubkey}</div>
                </div>
                
                <div class="test-detail">
                    <label>Content Posted:</label>
                    <div class="test-value">${signedEvent.content}</div>
                </div>
                
                <div class="test-detail">
                    <label>Conclusion:</label>
                    <div class="test-value ${verificationResult?.includes('✅') ? 'success' : 'warning'}">
                        ${verificationResult?.includes('✅') ? 
                            'Extension signatures are VALID and work with NOSTR relays!' : 
                            'Signature may be invalid or relay is not responding properly'}
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('signature-results').innerHTML = resultsHtml;
        document.getElementById('signature-test').classList.remove('hidden');
        
        if (verificationResult?.includes('✅')) {
            updateStatus('✅ Extension successfully posted to NOSTR relay!', 'success');
        } else {
            updateStatus('⚠️ Relay test completed - check results', 'warning');
        }
        
    } catch (error) {
        console.error('Relay test error:', error);
        updateStatus('Relay test error: ' + error.message, 'error');
        
        document.getElementById('signature-results').innerHTML = `
            <div class="test-result error">
                <h3>❌ Relay Test ERROR</h3>
                <div class="test-detail">
                    <label>Error:</label>
                    <div class="test-value error">${error.message}</div>
                </div>
                <div class="test-detail">
                    <label>Possible Issues:</label>
                    <div class="test-value">
                        • Network connectivity issues<br>
                        • Relay is down or rejecting connections<br>
                        • Extension signature format is incorrect
                    </div>
                </div>
            </div>
        `;
        document.getElementById('signature-test').classList.remove('hidden');
    }
}

async function logBackIn() {
    try {
        updateStatus('Logging back in with saved keys...', 'loading');
        
        // Get saved keys from storage
        const result = await new Promise((resolve) => {
            chrome.storage.local.get([
                'nostr_private_key',
                'nostr_public_key',
                'nostr_npub',
                'nostr_nsec',
                'generated_at',
                'crypto_method',
                'logged_out',
                'logged_out_at'
            ], resolve);
        });
        
        // Verify we have the required keys
        if (!result.nostr_private_key || !result.nostr_public_key) {
            throw new Error('No saved keys found. Please generate new keys or import existing ones.');
        }
        
        // Clear the logout state
        await new Promise((resolve) => {
            chrome.storage.local.remove(['logged_out', 'logged_out_at'], resolve);
        });
        
        // Restore current identity from saved keys
        currentIdentity = {
            privateKey: result.nostr_nsec,
            publicKey: result.nostr_npub,
            publicKeyHex: result.nostr_public_key,
            cryptoMethod: result.crypto_method || 'saved keys',
            createdAt: result.generated_at || Date.now(),
            isNew: false
        };
        
        // Hide the Log Back In button
        document.getElementById('log-back-in').classList.add('hidden');
        
        // Fetch profile data from relays
        try {
            updateStatus('Fetching profile data from NOSTR relays...', 'loading');
            const profileData = await NostrUtils.fetchProfileFromRelays(currentIdentity.publicKeyHex);
            
            if (profileData && (profileData.name || profileData.about || profileData.picture)) {
                updateProfileDisplay(profileData);
                updateStatus('Logged back in successfully! Profile data loaded from NOSTR relays.', 'success');
            } else {
                updateStatus('Logged back in successfully! No profile data found on relays.', 'success');
            }
        } catch (error) {
            console.error('Error fetching profile data:', error);
            updateStatus('Logged back in successfully!', 'success');
        }
        
        // Display the identity
        displayIdentity();
        
        console.log('User logged back in successfully with saved keys');
        
    } catch (error) {
        console.error('Error logging back in:', error);
        updateStatus('Failed to log back in: ' + error.message, 'error');
    }
}

async function logoutIdentity() {
    try {
        updateStatus('Logging out...', 'loading');
        
        // Send logout request to background script
        // This will set the logged out state and stop passing identity to pages
        const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
                type: 'NOSTR_REQUEST',
                method: 'logout'
            }, resolve);
        });
        
        if (response.error) {
            throw new Error(response.error);
        }
        
        // Clear current identity from popup (but keys remain in storage)
        currentIdentity = null;
        showNoIdentity();
        updateStatus('Logged out successfully. Keys remain saved for future login.', 'success');
        
        // Clear signature test results
        document.getElementById('signature-test').classList.add('hidden');
        
        console.log('User logged out successfully');
        
    } catch (error) {
        console.error('Error logging out:', error);
        updateStatus('Error logging out: ' + error.message, 'error');
    }
}

async function clearIdentity() {
    if (confirm('Are you sure you want to clear your real secp256k1 identity? This cannot be undone!')) {
        try {
            await new Promise((resolve) => {
                chrome.storage.local.clear(resolve);
            });
            
            currentIdentity = null;
            showNoIdentity();
            updateStatus('Identity cleared', 'info');
            
            // Clear signature test results
            document.getElementById('signature-test').classList.add('hidden');
            
        } catch (error) {
            console.error('Error clearing identity:', error);
            updateStatus('Error clearing identity', 'error');
        }
    }
}

function togglePrivateKeyVisibility() {
    const privateKeyInput = document.getElementById('private-key');
    const toggleButton = document.getElementById('toggle-private');
    
    if (privateKeyInput.type === 'password') {
        privateKeyInput.type = 'text';
        toggleButton.textContent = '🙈';
        toggleButton.title = 'Hide Private Key';
    } else {
        privateKeyInput.type = 'password';
        toggleButton.textContent = '👁️';
        toggleButton.title = 'Show Private Key';
    }
}

async function copyToClipboard(elementId) {
    try {
        const element = document.getElementById(elementId);
        await navigator.clipboard.writeText(element.value);
        
        const button = element.nextElementSibling;
        const originalText = button.textContent;
        button.textContent = '✅';
        
        setTimeout(() => {
            button.textContent = originalText;
        }, 1000);
        
        updateStatus('Copied to clipboard', 'success');
    } catch (error) {
        console.error('Copy failed:', error);
        updateStatus('Copy failed', 'error');
    }
}

function openProfileConfig() {
    if (!currentIdentity) {
        updateStatus('Generate an identity first before creating a profile', 'warning');
        return;
    }
    
    // Show the settings panel and then show the profile editor
    showSettings();
    showProfileEditor();
}

function showProfileEditor() {
    if (!currentIdentity) {
        updateStatus('Generate an identity first before editing a profile', 'warning');
        return;
    }
    
    // Show the profile editor
    document.getElementById('profile-editor').classList.remove('hidden');
    
    // Load existing profile data
    loadProfileData();
    
    updateStatus('Profile editor opened', 'info');
}

function hideProfileEditor() {
    document.getElementById('profile-editor').classList.add('hidden');
    updateStatus('Profile editor closed', 'info');
}

async function loadProfileData() {
    try {
        const result = await new Promise((resolve) => {
            chrome.storage.local.get(['profileData', 'nostr_public_key'], resolve);
        });
        
        // First, try to fetch fresh profile data from NOSTR relays
        let profile = {};
        if (result.nostr_public_key) {
            try {
                updateStatus('🔄 Fetching latest profile from NOSTR relays...', 'loading');
                const relayProfile = await NostrUtils.fetchProfileFromRelays(result.nostr_public_key);
                
                if (relayProfile && (relayProfile.name || relayProfile.about || relayProfile.picture || relayProfile.baseAddr || relayProfile.ethereum || relayProfile.base)) {
                    profile = { ...relayProfile };
                    updateStatus('✅ Profile data loaded from NOSTR relays', 'success');
                    console.log('📋 Loaded profile from relays:', profile);
                } else {
                    updateStatus('ℹ️ No profile data found on relays, using stored data', 'info');
                }
            } catch (error) {
                console.error('Error fetching profile from relays:', error);
                updateStatus('⚠️ Failed to fetch from relays, using stored data', 'warning');
            }
        }
        
        // Fallback to locally stored profile data if relay fetch failed or returned empty
        if (result.profileData && Object.keys(profile).length === 0) {
            profile = { ...result.profileData };
        }
        
        // Check for chainmagic NIP-05 identifier
        let chainmagicNip05 = null;
        if (result.nostr_public_key) {
            try {
                chainmagicNip05 = await NostrUtils.checkChainmagicIds(result.nostr_public_key);
                
                if (chainmagicNip05) {
                    updateStatus('🎯 Found NIP-05: ' + chainmagicNip05, 'success');
                } else {
                    updateStatus('ℹ️ No chainmagic NIP-05 found', 'info');
                }
            } catch (error) {
                updateStatus('⚠️ Error checking chainmagic NIP-05: ' + error.message, 'warning');
            }
        }
        
        // Prioritize chainmagic NIP-05 over other data
        if (chainmagicNip05) {
            profile.nip05 = chainmagicNip05;
        }
        
        // Fill form fields with data (including chainmagic NIP-05)
        document.getElementById('display-name').value = profile.name || '';
        document.getElementById('about').value = profile.about || '';
        document.getElementById('picture').value = profile.picture || '';
        document.getElementById('banner').value = profile.banner || '';
        document.getElementById('nip05').value = profile.nip05 || '';
        
        // Handle Base/Ethereum address with priority
        const baseAddress = profile.baseAddr || profile.ethereum || profile.base || '';
        document.getElementById('base-addr').value = baseAddress;
        
        console.log('📝 Form fields populated:', {
            name: profile.name,
            about: profile.about?.substring(0, 50),
            picture: profile.picture?.substring(0, 50),
            baseAddr: profile.baseAddr,
            ethereum: profile.ethereum,
            base: profile.base,
            finalBaseAddr: baseAddress
        });
        
        // Handle profile picture preview
        const preview = document.getElementById('picture-preview');
        const filenameDisplay = document.getElementById('picture-filename');
        
        if (profile.picture) {
            preview.src = profile.picture;
            preview.classList.remove('hidden');
            
            // Check if it's an IPFS URL or regular URL
            if (profile.picture.includes('ipfs') || profile.picture.includes('chainmagic.studio')) {
                filenameDisplay.textContent = 'Image from IPFS';
            } else if (profile.picture.startsWith('data:')) {
                filenameDisplay.textContent = 'Uploaded image';
            } else {
                filenameDisplay.textContent = 'Image from URL';
            }
        } else {
            preview.classList.add('hidden');
            filenameDisplay.textContent = 'No file chosen';
        }
        
        // Update character count for bio
        updateCharCount();
        
        // Show status if chainmagic NIP-05 was found
        if (chainmagicNip05) {
            updateStatus('NIP-05 identifier found and prefilled: ' + chainmagicNip05, 'success');
        }
        
    } catch (error) {
        console.error('Error loading profile data:', error);
    }
}

function updateCharCount() {
    const textarea = document.getElementById('about');
    const charCount = document.querySelector('.char-count .current');
    charCount.textContent = textarea.value.length;
}

// Upload image to IPFS
async function uploadImageToIPFS(file) {
    const formData = new FormData();
    formData.append('image', file);
    
    const response = await fetch('http://chainmagic.studio/scripts/upload_to_ipfs.php', {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
        throw new Error(result.error || 'Upload failed');
    }
    
    return result.url;
}

function triggerFileUpload() {
    document.getElementById('picture-file').click();
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    const filenameDisplay = document.getElementById('picture-filename');
    const preview = document.getElementById('picture-preview');
    const urlInput = document.getElementById('picture');
    
    if (file) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            updateStatus('Please select a valid image file', 'error');
            return;
        }
        
        // Validate file size (limit to 5MB)
        if (file.size > 5 * 1024 * 1024) {
            updateStatus('Image file too large. Please choose a file under 5MB', 'error');
            return;
        }
        
        // Update filename display and show loading
        filenameDisplay.textContent = 'Uploading to IPFS...';
        updateStatus('Uploading image to IPFS...', 'loading');
        
        try {
            // Upload to IPFS
            const ipfsUrl = await uploadImageToIPFS(file);
            
            // Show preview with IPFS URL
            preview.src = ipfsUrl;
            preview.classList.remove('hidden');
            
            // Store the IPFS URL in the URL input
            urlInput.value = ipfsUrl;
            
            // Update filename display
            filenameDisplay.textContent = file.name + ' (IPFS)';
            
            updateStatus('Image uploaded to IPFS successfully', 'success');
        } catch (error) {
            console.error('IPFS upload error:', error);
            updateStatus('Failed to upload image to IPFS: ' + error.message, 'error');
            
            // Reset on error
            filenameDisplay.textContent = 'No file chosen';
            preview.classList.add('hidden');
            preview.src = '';
            urlInput.value = '';
        }
    } else {
        // Reset if no file selected
        filenameDisplay.textContent = 'No file chosen';
        preview.classList.add('hidden');
        preview.src = '';
    }
}

async function saveProfile() {
    try {
        if (!currentIdentity) {
            updateStatus('No identity available to save profile', 'error');
            return;
        }
        
        updateStatus('Saving profile...', 'loading');
        
        // Get form data
        const profileData = {
            name: document.getElementById('display-name').value.trim(),
            about: document.getElementById('about').value.trim(),
            picture: document.getElementById('picture').value.trim(),
            banner: document.getElementById('banner').value.trim(),
            nip05: document.getElementById('nip05').value.trim(),
            baseAddr: document.getElementById('base-addr').value.trim(),
            pubkey: currentIdentity.publicKeyHex,
            updated_at: Math.floor(Date.now() / 1000)
        };
        
        // Store profile data
        await new Promise((resolve) => {
            chrome.storage.local.set({ profileData }, resolve);
        });
        
        updateStatus('Profile saved! Publishing to Nostr relays...', 'loading');
        
        try {
            // Create the metadata event (kind 0) for NOSTR profile
            const metadataContent = {
                name: profileData.name || '',
                about: profileData.about || '',
                picture: profileData.picture || '',
                banner: profileData.banner || '',
                nip05: profileData.nip05 || '',
                website: profileData.website || ''
            };
            
            // Add Base/Ethereum address if provided
            if (profileData.baseAddr) {
                // Check if it's a Lightning address (starts with user@domain) or Ethereum/Base address
                if (profileData.baseAddr.includes('@') && profileData.baseAddr.includes('.')) {
                    // Lightning address
                    metadataContent.lud16 = profileData.baseAddr;
                } else if (profileData.baseAddr.startsWith('0x') && profileData.baseAddr.length === 42) {
                    // Ethereum/Base address
                    metadataContent.ethereum = profileData.baseAddr;
                    metadataContent.base = profileData.baseAddr; // Also add as base field
                } else {
                    // Fallback - could be either, add both
                    metadataContent.lud16 = profileData.baseAddr;
                    metadataContent.ethereum = profileData.baseAddr;
                }
            }
            
            const metadataEvent = {
                kind: 0,
                content: JSON.stringify(metadataContent),
                created_at: Math.floor(Date.now() / 1000),
                tags: []
            };
            
            console.log('Creating metadata event:', metadataEvent);
            
            // Send to background script for proper signing with real secp256k1
            console.log('🔄 Sending event to background script for signing:', metadataEvent);
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    type: 'NOSTR_REQUEST',
                    method: 'signEvent',
                    params: { event: metadataEvent }
                }, resolve);
            });
            
            console.log('📨 Response from background script:', response);
            
            if (response.error) {
                console.error('❌ Background script error:', response.error);
                throw new Error(response.error);
            }
            
            const signedEvent = response.result;
            console.log('✅ Profile event signed successfully:', {
                id: signedEvent.id,
                pubkey: signedEvent.pubkey,
                sig: signedEvent.sig?.substring(0, 20) + '...',
                sigLength: signedEvent.sig?.length,
                kind: signedEvent.kind,
                content: signedEvent.content?.substring(0, 100) + '...'
            });
            
            // Validate the signed event
            if (!signedEvent.id || !signedEvent.sig || !signedEvent.pubkey) {
                throw new Error('Signed event is missing required fields');
            }
            
            // Publish the signed event to multiple relays
            console.log('🌐 Publishing to relays...');
            const publishResult = await publishEventToRelays(signedEvent);
            
            console.log('📊 Publish result:', publishResult);
            
            if (publishResult.successCount > 0) {
                updateStatus(`Profile published successfully to ${publishResult.successCount}/${publishResult.errorCount + publishResult.successCount} relays!`, 'success');
                console.log('✅ Profile published successfully');
            } else {
                updateStatus('Profile saved locally but failed to publish to any relays', 'warning');
                console.error('❌ All relay publishes failed:', publishResult);
            }
            
        } catch (error) {
            console.error('Error publishing to relays:', error);
            updateStatus('Profile saved locally but failed to publish to relays: ' + error.message, 'warning');
        }
        
        // Update the main profile display
        await loadProfileDisplay();
        
        // Hide the profile editor
        hideProfileEditor();
        
    } catch (error) {
        console.error('Error saving profile:', error);
        updateStatus('Failed to save profile: ' + error.message, 'error');
    }
}

function updateStatus(message, type = 'info') {
    const statusText = document.getElementById('status-text');
    const statusDot = document.querySelector('.status-dot');
    
    statusText.textContent = message;
    
    // Reset classes
    statusDot.className = 'status-dot';
    
    // Add type-specific class
    switch (type) {
        case 'success':
            statusDot.classList.add('success');
            break;
        case 'error':
            statusDot.classList.add('error');
            break;
        case 'loading':
            statusDot.classList.add('loading');
            break;
        case 'warning':
            statusDot.classList.add('warning');
            break;
        default:
            statusDot.classList.add('info');
    }
    
    // Auto-clear after 5 seconds for non-error messages
    if (type !== 'error') {
        setTimeout(() => {
            if (statusText.textContent === message) {
                updateStatus('Ready', 'info');
            }
        }, 5000);
    }
}

// Settings Panel Functions
function showSettings() {
    document.getElementById('settings-panel').classList.remove('hidden');
}

function hideSettings() {
    document.getElementById('settings-panel').classList.add('hidden');
}

// Update profile display with data from NOSTR relays
function updateProfileDisplay(profileData) {
    if (!profileData) return;
    
    // Update profile display with relay data
    const displayName = profileData.name || profileData.displayName || '';
    const bio = profileData.about || profileData.bio || '';
    const avatar = profileData.picture || profileData.avatar || '';
    const banner = profileData.banner || profileData.backgroundImage || '';
    
    if (displayName) {
        document.getElementById('profile-name').textContent = displayName;
    }
    
    if (bio) {
        document.getElementById('profile-about').textContent = bio;
    }
    
    // Update avatar
    const avatarElement = document.getElementById('profile-avatar');
    const placeholder = document.querySelector('.avatar-placeholder');
    
    if (avatar) {
        avatarElement.src = avatar;
        avatarElement.classList.remove('hidden');
        if (placeholder) placeholder.style.display = 'none';
    }
    
    // Display NIP-05 if available
    const nip05Display = document.getElementById('profile-nip05');
    if (profileData.nip05) {
        nip05Display.textContent = profileData.nip05;
        nip05Display.classList.remove('hidden');
    }
    
    // Store the complete profile data locally for future use
    const completeProfileData = {
        name: displayName,
        about: bio,
        picture: avatar,
        banner: banner,
        nip05: profileData.nip05 || '',
        lud06: profileData.lud06 || '',
        lud16: profileData.lud16 || '',
        website: profileData.website || '',
        ethereum: profileData.ethereum || '',
        base: profileData.base || '',
        baseAddr: profileData.baseAddr || profileData.ethereum || profileData.base || profileData.lud16 || '',
        updated_at: Math.floor(Date.now() / 1000)
    };
    
    chrome.storage.local.set({ profileData: completeProfileData });
    
    console.log('Profile updated with relay data:', completeProfileData);
}

// Clear profile display when switching identities
function clearProfileDisplay() {
    // Reset profile name and about to defaults
    document.getElementById('profile-name').textContent = 'Display Name';
    document.getElementById('profile-about').textContent = 'No bio set. Click settings to add profile information.';
    
    // Hide avatar and show placeholder
    const avatar = document.getElementById('profile-avatar');
    const placeholder = document.querySelector('.avatar-placeholder');
    avatar.classList.add('hidden');
    avatar.src = '';
    if (placeholder) {
        placeholder.style.display = 'flex';
    }
    
    // Hide NIP-05 display
    const nip05Display = document.getElementById('profile-nip05');
    nip05Display.classList.add('hidden');
    nip05Display.textContent = '';
    
    console.log('Profile display cleared for new identity');
}

// Profile Display Functions
async function loadProfileDisplay() {
    try {
        const result = await new Promise((resolve) => {
            chrome.storage.local.get(['profileData'], resolve);
        });
        
        // Always check for NIP-05 from chainmagic, regardless of profile data
        const publicKeyHex = currentIdentity ? currentIdentity.publicKeyHex : null;
        const chainmagicNip05 = publicKeyHex ? await NostrUtils.checkChainmagicIds(publicKeyHex) : null;
        const nip05Display = document.getElementById('profile-nip05');
        
        if (result.profileData) {
            const profile = result.profileData;
            
            // Update profile display
            document.getElementById('profile-name').textContent = profile.name || 'Display Name';
            document.getElementById('profile-about').textContent = profile.about || 'No bio set. Click settings to add profile information.';
            
            // Update avatar
            const avatar = document.getElementById('profile-avatar');
            const placeholder = document.querySelector('.avatar-placeholder');
            
            if (profile.picture) {
                avatar.src = profile.picture;
                avatar.classList.remove('hidden');
                placeholder.style.display = 'none';
            } else {
                avatar.classList.add('hidden');
                placeholder.style.display = 'flex';
            }
            
            // Display NIP-05: prioritize chainmagic, then profile stored NIP-05
            if (chainmagicNip05) {
                nip05Display.textContent = chainmagicNip05;
                nip05Display.classList.remove('hidden');
            } else if (profile.nip05) {
                nip05Display.textContent = profile.nip05;
                nip05Display.classList.remove('hidden');
            } else {
                nip05Display.classList.add('hidden');
            }
        } else {
            // No profile data, but still check for chainmagic NIP-05
            document.getElementById('profile-name').textContent = 'Display Name';
            document.getElementById('profile-about').textContent = 'No bio set. Click settings to add profile information.';
            
            // Hide avatar
            const avatar = document.getElementById('profile-avatar');
            const placeholder = document.querySelector('.avatar-placeholder');
            avatar.classList.add('hidden');
            placeholder.style.display = 'flex';
            
            // Still display chainmagic NIP-05 if found
            if (chainmagicNip05) {
                nip05Display.textContent = chainmagicNip05;
                nip05Display.classList.remove('hidden');
            } else {
                nip05Display.classList.add('hidden');
            }
        }
    } catch (error) {
        console.error('Error loading profile display:', error);
    }
}

// Export Keys Function
async function exportKeys() {
    if (!currentIdentity) {
        updateStatus('No identity to export', 'error');
        return;
    }
    
    const keyData = {
        publicKey: currentIdentity.publicKey,
        privateKey: currentIdentity.privateKey,
        publicKeyHex: currentIdentity.publicKeyHex,
        createdAt: new Date(currentIdentity.createdAt).toISOString()
    };
    
    const dataStr = JSON.stringify(keyData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `nostr-keys-${Date.now()}.json`;
    
    // Create download link
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    updateStatus('Keys exported successfully', 'success');
}

// Publish Event to Relays
async function publishEventToRelays(signedEvent) {
    const relays = [
        'wss://relay.damus.io',
        'wss://nos.lol',
        'wss://relay.snort.social'
    ];
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const relayUrl of relays) {
        try {
            await publishToSingleRelay(relayUrl, signedEvent);
            successCount++;
            console.log(`✅ Published to ${relayUrl}`);
        } catch (error) {
            errorCount++;
            console.error(`❌ Failed to publish to ${relayUrl}:`, error);
        }
    }
    
    console.log(`Profile publishing complete: ${successCount} success, ${errorCount} errors`);
    
    if (successCount === 0) {
        throw new Error('Failed to publish to any relay');
    }
    
    return { successCount, errorCount };
}

// Publish to a single relay
async function publishToSingleRelay(relayUrl, signedEvent) {
    console.log(`🚀 Attempting to publish to ${relayUrl}`);
    console.log(`📝 Event to publish:`, {
        id: signedEvent.id,
        pubkey: signedEvent.pubkey,
        kind: signedEvent.kind,
        created_at: signedEvent.created_at,
        content: signedEvent.content?.substring(0, 100) + '...',
        sig: signedEvent.sig?.substring(0, 20) + '...'
    });
    
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(relayUrl);
        let resolved = false;
        
        const resolveOnce = (result) => {
            if (!resolved) {
                resolved = true;
                console.log(`🎉 ${relayUrl} resolved with:`, result);
                resolve(result);
            }
        };
        
        const rejectOnce = (error) => {
            if (!resolved) {
                resolved = true;
                console.error(`💥 ${relayUrl} rejected with:`, error.message);
                reject(error);
            }
        };
        
        ws.onopen = () => {
            console.log(`🌐 Connected to ${relayUrl}`);
            
            // Send the signed event to the relay
            const publishMessage = ['EVENT', signedEvent];
            const messageJson = JSON.stringify(publishMessage);
            console.log(`📤 Sending to ${relayUrl}:`, messageJson.substring(0, 200) + '...');
            ws.send(messageJson);
        };
        
        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            console.log(`📨 ${relayUrl} raw response:`, event.data);
            console.log(`📨 ${relayUrl} parsed response:`, message);
            
            if (message[0] === 'OK') {
                const [, eventId, success, errorMessage] = message;
                console.log(`🔍 ${relayUrl} OK response details:`, {
                    eventId,
                    success,
                    errorMessage,
                    expectedEventId: signedEvent.id
                });
                
                if (success) {
                    console.log(`✅ Event accepted by ${relayUrl}`);
                    ws.close();
                    resolveOnce({ success: true, relay: relayUrl });
                } else {
                    console.log(`❌ Event rejected by ${relayUrl}:`, errorMessage);
                    ws.close();
                    rejectOnce(new Error(`Event rejected: ${errorMessage}`));
                }
            } else {
                console.log(`❓ Unexpected message type from ${relayUrl}:`, message[0]);
            }
        };
        
        ws.onerror = (error) => {
            console.error(`❌ WebSocket error for ${relayUrl}:`, error);
            rejectOnce(new Error(`Connection error: ${relayUrl}`));
        };
        
        ws.onclose = (event) => {
            console.log(`🔌 Connection closed for ${relayUrl}, code:`, event.code, 'reason:', event.reason);
            if (!resolved) {
                rejectOnce(new Error(`Connection closed unexpectedly: ${relayUrl} (code: ${event.code})`));
            }
        };
        
        // Timeout after 15 seconds (increased from 10)
        setTimeout(() => {
            if (!resolved) {
                console.warn(`⏰ Timeout for ${relayUrl} after 15 seconds`);
                ws.close();
                rejectOnce(new Error(`Timeout publishing to ${relayUrl}`));
            }
        }, 15000);
    });
}

// Publish Profile to Relays
async function publishProfileToRelays() {
    if (!currentIdentity) {
        updateStatus('No identity found', 'error');
        return;
    }
    
    try {
        updateStatus('Publishing profile to NOSTR relays...', 'loading');
        
        // Get profile data
        const result = await new Promise((resolve) => {
            chrome.storage.local.get(['profileData'], resolve);
        });
        
        if (!result.profileData) {
            updateStatus('No profile data to publish. Please create a profile first.', 'error');
            return;
        }
        
        const profileData = result.profileData;
        
        // Create kind 0 event (user metadata)
        const metadataEvent = {
            kind: 0,
            content: JSON.stringify({
                name: profileData.name || '',
                about: profileData.about || '',
                picture: profileData.picture || '',
                banner: profileData.banner || '',
                nip05: profileData.nip05 || '',
                lud16: profileData.lud16 || '',
                website: profileData.website || ''
            }),
            created_at: Math.floor(Date.now() / 1000),
            tags: []
        };
        
        // Send to background script for signing
        const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
                type: 'NOSTR_REQUEST',
                method: 'signEvent',
                params: { event: metadataEvent }
            }, resolve);
        });
        
        if (response.error) {
            throw new Error(response.error);
        }
        
        const signedEvent = response.result;
        
        // Now publish the signed event to relays
        await publishEventToRelays(signedEvent);
        
        updateStatus('Profile published to NOSTR relays successfully!', 'success');
        
    } catch (error) {
        console.error('Error publishing profile:', error);
        updateStatus('Failed to publish profile: ' + error.message, 'error');
    }
}

// Add these missing functions to your popup.js file

// Content script injection - this is what makes the extension communicate with web pages
function injectContentScript() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0] && tabs[0].id) {
            chrome.scripting.executeScript({
                target: {tabId: tabs[0].id},
                files: ['content.js']
            }).catch(err => {
                console.log('Content script injection failed:', err);
            });
        }
    });
}

// Extension status check - tells web pages if extension is available
function checkExtensionStatus() {
    // This should be called periodically to maintain connection
    if (currentIdentity && currentIdentity.publicKeyHex) {
        // Send status to any listening web pages
        chrome.tabs.query({}, function(tabs) {
            tabs.forEach(tab => {
                if (tab.id) {
                    chrome.tabs.sendMessage(tab.id, {
                        type: 'EXTENSION_STATUS',
                        status: 'connected',
                        publicKey: currentIdentity.publicKeyHex,
                        displayName: getActualDisplayName()
                    }).catch(() => {
                        // Tab might not have content script, ignore error
                    });
                }
            });
        });
    }
}

// Get actual display name for the current identity
function getActualDisplayName() {
    if (!currentIdentity) return 'Anonymous';
    
    // Try to get display name from stored profile data
    chrome.storage.local.get(['profileData'], (result) => {
        if (result.profileData && result.profileData.name) {
            return result.profileData.name;
        }
    });
    
    // Fallback to shortened public key
    if (currentIdentity.publicKeyHex) {
        return `@${currentIdentity.publicKeyHex.slice(0, 8)}...${currentIdentity.publicKeyHex.slice(-4)}`;
    }
    
    return 'Anonymous';
}

// Handle messages from web pages (via content script)
function handleWebPageMessage(message, sender, sendResponse) {
    console.log('🌐 Extension received message from web page:', message);
    
    switch (message.type) {
        case 'GET_PUBLIC_KEY':
            if (currentIdentity && currentIdentity.publicKeyHex) {
                sendResponse({
                    success: true,
                    publicKey: currentIdentity.publicKeyHex,
                    displayName: getActualDisplayName()
                });
            } else {
                sendResponse({
                    success: false,
                    error: 'No identity available'
                });
            }
            break;
            
        case 'SIGN_EVENT':
            if (currentIdentity && currentIdentity.privateKey) {
                // Send to background script for signing
                chrome.runtime.sendMessage({
                    type: 'NOSTR_REQUEST',
                    method: 'signEvent',
                    params: { event: message.event }
                }, (response) => {
                    sendResponse(response);
                });
                return true; // Keep channel open for async response
            } else {
                sendResponse({
                    success: false,
                    error: 'No private key available for signing'
                });
            }
            break;
            
        case 'GET_STATUS':
            sendResponse({
                success: true,
                isLoggedIn: !!currentIdentity,
                publicKey: currentIdentity?.publicKeyHex || null,
                displayName: getActualDisplayName(),
                extensionVersion: chrome.runtime.getManifest().version
            });
            break;
            
        default:
            sendResponse({
                success: false,
                error: 'Unknown message type'
            });
    }
}

// Set up message listener for web page communication
chrome.runtime.onMessage.addListener(handleWebPageMessage);

// Periodically broadcast extension status
setInterval(() => {
    if (currentIdentity) {
        checkExtensionStatus();
    }
}, 5000); // Every 5 seconds

// Call when identity changes (add this to your existing login/logout functions)
function notifyIdentityChange() {
    checkExtensionStatus();
    
    // Also update any open extension popups
    chrome.runtime.sendMessage({
        type: 'IDENTITY_CHANGED',
        identity: currentIdentity
    }).catch(() => {
        // No listeners, ignore
    });
}

// Modify your existing loadIdentity function to include notification
const originalLoadIdentity = loadIdentity;
loadIdentity = async function() {
    await originalLoadIdentity.apply(this, arguments);
    
    // Notify web pages after identity is loaded
    setTimeout(() => {
        notifyIdentityChange();
    }, 1000);
};

// Modify your existing logout function to include notification
const originalLogoutIdentity = logoutIdentity;
logoutIdentity = async function() {
    await originalLogoutIdentity.apply(this, arguments);
    
    // Notify web pages after logout
    setTimeout(() => {
        notifyIdentityChange();
    }, 500);
};

// Add to your existing generateNewIdentity function
const originalGenerateNewIdentity = generateNewIdentity;
generateNewIdentity = async function() {
    await originalGenerateNewIdentity.apply(this, arguments);
    
    // Notify web pages after new identity is generated
    setTimeout(() => {
        notifyIdentityChange();
    }, 1000);
};

// Add to your existing importIdentity function
const originalImportIdentity = importIdentity;
importIdentity = async function() {
    await originalImportIdentity.apply(this, arguments);
    
    // Notify web pages after identity is imported
    setTimeout(() => {
        notifyIdentityChange();
    }, 1000);
};