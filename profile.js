// Profile Configuration Logic

document.addEventListener('DOMContentLoaded', function() {
    loadProfile();
    setupEventListeners();
    setupValidation();
});

function setupEventListeners() {
    document.getElementById('save-profile').addEventListener('click', saveProfile);
    document.getElementById('reset-form').addEventListener('click', resetForm);
    document.getElementById('back-to-main').addEventListener('click', () => window.location.href = 'popup.html');
    document.getElementById('back-to-popup').addEventListener('click', () => window.location.href = 'popup.html');
    
    // File upload listeners
    setupFileUpload();
    
    // Identity management listeners
    setupIdentityManagement();

    const inputs = document.querySelectorAll('#profile-form input, #profile-form textarea');
    inputs.forEach(input => {
        input.addEventListener('input', handleInputChange);
        input.addEventListener('blur', validateField);
        input.addEventListener('focus', handleInputFocus);
        input.addEventListener('blur', handleInputBlur);
    });

    document.getElementById('nip05').addEventListener('blur', validateNIP05);
    
    // Image preview error handling
    document.getElementById('preview-avatar-img').addEventListener('error', () => {
        document.getElementById('preview-avatar-img').classList.add('hidden');
        document.querySelector('.avatar-placeholder').classList.remove('hidden');
    });
    
    document.getElementById('preview-banner-img').addEventListener('error', () => {
        document.getElementById('preview-banner-img').classList.add('hidden');
        document.querySelector('.banner-placeholder').classList.remove('hidden');
    });
    
    // Hide all help text initially
    hideAllHelpText();
}

