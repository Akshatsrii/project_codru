import crypto from "crypto";

import extractPage from "./extractPage.js";
import normalizeUrl from "./normalise.js";
import shouldCrawl from "./ShouldCrawl.js";
import saveJson from "./SaveJson.js";

const visited = new Set();
const contentHashes = new Set();

const queue = [];

const MAX_CONCURRENT = 5;

let activeWorkers = 0;

async function worker(domain) {

    while (queue.length > 0) {

        const url = queue.shift();

        if (!url) continue;

        try {

            const normalized =
              normalizeUrl(url);

            if (!normalized) continue;

            if (visited.has(normalized)) {
                continue;
            }

            if (
              !shouldCrawl(
                 normalized,
                 domain
              )
            ) {
                continue;
            }

            visited.add(normalized);

            console.log(
              "Crawling:",
              normalized
            );

            const pageData =
               await extractPage(normalized);

            // Skip empty content
            if (
              !pageData.content ||
              pageData.content.length < 100
            ) {
                continue;
            }

            // Duplicate detection
            const hash =
              crypto
               .createHash("sha256")
               .update(pageData.content)
               .digest("hex");

            if (
              contentHashes.has(hash)
            ) {
                continue;
            }

            contentHashes.add(hash);

            saveJson(pageData);

            for (
              const link
              of pageData.links
            ) {

                try {

                    const nextUrl =
                      new URL(
                        link,
                        normalized
                      ).href;

                    queue.push(nextUrl);

                } catch {}
            }

        } catch (error) {

            console.log(
              "Failed:",
              url
            );
        }
    }

    activeWorkers--;
}

export default async function startCrawler(
   startUrl,
   domain
) {

    queue.push(startUrl);

    for (
      let i = 0;
      i < MAX_CONCURRENT;
      i++
    ) {

        activeWorkers++;

        worker(domain);
    }

    const interval = setInterval(() => {

        if (
          queue.length === 0 &&
          activeWorkers === 0
        ) {

            clearInterval(interval);

            console.log(
              "Crawling completed"
            );

            console.log(
              "Pages crawled:",
              visited.size
            );
        }

    }, 1000);
}
