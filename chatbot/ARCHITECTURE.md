# Architecture Documentation

## System Overview

This document describes the technical architecture of the Chatbot project.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     CHATBOT SYSTEM ARCHITECTURE                 │
└─────────────────────────────────────────────────────────────────┘

    WEB CRAWLER PHASE              INDEXING PHASE           QUERY PHASE
    ────────────────────          ──────────────           ────────────

    Website
       │
       ├─→ [Crawler]              
       │   - BFS traversal
       │   - Extract links
       │
       └─→ [Page Extractor]
           - Parse HTML
           - Clean content
           - Extract metadata
           │
           └─→ [Normalize URLs]
               │
               ├─→ [Save JSON]
               │
               └─→ [JSON Files] ─────────────→ [Text Chunking] ────┐
                                               - Split content      │
                                               - Add overlap        │
                                                                    │
                                          [Embedding Model]  ←─────┘
                                          - gemini-embedding-2
                                          - Convert text→vector
                                                    │
                                                    ↓
                                          [ChromaDB]
                                          - Vector storage
                                          - Metadata index
                                                    │
                    User Query ───────────────────→│
                                               [Search]
                                               - Embed query
                                               - Find similar
                                               - Retrieve top-k
                                                    │
                                                    ↓
                                          [Context Building]
                                          - Concat documents
                                                    │
                                                    ↓
                                          [Generation Model]
                                          - gemini-2.5-flash
                                          - Generate response
                                                    │
                                                    ↓
                                          Response to User
```

## Data Flow Layers

### 1. Crawling Layer
**Components**: `crawler.js`, `extractPage.js`, `normalise.js`, `ShouldCrawl.js`

- **Crawler**: Multi-worker BFS-based web crawler
  - Queue-based URL processing
  - Concurrent workers (max 5)
  - Visited set to prevent re-processing
  - Content hash tracking for deduplication

- **Page Extraction**: Uses Cheerio for DOM parsing
  - Removes unwanted elements (scripts, styles)
  - Extracts title, description, headings
  - Extracts clean text content
  - Extracts internal links

- **URL Normalization**: Standardizes URLs
  - Removes fragments (#)
  - Removes trailing slashes
  - Validates URL format

- **Crawl Filtering**: Prevents unwanted URLs
  - Blocks external domains
  - Blocks social media platforms
  - Blocks CDN and tracking URLs
  - Ignores email/phone/javascript protocols

### 2. Storage Layer
**Components**: `SaveJson.js`, `/data` directory

- **Raw Data Storage**:
  - JSON files for each crawled page
  - Includes: URL, title, description, content, links, headings
  - Filename format: `domain_page-path.html.json`
  - One file per unique page

### 3. Embedding & Indexing Layer
**Components**: `Ingest.js`, `EmbeddingText.js`, `chunkText.js`, `Aimodel.js`

#### Text Chunking
```
Original Text (e.g., 5000 chars)
│
├─ Chunk 1: chars 0-999 (1000 chars)
├─ Chunk 2: chars 800-1799 (overlap starts at 800)
├─ Chunk 3: chars 1600-2599 (overlap starts at 1600)
└─ Chunk N: remaining text
```

- **Parameters**:
  - Chunk size: 1000 characters
  - Overlap: 200 characters
  - Purpose: Preserve context at chunk boundaries

#### Embedding Generation
- **Model**: `gemini-embedding-2`
- **Input**: Text chunk (up to ~10k chars)
- **Output**: Vector embedding (~768 dimensions)
- **Process**:
  1. Read JSON file from data/
  2. Split content into chunks
  3. Generate embedding for each chunk
  4. Create metadata (URL, title, chunk index)
  5. Store in ChromaDB with ID: `{filename}_{chunk_index}`

### 4. Vector Database Layer
**Components**: `Chromadb.js`

- **Provider**: Chroma Cloud
- **Authentication**: API Key, Tenant, Database
- **Collection**: `website_data`
- **Schema**:
  ```
  Collection: website_data
  ├─ ids: string (file_chunkIndex)
  ├─ documents: string (text chunk)
  ├─ embeddings: float[] (vector)
  └─ metadatas: object
     ├─ url: string
     ├─ title: string
     └─ chunkIndex: number
  ```

### 5. Query Layer
**Components**: `embeddingClient.js`, `searchData.js`

#### Query Processing Pipeline
```
User Query
    │
    ├─→ [Embedding Client]
    │   - Convert query to embedding
    │   - Model: gemini-embedding-2
    │
    ├─→ [ChromaDB Search]
    │   - Find nearest vectors (cosine similarity)
    │   - nResults: 5 (top 5 most similar documents)
    │   - Return: documents, metadatas, distances
    │
    ├─→ [Context Builder]
    │   - Join retrieved documents with "\n\n"
    │   - Create prompt with system instruction
    │
    └─→ [Generation Client]
        - Model: gemini-2.5-flash
        - Inputs: System prompt, context, user query
        - Output: Natural language response
```

## Component Interactions

### Initialization Sequence

```
Server Start
    │
    ├─→ Load Environment (.env)
    │
    ├─→ Initialize GoogleGenAI
    │   └─ Create GenAI instance with API key
    │
    ├─→ Initialize ChromaDB Client
    │   └─ CloudClient with credentials
    │
    └─→ Ready for operations
