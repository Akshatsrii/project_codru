# Troubleshooting Guide

Solutions for common issues.

## Connection Issues

### Google GenAI API Errors

**Error**: `API key not found` or `Invalid API key`

**Causes**:
- `.env` file missing
- `GOOGLE_API_KEY2` not set
- API key is invalid or expired

**Solutions**:
1. Verify `.env` exists in project root
2. Check `GOOGLE_API_KEY2=...` line is present
3. Verify no typos in the key
4. Generate new key at https://aistudio.google.com/app/apikeys
5. Restart terminal to reload environment

**Test**:
```powershell
node -e "console.log(process.env.GOOGLE_API_KEY2)"
# Should output your API key
```

---

### ChromaDB Connection Errors

**Error**: `Connection refused` or `Authentication failed`

**Causes**:
- Credentials incorrect
- ChromaDB account inactive
- Network connectivity issue

**Solutions**:
1. Double-check `.env` values:
   ```env
   API_KEY=correct_value
   TENANT=correct_value
   DATABASE=correct_value
   ```
2. Test credentials at https://www.trychroma.com/
3. Verify internet connection
4. Recreate credentials if needed

**Test**:
```powershell
node test-chroma.js
# Should output success message
```

---

## Crawling Issues

### No Pages Crawled

**Error**: "Crawling completed, Pages crawled: 0"

**Causes**:
- Website unreachable
- All URLs filtered out
- Domain mismatch

**Solutions**:
1. Test website manually (open in browser)
2. Check domain in `crawler.js` matches start URL
3. Review `ShouldCrawl.js` filters - may be too restrictive
4. Check network allows outbound connections

**Debug**:
```javascript
// In crawler.js, add after URL check:
console.log("Checking:", normalized, "Should crawl?", shouldCrawl(normalized, domain));
```

---

### Crawler Very Slow

**Error**: Takes many minutes to crawl

**Causes**:
- Network latency
- Server rate limiting
- Too many workers competing

**Solutions**:
1. Check internet speed (speedtest.net)
2. Reduce `MAX_CONCURRENT` workers in `crawler.js`:
   ```javascript
   const MAX_CONCURRENT = 3;  // Was 5
   ```
3. Crawl during off-peak hours
4. Check if target website is slow

---

### Duplicate Content Warning

**Error**: Many pages have same hash

**Causes**:
- Template-heavy websites
- Dynamic content
- Session parameters in URLs

**Solutions**:
1. Not necessarily a problem - deduplication works
2. Check if URLs are normalized correctly
3. May need custom extraction for this site

---

## Data Processing Issues

### No JSON Files in `data/` Directory

**Error**: `data/` folder empty after crawling

**Causes**:
- Crawler didn't run successfully
- Content too short (<100 characters)
- All pages filtered

**Solutions**:
1. Run crawler again: `node services/crawler.js`
2. Check console for "Crawling:" messages
3. Verify website content exists
4. Lower minimum content threshold if needed

---

### Ingest Fails to Complete

**Error**: Ingestion stops midway

**Causes**:
- API rate limit hit
- ChromaDB quota exceeded
- Invalid JSON files

**Solutions**:
1. Wait 1-2 minutes, run again (rate limits reset)
2. Check ChromaDB quota at https://www.trychroma.com/
3. Validate JSON files:
   ```powershell
   # Test first JSON file
   node -e "const fs = require('fs'); const file = JSON.parse(fs.readFileSync('data/curiousteamlearning.com_index.html.json')); console.log('Valid JSON');"
   ```
4. Delete corrupted JSON files and re-crawl

---

## Search & Generation Issues

### No Search Results

**Error**: Empty results from ChromaDB

**Causes**:
- Data not ingested
- Wrong collection name
- ChromaDB empty

**Solutions**:
1. Run ingest: `node embeddings/Ingest.js`
2. Verify collection name is `website_data`
3. Check ChromaDB contains documents:
   ```powershell
   node test-chroma.js  # Should show collection
   ```
