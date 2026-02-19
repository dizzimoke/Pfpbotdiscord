import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// --- Bot Logic ---

import fs from 'fs';
import path from 'path';

interface BotConfig {
  webhookUrl: string;
  giphyKey: string;
  intervalSeconds?: number;
}

interface CachedItem {
  url: string;
  styleTag: string;
  type: 'icon' | 'banner';
  timestamp: number;
}

interface BotStatus {
  isRunning: boolean;
  totalPosted: number;
  lastPostedUrl: string | null;
  lastError: string | null;
  queueSize: { icons: number; banners: number };
  currentStyle: string;
  logs: string[];
}

class AnimeBot {
  private isRunning = false;
  private config: BotConfig | null = null;
  
  // Queues
  private iconQueue: CachedItem[] = [];
  private bannerQueue: CachedItem[] = [];
  private postedUrls = new Set<string>();
  
  // State
  private totalPosted = 0;
  private lastPostedUrl: string | null = null;
  private lastError: string | null = null;
  private logs: string[] = [];
  private currentTimeout: NodeJS.Timeout | null = null;
  private isRefilling = false;

  // Persistence
  private cacheFilePath = path.resolve(process.cwd(), 'bot_cache.json');

  // Style tags for rotation
  private styleTags = [
    "dark anime", "white anime", "protagonist anime", "anime aesthetic", 
    "black and white anime", "cool anime", "cute anime", "anime profile", "anime header"
  ];
  private currentStyleIndex = 0;

  // Filtering
  private blockedKeywords = ["meme","reaction","funny","tiktok","instagram","youtube","movie","tv","celebrity","real","irl","cat","dog","elmo","sesame","ufc","radio","who the fook"];
  private requiredKeywords = ["anime","manga","waifu","chibi","kawaii","otaku","anime girl","anime boy"];

  constructor() {
    this.loadCache();
  }

  start(config: BotConfig) {
    if (this.isRunning) return;
    this.config = config;
    this.isRunning = true;
    this.log('Bot started. Queue system active.');
    this.processQueueLoop();
  }

