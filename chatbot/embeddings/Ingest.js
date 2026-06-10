  import fs from "fs";
  import path from "path";

  import chunkText
  from "./chunkText.js";

  import createEmbedding
  from "./EmbeddingText.js";

  import getCollection
  from "../vector/Chromadb.js";

  async function ingest() {

      const collection =
        await getCollection();

      const pagesDir =
        path.join(
          process.cwd(),
          "data"
        );

      const files =
        fs.readdirSync(pagesDir);

      for (const file of files) {

          console.log(
            "Processing:",
            file
          );

          const raw =
            fs.readFileSync(
              path.join(
                  pagesDir,
                  file
              ),
              "utf-8"
            );

          const page =
            JSON.parse(raw);

          const chunks =
            chunkText(page.content);

          for (
            let i = 0;
            i < chunks.length;
            i++
          ) {

              const chunk =
                chunks[i];

              console.log(
                "Embedding chunk:",
                i
              );

              const embedding =
                await createEmbedding(
                  chunk
                );

              await collection.add({

                  ids: [
                    `${file}_${i}`
                  ],

                  documents: [
                    chunk
                  ],

                  embeddings: [
                    embedding
                  ],

                  metadatas: [
                    {
                      url: page.url,
                      title: page.title,
                      chunkIndex: i
                    }
                  ]
              });
          }
      }

      console.log(
        "Embeddings completed"
      );
  }

  

  export default ingest;