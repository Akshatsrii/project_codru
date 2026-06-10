import cron from 'node-cron';
import  startCrawler  from './crawler.js';
import  ingest from '../embeddings/Ingest.js';
export function setupCronJobs() {
    cron.schedule('0 0 */15 * *', () => {
       startCrawler('https://curiousteamlearning.com', 'curiousteamlearning.com');
         ingest();  
    });
}
