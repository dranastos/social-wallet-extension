document.addEventListener('DOMContentLoaded', async function() {
    // Back button functionality
    const backBtn = document.getElementById('back-to-main');
    backBtn.addEventListener('click', () => {
        window.location.href = 'popup.html';
    });

    // Transfer functionality
    const sendTransferBtn = document.getElementById('send-transfer');
    const clearTransferBtn = document.getElementById('clear-transfer');
    const transferToInput = document.getElementById('transfer-to');
    const transferAmountInput = document.getElementById('transfer-amount');
    const transferStatus = document.getElementById('transfer-status');
    const statusIcon = document.querySelector('.status-icon');
    const statusText = document.querySelector('.status-text');
    const statusDetails = document.querySelector('.status-details');

    // Clear button functionality
    clearTransferBtn.addEventListener('click', () => {
        transferToInput.value = '';
        transferAmountInput.value = '';
        transferStatus.classList.add('hidden');
    });

    // Send transfer functionality
    sendTransferBtn.addEventListener('click', async () => {
        const toAddress = transferToInput.value.trim();
        const amount = transferAmountInput.value.trim();

        if (!toAddress || !amount) {
            updateStatus('❌', 'Error: Please fill in all fields', 'error');
            return;
        }

        if (parseFloat(amount) <= 0) {
            updateStatus('❌', 'Error: Amount must be greater than 0', 'error');
            return;
        }

        try {
            updateStatus('⏳', 'Preparing transfer...', 'loading');
            
            // Call the existing slidechain transfer function
            if (window.sendSlideChainTransfer) {
                await window.sendSlideChainTransfer(toAddress, amount);
            } else {
                throw new Error('Transfer function not available');
            }
            
        } catch (error) {
            console.error('Transfer error:', error);
            updateStatus('❌', `Transfer failed: ${error.message}`, 'error');
        }
    });

    function updateStatus(icon, text, type) {
        statusIcon.textContent = icon;
        statusText.textContent = text;
        transferStatus.classList.remove('hidden');
        
        // Update status details based on type
        if (type === 'error') {
            statusDetails.textContent = 'Please check your inputs and try again.';
        } else if (type === 'loading') {
            statusDetails.textContent = 'This may take a few moments...';
        } else if (type === 'success') {
            statusDetails.textContent = 'Transaction completed successfully!';
        }
    }
});
