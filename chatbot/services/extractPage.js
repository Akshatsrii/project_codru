import * as cheerio from "cheerio";

 export default async function extractPage(url) {
        
    const response = await fetch(url);
    if (!response.ok) {
        console.error(`Failed to fetch ${url}: ${response.statusText}`);
        return null;
    }

    const data = await response.text();

    const $ = cheerio.load(data);

    // Remove junk
    $("script").remove();
    $("style").remove();
    $("noscript").remove();

    // Title
    const title = $("title").text().trim();

    // Meta description
    const description =
      $('meta[name="description"]')
      .attr("content") || "";

    // Headings
    const headings = [];

    $("h1, h2, h3").each((i, el) => {
        headings.push($(el).text().trim());
    });

    // Content
    const content = $("body")
      .text()
      .replace(/\s+/g, " ")
      .trim();

    // Links
    const links = [];

    $("a").each((i, el) => {

        const href = $(el).attr("href");

        if (!href) return;

        links.push(href);
    });

    return {
        url,
        title,
        headings,
        metadata: {
            description
        },
        content,
        links,
        scrapedAt: new Date().toISOString()
    };
}

