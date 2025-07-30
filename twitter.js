// Twitter Web Intents integration for Zap Social
// No API keys required - uses Twitter's web interface
class TwitterIntents {
    constructor() {
        // Twitter Web Intent URLs
        this.tweetIntentUrl = 'https://twitter.com/intent/tweet';
        this.followIntentUrl = 'https://twitter.com/intent/follow';
        this.retweetIntentUrl = 'https://twitter.com/intent/retweet';
        this.likeIntentUrl = 'https://twitter.com/intent/like';
    }

    // Share text via Twitter Web Intent
    async shareToTwitter(text, options = {}) {
        const params = new URLSearchParams({
            text: text,
            ...options
        });

        // Open Twitter intent in a new window
        const intentUrl = `${this.tweetIntentUrl}?${params.toString()}`;
        const width = 550;
        const height = 420;
        const left = (screen.width / 2) - (width / 2);
        const top = (screen.height / 2) - (height / 2);

        window.open(
            intentUrl,
            'Share on Twitter',
            `width=${width},height=${height},left=${left},top=${top},toolbar=0,menubar=0`
        );
    }

    // Share NOSTR content to Twitter
    async shareNostrToTwitter(nostrContent, options = {}) {
        const twitterText = this.formatNostrForTwitter(nostrContent);
        return await this.shareToTwitter(twitterText, options);
    }

    formatNostrForTwitter(content) {
        // Add NOSTR context to the tweet
        let twitterText = content;
        
        // Add hashtags for discoverability
        if (!twitterText.includes('#NOSTR')) {
            twitterText += ' #NOSTR #Decentralized';
        }
        
        // Ensure it's under Twitter's character limit
        if (twitterText.length > 280) {
            twitterText = twitterText.substring(0, 277) + '...';
        }
        
        return twitterText;
    }
}

// Make available globally
window.TwitterIntents = TwitterIntents;
