import { useState } from 'react';

export interface SettingsData {
  apiUrl: string;
  cluster: 'mainnet-beta' | 'devnet' | 'testnet';
}

interface SettingsProps {
  onClose: () => void;
  onSave: (settings: SettingsData) => void;
  initialSettings: SettingsData;
}

export function Settings({ onClose, onSave, initialSettings }: SettingsProps) {
  const [settings, setSettings] = useState<SettingsData>(initialSettings);
  const [saved, setSaved] = useState(false);

  const [isLocked, setIsLocked] = useState(true);

  const handleSave = () => {
    onSave(settings);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-darker/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="glass-panel w-full max-w-md p-8 rounded-3xl border border-white/10 shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/5 text-white/50 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-8">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs uppercase font-black tracking-widest text-white/40">API Endpoint</label>
              <button 
                onClick={() => setIsLocked(!isLocked)}
                className={`text-[10px] font-bold px-3 py-1 rounded-full border transition-all ${
                  isLocked ? 'text-primary border-primary/20 hover:bg-primary/5' : 'text-orange-400 border-orange-500/30 bg-orange-500/5'
                }`}
              >
                {isLocked ? '🔒 Locked' : '🔓 Unlock to Edit'}
              </button>
            </div>
            
            <div className="relative">
              <input
                type="url"
                disabled={isLocked}
                value={settings.apiUrl}
                onChange={(e) => setSettings({ ...settings, apiUrl: e.target.value })}
                className={`w-full bg-dark/50 border rounded-xl px-4 py-3.5 transition-all font-mono text-sm outline-none ${
                  isLocked 
                    ? 'border-white/5 text-white/20 cursor-not-allowed' 
                    : 'border-orange-500/50 text-white shadow-[0_0_20px_rgba(249,115,22,0.1)] focus:border-orange-400'
                }`}
                placeholder="http://localhost:3001"
              />
              {!isLocked && (
                <div className="mt-3 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <svg className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="text-xs leading-relaxed text-orange-200/70">
                    <strong className="text-orange-400 block mb-1">Security Warning</strong>
                    Pointing to an untrusted provider allows them to potentially spoof simulation results and bypass wallet safety checks.
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase font-black tracking-widest text-white/40">Solana Network</label>
            <div className="grid grid-cols-1 gap-2">
              {(['mainnet-beta', 'devnet', 'testnet'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setSettings({ ...settings, cluster: c })}
                  className={`px-4 py-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                    settings.cluster === c
                      ? 'bg-primary/10 border-primary text-primary shadow-[0_0_20px_rgba(34,197,94,0.1)]'
                      : 'bg-dark/30 border-white/5 text-white/60 hover:border-white/20'
                  }`}
                >
                  <span className="font-bold capitalize">{c.replace('-', ' ')}</span>
                  {settings.cluster === c && (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10">
          <button
            onClick={handleSave}
            className="w-full bg-primary text-darker font-black py-4 rounded-xl hover:bg-[#10c47a] hover:-translate-y-0.5 transition-all shadow-lg flex items-center justify-center gap-2"
          >
            {saved ? (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
                Saved Configuration
              </>
            ) : 'Save and Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