// Setup identity management functionality
function setupIdentityManagement() {
    const importKeyBtn = document.getElementById('import-key-btn');
    const generateKeyBtn = document.getElementById('generate-key-btn');
    const importForm = document.getElementById('import-form');
    const generateProgress = document.getElementById('generate-progress');
    const identityPreview = document.getElementById('identity-preview');
    const importConfirmBtn = document.getElementById('import-confirm-btn');
    const importCancelBtn = document.getElementById('import-cancel-btn');
    const privateKeyInput = document.getElementById('private-key-input');
    const publicKeyDisplay = document.getElementById('public-key-display');
    const privateKeyDisplay = document.getElementById('private-key-display');
    const revealKeyBtn = document.getElementById('reveal-key-btn');
    const continueSetupBtn = document.getElementById('continue-setup-btn');
    const copyKeysBtn = document.getElementById('copy-keys-btn');

    let privateKeyHex = '';
    let publicKeyHex = '';

    importKeyBtn.addEventListener('click', () => {
        importForm.classList.remove('hidden');
        generateProgress.classList.add('hidden');
        identityPreview.classList.add('hidden');
    });

    generateKeyBtn.addEventListener('click', async () => {
        generateProgress.classList.remove('hidden');
        importForm.classList.add('hidden');
        identityPreview.classList.add('hidden');
        
        // Animate progress bar
        const progressFill = generateProgress.querySelector('.progress-fill');
        const progressText = generateProgress.querySelector('.progress-text');
        
        progressFill.style.width = '30%';
        progressText.textContent = 'Generating private key...';
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        privateKeyHex = NostrUtils.generatePrivateKey();
        progressFill.style.width = '70%';
        progressText.textContent = 'Deriving public key...';
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        publicKeyHex = await NostrUtils.getPublicKey(privateKeyHex);
        progressFill.style.width = '100%';
        progressText.textContent = 'Identity generated successfully!';
        
        await new Promise(resolve => setTimeout(resolve, 500));

        await updateIdentityPreview(privateKeyHex, publicKeyHex);
    });

    importConfirmBtn.addEventListener('click', async () => {
        let keyInput = privateKeyInput.value.trim();
        
        // Check if it's nsec format and convert to hex
        if (keyInput.startsWith('nsec')) {
            privateKeyHex = NostrUtils.nsecToHex(keyInput);
            if (!privateKeyHex) {
                showStatus('Invalid nsec private key format', 'error');
                return;
            }
        } else {
            privateKeyHex = keyInput;
            if (!NostrUtils.isValidPrivateKey(privateKeyHex)) {
                showStatus('Invalid private key - must be 64 hex characters or valid nsec', 'error');
                return;
            }
        }

        try {
            publicKeyHex = await NostrUtils.getPublicKey(privateKeyHex);
            importForm.classList.add('hidden');
            showStatus('Importing identity and fetching profile...', 'loading');
            await updateIdentityPreview(privateKeyHex, publicKeyHex);
        } catch (error) {
            showStatus('Failed to process private key', 'error');
        }
    });

    importCancelBtn.addEventListener('click', () => {
        importForm.classList.add('hidden');
        generateProgress.classList.add('hidden');
        identityPreview.classList.add('hidden');
    });

    revealKeyBtn.addEventListener('click', () => {
        const keyElement = privateKeyDisplay.querySelector('.key-hidden');
        if (keyElement.textContent.includes('•')) {
            keyElement.textContent = NostrUtils.hexToNsec(privateKeyHex);
            revealKeyBtn.textContent = '🙈';
        } else {
            keyElement.textContent = NostrUtils.hexToNsec(privateKeyHex).replace(/\w/g, '•');
            revealKeyBtn.textContent = '👁️';
        }
    });

    continueSetupBtn.addEventListener('click', () => {
        // Store the keys in chrome storage
        chrome.storage.local.set({
            nostr_private_key: privateKeyHex,
            nostr_public_key: publicKeyHex
        }, () => {
            document.getElementById('no-identity').classList.add('hidden');
            document.getElementById('profile-editor').classList.remove('hidden');
            updateStatus('Identity setup complete. You can now configure your profile.', 'success');
        });
    });

    copyKeysBtn.addEventListener('click', () => {
        const keyData = `Public Key (npub): ${publicKeyDisplay.textContent}\nPrivate Key (nsec): ${privateKeyHex}`;
        navigator.clipboard.writeText(keyData).then(() => {
            showStatus('Keys copied to clipboard', 'success');
        }, () => {
            showStatus('Failed to copy keys', 'error');
        });
    });

    async function updateIdentityPreview(privateKey, publicKey) {
        const npub = NostrUtils.hexToNpub(publicKey);
        const nsec = NostrUtils.hexToNsec(privateKey);

        publicKeyDisplay.textContent = npub;
        privateKeyDisplay.querySelector('.key-hidden').textContent = nsec.replace(/\w/g, '•');

        identityPreview.classList.remove('hidden');
        generateProgress.classList.add('hidden');

        try {
            const chainmagicNip05 = await NostrUtils.checkChainmagicIds(publicKey);
            const profileData = await NostrUtils.fetchProfileFromRelays(publicKey);

            // Update profile form with fetched data
            if (chainmagicNip05) {
                profileData.nip05 = chainmagicNip05;
            }
            populateForm(profileData);

            showStatus('Identity imported successfully', 'success');
        } catch (error) {
            showStatus('Failed to import identity', 'error');
        }
    }
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

// Setup file upload functionality
function setupFileUpload() {
    // Profile picture upload setup
    const fileInput = document.getElementById('picture-file');
    const uploadBtn = document.getElementById('upload-picture-btn');
    const filenameDisplay = document.getElementById('picture-filename');
    const picturePreview = document.getElementById('picture-preview');
    const pictureUrl = document.getElementById('picture');
    const uploadSection = document.querySelector('.picture-upload-section');
    
    // Click upload button to trigger file input
    uploadBtn.addEventListener('click', () => {
        fileInput.click();
    });
    
    // Handle file selection
    fileInput.addEventListener('change', handleFileUpload);
    
    // Handle drag and drop
    uploadSection.addEventListener('dragover', handleDragOver);
    uploadSection.addEventListener('dragleave', handleDragLeave);
    uploadSection.addEventListener('drop', handleFileDrop);
    
    // Clear file when URL input is used
    pictureUrl.addEventListener('input', () => {
        if (pictureUrl.value.trim()) {
            clearFileUpload();
        }
    });
    
    // Banner upload setup
    const bannerFileInput = document.getElementById('banner-file');
    const bannerUploadBtn = document.getElementById('upload-banner-btn');
    const bannerFilenameDisplay = document.getElementById('banner-filename');
    const bannerPreview = document.getElementById('banner-preview');
    const bannerUrl = document.getElementById('banner');
    const bannerUploadSection = bannerUploadBtn.parentElement;
    
    // Click banner upload button to trigger file input
    bannerUploadBtn.addEventListener('click', () => {
        bannerFileInput.click();
    });
    
    // Handle banner file selection
    bannerFileInput.addEventListener('change', handleBannerFileUpload);
    
    // Handle banner drag and drop
    bannerUploadSection.addEventListener('dragover', handleBannerDragOver);
    bannerUploadSection.addEventListener('dragleave', handleBannerDragLeave);
    bannerUploadSection.addEventListener('drop', handleBannerFileDrop);
    
    // Clear banner file when URL input is used
    bannerUrl.addEventListener('input', () => {
        if (bannerUrl.value.trim()) {
            clearBannerFileUpload();
        }
    });
}

function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.add('drag-over');
}