4. Verify at least one ingest completed successfully

---

### Generated Response is Irrelevant

**Error**: AI response doesn't match query

**Causes**:
- Wrong documents retrieved
- Poor query embedding
- Insufficient context

**Solutions**:
1. Check retrieved documents:
   ```javascript
   // In searchData.js, add:
   console.log("Retrieved docs:", docs);
   ```
2. Rephrase query more clearly
3. Try simpler, single-topic queries
4. Increase `nResults` in search:
   ```javascript
   nResults: 10,  // Was 5
   ```

---

### Response Generation Timeout

**Error**: Generating response takes >30 seconds

**Causes**:
- API overload
- Large context size
- Network latency

**Solutions**:
1. Reduce `nResults`:
   ```javascript
   nResults: 3,  // Was 5
   ```
2. Reduce chunk context length in prompt
3. Try shorter queries
4. Retry in a few moments

---

## Memory & Performance Issues

### Out of Memory Error

**Error**: `JavaScript heap out of memory`

**Causes**:
- Processing very large files
- Too many chunks in memory

**Solutions**:
1. Process in smaller batches
2. Reduce chunk size in `chunkText.js`
3. Process fewer files at once
4. Increase Node.js heap:
   ```powershell
   node --max-old-space-size=4096 embeddings/Ingest.js
   ```

---

### Very Slow Text Processing

**Error**: Takes minutes to chunk text

**Causes**:
- Very large documents
- Overlapping causing many chunks
- System resource constraints

**Solutions**:
1. Increase chunk size in `chunkText.js`:
   ```javascript
   function chunkText(text, chunkSize = 2000, overlap = 200)
   ```
2. Reduce overlap:
   ```javascript
   overlap = 100  // Was 200
   ```
3. Process fewer files simultaneously

---

## Configuration Issues

### Wrong Website Being Crawled

**Error**: Crawler fetching different domain

**Causes**:
- Domain not updated in `crawler.js`
- URL normalization issues

**Solution**:
1. Update `crawler.js` line at bottom:
   ```javascript
   startCrawler(
      "https://mynewsite.com",      // Change this
      "https://mynewsite.com"       // And this
   );
   ```

---

### Unwanted URLs Being Crawled

**Error**: Includes social media, external links

**Causes**:
- Filters not configured correctly
- Links not normalized

**Solution**:
1. Add to blocked domains in `ShouldCrawl.js`:
   ```javascript
   const blockedDomains = [
      "instagram.com",
      "facebook.com",
      "mynewblockedsite.com",  // Add here
   ];
   ```

---

### Chunks Too Large/Small

**Error**: Chunks are 50 chars or 5000 chars

**Causes**:
- `chunkSize` parameter wrong
- Text variation large

**Solution**:
1. Adjust in `chunkText.js`:
   ```javascript
   function chunkText(text, chunkSize = 1000, overlap = 200)
   //                                      ^ Change this
   ```
2. Typical range: 500-2000 characters
3. Test impact on search quality

---

## File System Issues

### Cannot Write Files to `data/` Directory

**Error**: `Permission denied` writing JSON files

**Causes**:
- Directory permissions
- Disk full
- File locked by another process

**Solutions**:
```powershell
# Check permissions
icacls d:\chatbot\data

# Create data folder if missing
mkdir d:\chatbot\data

# Check disk space
Get-Volume
```

---

### Cannot Find Imported Modules

**Error**: `Cannot find module '@google/genai'`

**Causes**:
- `npm install` not run
- `node_modules/` corrupted
- Module not installed

**Solutions**:
```powershell
# Reinstall dependencies
rm -r node_modules
npm install

# Verify module exists
ls node_modules/@google
```

---

## Environment Variable Issues

### Environment Variables Not Loading

**Error**: `undefined` when accessing process.env

**Causes**:
- `dotenv.config()` not called
- `.env` file in wrong location
- Terminal not restarted after creating `.env`

