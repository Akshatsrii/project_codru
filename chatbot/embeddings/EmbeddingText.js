import {genai} from "./Aimodel.js";

export default async function createEmbedding(text) {
    const response = await genai.models.embedContent({
        model: 'gemini-embedding-2',
        contents:text,
    });
    return response.embeddings[0].values;
}