function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove('drag-over');
}

function handleFileDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove('drag-over');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
            processImageFile(file);
        } else {
            showStatus('Please select an image file', 'error');
        }
    }
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        if (file.type.startsWith('image/')) {
            processImageFile(file);
        } else {
            showStatus('Please select an image file', 'error');
            clearFileUpload();
        }
    }
}

async function processImageFile(file) {
    const uploadSection = document.querySelector('.picture-upload-section');
    const filenameDisplay = document.getElementById('picture-filename');
    const picturePreview = document.getElementById('picture-preview');
    const pictureUrl = document.getElementById('picture');
    
    // Show loading state
    uploadSection.classList.add('loading');
    filenameDisplay.textContent = 'Uploading to IPFS...';
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showStatus('Image file must be less than 5MB', 'error');
        uploadSection.classList.remove('loading');
        clearFileUpload();
        return;
    }
    
    try {
        showStatus('Uploading image to IPFS...', 'loading');
        
        // Upload to IPFS
        const ipfsUrl = await uploadImageToIPFS(file);
        
        // Update UI with IPFS URL
        filenameDisplay.textContent = file.name + ' (IPFS)';
        filenameDisplay.classList.add('has-file');
        picturePreview.src = ipfsUrl;
        picturePreview.classList.remove('hidden');
        
        // Store the IPFS URL in the input field
        pictureUrl.value = ipfsUrl;
        
        // Clear file object attributes since we now have the URL
        pictureUrl.removeAttribute('data-file-obj');
        if (pictureUrl.fileObject) {
            delete pictureUrl.fileObject;
        }
        
        // Update preview
        updatePreview();
        
        uploadSection.classList.remove('loading');
        showStatus('Image uploaded to IPFS successfully!', 'success');
    } catch (error) {
        console.error('IPFS upload error:', error);
        showStatus('Failed to upload image to IPFS: ' + error.message, 'error');
        uploadSection.classList.remove('loading');
        clearFileUpload();
    }
}

function clearFileUpload() {
    const fileInput = document.getElementById('picture-file');
    const filenameDisplay = document.getElementById('picture-filename');
    const picturePreview = document.getElementById('picture-preview');
    const pictureUrl = document.getElementById('picture');
    
    fileInput.value = '';
    filenameDisplay.textContent = 'No file chosen';
    filenameDisplay.classList.remove('has-file');
    picturePreview.classList.add('hidden');
    pictureUrl.value = '';
}

// Banner file upload handlers
function handleBannerDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.add('drag-over');
}

function handleBannerDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove('drag-over');
}

function handleBannerFileDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove('drag-over');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
            processBannerFile(file);
        } else {
            showStatus('Please select an image file', 'error');
        }
    }
}

function handleBannerFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        if (file.type.startsWith('image/')) {
            processBannerFile(file);
        } else {
            showStatus('Please select an image file', 'error');
            clearBannerFileUpload();
        }
    }
}

async function processBannerFile(file) {
    const bannerUploadSection = document.getElementById('upload-banner-btn').parentElement;
    const bannerFilenameDisplay = document.getElementById('banner-filename');
    const bannerPreview = document.getElementById('banner-preview');
    const bannerUrl = document.getElementById('banner');
    
    // Show loading state
    bannerUploadSection.classList.add('loading');
    bannerFilenameDisplay.textContent = 'Uploading to IPFS...';
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showStatus('Banner image file must be less than 5MB', 'error');
        bannerUploadSection.classList.remove('loading');
        clearBannerFileUpload();
        return;
    }
    
    try {
        showStatus('Uploading banner image to IPFS...', 'loading');
        
        // Upload to IPFS
        const ipfsUrl = await uploadImageToIPFS(file);
        
        // Update UI with IPFS URL
        bannerFilenameDisplay.textContent = file.name + ' (IPFS)';
        bannerFilenameDisplay.classList.add('has-file');
        bannerPreview.src = ipfsUrl;
        bannerPreview.classList.remove('hidden');
        
        // Store the IPFS URL in the input field
        bannerUrl.value = ipfsUrl;
        
        // Clear file object attributes since we now have the URL
        bannerUrl.removeAttribute('data-file-obj');
        if (bannerUrl.fileObject) {
            delete bannerUrl.fileObject;
        }
        
        // Update preview
        updatePreview();
        
        bannerUploadSection.classList.remove('loading');
        showStatus('Banner image uploaded to IPFS successfully!', 'success');
    } catch (error) {
        console.error('Banner IPFS upload error:', error);
        showStatus('Failed to upload banner image to IPFS: ' + error.message, 'error');
        bannerUploadSection.classList.remove('loading');
        clearBannerFileUpload();
    }
}