**Solutions**:
1. Verify `dotenv.config()` is called early in file
2. Move `.env` to project root
3. Close and reopen terminal
4. Test with:
   ```powershell
   node -e "require('dotenv').config(); console.log(process.env.GOOGLE_API_KEY2)"
   ```

---

### Sensitive Data Exposed

**Error**: API keys visible in git history

**Causes**:
- `.env` committed to git
- `.gitignore` not configured

**Solutions**:
```powershell
# Add to .gitignore
".env" | Add-Content .gitignore

# Remove from git history
git rm --cached .env
git commit -m "Remove .env from tracking"
```

---

## API Quota & Rate Limiting

### `429 Too Many Requests` Error

**Error**: API rate limit exceeded

**Causes**:
- Too many requests in short time
- Other processes using same API key
- Daily quota exceeded

**Solutions**:
1. Wait 1-2 minutes before retrying
2. Reduce concurrent workers:
   ```javascript
   const MAX_CONCURRENT = 2;  // Was 5
   ```
3. Add delay between requests
4. Check quota at API console
5. Use different API key if available

---

### `403 Forbidden` Error

**Error**: API key doesn't have permission

**Causes**:
- API key doesn't include required model
- Permissions not enabled

**Solutions**:
1. Verify API key enables:
   - `gemini-embedding-2` model
   - `gemini-2.5-flash` model
2. Generate new key at https://aistudio.google.com/app/apikeys
3. Check Google Cloud project permissions

---

## Debugging Tips

### Enable Verbose Logging

Add to start of any file:
```javascript
const DEBUG = true;

function log(msg, data) {
    if (DEBUG) console.log(`[${new Date().toISOString()}]`, msg, data || '');
}
```

Then use: `log("Processing:", url);`

### Test Individual Components

```powershell
# Test embeddings
node -e "import('./embeddings/EmbeddingText.js').then(m => m.default('test').then(e => console.log('Embedding OK')))"

# Test ChromaDB
node -e "import('./vector/Chromadb.js').then(m => m.default().then(c => console.log('ChromaDB OK')))"

# Test crawl function
node -e "import('./services/extractPage.js').then(m => m.default('https://example.com').then(p => console.log('Extract OK')))"
```

### Check Node.js Version

Some ES6 features require newer Node.js:
```powershell
node --version  # Should be v16+
```

If older:
1. Uninstall Node.js
2. Download latest LTS from https://nodejs.org/
3. Reinstall

---

## Getting Help

### If Still Stuck

1. Check **README.md** for overview
2. Check **ARCHITECTURE.md** for system design
3. Check **API_REFERENCE.md** for function details
4. Check **SETUP_GUIDE.md** for detailed setup
5. Review console output carefully - errors often indicate cause

### Provide When Asking for Help

- Full error message
- `.env` setup (without keys)
- Last few lines of console output
- What you were trying to do
- Operating system and Node.js version

---

## Preventive Measures

### Before Running Commands

```powershell
# Always test connectivity
ping google.com

# Check Node.js version
node --version

# Verify .env exists
type .env

# Check data directory
ls data/

# Verify npm dependencies
npm list | head -20
```

### Regular Maintenance

```powershell
# Weekly: Update dependencies
npm update

# Monthly: Check for vulnerabilities
npm audit

# Monthly: Clear old data (optional)
rm data/*  # Only if you want to recrawl
```

---

## Performance Baselines

For reference, here are typical completion times:

| Operation | Duration | Notes |
|-----------|----------|-------|
| Crawl 25 pages | 3-5 min | Depends on network |
| Ingest 100 chunks | 1-2 min | Embedding API latency |
| Generate response | 2-5 sec | GenAI model latency |
| **Total (first run)** | **6-12 min** | One-time cost |
| **Total (subsequent)** | **3-5 sec** | Just search+generate |

If significantly slower, check:
- Internet speed
- API rate limits
- System resources (CPU, RAM, disk)
- Target website responsiveness
