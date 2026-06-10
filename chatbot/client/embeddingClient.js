import { genai } from "../embeddings/Aimodel.js";

export default async function embeddingClient(query) {
    const response = await genai.models.embedContent({
        model: 'gemini-embedding-2',
        contents:query,
    });
    console.log("Embedding response:", response);
    return response.embeddings[0].values;
}