```

### Crawl Execution Sequence

```
startCrawler()
    │
    ├─→ Initialize queue with startUrl
    │
    ├─→ Spawn 5 worker threads
    │
    ├─→ Each worker:
    │   ├─ Dequeue URL
    │   ├─ Normalize URL
    │   ├─ Check if already visited
    │   ├─ Check shouldCrawl filters
    │   ├─ Add to visited set
    │   ├─ Fetch and extract page
    │   ├─ Check content length (min 100 chars)
    │   ├─ Calculate content hash
    │   ├─ Check for duplicates
    │   ├─ Save to JSON
    │   └─ Enqueue all found links
    │
    └─→ Complete when queue empty & no active workers
```

### Ingest Execution Sequence

```
ingest()
    │
    ├─→ Initialize ChromaDB collection
    │
    ├─→ Read data directory
    │
    ├─→ For each JSON file:
    │   ├─ Parse JSON
    │   ├─ Chunk text
    │   │
    │   └─ For each chunk:
    │       ├─ Generate embedding
    │       ├─ Create metadata object
    │       ├─ Add to collection:
    │       │  ├─ ids: [filename_chunkIndex]
    │       │  ├─ documents: [chunk text]
    │       │  ├─ embeddings: [vector]
    │       │  └─ metadatas: [metadata object]
    │       └─ (sequential to avoid rate limiting)
    │
    └─→ Complete when all chunks indexed
```

### Query Execution Sequence

```
searchData(query)
    │
    ├─→ Embed query
    │   └─ embeddingClient(query)
    │
    ├─→ Get collection
    │
    ├─→ Query collection
    │   ├─ Input: query embedding vector
    │   ├─ nResults: 5
    │   └─ Returns: documents[], metadatas[], distances[]
    │
    ├─→ Build context
    │   └─ Join documents with "\n\n"
    │
    ├─→ Generate response
    │   ├─ System prompt: instructions for AI
    │   ├─ Context: retrieved documents
    │   └─ Query: user question
    │
    └─→ Return response.text
```

## Technology Stack Details

### Google GenAI
- **Embedding Model**: `gemini-embedding-2`
  - Used for: Converting text/queries to vectors
  - Dimensions: ~768
  - Performance: Fast, cost-effective

- **Generation Model**: `gemini-2.5-flash`
  - Used for: Generating responses
  - Speed: Fast inference
  - Context window: Suitable for RAG use case

### ChromaDB Cloud
- **Vector Database**: Cloud-hosted vector search
- **Search Method**: Cosine similarity on embeddings
- **Features**: Metadata filtering, persistence, scalability

### Cheerio
- **DOM Parser**: Server-side jQuery-like syntax
- **Use Case**: Extract content from HTML
- **Benefits**: Lightweight, no browser overhead

### Express.js
- **Web Framework**: HTTP server (currently unused in code)
- **Potential**: Can be extended for REST API endpoints

## Performance Considerations

### Crawler Performance
- **Concurrency**: 5 workers balances speed and resource usage
- **URL Normalization**: Prevents duplicate crawls
- **Content Hashing**: O(n) but prevents storage bloat
- **Visited Set**: O(1) lookup for visited URLs

### Embedding Performance
- **Batch Processing**: Process files sequentially to avoid rate limits
- **Chunk Overlap**: Adds ~20% processing but improves context quality
- **Vector Size**: ~768 dims reasonable for semantic search

### Search Performance
- **Vector Search**: Sub-millisecond for typical collections
- **Top-K**: 5 results balances quality and context length
- **Embedding Reuse**: Same embedding model for consistency

## Scalability Considerations

### Current Bottlenecks
1. **Sequential Ingestion**: Process one chunk at a time
2. **API Rate Limits**: Google API may throttle requests
3. **Memory**: Entire content loaded before chunking
4. **Single Website**: Hardcoded target domain

### Scaling Strategies
1. **Batch Embedding**: Accumulate chunks and batch embed
2. **Streaming Processing**: Process files in streams
3. **Distributed Crawling**: Separate crawler instances
4. **Caching**: Cache embeddings locally
5. **Sharding**: Split collections by domain/topic

## Error Handling

### Crawler Level
- URL fetch failures logged and skipped
- Invalid URLs caught and ignored
- Content too short (<100 chars) filtered

### Embedding Level
- API errors would crash process (could add retry logic)
- Invalid JSON would crash process (could add validation)

### Search Level
- Empty query embeddings handled
- No results gracefully handled (returns empty array)

## Security Considerations

### Current Implementation
- API keys stored in `.env` (not committed)
- No input validation on queries
- No authentication/authorization
- No rate limiting

### Recommendations
- Validate and sanitize all inputs
- Implement rate limiting
- Add API authentication
- Use HTTPS in production
- Rotate API keys regularly
- Implement query logging
- Add access controls

## Extension Points

### Easy to Extend
1. **Different Websites**: Change domain in `crawler.js`
2. **Different Chunking**: Modify `chunkText.js` parameters
3. **Different Models**: Update model names in `Aimodel.js`
4. **New Search Filters**: Add to `ShouldCrawl.js`

### Moderate Effort
1. **REST API**: Wrap functions in Express routes
2. **Multiple Websites**: Support array of domains
3. **Custom Extractors**: Add domain-specific extraction
4. **Result Ranking**: Add relevance scoring

### Complex Changes
1. **Multi-language Support**: Requires cross-lingual embeddings
2. **Streaming Responses**: Implement streaming APIs
3. **Real-time Updates**: Add change detection
4. **Fine-tuned Models**: Require additional training data
