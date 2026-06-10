import { ChromaClient }
from "chromadb";

import { CloudClient } from "chromadb";
import dotenv from "dotenv";
dotenv.config();
const client = new CloudClient({
   apiKey: process.env.CHROMADB_API_KEY,
    tenant: process.env.TENANT,
    database: process.env.DATABASE
});

async function getCollection() {

   return await client
   .getOrCreateCollection({
      name: "website_data"
   });
}

export default getCollection;