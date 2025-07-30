# Contributing to Social Wallet Extension

Thank you for your interest in contributing to Social Wallet Extension! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- Git
- A Chromium-based browser (Chrome, Edge) or Firefox for testing

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/yourusername/social-wallet-extension.git
   cd social-wallet-extension
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Load Extension for Testing**
   - Chrome: Go to `chrome://extensions/`, enable Developer mode, click "Load unpacked"
   - Firefox: Go to `about:debugging`, click "Load Temporary Add-on"

## 🛠️ Development Guidelines

### Code Style

- Use consistent indentation (2 spaces)
- Follow JavaScript ES6+ standards
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused

### File Organization

- **Core Extension**: `manifest.json`, `popup.html`, `popup.js`, `background.js`
- **Content Scripts**: `content.js`, `injected.js`
- **Utilities**: `crypto.js`, `nostr-utils.js`, `slidechain-balance.js`
- **Social Integration**: `twitter.js`
- **Styles**: `styles.css`, `profile.css`

### Testing

Before submitting a PR, please test:

1. **Extension Loading**: Verify the extension loads without errors
2. **Key Generation**: Test new identity creation
3. **Key Import**: Test importing existing NOSTR keys
4. **Balance Display**: Verify SlideChain balance queries work
5. **Social Integration**: Test Twitter/X integration
6. **Cross-Browser**: Test on both Chrome and Firefox

## 📝 Pull Request Process

### Before You Submit

1. **Create an Issue**: For new features or major changes, create an issue first
2. **Branch Naming**: Use descriptive branch names (`feature/add-ethereum-support`, `fix/balance-display-bug`)
3. **Commit Messages**: Write clear, descriptive commit messages

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] All tests pass
- [ ] Extension loads without console errors
- [ ] README updated if needed
- [ ] No sensitive data (private keys, API keys) in code

### Review Process

1. Submit your PR with a clear description
2. Link any related issues
3. Be responsive to feedback
4. Make requested changes promptly

## 🐛 Bug Reports

When reporting bugs, please include:

- **Browser and Version**: Chrome 120.0.6099.109, Firefox 121.0, etc.
- **Extension Version**: Current version number
- **Steps to Reproduce**: Clear, numbered steps
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Screenshots**: If applicable
- **Console Errors**: Any error messages

## 💡 Feature Requests

For new features:

- Check existing issues first
- Provide a clear use case
- Explain the expected behavior
- Consider implementation complexity
- Discuss potential alternatives

## 🔒 Security Guidelines

### Reporting Security Issues

**Do not open public issues for security vulnerabilities.**

Instead:
1. Email security concerns to: [security-email]
2. Provide detailed information about the vulnerability
3. Allow time for the issue to be addressed before public disclosure

### Security Best Practices

- Never commit private keys or sensitive data
- Use secure randomness for key generation
- Validate all user inputs
- Follow browser extension security guidelines
- Keep dependencies updated

## 🎯 Areas Where We Need Help

- **Documentation**: Improve README, add tutorials
- **Testing**: Cross-browser compatibility testing
- **UI/UX**: Design improvements and accessibility
- **Security**: Cryptographic review and improvements
- **Features**: 
  - Hardware wallet integration
  - Additional blockchain support
  - Enhanced social platform integration
  - Profile management features

## 📚 Resources

### NOSTR Protocol
- [NOSTR NIPs](https://github.com/nostr-protocol/nips)
- [NOSTR Tools](https://github.com/nbd-wtf/nostr-tools)

### Browser Extensions
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [Firefox Extension Docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)

### Blockchain Integration
- [Polkadot.js Documentation](https://polkadot.js.org/docs/)
- [Substrate Documentation](https://docs.substrate.io/)

## 🤝 Community

- **GitHub Discussions**: Ask questions and share ideas
- **Issues**: Report bugs and request features
- **Pull Requests**: Contribute code improvements

## 📋 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Social Wallet Extension! 🚀
