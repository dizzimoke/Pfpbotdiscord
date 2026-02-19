import { useState } from 'react';
import { Key, Webhook, Save, Lock, Activity, Play, Square } from 'lucide-react';

export default function App() {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [giphyKey, setGiphyKey] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [interval, setInterval] = useState(2);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!webhookUrl || !giphyKey || !adminPassword) {
      setStatus('Error: Missing required fields (Webhook, GIPHY Key, Admin Password)');
      return;
    }

    setLoading(true);
    setStatus('Saving settings...');

    try {
      const endpoint = import.meta.env.VITE_SETTINGS_ENDPOINT;
      if (!endpoint) {
        throw new Error('VITE_SETTINGS_ENDPOINT is not defined');
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword
        },
        body: JSON.stringify({
          discord_webhook_url: webhookUrl,
          giphy_api_key: giphyKey,
          enabled,
          combo_interval_minutes: interval
        })
      });

      const data = await res.json();

      if (res.ok) {
        setStatus('✅ Settings saved! Bot will run on next schedule.');
      } else {
        setStatus(`❌ Error: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      setStatus(`❌ Network Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 p-8 font-sans selection:bg-indigo-500/30">
      <div className="max-w-md mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Anime Auto-Poster</h1>
          <p className="text-neutral-400 mt-1">Supabase + Vercel Serverless Bot</p>
        </div>

        {/* Configuration */}
        <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Key className="w-5 h-5 text-indigo-400" />
            Configuration
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5">
                Admin Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Required to save settings"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-neutral-700"
                />
              </div>
            </div>

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
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-medium text-neutral-300">Bot Enabled</span>
              <button 
                onClick={() => setEnabled(!enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-neutral-700'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-medium text-neutral-300">Interval (Minutes)</span>
              <input 
                type="number" 
                min="1" 
                max="60" 
                value={interval} 
                onChange={(e) => setInterval(parseInt(e.target.value) || 2)}
                className="w-16 bg-neutral-950 border border-neutral-800 rounded-lg py-1 px-2 text-center text-sm"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 mt-4"
            >
              {loading ? <Activity className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Settings
            </button>

            {status && (
              <div className={`text-center text-sm font-medium mt-4 p-3 rounded-lg ${status.includes('Error') ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                {status}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
