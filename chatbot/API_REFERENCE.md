# API Reference

Complete reference for all modules and functions in the chatbot project.

## Table of Contents
1. [Client Module](#client-module)
2. [Embeddings Module](#embeddings-module)
3. [Vector Module](#vector-module)
4. [Services Module](#services-module)
5. [Data Models](#data-models)

---

## Client Module

### `embeddingClient(query)`

Generates an embedding vector for a user query.

**Location**: `client/embeddingClient.js`

**Parameters**:
- `query` (string): The search query text

**Returns**:
- `Promise<number[]>`: Array of embedding values (~768 dimensions)

**Example**:
```javascript
import embeddingClient from "./client/embeddingClient.js";

const embedding = await embeddingClient("What courses are available?");
console.log(embedding); // [0.123, 0.456, ...]
```

**Dependencies**:
- Google GenAI (model: `gemini-embedding-2`)

---

### `searchData(query)`

Searches the vector database and generates a response.

**Location**: `client/searchData.js`

**Parameters**:
- `query` (string): The user question

**Returns**:
- `Promise<Object>`: 
  ```javascript
  {
    documents: [["chunk1", "chunk2", ...]],
    metadatas: [[{url, title, chunkIndex}, ...]],
    distances: [[0.1, 0.2, ...]]  // similarity scores
  }
  ```

**Output**: Prints generated response to console

**Example**:
```javascript
import searchData from "./client/searchData.js";

const results = await searchData("Tell me about the courses");
// Retrieves 5 most similar documents
// Generates and logs response
```

**Process**:
1. Embed the query
2. Search ChromaDB for similar documents
3. Retrieve top 5 results
4. Build context from retrieved documents
5. Generate response using GenAI
6. Output response

**Dependencies**:
- `embeddingClient`
- `getCollection` (ChromaDB)
- `genai` (Google GenAI)

---

## Embeddings Module

### `createEmbedding(text)`

Converts text content to embedding vector.

**Location**: `embeddings/EmbeddingText.js`

**Parameters**:
- `text` (string): Text content to embed

**Returns**:
- `Promise<number[]>`: Embedding vector

**Example**:
```javascript
import createEmbedding from "./embeddings/EmbeddingText.js";

const embedding = await createEmbedding("About Us: We teach coding...");
```

**Model**: `gemini-embedding-2` from Google GenAI

---

### `ingest()`

Main ingestion pipeline. Reads JSON files, chunks text, generates embeddings, and stores in ChromaDB.

**Location**: `embeddings/Ingest.js`

**Parameters**: None

**Process**:
1. Get ChromaDB collection (`website_data`)
2. Read all files from `data/` directory
3. For each file:
   - Parse JSON
   - Chunk text using `chunkText()`
   - Generate embedding for each chunk
   - Add to ChromaDB collection

**Output**: Console logs progress

**Run**: `node embeddings/Ingest.js`

**Dependencies**:
- `chunkText`
- `createEmbedding`
- `getCollection` (ChromaDB)

**Notes**:
- Sequential processing to respect rate limits
- Creates IDs: `{filename}_{chunk_index}`
- Stores metadata: url, title, chunkIndex

---

### `chunkText(text, chunkSize = 1000, overlap = 200)`

Splits text into overlapping chunks.

**Location**: `embeddings/chunkText.js`

**Parameters**:
- `text` (string): Text to chunk
- `chunkSize` (number, default: 1000): Size of each chunk in characters
- `overlap` (number, default: 200): Number of overlapping characters

**Returns**:
- `string[]`: Array of text chunks

**Example**:
```javascript
import chunkText from "./embeddings/chunkText.js";

const text = "Long content..."; // 5000 chars
const chunks = chunkText(text, 1000, 200);
// chunks[0]: chars 0-999
// chunks[1]: chars 800-1799
// chunks[2]: chars 1600-2599
```

**Algorithm**:
```
for i = 0 to text.length step (chunkSize - overlap):
  push text.slice(i, i + chunkSize)
```

---

### `genai`

Google GenAI client instance.

**Location**: `embeddings/Aimodel.js`

**Properties**:
- `models`: GenAI models namespace

**Available Models**:
- `gemini-embedding-2`: Text-to-vector
- `gemini-2.5-flash`: Text generation

**Example**:
```javascript
import genai from "./embeddings/Aimodel.js";

// Embeddings
const embResp = await genai.models.embedContent({
  model: 'gemini-embedding-2',
  contents: 'text to embed'
});

// Generation
const genResp = await genai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: 'prompt'
});
```

**Configuration**: Uses `GOOGLE_API_KEY2` from `.env`

---

## Vector Module

### `getCollection()`

Gets or creates ChromaDB collection.

**Location**: `vector/Chromadb.js`

**Parameters**: None

**Returns**:
- `Promise<Collection>`: ChromaDB collection object

**Collection Operations**:
```javascript
const collection = await getCollection();

// Add documents
await collection.add({
  ids: ["doc_1"],
  documents: ["text content"],
  embeddings: [vector],
  metadatas: [{key: "value"}]
});

// Query
const results = await collection.query({
  queryEmbeddings: [queryVector],
  nResults: 5
});

// Get
const doc = await collection.get({
  ids: ["doc_1"]
});

// Delete
await collection.delete({
  ids: ["doc_1"]
});
```

**Collection Name**: `website_data`

**Provider**: ChromaDB Cloud

**Configuration**: Uses `API_KEY`, `TENANT`, `DATABASE` from `.env`

---

## Services Module

### `startCrawler(startUrl, domain)`

Starts the web crawler.

**Location**: `services/crawler.js`

**Parameters**:
- `startUrl` (string): Initial URL to crawl
- `domain` (string): Domain to restrict crawling to

**Returns**: None (runs indefinitely until complete)

**Example**:
```javascript
startCrawler(
  "https://curiousteamlearning.com",
  "https://curiousteamlearning.com"
);
```

**Features**:
- BFS-based queue processing
- 5 concurrent workers
- Duplicate detection (content hashing)
- URL normalization
- Link extraction
- Metadata collection

**Output**: Logs to console
- "Crawling: {url}"
- "Failed: {url}"
- "Crawling completed"
- "Pages crawled: {count}"

**Saved Data**: JSON files in `data/` directory

---

### `extractPage(url)`

Extracts content from a single HTML page.

**Location**: `services/extractPage.js`

**Parameters**:
- `url` (string): URL to fetch

**Returns**:
- `Promise<Object>`:
  ```javascript
  {
    url: string,
    title: string,
    description: string,
    headings: string[],
    content: string,
    links: string[]
  }
  ```

**Process**:
1. Fetch URL
2. Parse HTML with Cheerio
3. Remove scripts, styles, noscript tags
4. Extract title, description
5. Extract all headings (h1, h2, h3)
6. Extract body text (normalized whitespace)
7. Extract all links
8. Return structured data

**Parsing Library**: Cheerio

---

### `normalizeUrl(url)`

Normalizes a URL to a canonical form.

**Location**: `services/normalise.js`

**Parameters**:
- `url` (string): URL to normalize

**Returns**:
- `string | null`: Normalized URL or null if invalid

**Transformations**:
- Removes URL fragments (#)
- Removes trailing slashes (/)
- Validates URL format

**Example**:
```javascript
normalizeUrl("https://example.com/page#section") 
// → "https://example.com/page"

normalizeUrl("https://example.com/")
// → "https://example.com"
```

---

### `shouldCrawl(url, domain)`

Determines if a URL should be crawled.

**Location**: `services/ShouldCrawl.js`

**Parameters**:
- `url` (string): URL to evaluate
- `domain` (string): Parent domain

**Returns**:
- `boolean`: true if URL should be crawled

**Filtering Rules**:
1. Rejects empty/null URLs
2. Ignores URL fragments (#)
3. Blocks special protocols:
   - `tel:` (phone)
   - `mailto:` (email)
   - `javascript:` (javascript)
4. Blocks external domains:
   - instagram.com
   - facebook.com
   - linkedin.com
   - wa.me (WhatsApp)
   - t.me (Telegram)
   - google.com
5. Blocks CDN URLs (`/cdn-cgi/`)
6. **Must**: Start with parent domain

**Example**:
```javascript
shouldCrawl("https://example.com/page", "https://example.com")
// → true

shouldCrawl("https://facebook.com/share", "https://example.com")
// → false

shouldCrawl("tel:+1234567890", "https://example.com")
// → false
```

---

### `saveJson(pageData)`

Saves extracted page data to JSON file.

**Location**: `services/SaveJson.js`

**Parameters**:
- `pageData` (Object): Page data object from `extractPage()`

**File Format**:
- Name: `{domain}_{path}.html.json`
- Location: `data/` directory
- Content: Pretty-printed JSON

**Example**:
```javascript
await saveJson({
  url: "https://example.com/about",
  title: "About Us",
  description: "...",
  content: "...",
  links: [...],
  headings: [...]
});
// Creates: data/example.com_about.html.json
```

---

## Data Models

### Page Data Object

Structure returned by `extractPage()`:

```javascript
{
  url: string,           // Full URL of page
  title: string,         // Page title (from <title> tag)
  description: string,   // Meta description
  content: string,       // Full page text content
  headings: string[],    // All h1, h2, h3 elements
  links: string[]        // All href values found
}
```

### Chunk Object (Internal)

Created by `chunkText()`:

```javascript
{
  // String of up to 1000 characters
  // May overlap with previous/next chunks
}
```

### Embedding Object

Created by `createEmbedding()`:

```javascript
number[]  // Float array, ~768 dimensions
```

### ChromaDB Document

Stored in collection:

```javascript
{
  id: string,          // Format: "{filename}_{chunk_index}"
  document: string,    // Text chunk
  embedding: number[], // Vector embedding
  metadata: {
    url: string,       // Original page URL
    title: string,     // Page title
    chunkIndex: number // Chunk number within document
  }
}
```

### Search Results

Returned by `collection.query()`:

```javascript
{
  documents: [[string, ...]],    // Nested array of text chunks
  metadatas: [[Object, ...]],    // Nested array of metadata
  distances: [[number, ...]]     // Nested array of distances (0-1)
}
```

### Generation Response

Returned by `genai.models.generateContent()`:

```javascript
{
  text: string  // Generated response text
}
```

---

## Environment Variables

```env
# Google GenAI Configuration
GOOGLE_API_KEY2=<api_key>

# ChromaDB Cloud Configuration
API_KEY=<chroma_api_key>
TENANT=<tenant_name>
DATABASE=<database_name>
```

---

## Error Handling

### Common Errors

**GOOGLE_API_KEY2 not set**
- Error: API key missing
- Solution: Add to `.env`

**ChromaDB connection failed**
- Error: Invalid credentials or no network
- Solution: Verify API_KEY, TENANT, DATABASE in `.env`

**Page extraction failed**
- Error: Network error fetching URL
- Solution: Check URL accessibility

**No search results**
- Error: Query returns empty array
- Solution: Run ingestion to populate vector database

---

## Performance Metrics

### Typical Operation Times

| Operation | Time | Notes |
|-----------|------|-------|
| Embed query | 100-200ms | Per query |
| Search vector DB | 10-50ms | For 5 results |
| Generate response | 1-2s | Depends on context length |
| Extract page | 200-500ms | Per page |
| Create embedding | 100-300ms | Per chunk |
| Crawl page | 300-800ms | With extraction |

---

## Rate Limits

- **Google GenAI**: API-dependent (check quota)
- **ChromaDB**: Cloud plan-dependent
- **Web Crawler**: Consider target server load (5 concurrent workers)

---

## Module Dependencies

```
client/
├─ searchData.js
│  ├─ embeddingClient
│  ├─ Chromadb.getCollection
│  └─ Aimodel (genai)
└─ embeddingClient.js
   └─ Aimodel (genai)

embeddings/
├─ Ingest.js
│  ├─ chunkText
│  ├─ EmbeddingText.createEmbedding
│  └─ Chromadb.getCollection
├─ EmbeddingText.js
│  └─ Aimodel (genai)
└─ chunkText.js

services/
├─ crawler.js
│  ├─ extractPage
│  ├─ normalise
│  ├─ ShouldCrawl
│  └─ SaveJson
├─ extractPage.js
│  └─ (cheerio for DOM parsing)
├─ normalise.js
├─ ShouldCrawl.js
└─ SaveJson.js

vector/
└─ Chromadb.js
   └─ (chromadb library)
```

---

## Usage Examples

### Basic Search Query

```javascript
import searchData from "./client/searchData.js";

const query = "What programming languages are taught?";
const results = await searchData(query);
// Prints AI-generated response
```

### Custom Crawl

```javascript
import { startCrawler } from "./services/crawler.js";

startCrawler(
  "https://mynewsite.com",
  "https://mynewsite.com"
);
```

### Manual Embedding Creation

```javascript
import createEmbedding from "./embeddings/EmbeddingText.js";
import { getCollection } from "./vector/Chromadb.js";

const text = "Custom content to embed";
const embedding = await createEmbedding(text);

const collection = await getCollection();
await collection.add({
  ids: ["custom_1"],
  documents: [text],
  embeddings: [embedding],
  metadatas: [{custom: true}]
});
```

### Extract Single Page

```javascript
import extractPage from "./services/extractPage.js";

const data = await extractPage("https://example.com/about");
console.log(data.title, data.content);
```
