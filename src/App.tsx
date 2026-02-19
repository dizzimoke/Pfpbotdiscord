import { useState, useEffect, useRef } from 'react';
import { Play, Square, Activity, Terminal, Key, Webhook, AlertCircle } from 'lucide-react';
import axios from 'axios';

interface BotStatus {
  isRunning: boolean;
  totalPosted: number;
  lastPostedUrl: string | null;
  lastError: string | null;
  logs: string[];
}

export default function App() {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [giphyKey, setGiphyKey] = useState('');
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Poll status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await axios.get('/api/status');
        setStatus(res.data);
      } catch (err) {
        console.error('Failed to fetch status', err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll logs safely using scrollTop instead of scrollIntoView
  // This prevents the whole page from jumping on mobile
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [status?.logs]);

  const handleStart = async () => {
    if (!webhookUrl || !giphyKey) return;
    setLoading(true);
    try {
      await axios.post('/api/start', { webhookUrl, giphyKey });
    } catch (err) {
      alert('Failed to start bot');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      await axios.post('/api/stop');
    } catch (err) {
      alert('Failed to stop bot');
    } finally {
      setLoading(false);
    }
  };

  return (
    // Use min-h-[100dvh] to handle mobile address bar resizing correctly
    <div className="min-h-[100dvh] bg-neutral-950 text-neutral-200 p-8 font-sans selection:bg-indigo-500/30">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Anime Auto-Poster</h1>
            <p className="text-neutral-400 mt-1">Automated Discord webhook bot for anime GIFs & banners</p>
          </div>
          <div className={`px-4 py-2 rounded-full text-sm font-medium border ${
            status?.isRunning 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
              : 'bg-neutral-800 border-neutral-700 text-neutral-400'
          }`}>
            {status?.isRunning ? 'Running' : 'Stopped'}
          </div>
        </div>

        {/* Configuration */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-400" />
              Configuration
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5">
                  Discord Webhook URL
                </label>
                <div className="relative">
                  <Webhook className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
                  <input
                    type="password"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://discord.com/api/webhooks/..."
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-neutral-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5">
                  GIPHY API Key
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
                  <input
                    type="password"
                    value={giphyKey}
                    onChange={(e) => setGiphyKey(e.target.value)}
                    placeholder="GIPHY API Key"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-neutral-700"
                  />
                </div>
                <p className="text-xs text-neutral-600 mt-2">
                  Get a key from <a href="https://developers.giphy.com/dashboard/" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">GIPHY Developers</a>.
                </p>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  onClick={handleStart}
                  disabled={status?.isRunning || loading || !webhookUrl || !giphyKey}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Start Bot
                </button>
                <button
                  onClick={handleStop}
                  disabled={!status?.isRunning || loading}
                  className="flex-1 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Square className="w-4 h-4 fill-current" />
                  Stop Bot
                </button>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-6 space-y-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              Live Stats
            </h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-neutral-950 rounded-xl p-4 border border-white/5">
                <div className="text-neutral-500 text-xs uppercase tracking-wider mb-1">Total Posted</div>
                <div className="text-3xl font-mono text-white">{status?.totalPosted || 0}</div>
              </div>
              <div className="bg-neutral-950 rounded-xl p-4 border border-white/5">
                <div className="text-neutral-500 text-xs uppercase tracking-wider mb-1">Status</div>
                <div className={`text-lg font-medium ${status?.lastError ? 'text-red-400' : 'text-neutral-200'}`}>
                  {status?.lastError ? 'Error' : (status?.isRunning ? 'Active' : 'Idle')}
                </div>
              </div>
            </div>

            {status?.lastPostedUrl && (
              <div className="relative aspect-video bg-neutral-950 rounded-xl overflow-hidden border border-white/5 group">
                <img 
                  src={status.lastPostedUrl} 
                  alt="Last posted" 
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                  <p className="text-xs text-white font-mono truncate">{status.lastPostedUrl}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Logs */}
        <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-6 flex flex-col h-96">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <Terminal className="w-5 h-5 text-neutral-400" />
            System Logs
          </h2>
          <div 
            ref={logsContainerRef}
            className="flex-1 bg-neutral-950 rounded-xl p-4 overflow-y-auto font-mono text-xs space-y-1 border border-white/5"
          >
            {status?.logs.length === 0 && (
              <div className="text-neutral-600 italic">No logs yet...</div>
            )}
            {status?.logs.map((log, i) => (
              <div key={i} className="text-neutral-400 border-b border-white/5 pb-1 last:border-0">
                <span className="text-neutral-600 mr-2">{log.split(']')[0]}]</span>
                <span className={log.includes('Error') ? 'text-red-400' : 'text-neutral-300'}>
                  {log.split(']').slice(1).join(']')}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
