# Social Wallet Extension

🔐 **A powerful browser extension that bridges NOSTR identity with social platforms and SlideChain blockchain**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue.svg)](https://chrome.google.com/webstore)
[![Firefox Add-on](https://img.shields.io/badge/Firefox-Add--on-orange.svg)](https://addons.mozilla.org/firefox/)

## ✨ Features

- **🔑 NOSTR Identity Management**: Generate or import NOSTR private keys with full secp256k1 cryptography
- **💰 SlideChain Integration**: Real-time balance checking and SS58 address conversion
- **🐦 Social Platform Integration**: Seamless Twitter/X integration for decentralized social interactions
- **🎨 Beautiful UI**: Modern, responsive popup interface with profile management
- **🔒 Secure**: Client-side key management with no data sent to external servers
- **⚡ Fast**: Optimized performance with efficient blockchain queries

## Installation

1. **Download the Extension**
   - Clone or download this repository to your computer
   - Navigate to `C:\frens\zap-social-extension\`

2. **Load in Chrome/Edge**
   - Open Chrome or Edge browser
   - Go to `chrome://extensions/` (or `edge://extensions/`)
   - Enable "Developer mode" in the top right
   - Click "Load unpacked"
   - Select the `zap-social-extension` folder

3. **Load in Firefox**
   - Open Firefox
   - Go to `about:debugging#/runtime/this-firefox`
   - Click "Load Temporary Add-on"
   - Select the `manifest.json` file

## Usage

### First Time Setup

1. Click the Zap Social extension icon in your browser toolbar
2. Click "Generate Identity" to create a new NOSTR key pair
3. Your keys will be automatically saved and displayed

### Using with NOSTR Websites

1. Visit any NOSTR-enabled website
2. The extension automatically injects the NOSTR provider
3. Websites can now access your public key and request signatures
4. The extension will handle authentication seamlessly

### Managing Your Identity

- **View Keys**: Click the extension icon to see your public and private keys
- **Copy Keys**: Use the copy buttons to copy your keys for use elsewhere
- **Export Keys**: Click "Export Keys" to download a backup file
- **Import Keys**: Use "Import Existing Identity" to restore from a private key
- **Clear Identity**: Remove your current identity (cannot be undone)

## NOSTR API

The extension provides the standard NOSTR API to websites:

```javascript
// Check if NOSTR provider is available
if (window.nostr) {
  // Get public key
  const pubkey = await window.nostr.getPublicKey();
  
  // Sign an event
  const signedEvent = await window.nostr.signEvent(event);
  
  // Check if unlocked
  const unlocked = await window.nostr.isUnlocked();
}
```

## Development

### File Structure

```
zap-social-extension/
├── manifest.json          # Extension manifest
├── popup.html             # Extension popup UI
├── popup.js               # Popup functionality
├── styles.css             # Styling (Zap Protocol theme)
├── crypto.js              # NOSTR cryptographic functions
├── content.js             # Content script for web injection
├── injected.js            # NOSTR API provider
├── background.js          # Background service worker
└── README.md              # This file
```

### Key Technologies

- **Manifest V3**: Modern Chrome extension format
- **NOSTR Protocol**: Decentralized social networking protocol
- **Secp256k1**: Elliptic curve cryptography (simplified for demo)
- **Web Crypto API**: Browser-native cryptographic functions
- **Chrome Storage API**: Secure local key storage

## Security Notes

⚠️ **Development Version**: This is a development/demo version with simplified cryptography. For production use, implement proper secp256k1 cryptography using libraries like `noble-secp256k1`.

- Keys are stored locally in browser storage
- Private keys are never transmitted to external servers
- Simplified signing implementation for demonstration
- Consider hardware wallet integration for enhanced security

## Customization

The extension uses the Zap Protocol color scheme:
- Primary: `#00aaff` (Electric Blue)
- Background: Dark gradients (`#1a1a1a` to `#2a2a2a`)
- Accents: Subtle borders and glows using the primary color

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Test with multiple NOSTR applications
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Disclaimer

This extension is for educational and development purposes. Always audit cryptographic implementations before using with real funds or sensitive data.
