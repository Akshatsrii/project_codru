# Setup Guide

Complete step-by-step guide to set up and run the chatbot project.

## Prerequisites

### System Requirements
- **Node.js**: Version 16 or higher
- **npm**: Comes with Node.js
- **Internet Connection**: Required for API calls
- **OS**: Windows, macOS, or Linux

### Accounts Required
1. **Google GenAI Account**
   - API key with access to:
     - `gemini-embedding-2` model
     - `gemini-2.5-flash` model
   - Get it at: https://aistudio.google.com/app/apikeys

2. **ChromaDB Cloud Account**
   - API credentials
   - Tenant name
   - Database name
   - Sign up at: https://www.trychroma.com/

## Installation Steps

### Step 1: Verify Node.js Installation

```powershell
# Check Node version
node --version    # Should be v16.0.0 or higher

# Check npm version
npm --version     # Should be 8.0.0 or higher
```

If not installed, download from https://nodejs.org/

### Step 2: Clone/Navigate to Project

```powershell
# Navigate to project directory
cd d:\chatbot

# Verify project structure
dir  # Should see package.json, Server.js, client/, embeddings/, etc.
```

### Step 3: Install Dependencies

```powershell
npm install
```

**Expected output**:
```
added X packages in Xs
```

**Installed packages**:
- `@google/genai` - Google Generative AI library
- `chromadb` - Vector database client
- `cheerio` - HTML parser
- `express` - Web framework
- `dotenv` - Environment configuration

### Step 4: Get API Credentials

#### Google GenAI API Key

1. Visit: https://aistudio.google.com/app/apikeys
2. Click "Create API Key"
3. Choose/Create a Google Cloud project
4. Copy the generated API key
5. Save securely

#### ChromaDB Credentials

1. Visit: https://www.trychroma.com/
2. Sign up or log in
3. Create a new database (or use existing)
4. Get credentials:
   - API Key
   - Tenant name
   - Database name
5. Save securely

### Step 5: Create Environment File

Create `.env` file in project root (`d:\chatbot\.env`):

```env
GOOGLE_API_KEY2=your_google_genai_api_key_here
API_KEY=your_chromadb_api_key_here
TENANT=your_chromadb_tenant_name
DATABASE=your_chromadb_database_name
```

**Important**: Replace with actual values from Step 4

**Example** (DO NOT use these):
```env
GOOGLE_API_KEY2=AIzaSyDVfCabcdef1234567890ghijklmnopqrst
API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
TENANT=default
DATABASE=my_chatbot
```

### Step 6: Verify .env Security

Ensure `.env` is in `.gitignore`:

```powershell
# Check if .gitignore exists
type .gitignore

# If .gitignore doesn't exist, create it
@"
node_modules/
.env
.env.local
dist/
build/
"@ | Out-File .gitignore -Encoding utf8
```

## Verification & Testing

### Test 1: Check Dependencies

```powershell
npm list
```

Should show all dependencies installed correctly.

### Test 2: Verify Environment

```powershell
# Check if .env file exists
type .env
```

