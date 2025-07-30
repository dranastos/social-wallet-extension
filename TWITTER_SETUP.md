# Twitter Integration Setup for Zap Social

## Prerequisites

To enable Twitter integration in your Zap Social extension, you need to create a Twitter Developer App and obtain API credentials.

## Step 1: Create a Twitter Developer Account

1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Sign in with your Twitter account
3. Apply for a developer account if you haven't already
4. Create a new project/app

## Step 2: Configure Your Twitter App

1. In the Twitter Developer Portal, create a new App
2. Fill in the required information:
   - **App name**: Zap Social Extension (or your preferred name)
   - **Description**: NOSTR identity management and social sharing extension
   - **Website URL**: `https://github.com/yourusername/zap-social` (or your project URL)

## Step 3: Set Up OAuth 2.0

1. Go to your app's settings
2. Navigate to "User authentication settings"
3. Enable OAuth 2.0
4. Set the callback URL to: `chrome-extension://[YOUR_EXTENSION_ID]/oauth-callback.html`
   - You'll get your extension ID after loading the extension in Chrome
   - Alternatively, use a temporary URL like `http://localhost:3000/callback` during development
5. Set permissions to: **Read and Write**
6. Enable "Request email from users" if needed

## Step 4: Get Your API Keys

1. Go to the "Keys and Tokens" tab
2. Copy your **Client ID** (this is what you'll enter in the extension)
3. Generate and copy your **Client Secret** (keep this secure!)

## Step 5: Configure the Extension

1. Load your Zap Social extension in Chrome
2. Open the extension popup
3. Expand the "🐦 Twitter Integration" section
4. Enter your **Client ID** and **Client Secret**
5. Click "Save API Config"
6. Click "Login with Twitter" to authenticate

## Step 6: Update Callback URL (Production)

After loading the extension, you'll see your actual extension ID in Chrome:
1. Go to `chrome://extensions/`
2. Find your Zap Social extension
3. Copy the extension ID
4. Go back to Twitter Developer Portal
5. Update the callback URL to: `chrome-extension://[ACTUAL_EXTENSION_ID]/oauth-callback.html`

## Features

Once configured, you can:

- **Login with Twitter**: Authenticate your Twitter account
- **Share to Twitter**: Quick share your NOSTR identity 
- **Compose Tweets**: Write and post tweets directly from the extension
- **Auto-logout**: Securely logout from Twitter when needed

## Security Notes

- Your API keys are stored locally in Chrome's extension storage
- Tokens are automatically refreshed when they expire
- Use the logout feature to revoke access when needed

## Troubleshooting

### Common Issues:

1. **"Twitter API credentials not configured"**
   - Make sure you've entered both Client ID and Client Secret
   - Click "Save API Config" after entering credentials

2. **"Authentication failed"**
   - Check that your callback URL is correctly set in Twitter Developer Portal
   - Ensure your app has the correct permissions (Read and Write)

3. **"Tweet failed"**
   - Check that your Twitter app has write permissions
   - Ensure you haven't exceeded Twitter's rate limits
   - Make sure your tweet is under 280 characters

### Rate Limits:

Twitter has rate limits for API usage:
- Tweet creation: 300 tweets per 15-minute window
- Authentication: Limited number of login attempts

### Support:

If you encounter issues:
1. Check the browser console for detailed error messages
2. Verify your Twitter app settings match the requirements above
3. Ensure your Twitter developer account is in good standing
