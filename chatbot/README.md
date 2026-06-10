# Chatbot Project

A Retrieval-Augmented Generation (RAG) chatbot that crawls a website, creates semantic embeddings, and answers questions based on the website content.

## Overview

This project implements an intelligent chatbot that:
- **Crawls** website content automatically
- **Embeds** text using Google Generative AI embeddings
- **Stores** embeddings in ChromaDB vector database
- **Retrieves** relevant documents using semantic search
- **Generates** context-aware responses using Google Generative AI

## Tech Stack

- **Node.js** - Runtime environment (ES6 modules)
- **Express.js** - Web server framework
- **Google GenAI** - Embedding and generation models
- **ChromaDB** - Vector database for semantic search
- **Cheerio** - HTML parsing and web scraping
- **dotenv** - Environment configuration

## Project Structure

```
chatbot/
├── Server.js                 # Express server (main entry point)
├── package.json             # Project dependencies
├── .env                     # Environment variables (not tracked)
├── client/
│   ├── embeddingClient.js  # Query embedding generation
│   └── searchData.js       # Search and response generation
├── embeddings/
│   ├── Aimodel.js          # Google GenAI initialization
│   ├── EmbeddingText.js    # Text embedding creation
│   ├── Ingest.js           # Data ingestion pipeline
│   └── chunkText.js        # Text chunking utility
├── services/
│   ├── crawler.js          # Web crawler
│   ├── extractPage.js      # HTML content extraction
│   ├── normalise.js        # URL normalization
│   ├── ShouldCrawl.js      # Crawl filtering logic
│   └── SaveJson.js         # JSON persistence
├── vector/
│   └── Chromadb.js         # ChromaDB client initialization
└── data/                   # Crawled content (JSON files)
```

## Setup & Installation

### Prerequisites

- Node.js 16+ installed
- Google API key for GenAI (with embeddings & generative models enabled)
- ChromaDB cloud account with credentials

### Installation Steps

1. **Clone/Navigate to project**
   ```bash
   cd chatbot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create `.env` file** with the following variables:
   ```env
   GOOGLE_API_KEY2=your_google_genai_api_key
   API_KEY=your_chromadb_api_key
   TENANT=your_chromadb_tenant
   DATABASE=your_chromadb_database_name
   ```

4. **Verify `.env` is in `.gitignore`** to protect sensitive data

## Usage

### 1. Crawl Website Content

Extract content from the target website:

```bash
node services/crawler.js
```

This will:
- Crawl `https://curiousteamlearning.com` and all internal links
- Extract text, title, description, and links
- Remove duplicates and filter unwanted content
- Save extracted data to `data/` folder as JSON files

### 2. Ingest Data into Vector Database

Create embeddings and store in ChromaDB:

```bash
node embeddings/Ingest.js
```

This will:
- Read all JSON files from `data/`
- Split content into overlapping chunks (1000 chars, 200 char overlap)
- Generate embeddings using `gemini-embedding-2` model
- Store embeddings with metadata in ChromaDB collection `website_data`

### 3. Search and Generate Responses

Query the chatbot:

```bash
node client/searchData.js
```

This will:
- Take the query (hardcoded as "tell me about modi ji")
- Create an embedding for the query
- Search for 5 most similar documents in ChromaDB
- Generate a contextual response using `gemini-2.5-flash` model
- Print the response to console