Should display your environment variables (API keys will be hidden if you're careful).

### Test 3: Test Google GenAI Connection

Create a test file `test-genai.js`:

```javascript
import dotenv from "dotenv";
import genai from "./embeddings/Aimodel.js";

dotenv.config();

async function test() {
    try {
        const response = await genai.models.embedContent({
            model: 'gemini-embedding-2',
            contents: 'test',
        });
        console.log("✓ Google GenAI connection successful");
        console.log("Embedding length:", response.embeddings[0].values.length);
    } catch (error) {
        console.error("✗ Google GenAI connection failed:", error.message);
    }
}

test();
```

Run it:
```powershell
node test-genai.js
```

Expected output:
```
✓ Google GenAI connection successful
Embedding length: 768
```

### Test 4: Test ChromaDB Connection

Create a test file `test-chroma.js`:

```javascript
import dotenv from "dotenv";
import getCollection from "./vector/Chromadb.js";

dotenv.config();

async function test() {
    try {
        const collection = await getCollection();
        console.log("✓ ChromaDB connection successful");
        console.log("Collection name:", collection.name);
    } catch (error) {
        console.error("✗ ChromaDB connection failed:", error.message);
    }
}

test();
```

Run it:
```powershell
node test-chroma.js
```

Expected output:
```
✓ ChromaDB connection successful
Collection name: website_data
```

### Clean Up Test Files

```powershell
Remove-Item test-genai.js
Remove-Item test-chroma.js
```

## Running the Chatbot

### Workflow

The complete workflow involves three stages:

```
1. CRAWL     → Extract website content
   ↓
2. INGEST    → Create embeddings and index
   ↓
3. SEARCH    → Query and generate responses
```

### Stage 1: Crawl Website Content

```powershell
node services/crawler.js
```

**What it does**:
- Crawls https://curiousteamlearning.com
- Extracts content from all pages
- Saves JSON files to `data/` directory
- Shows progress in console

**Expected output**:
```
Crawling: https://curiousteamlearning.com/
Crawling: https://curiousteamlearning.com/about
Crawling: https://curiousteamlearning.com/courses/coding
...
Crawling completed
Pages crawled: 25
```

**Duration**: 2-5 minutes depending on website size

**Troubleshooting**:
- If no crawling starts: Check internet connection
- If all URLs blocked: Verify domain in `shouldCrawl` filters
- If very slow: Reduce MAX_CONCURRENT workers

### Stage 2: Ingest Data (Create Embeddings)

Wait for crawling to complete, then:

```powershell
node embeddings/Ingest.js
```

**What it does**:
- Reads JSON files from `data/`
- Chunks text (1000 chars, 200 overlap)
- Creates embeddings for each chunk
- Stores in ChromaDB
- Shows progress for each file

**Expected output**:
```
Processing: curiousteamlearning.com_index.html.json
Embedding chunk: 0
Embedding chunk: 1
...
Embeddings completed
```

**Duration**: 1-3 minutes depending on content volume

**Troubleshooting**:
- If ChromaDB errors: Verify credentials in `.env`
- If API quota exceeded: Wait a moment and retry
- If no chunks: Verify JSON files in `data/`

### Stage 3: Query and Generate Response

```powershell
node client/searchData.js
```

**What it does**:
- Searches for relevant documents
- Generates response using context
- Prints response to console

**Expected output**:
```
Embedding response: {...}
Generated response:
The chatbot has several courses available including...
```

**Duration**: 2-5 seconds

**Modify Query**:

Edit `client/searchData.js` line 3:
```javascript
const query = "What courses are offered?";  // Change this
```

Then run again:
```powershell
node client/searchData.js
```

## Configuration

### Crawler Settings

In `services/crawler.js`:

```javascript
const MAX_CONCURRENT = 5;  // Number of concurrent workers
// Change to 10 for faster crawling (uses more resources)
// Change to 1 for slower, more conservative crawling

startCrawler(
   "https://curiousteamlearning.com",    // Start URL
   "https://curiousteamlearning.com"     // Domain to crawl
);
// Change both to crawl a different website
```

### Text Chunking Settings

In `embeddings/chunkText.js`:

```javascript
function chunkText(
   text,
   chunkSize = 1000,     // Change chunk size
   overlap = 200         // Change overlap
)
```

- **Larger chunks**: Better context, fewer documents
- **Smaller chunks**: More precise retrieval, more documents
- **More overlap**: Better continuity, slower processing

### Search Settings

In `client/searchData.js`:

```javascript
const results = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: 5,  // Change number of results
});
```

- **More results**: Longer context, may be irrelevant
- **Fewer results**: Shorter context, faster generation

## Project Structure Details

After running the full workflow, your project will have:

```
chatbot/
├── data/                    # Generated by crawler
│   ├── domain_page.html.json
│   └── ...
├── node_modules/            # Generated by npm install
├── client/
│   ├── embeddingClient.js
│   └── searchData.js
├── embeddings/
│   ├── Aimodel.js
│   ├── chunkText.js
│   ├── EmbeddingText.js
│   └── Ingest.js
├── services/
│   ├── crawler.js
│   ├── extractPage.js
│   ├── normalise.js
│   ├── ShouldCrawl.js
│   └── SaveJson.js
├── vector/
│   └── Chromadb.js
├── .env                     # Environment variables
├── .gitignore              # Git configuration
├── package.json
└── Server.js               # Empty (for future API)
```

## Common Issues & Solutions

### Issue: `GOOGLE_API_KEY2 not set`

**Cause**: `.env` file missing or incomplete

**Solution**:
1. Verify `.env` file exists in project root
2. Check file contains `GOOGLE_API_KEY2=...`
3. Restart your terminal/IDE to reload env vars

### Issue: `No documents crawled`

**Cause**: URL filters blocking all pages

**Solution**:
1. Check if website is accessible: Open in browser
2. Check `shouldCrawl` function filters
3. Verify start URL and domain are correct

### Issue: `ChromaDB connection refused`

**Cause**: Wrong credentials or no internet

**Solution**:
1. Verify API_KEY, TENANT, DATABASE in `.env`
2. Check internet connection
3. Verify ChromaDB account is active
4. Test with `test-chroma.js`

### Issue: `No search results returned`

**Cause**: Data not indexed in ChromaDB

**Solution**:
1. Ensure you ran both crawler and ingest
2. Check `data/` folder has JSON files
3. Check ChromaDB console for inserted documents
4. Try re-running ingest

### Issue: `API quota exceeded`

**Cause**: Too many requests to GenAI API

**Solution**:
1. Wait a few minutes before retrying
2. Check Google Cloud API quota
3. Consider using free tier limits
4. Reduce concurrent workers in crawler

### Issue: `Port already in use` (when running server)

**Cause**: Another process on port 3000

**Solution**:
```powershell
# Find and stop process
Get-Process | Where-Object {$_.Id -eq (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue).OwningProcess}
Stop-Process -Id <process_id> -Force
```

## Next Steps

### Extend the Project

1. **Add REST API endpoints** in `Server.js`
2. **Support multiple websites** by making domain dynamic
3. **Create web UI** for interactive search
4. **Add chat history** for multi-turn conversations
5. **Implement result ranking** for better relevance

### Optimize Performance

1. **Batch embedding** for faster ingestion
2. **Cache embeddings** to avoid re-computing
3. **Implement pagination** for large result sets
4. **Add response streaming** for faster feedback

### Improve Quality

1. **Fine-tune chunks** for better context
2. **Add result filtering** by metadata
3. **Implement feedback loops** for relevance
4. **Add query expansion** for better matching

## Support

### Documentation
- `README.md` - Project overview
- `ARCHITECTURE.md` - System design
- `API_REFERENCE.md` - Function documentation

### Debugging
- Check console output for error messages
- Enable verbose logging in code
- Verify credentials in `.env`
- Check API usage in respective dashboards

### Resources
- Google GenAI Docs: https://ai.google.dev/
- ChromaDB Docs: https://docs.trychroma.com/
- Node.js Docs: https://nodejs.org/docs/
