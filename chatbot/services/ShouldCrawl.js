function shouldCrawl(url, domain) {

    if (!url) return false;

    // Ignore fragments
    if (url.startsWith("#")) {
        return false;
    }

    // Ignore phone/email/javascript
    if (
        url.startsWith("tel:") ||
        url.startsWith("mailto:") ||
        url.startsWith("javascript:")
    ) {
        return false;
    }

    // Ignore social/media links
    const blockedDomains = [
        "instagram.com",
        "facebook.com",
        "linkedin.com",
        "wa.me",
        "t.me",
        "google.com"
    ];

    for (const blocked of blockedDomains) {

        if (url.includes(blocked)) {
            return false;
        }
    }

    // Ignore Cloudflare junk
    if (url.includes("/cdn-cgi/")) {
        return false;
    }

    // Internal domain only
    return url.startsWith(domain);
}

export default shouldCrawl;