import { useState, useEffect } from 'react';

export interface SettingsData {
  apiUrl: string;
  cluster: 'mainnet-beta' | 'devnet' | 'testnet' | 'custom';
  sensitivityLevel: 'low' | 'medium' | 'high';
  historyRetentionDays: number;
  trustedOrigins: string[];
}

export default function Settings({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<SettingsData>({
    apiUrl: 'http://localhost:3001',
    cluster: 'devnet',
    sensitivityLevel: 'medium',
    historyRetentionDays: 7,
    trustedOrigins: [],
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    browser.storage.local.get('settings').then((data) => {
      if (data.settings) {
        setSettings(data.settings as SettingsData);
      }
    });
  }, []);

  const handleSave = async () => {
    await browser.storage.local.set({ settings });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const [isLocked, setIsLocked] = useState(true);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-3">
        <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-sm font-bold uppercase tracking-widest text-white/80">Settings</h2>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto pr-1 custom-scrollbar">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-[10px] uppercase font-bold text-white/50 block tracking-wider">Security Provider (API)</label>
            <button 
              onClick={() => setIsLocked(!isLocked)}
              className={`text-[9px] px-2 py-0.5 rounded border transition-all ${
                isLocked ? 'text-primary/70 border-primary/20 hover:text-primary' : 'text-orange-400 border-orange-500/30 bg-orange-500/5'
              }`}
            >
              {isLocked ? '🔒 Locked' : '🔓 Unlock'}
            </button>
          </div>
          
          <div className="relative group">
            <input
              type="url"
              disabled={isLocked}
              value={settings.apiUrl}
              onChange={(e) => setSettings({ ...settings, apiUrl: e.target.value })}
              className={`w-full bg-dark/50 border rounded-lg px-3 py-2.5 text-xs font-mono transition-all outline-none ${
                isLocked 
                  ? 'border-white/5 text-white/30 cursor-not-allowed' 
                  : 'border-orange-500/50 text-white shadow-[0_0_15px_rgba(249,115,22,0.1)] focus:border-orange-400'
              }`}
            />
            {!isLocked && (
              <div className="mt-2 p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-start gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <svg className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-[10px] leading-relaxed text-orange-200/80">
                  <strong className="text-orange-400 block mb-0.5">DANGER: Advanced Setting</strong>
                  Changing the security provider can bypass all wallet protections. Only use trusted private endpoints.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-bold text-white/50 block">Network / Cluster</label>
          <select
            value={settings.cluster}
            onChange={(e) => setSettings({ ...settings, cluster: e.target.value as any })}
            className="w-full bg-dark/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors appearance-none"
          >
            <option value="mainnet-beta">Mainnet Beta</option>
            <option value="devnet">Devnet</option>
            <option value="testnet">Testnet</option>
            <option value="custom">Custom RPC</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-bold text-white/50 block">Sensitivity Level</label>
          <select
            value={settings.sensitivityLevel}
            onChange={(e) => setSettings({ ...settings, sensitivityLevel: e.target.value as any })}
            className="w-full bg-dark/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors appearance-none"
          >
            <option value="low">Low (Fewer Alerts)</option>
            <option value="medium">Medium (Balanced)</option>
            <option value="high">High (Maximum Security)</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-bold text-white/50 block">History Retention (Days)</label>
          <input
            type="number"
            min="1"
            max="30"
            value={settings.historyRetentionDays}
            onChange={(e) => setSettings({ ...settings, historyRetentionDays: parseInt(e.target.value) || 7 })}
            className="w-full bg-dark/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-bold text-white/50 block">Trusted Origins (Comma Separated)</label>
          <textarea
            value={settings.trustedOrigins.join(', ')}
            onChange={(e) => setSettings({ ...settings, trustedOrigins: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
            className="w-full bg-dark/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors min-h-[60px]"
            placeholder="https://jup.ag, https://tensor.trade"
          />
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-white/10">
        <button
          onClick={handleSave}
          className="w-full bg-primary text-darker font-bold py-2.5 rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
        >
          {saved ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </>
          ) : 'Save Settings'}
        </button>
        <button
          onClick={() => window.open(browser.runtime.getURL('/privacy.html'), '_blank')}
          className="w-full mt-2 text-[10px] text-white/40 hover:text-white/60 transition-colors"
        >
          Privacy Policy
        </button>
      </div>
    </div>
  );
}
