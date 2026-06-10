function normalizeUrl(url) {

    try {

        const parsed =
           new URL(url);

        // Remove fragments
        parsed.hash = "";

        // Remove trailing slash
        let normalized =
           parsed.href.replace(/\/$/, "");

        return normalized;

    } catch {

        return null;
    }
}

export default normalizeUrl;