function clearBannerFileUpload() {
    const bannerFileInput = document.getElementById('banner-file');
    const bannerFilenameDisplay = document.getElementById('banner-filename');
    const bannerPreview = document.getElementById('banner-preview');
    const bannerUrl = document.getElementById('banner');
    
    bannerFileInput.value = '';
    bannerFilenameDisplay.textContent = 'No file chosen';
    bannerFilenameDisplay.classList.remove('has-file');
    bannerPreview.classList.add('hidden');
    bannerUrl.value = '';
}

// Populate form fields with stored data
function populateForm(data) {
    for (const key in data) {
        const element = document.querySelector(`#profile-form [name="${key}"]`);
        if (element) {
            element.value = data[key];
            // Show help text for fields that have values
            if (data[key] && data[key].trim()) {
                showHelpText(element);
            }
        }
    }
    
    // Show debug info for NIP-05 specifically
    if (data.nip05) {
        updateStatus('📋 Form populated with NIP-05: ' + data.nip05, 'success');
    }
    
    // Update character counts for textareas
    const textAreas = document.querySelectorAll('#profile-form textarea');
    textAreas.forEach(textArea => {
        const countEl = textArea.nextElementSibling.querySelector('.current');
        if (countEl) {
            countEl.textContent = textArea.value.length;
        }
    });
}

// Update live preview panel with input values
function updatePreview() {
    const name = document.getElementById('display-name').value;
    const about = document.getElementById('about').value;
    const pictureEl = document.getElementById('picture');
    
    // Get picture URL from the input field
    let picture = pictureEl.value;
    
    const banner = document.getElementById('banner').value;
    const nip05 = document.getElementById('nip05').value;
    const baseAddr = document.getElementById('base-addr').value;

    document.getElementById('preview-name').textContent = name || 'Display Name';
    document.getElementById('preview-about').textContent = about || 'Your bio will appear here...';

    updateImagePreview('preview-avatar-img', 'avatar-placeholder', picture);
    updateImagePreview('preview-banner-img', 'banner-placeholder', banner);

    updateTextPreview('preview-nip05', nip05);
    updateTextPreview('preview-base', baseAddr, '🔗');
}

// Helper to update image preview
function updateImagePreview(imgId, placeholderClass, url) {
    const imgEl = document.getElementById(imgId);
    if (url) {
        imgEl.src = url;
        imgEl.classList.remove('hidden');
        imgEl.nextElementSibling.classList.add('hidden');
    } else {
        imgEl.src = '';
        imgEl.classList.add('hidden');
        imgEl.nextElementSibling.classList.remove('hidden');
    }
}

// Helper to update text preview with an icon
function updateTextPreview(id, text, icon) {
    const el = document.getElementById(id);
    if (id === 'preview-nip05') {
        if (text) {
            el.textContent = text;
            el.classList.remove('hidden');
        } else {
            el.textContent = '';
            el.classList.add('hidden');
        }
    } else {
        const container = el.closest('.address-item');
        const textSpan = container.querySelector('.address-text');
        if (text) {
            textSpan.textContent = text;
            container.classList.remove('hidden');
        } else {
            textSpan.textContent = '';
            container.classList.add('hidden');
        }
    }
}

// Hide all help text initially
function hideAllHelpText() {
    const helpTexts = document.querySelectorAll('.help-text');
    helpTexts.forEach(helpText => {
        helpText.style.display = 'none';
    });
}

// Show help text for specific input
function showHelpText(input) {
    const helpText = input.parentNode.querySelector('.help-text');
    if (helpText) {
        helpText.style.display = 'block';
        helpText.style.opacity = '1';
    }
}

