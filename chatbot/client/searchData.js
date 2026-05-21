import embeddingClient from "../client/embeddingClient.js";
import getCollection from "../vector/Chromadb.js";
import genai from "../embeddings/Aimodel.js";

const query = "tell me about modi ji";

export default async function searchData(query) {

    // Create query embedding
    const queryEmbedding = await embeddingClient(query);

    // Get collection
    const collection = await getCollection();

    // Search similar docs
    const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: 5,
    });

    return results;
}

const results = await searchData(query);

// console.log("Search results:", results);

// Extract retrieved documents
const docs = results.documents[0];

// Convert array to text context
const context = docs.join("\n\n");


// Generate response
const response = await genai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `
You are a helpful AI assistant.

Use the provided context to answer the user's question.

If the answer is unavailable in context, say:
"I could not find sufficient information."

Context:
${context}

Question:
${query}
`
});

console.log("Generated response:");
console.log(response.text);
