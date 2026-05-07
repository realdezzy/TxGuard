export default function Download() {
  const chromeStoreUrl = '#';
  const githubUrl = '#';

  const navigateHome = () => {
    window.location.hash = '';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };

  return (
    <div className="min-h-screen bg-darker text-white font-sans selection:bg-primary/30 overflow-hidden">
      {/* Navbar */}
      <nav className="border-b border-white/5 bg-black/10 backdrop-blur-xl sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <button onClick={navigateHome} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-secondary shadow-lg shadow-primary/20">
                <svg className="w-6 h-6 text-darker" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5zm0 18c-3.75-1-6.5-4.82-6.5-9V8.55l6.5-3.61 6.5 3.61V11c0 4.18-2.75 8-6.5 9z"/>
                </svg>
              </div>
              <span className="text-xl font-bold tracking-tight">TxGuard</span>
            </button>
            <div className="flex items-center gap-6">
              <button onClick={() => { window.location.hash = '#/analyze'; window.dispatchEvent(new HashChangeEvent('hashchange')); }} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-semibold transition-all active:scale-95">
                Launch App
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-20 pb-16 sm:pt-28 sm:pb-24">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-secondary/5 blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-sm text-primary mb-8">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Browser Extension
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6 leading-[1.1]">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-[#14f1d5] to-secondary">
                  Protect Every Sign,
                </span>
                <br />
                <span className="text-white">On Every Site</span>
              </h1>
              <p className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed">
                The TxGuard browser extension intercepts wallet signing requests before execution,
                simulating and scoring transactions in real time — so you never sign a malicious transaction.
              </p>
            </div>

            {/* Download CTA */}
            <div className="glass-panel p-8 sm:p-10 rounded-3xl mb-16">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                {/* Chrome Store Button */}
                <a
                  href={chromeStoreUrl}
                  target={chromeStoreUrl === '#' ? undefined : '_blank'}
                  rel="noopener noreferrer"
                  className={`group w-full sm:w-auto flex items-center justify-center gap-4 px-8 py-5 rounded-2xl font-bold text-lg shadow-2xl transition-all ${
                    chromeStoreUrl === '#'
                      ? 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                      : 'bg-white text-black hover:bg-gray-100 hover:scale-[1.02] active:scale-95'
                  }`}
                  onClick={(e) => { if (chromeStoreUrl === '#') e.preventDefault(); }}
                >
                  <svg className={`w-8 h-8 ${chromeStoreUrl === '#' ? 'opacity-30' : ''}`} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2a8 8 0 100-16 8 8 0 000 16zm-1-4.5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm3.5-3.5a2.5 2.5 0 00-5 0H8a4 4 0 018 0h-1.5z"/>
                  </svg>
                  <div className="text-left">
                    <div className="text-xs opacity-70">Available on</div>
                    <div className="text-base">Chrome Web Store</div>
                  </div>
                </a>

                {/* Firefox / Manual */}
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <a
                    href={githubUrl}
                    target={githubUrl === '#' ? undefined : '_blank'}
                    rel="noopener noreferrer"
                    className={`flex items-center justify-center gap-2 px-6 py-4 rounded-2xl border text-sm font-semibold transition-all ${
                      githubUrl === '#'
                        ? 'border-white/5 text-white/20 cursor-not-allowed'
                        : 'border-white/10 text-white/60 hover:text-white hover:border-white/20 active:scale-95'
                    }`}
                    onClick={(e) => { if (githubUrl === '#') e.preventDefault(); }}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Manual Install
                  </a>
                </div>
              </div>

              {chromeStoreUrl === '#' && (
                <div className="mt-6 p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm text-yellow-400 font-semibold mb-1">Coming Soon</p>
                      <p className="text-xs text-white/40">
                        TxGuard is pending review on the Chrome Web Store. In the meantime, you can load it as an unpacked extension from the source code.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Feature highlights */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
              {[
                {
                  icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  ),
                  title: 'Real-Time Interception',
                  desc: 'Automatically scans signTransaction and signAllTransactions calls from your wallet provider before execution.',
                },
                {
                  icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  ),
                  title: '10+ Wallet Support',
                  desc: 'Works with Phantom, Solflare, Backpack, OKX, Coinbase Wallet, Nightly, Trust Wallet, and more.',
                },
                {
                  icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  ),
                  title: 'Threat Blocking',
                  desc: 'Shows a Guardian overlay for CAUTION/REJECT transactions. You decide whether to proceed or reject.',
                },
              ].map((item) => (
                <div key={item.title} className="p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                    {item.icon}
                  </div>
                  <h3 className="font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>

            {/* Manual Install Instructions */}
            <div className="glass-panel p-8 sm:p-10 rounded-3xl">
              <h2 className="text-2xl font-extrabold text-white mb-6">Manual Install (Developers)</h2>
              <div className="space-y-5">
                {[
                  {
                    step: '1',
                    title: 'Clone the repository',
                    code: 'git clone https://github.com/anomalyco/TxGuard.git',
                  },
                  {
                    step: '2',
                    title: 'Install dependencies & build',
                    code: 'cd TxGuard\npnpm install\npnpm build --filter=@txguard/extension',
                  },
                  {
                    step: '3',
                    title: 'Load in Chrome',
                    desc: 'Go to <code class="text-primary/80 bg-primary/5 px-1.5 py-0.5 rounded text-xs">chrome://extensions</code>, enable <strong>Developer mode</strong>, click <strong>Load unpacked</strong>, and select the <code class="text-primary/80 bg-primary/5 px-1.5 py-0.5 rounded text-xs">apps/extension/.output/chrome-mv3</code> directory.',
                  },
                ].map((item) => (
                  <div key={item.step} className="flex gap-4">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-sm font-black text-primary">{item.step}</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm mb-1">{item.title}</h4>
                      {'code' in item ? (
                        <pre className="p-3 rounded-lg bg-black/40 border border-white/5 text-xs text-white/60 font-mono overflow-x-auto">
                          {item.code}
                        </pre>
                      ) : (
                        <p className="text-sm text-white/40 leading-relaxed" dangerouslySetInnerHTML={{ __html: item.desc || '' }} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-primary to-secondary flex items-center justify-center">
                <svg className="w-4 h-4 text-darker" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"/>
                </svg>
              </div>
              <span className="text-sm font-bold text-white/50">TxGuard</span>
            </div>
            <p className="text-xs text-white/20">
              &copy; {new Date().getFullYear()} TxGuard. Open-source transaction security for Solana.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
