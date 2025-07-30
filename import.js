document.addEventListener('DOMContentLoaded', () => {
    const backToMainBtn = document.getElementById('back-to-main');
    const importConfirmBtn = document.getElementById('import-confirm');
    const importCancelBtn = document.getElementById('import-cancel');
    const privateKeyInput = document.getElementById('private-key-input');
    const statusText = document.getElementById('status-text');

    // Handle back to main page
    backToMainBtn.addEventListener('click', () => {
        window.location.href = 'popup.html';
    });

    // Handle import confirmation
    importConfirmBtn.addEventListener('click', async () => {
        const privateKey = privateKeyInput.value.trim();
        if (!privateKey) {
            alert('Please enter a private key.');
            return;
        }

        try {
            statusText.textContent = 'Importing NOSTR identity...';
            
            // Send the raw input directly to background script
            // Let the background script handle both nsec conversion AND public key derivation
            // using the same real nostr-tools library
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    type: 'NOSTR_REQUEST', 
                    method: 'importPrivateKey',
                    params: { privateKeyInput: privateKey }
                }, resolve);
            });
            
            if (response.error) {
                throw new Error('Failed to import private key: ' + response.error);
            }
            
            statusText.textContent = 'Import successful! Redirecting...';
            
            // Redirect to main page after successful import
            setTimeout(() => {
                window.location.href = 'popup.html';
            }, 1000);
        } catch (error) {
            console.error('Import failed:', error);
            statusText.textContent = `Error: ${error.message}`;
            alert(`Failed to import identity: ${error.message}`);
        }
    });

    // Handle import cancellation
    importCancelBtn.addEventListener('click', () => {
        window.location.href = 'popup.html';
    });
});