// Hide help text for specific input if it has no value
function hideHelpText(input) {
    const helpText = input.parentNode.querySelector('.help-text');
    if (helpText && !input.value.trim()) {
        helpText.style.display = 'none';
        helpText.style.opacity = '0';
    }
}

// Handle input focus
function handleInputFocus(event) {
    showHelpText(event.target);
}

// Handle input blur
function handleInputBlur(event) {
    // Don't hide if input has value
    if (!event.target.value.trim()) {
        hideHelpText(event.target);
    }
}

// Handle input changes with validation
function handleInputChange(event) {
    updatePreview();
    clearValidationMessage(event.target);
    
    // Show help text if input has value
    if (event.target.value.trim()) {
        showHelpText(event.target);
    }
}

// Validate individual fields
function validateField(event) {
    const field = event.target;
    const value = field.value.trim();
    
    switch (field.id) {
        case 'display-name':
            validateDisplayName(field, value);
            break;
        case 'about':
            validateAbout(field, value);
            break;
        case 'picture':
        case 'banner':
            validateImageUrl(field, value);
            break;
        case 'lud06':
            validateLUD06(field, value);
            break;
        case 'lud16':
            validateLUD16(field, value);
            break;
        case 'base-addr':
            validateEthAddress(field, value);
            break;
    }
}

// Clear validation message
function clearValidationMessage(field) {
    const validationEl = field.parentNode.querySelector('.validation-message');
    if (validationEl) {
        validationEl.textContent = '';
        validationEl.className = 'validation-message';
    }
    field.classList.remove('valid', 'invalid', 'checking');
}

// Set validation message
function setValidationMessage(field, message, type = 'error') {
    const validationEl = field.parentNode.querySelector('.validation-message');
    if (validationEl) {
        validationEl.textContent = message;
        validationEl.className = `validation-message ${type}`;
    }
    field.classList.remove('valid', 'invalid', 'checking');
    field.classList.add(type === 'success' ? 'valid' : 'invalid');
}

// Validate display name
function validateDisplayName(field, value) {
    if (value.length === 0) return;
    
    if (value.length > 50) {
        setValidationMessage(field, 'Display name must be 50 characters or less');
        return false;
    }
    
    if (value.length < 2) {
        setValidationMessage(field, 'Display name must be at least 2 characters');
        return false;
    }
    
    setValidationMessage(field, 'Valid display name', 'success');
    return true;
}

// Validate about/bio
function validateAbout(field, value) {
    if (value.length === 0) return;
    
    if (value.length > 500) {
        setValidationMessage(field, 'Bio must be 500 characters or less');
        return false;
    }
    
    setValidationMessage(field, 'Valid bio length', 'success');
    return true;
}

// Validate image URLs
function validateImageUrl(field, value) {
    if (value.length === 0) return;
    
    try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol)) {
            setValidationMessage(field, 'Image URL must use HTTP or HTTPS');
            return false;
        }
        
        // Check if URL looks like an image
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
        const hasImageExtension = imageExtensions.some(ext => 
            url.pathname.toLowerCase().includes(ext));
        
        if (!hasImageExtension && !url.pathname.includes('image') && !url.hostname.includes('imgur') 
            && !url.hostname.includes('cloudinary') && !url.hostname.includes('gravatar')) {
            setValidationMessage(field, 'URL should point to an image file', 'warning');
            return true; // Warning, not error
        }
        
        setValidationMessage(field, 'Valid image URL', 'success');
        return true;
    } catch (e) {
        setValidationMessage(field, 'Invalid URL format');
        return false;
    }
}

// Validate LUD-06 (LNURL-Pay)
function validateLUD06(field, value) {
    if (value.length === 0) return;
    
    if (!value.toLowerCase().startsWith('lnurl')) {
        setValidationMessage(field, 'LUD-06 address must start with "lnurl"');
        return false;
    }
    
    setValidationMessage(field, 'Valid LUD-06 format', 'success');
    return true;
}

// Validate LUD-16 (Lightning Address)
function validateLUD16(field, value) {
    if (value.length === 0) return;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
        setValidationMessage(field, 'Lightning address must be in email format (user@domain.com)');
        return false;
    }
    
    setValidationMessage(field, 'Valid lightning address format', 'success');
    return true;
}

