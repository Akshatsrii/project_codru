import embeddingClient from "../client/embeddingClient.js";
import getCollection from "../vector/Chromadb.js";
import genai from "../embeddings/Aimodel.js";


 async function searchData(query) {

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

// Generate response
const generateResponse = async (query, context) => {
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
return response.text;
};

export {generateResponse, searchData};