**To use a different query**, modify the `query` variable in [searchData.js](client/searchData.js#L3).

## Architecture

### Data Pipeline

```
Website
   ↓
[Crawler] → Extract URLs, content, metadata
   ↓
[JSON Files] → Stored in /data directory
   ↓
[Ingest] → Read files, chunk text
   ↓
[Embedding Model] → Generate vector embeddings
   ↓
[ChromaDB] → Store vectors with metadata
   ↓
[Search] → User query → Find similar documents
   ↓
[Generation] → Context + Query → Generate Response
```

### Component Details

**Crawler** (`crawler.js`)
- Starts from a root URL and uses BFS with a queue
- Concurrent processing with max 5 workers
- Filters URLs (no fragments, social media, external domains)
- Removes duplicate content using content hashing
- Normalizes URLs before processing

**Text Processing** 
- `chunkText.js`: Splits text into overlapping chunks to preserve context
- Default: 1000 character chunks with 200 character overlap

**Embeddings**
- `EmbeddingText.js`: Converts text chunks to vector embeddings
- Uses `gemini-embedding-2` model from Google GenAI
- Supports both document and query embeddings

**Vector Search**
- `Chromadb.js`: Manages ChromaDB cloud connection
- Collection: `website_data`
- Retrieves top-k similar documents based on embedding similarity

**Response Generation**
- Retrieves relevant context documents
- Sends context + query to `gemini-2.5-flash` model
- Generates contextual responses based on website content

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GOOGLE_API_KEY2` | Google GenAI API key | `sk-...` |
| `API_KEY` | ChromaDB API authentication key | `abc123...` |
| `TENANT` | ChromaDB tenant identifier | `default` |
| `DATABASE` | ChromaDB database name | `default` |

## Configuration

### Crawler Configuration
- **Start URL**: `https://curiousteamlearning.com` (in `crawler.js`)
- **Max Concurrent Workers**: 5 (configurable in `crawler.js`)
- **Blocked Domains**: Instagram, Facebook, LinkedIn, Telegram, etc.

### Text Chunking
- **Chunk Size**: 1000 characters
- **Overlap**: 200 characters (in `chunkText.js`)

### Vector Search
- **Top-K Results**: 5 documents (in `searchData.js`)
- **Model**: `gemini-embedding-2` for embeddings
- **Generation Model**: `gemini-2.5-flash` for responses

## Key Features

✅ **Automatic Web Crawling** - Crawls websites recursively
✅ **Smart Content Extraction** - Removes scripts, styles, boilerplate
✅ **Semantic Search** - Vector embeddings for similarity matching
✅ **Duplicate Detection** - Content hashing prevents duplicates
✅ **Context-Aware Generation** - RAG approach with retrieved context
✅ **Metadata Tracking** - URL, title, chunk index preserved

## Workflow

1. **Data Collection**: Run crawler to extract website content
2. **Data Preparation**: Store extracted data as JSON files
3. **Vector Indexing**: Run ingestion to create embeddings and store
4. **Query Processing**: Submit queries to search and generate responses

## API Models

### Embedding Model
- **Model**: `gemini-embedding-2`
- **Purpose**: Convert text to vector embeddings
- **Dimensions**: ~768 dimensions (standard for embeddings)

### Generation Model
- **Model**: `gemini-2.5-flash`
- **Purpose**: Generate contextual responses
- **Input**: System prompt + context + user query
- **Output**: Natural language response

## Limitations & Future Improvements

### Current Limitations
- Query is hardcoded (needs API endpoint for dynamic queries)
- No persistent session management
- No streaming responses
- Single website target
- No authentication/authorization

### Potential Improvements
- [ ] REST API endpoints for querying
- [ ] Web UI for search interface
- [ ] Support for multiple websites
- [ ] Real-time streaming responses
- [ ] Session management and chat history
- [ ] Rate limiting and usage tracking
- [ ] Fine-tuned embedding models
- [ ] Automatic periodic re-crawling
- [ ] Query expansion and synonyms
- [ ] Response quality metrics

## Troubleshooting

### Embedding API Errors
- Verify `GOOGLE_API_KEY2` is valid and has embeddings enabled
- Check rate limits on Google API quota

### ChromaDB Connection Issues
- Verify credentials (API_KEY, TENANT, DATABASE)
- Check network connectivity
- Ensure ChromaDB account is active

### Crawler Issues
- Check if website is accessible
- Verify `shouldCrawl` filters aren't blocking legitimate URLs
- Monitor console for crawl status

### No Search Results
- Run ingestion again to ensure data is indexed
- Verify documents were successfully added to ChromaDB
- Check collection name matches (`website_data`)

## Testing

To test the pipeline:

```bash
# Step 1: Crawl content
node services/crawler.js

# Step 2: Verify data directory has files
ls data/

# Step 3: Ingest embeddings
node embeddings/Ingest.js

# Step 4: Test search/generation
node client/searchData.js
```

## License

ISC

## Author Notes

This is a foundation for a production-grade RAG chatbot. The modular structure allows easy extension for additional websites, models, and features.