// Validate Ethereum/Base address
function validateEthAddress(field, value) {
    if (value.length === 0) return;
    
    if (!value.startsWith('0x')) {
        setValidationMessage(field, 'Ethereum address must start with "0x"');
        return false;
    }
    
    if (value.length !== 42) {
        setValidationMessage(field, 'Ethereum address must be 42 characters long');
        return false;
    }
    
    if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
        setValidationMessage(field, 'Invalid Ethereum address format');
        return false;
    }
    
    setValidationMessage(field, 'Valid Ethereum address', 'success');
    return true;
}

// Enhanced NIP-05 validation with actual checking
function validateNIP05() {
    const nip05El = document.getElementById('nip05');
    const value = nip05El.value.trim();

    if (!value) {
        document.getElementById('nip05-status').classList.add('hidden');
        return;
    }
    
    // Basic format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
        setValidationMessage(nip05El, 'NIP-05 identifier must be in email format');
        document.getElementById('nip05-status').classList.add('hidden');
        return;
    }

    nip05El.classList.add('checking');
    const statusEl = document.getElementById('nip05-status');
    statusEl.classList.remove('hidden', 'success', 'error');
    statusEl.classList.add('loading');
    statusEl.querySelector('.verification-icon').textContent = '⏳';
    statusEl.querySelector('.verification-text').textContent = 'Checking NIP-05...';

    // Attempt to verify NIP-05
    const [name, domain] = value.split('@');
    const wellKnownUrl = `https://${domain}/.well-known/nostr.json`;
    
    fetch(wellKnownUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('NIP-05 verification failed: Domain not reachable');
            }
            return response.json();
        })
        .then(data => {
            if (data.names && data.names[name]) {
                statusEl.classList.remove('error', 'loading');
                statusEl.classList.add('success');
                statusEl.querySelector('.verification-icon').textContent = '✅';
                statusEl.querySelector('.verification-text').textContent = 'NIP-05 Verified!';
                setValidationMessage(nip05El, 'NIP-05 successfully verified', 'success');
            } else {
                throw new Error('Name not found in domain\'s nostr.json');
            }
        })
        .catch(error => {
            statusEl.classList.remove('success', 'loading');
            statusEl.classList.add('error');
            statusEl.querySelector('.verification-icon').textContent = '❌';
            statusEl.querySelector('.verification-text').textContent = 'Verification failed';
            setValidationMessage(nip05El, error.message, 'warning');
        })
        .finally(() => {
            nip05El.classList.remove('checking');
        });
}

// Setup validation listeners
function setupValidation() {
    const textAreas = document.querySelectorAll('#profile-form textarea');
    textAreas.forEach(textArea => {
        textArea.addEventListener('input', function() {
            const countEl = this.nextElementSibling.querySelector('.current');
            if (countEl) {
                countEl.textContent = this.value.length;
                
                // Update char count color based on usage
                const maxLength = parseInt(this.getAttribute('maxlength'));
                const usage = this.value.length / maxLength;
                
                if (usage > 0.9) {
                    countEl.style.color = '#ff6b6b';
                } else if (usage > 0.7) {
                    countEl.style.color = '#ffc107';
                } else {
                    countEl.style.color = '#00aaff';
                }
            }
        });
    });
}

