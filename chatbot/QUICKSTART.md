# Quick Start Guide

Get the chatbot running in 5 minutes.

## 1. Prerequisites (2 minutes)

- Node.js installed (`node --version`)
- Google GenAI API key
- ChromaDB account credentials

## 2. Setup (2 minutes)

```powershell
# Navigate to project
cd d:\chatbot

# Install dependencies
npm install

# Create .env file with:
# GOOGLE_API_KEY2=your_key
# API_KEY=your_chromadb_key
# TENANT=your_tenant
# DATABASE=your_database
```

## 3. Run (1 minute)

```powershell
# Option A: Crawl, ingest, and search (full workflow)
node services/crawler.js          # ~3 min: Extract website
node embeddings/Ingest.js         # ~2 min: Create embeddings
node client/searchData.js         # ~3 sec: Search and respond

# Option B: Quick test (with existing data)
node client/searchData.js         # Uses already-ingested data
```

## 4. Customize Query

Edit `client/searchData.js` line 3:

```javascript
const query = "Your question here?";
```

Then run:
```powershell
node client/searchData.js
```

## Done! 🎉

Your chatbot is now searching website content and answering questions.

---

## What Each Command Does

| Command | Purpose | Time | Output |
|---------|---------|------|--------|
| `node services/crawler.js` | Extract website content | 3-5 min | JSON files in `data/` |
| `node embeddings/Ingest.js` | Create embeddings | 1-3 min | Indexed in ChromaDB |
| `node client/searchData.js` | Search and respond | 3-5 sec | AI-generated response |

## Troubleshooting

**No response?**
- Verify `.env` has correct API keys
- Run crawler first to populate data
- Run ingest to create embeddings

**API error?**
- Check API keys are correct
- Check internet connection
- Wait a moment (rate limits)

**Very slow?**
- First run is slower (API overhead)
- Check internet speed
- Reduce chunk size if many results

See `SETUP_GUIDE.md` for detailed setup or `TROUBLESHOOTING.md` for more issues.