  stop() {
    this.isRunning = false;
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }
    this.log('Bot stopped.');
  }

  getStatus(): BotStatus {
    return {
      isRunning: this.isRunning,
      totalPosted: this.totalPosted,
      lastPostedUrl: this.lastPostedUrl,
      lastError: this.lastError,
      queueSize: { icons: this.iconQueue.length, banners: this.bannerQueue.length },
      currentStyle: this.styleTags[this.currentStyleIndex],
      logs: [...this.logs].reverse().slice(0, 50)
    };
  }

  private log(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    const logMsg = `[${timestamp}] ${message}`;
    console.log(logMsg);
    this.logs.push(logMsg);
    if (this.logs.length > 200) this.logs.shift();
  }

  // --- Persistence ---

  private loadCache() {
    try {
      if (fs.existsSync(this.cacheFilePath)) {
        const data = JSON.parse(fs.readFileSync(this.cacheFilePath, 'utf-8'));
        this.iconQueue = data.iconQueue || [];
        this.bannerQueue = data.bannerQueue || [];
        this.postedUrls = new Set(data.postedUrls || []);
        this.currentStyleIndex = data.currentStyleIndex || 0;
        this.log(`Cache loaded: ${this.iconQueue.length} icons, ${this.bannerQueue.length} banners.`);
      }
    } catch (err) {
      this.log('Failed to load cache, starting fresh.');
    }
  }

  private saveCache() {
    try {
      const data = {
        iconQueue: this.iconQueue,
        bannerQueue: this.bannerQueue,
        postedUrls: Array.from(this.postedUrls).slice(-5000), // Keep last 5000
        currentStyleIndex: this.currentStyleIndex
      };
      fs.writeFileSync(this.cacheFilePath, JSON.stringify(data));
    } catch (err) {
      console.error('Failed to save cache', err);
    }
  }

  // --- Main Loop ---

  private async processQueueLoop() {
    if (!this.isRunning || !this.config) return;

    try {
      // 1. Check Refill
      if (!this.isRefilling && (this.iconQueue.length < 20 || this.bannerQueue.length < 20)) {
        this.refillQueues().catch(err => this.log(`Refill failed: ${err.message}`));
      }

      // 2. Process Combo
      if (this.iconQueue.length > 0 && this.bannerQueue.length > 0) {
        await this.postCombo();
      } else {
        this.log('Queues empty, waiting for refill...');
      }

      // 3. Schedule Next
      if (this.isRunning) {
        const interval = (this.config.intervalSeconds || 30) * 1000;
        this.currentTimeout = setTimeout(() => this.processQueueLoop(), interval);
      }

    } catch (error: any) {
      this.handleError(error);
    }
  }

  private async postCombo() {
    // Peek icon
    const icon = this.iconQueue[0];
    
    // Find matching banner style
    const bannerIndex = this.bannerQueue.findIndex(b => b.styleTag === icon.styleTag);
    
    if (bannerIndex === -1) {
      // No matching banner, discard icon to prevent blocking
      this.log(`No banner found for style "${icon.styleTag}", discarding icon.`);
      this.iconQueue.shift();
      this.saveCache();
      return;
    }

    const banner = this.bannerQueue[bannerIndex];

    // Remove both from queues
    this.iconQueue.shift();
    this.bannerQueue.splice(bannerIndex, 1);
    this.saveCache();

    // Post Icon
    await this.postToDiscord(icon.url, 'icon', icon.styleTag);
    
    // Wait 1-2s
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
    
    // Post Banner
    await this.postToDiscord(banner.url, 'banner', banner.styleTag);
  }

  // --- Fetching & Refill ---

  private async refillQueues() {
    this.isRefilling = true;
    const styleTag = this.styleTags[this.currentStyleIndex];
    this.log(`Refilling queues for style: "${styleTag}"...`);

    try {
      // Fetch Icons
      const iconQuery = `anime pfp gif ${styleTag}`;
      const icons = await this.fetchBatch(iconQuery, 'icon', styleTag);
      this.iconQueue.push(...icons);

      // Fetch Banners
      const bannerQuery = `anime banner ${styleTag}`;
      const banners = await this.fetchBatch(bannerQuery, 'banner', styleTag);
      this.bannerQueue.push(...banners);

      this.log(`Refill complete. Added ${icons.length} icons, ${banners.length} banners.`);
      
      // Rotate style for next refill
      this.currentStyleIndex = (this.currentStyleIndex + 1) % this.styleTags.length;
      this.saveCache();

    } catch (err: any) {
      this.log(`Refill error: ${err.message}`);
    } finally {
      this.isRefilling = false;
    }
  }

  private async fetchBatch(term: string, type: 'icon' | 'banner', styleTag: string): Promise<CachedItem[]> {
    if (!this.config?.giphyKey) return [];

    const limit = 50;
    const offset = Math.floor(Math.random() * 100); 
    const url = `https://api.giphy.com/v1/gifs/search?api_key=${this.config.giphyKey}&q=${encodeURIComponent(term)}&limit=${limit}&offset=${offset}&rating=pg-13&lang=en`;

    try {
      const response = await axios.get(url);
      const results = response.data.data;
      const validItems: CachedItem[] = [];

      for (const result of results) {
        if (this.isAnimeCandidate(result, type)) {
          const media = result.images?.original?.url || result.images?.fixed_width?.url;
          
          if (media && !this.postedUrls.has(media)) {
            // Check if already in queue to avoid dupes in current batch
            const inQueue = type === 'icon' 
              ? this.iconQueue.some(i => i.url === media)
              : this.bannerQueue.some(i => i.url === media);
            
            if (!inQueue) {
              validItems.push({
                url: media,
                styleTag,
                type,
                timestamp: Date.now()
              });
              this.postedUrls.add(media);
            }
          }
        }
      }
      return validItems;
    } catch (err: any) {
      this.log(`GIPHY Fetch Error: ${err.message}`);
      return [];
    }
  }

  private isAnimeCandidate(item: any, type: 'icon' | 'banner'): boolean {
    const text = (
      (item.title || "") + " " + 
      (item.username || "") + " " + 
      (item.source_tld || "") + " " + 
      (item.slug || "")
    ).toLowerCase();
    
    if (this.blockedKeywords.some(k => text.includes(k))) return false;
    if (!this.requiredKeywords.some(k => text.includes(k))) return false;

    const img = item.images?.original;
    if (!img || !img.width || !img.height) return false;
    
    const width = parseInt(img.width);
    const height = parseInt(img.height);
    const ratio = width / height;
    
    if (type === 'icon') {
      return ratio >= 0.85 && ratio <= 1.15;
    } else {
      return ratio >= 1.7;
    }
  }

  // --- Discord Posting ---

  private async postToDiscord(imageUrl: string, type: 'icon' | 'banner', styleTag: string) {
    if (!this.config?.webhookUrl) return;

    const payload = {
      embeds: [{
        image: { url: imageUrl },
        footer: { text: `${styleTag} • ${type.toUpperCase()} • Auto-Posted` },
        color: 0xFF69B4
      }]
    };

    try {
      await axios.post(this.config.webhookUrl, payload);
      this.totalPosted++;
      this.lastPostedUrl = imageUrl;
      this.log(`Posted ${type}: ${imageUrl}`);
    } catch (error: any) {
      if (error.response?.status === 429) {
        const retryAfter = error.response.data?.retry_after 
          ? error.response.data.retry_after * 1000 
          : (parseInt(error.response.headers['retry-after'] || '5') * 1000);
        
        this.log(`Rate limited! Waiting ${retryAfter}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter));
        
        // Retry once
        if (this.isRunning) {
           await axios.post(this.config.webhookUrl, payload).catch(e => this.log(`Retry failed: ${e.message}`));
        }
      } else {
        this.log(`Discord Error: ${error.message}`);
      }
    }
  }

  private handleError(error: any) {
    this.lastError = error.message;
    this.log(`Critical Error: ${error.message}`);
    if (this.isRunning) {
      this.currentTimeout = setTimeout(() => this.processQueueLoop(), 5000);
    }
  }
}

const bot = new AnimeBot();

// --- API Routes ---

app.post('/api/start', (req, res) => {
  const { webhookUrl, giphyKey, intervalSeconds } = req.body;
  if (!webhookUrl || !giphyKey) {
    res.status(400).json({ error: 'Missing webhookUrl or giphyKey' });
    return;
  }
  bot.start({ 
    webhookUrl, 
    giphyKey,
    intervalSeconds: intervalSeconds ? parseInt(intervalSeconds) : 30
  });
  res.json({ status: 'started' });
});

app.post('/api/stop', (req, res) => {
  bot.stop();
  res.json({ status: 'stopped' });
});

app.get('/api/status', (req, res) => {
  res.json(bot.getStatus());
});

// --- Server Startup ---

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production (if built)
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