// Enhanced save profile with validation
async function saveProfile() {
    updateStatus('Validating profile data...', 'loading');
    
    // Validate all fields before saving
    const form = document.getElementById('profile-form');
    const inputs = form.querySelectorAll('input, textarea');
    let hasErrors = false;
    
    inputs.forEach(input => {
        const event = { target: input };
        validateField(event);
        if (input.classList.contains('invalid')) {
            hasErrors = true;
        }
    });
    
    if (hasErrors) {
        updateStatus('Please fix validation errors before saving', 'error');
        return;
    }
    
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    // Get picture URL from the input field (already contains IPFS URL if file was uploaded)
    const pictureEl = document.getElementById('picture');
    if (pictureEl.value) {
        data.picture = pictureEl.value;
    }
    
    // Add metadata
    data.lastModified = Date.now();
    data.version = '1.0';
    
    updateStatus('Saving profile...', 'loading');
    
    // Save to local storage first
    chrome.storage.local.set({ profileData: data }, async function() {
        if (chrome.runtime.lastError) {
            updateStatus('Failed to save profile: ' + chrome.runtime.lastError.message, 'error');
            return;
        }
        
        updateStatus('Profile saved locally! Publishing to Nostr relays...', 'loading');
        
        try {
            // Get private key to publish to relays
            const keys = await new Promise(resolve => {
                chrome.storage.local.get(['nostr_private_key'], resolve);
            });
            
            if (keys.nostr_private_key) {
                const publishResult = await NostrUtils.publishProfileToRelays(keys.nostr_private_key, data);
                
                if (publishResult.success) {
                    updateStatus(`Profile published successfully to ${publishResult.successCount}/${publishResult.totalRelays} relays!`, 'success');
                } else {
                    updateStatus('Profile saved locally but failed to publish to relays', 'warning');
                    console.error('Relay publish errors:', publishResult.errors);
                }
            } else {
                updateStatus('Profile saved locally (no private key found for relay publishing)', 'success');
            }
            
        } catch (error) {
            console.error('Error publishing to relays:', error);
            updateStatus('Profile saved locally but failed to publish to relays', 'warning');
        }
        
        // Show a brief success animation
        const saveButton = document.getElementById('save-profile');
        const originalText = saveButton.textContent;
        saveButton.textContent = '✅ Saved!';
        saveButton.disabled = true;
        
        setTimeout(() => {
            saveButton.textContent = originalText;
            saveButton.disabled = false;
        }, 3000);
    });
}

// Enhanced reset form
function resetForm() {
    if (confirm('Are you sure you want to reset all fields? This will clear all unsaved changes.')) {
        document.getElementById('profile-form').reset();
        
        // Clear all validation states
        const inputs = document.querySelectorAll('#profile-form input, #profile-form textarea');
        inputs.forEach(input => {
            clearValidationMessage(input);
        });
        
        // Hide NIP-05 status
        document.getElementById('nip05-status').classList.add('hidden');
        
        // Hide all help text
        hideAllHelpText();
        
        updatePreview();
        updateStatus('Form reset successfully', 'info');
    }
}

// Enhanced load profile with validation
async function loadProfile() {
    const result = await new Promise(resolve => {
        chrome.storage.local.get(['profileData', 'nostr_public_key'], resolve);
    });
    
    if (!result.nostr_public_key) {
        // No identity found, show the no identity state
        document.getElementById('no-identity').classList.remove('hidden');
        document.getElementById('profile-editor').classList.add('hidden');
        return;
    }
    
    document.getElementById('no-identity').classList.add('hidden');
    document.getElementById('profile-editor').classList.remove('hidden');
    
    try {
        // Check for chainmagic NIP-05 identifier
        updateStatus('🔧 Looking up NIP-05 for key: ' + result.nostr_public_key.substring(0, 16) + '...', 'loading');
        const chainmagicNip05 = await NostrUtils.checkChainmagicIds(result.nostr_public_key);
        
        if (chainmagicNip05) {
            updateStatus('🎯 Found NIP-05: ' + chainmagicNip05, 'success');
        } else {
            updateStatus('❌ No chainmagic NIP-05 found for key ending in: ...' + result.nostr_public_key.substring(56), 'info');
        }
        
        if (result.profileData) {
            // If we have stored profile data, use it but prioritize chainmagic NIP-05
            const profileData = { ...result.profileData };
            if (chainmagicNip05) {
                profileData.nip05 = chainmagicNip05;
            }
            populateForm(profileData);
            updatePreview();
            
            if (chainmagicNip05) {
                updateStatus('Profile loaded with NIP-05 identifier: ' + chainmagicNip05, 'success');
            } else {
                updateStatus('Profile loaded successfully', 'success');
            }
        } else {
            // No stored profile, but check if we have chainmagic NIP-05
            if (chainmagicNip05) {
                // Populate form with chainmagic NIP-05
                populateForm({ nip05: chainmagicNip05 });
                updatePreview();
                updateStatus('NIP-05 identifier found! You can add more profile details.', 'success');
            } else {
                updateStatus('Ready to create your profile', 'info');
            }
        }
    } catch (error) {
        console.error('Error checking chainmagic NIP-05:', error);
        // Fallback to existing logic
        if (result.profileData) {
            populateForm(result.profileData);
            updatePreview();
            updateStatus('Profile loaded successfully', 'success');
        } else {
            updateStatus('Ready to create your profile', 'info');
        }
    }
}

// Alias for updateStatus to match file upload calls
function showStatus(message, type = 'info') {
    updateStatus(message, type);
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
