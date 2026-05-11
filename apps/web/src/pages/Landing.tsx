import Logo from '../components/Logo';

export default function Landing() {
  const navigateToAnalyze = () => {
    window.location.hash = '#/analyze';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };

  return (
    <div className="min-h-screen bg-darker text-white font-sans selection:bg-primary/30 overflow-hidden">
      {/* Navbar */}
      <nav className="border-b border-white/5 bg-black/10 backdrop-blur-xl sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo size={40} />
              <span className="text-xl font-bold tracking-tight">TxGuard</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="#features" className="text-sm text-white/50 hover:text-white transition-colors hidden sm:block">Features</a>
              <a href="#how-it-works" className="text-sm text-white/50 hover:text-white transition-colors hidden sm:block">How It Works</a>
              <button
                onClick={() => {
                  window.location.hash = '#/download';
                  window.dispatchEvent(new HashChangeEvent('hashchange'));
                }}
                className="text-sm text-white/50 hover:text-white transition-colors hidden sm:block"
              >
                Get Extension
              </button>
              <button
                onClick={navigateToAnalyze}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-semibold transition-all active:scale-95"
              >
                Launch App
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-20 pb-32 sm:pt-28 sm:pb-40">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
          <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full bg-secondary/5 blur-[120px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-gradient-to-br from-primary/3 via-transparent to-secondary/3 blur-[80px]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-sm text-primary mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Powered by Solana RPC Simulation
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 leading-[1.1]">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-[#14f1d5] to-secondary">
              Protect Every
            </span>
            <br />
            <span className="text-white">Transaction You Sign</span>
          </h1>

          <p className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
            TxGuard simulates, analyzes, and risk-scores Solana transactions before you sign them.
            Stop phishing, address poisoning, and wallet drainers in real time — with
            <span className="text-primary font-semibold"> zero-config protection</span>.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={navigateToAnalyze}
              className="group px-8 py-4 rounded-2xl bg-gradient-to-r from-primary to-secondary text-darker font-bold text-lg shadow-2xl shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.03] active:scale-95 transition-all"
            >
              <span className="flex items-center gap-2">
                Analyze a Transaction
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </button>
            <a
              href="#features"
              className="px-8 py-4 rounded-2xl border border-white/10 text-white/70 hover:text-white hover:border-white/20 font-semibold text-lg transition-all"
            >
              Learn More
            </a>
          </div>

          {/* Stats row */}
          <div className="mt-20 grid grid-cols-2 sm:grid-cols-4 gap-8 max-w-3xl mx-auto">
            {[
              { value: '125+', label: 'Trusted Programs' },
              { value: '20', label: 'Risk Signals' },
              { value: '< 2s', label: 'Response Time' },
              { value: '0', label: 'Required Config' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
                  {stat.value}
                </div>
                <div className="text-xs text-white/30 mt-1 font-medium uppercase tracking-wider">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                Security That Works
              </span>
              <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                Before You Click Sign
              </span>
            </h2>
            <p className="text-white/40 max-w-xl mx-auto">
              Every feature is designed to catch the attack patterns real scammers use on Solana today.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                ),
                color: 'primary',
                title: 'RPC Simulation',
                desc: 'Every transaction is simulated on-chain to measure balance changes, compute units, and state mutations before you commit.',
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                color: 'secondary',
                title: '20 Risk Signals',
                desc: 'Detects address poisoning, durable nonces, authority changes, SolPhish drainers, compute budget manipulation, and more.',
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
                color: 'primary',
                title: 'Blink Preview',
                desc: 'Paste a Solana Action URL to analyze the embedded transaction before interacting. Trusted domain verification included.',
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                ),
                color: 'secondary',
                title: 'Browser Extension',
                desc: 'Intercepts signTransaction calls from Phantom, Solflare, Backpack, and 8+ other wallets for real-time analysis.',
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                ),
                color: 'primary',
                title: 'AI-Powered Explanations',
                desc: 'Uses OpenAI, Anthropic, or local Ollama models to explain risks in plain language. Falls back to structured templates when offline.',
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                color: 'secondary',
                title: 'Risk Scoring v1.2',
                desc: 'Weighted multi-signal scoring with simulation confidence multipliers, browser threat amplification, and score variance hints.',
              },
            ].map((feature) => {
              const featureColor = feature.color === 'primary' ? 'rgba(20, 241, 149, 0.10)' : 'rgba(153, 69, 255, 0.10)';
              const featureTextColor = feature.color === 'primary' ? '#14f195' : '#9945ff';
              return (
              <div
                key={feature.title}
                className="group relative p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
                  style={{ backgroundColor: featureColor, color: featureTextColor }}
                >
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{feature.desc}</p>
              </div>
            )})}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="relative py-20 sm:py-28 border-t border-white/5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4 text-white/90">
              How It Works
            </h2>
            <p className="text-white/40 max-w-xl mx-auto">
              From paste to protection in under two seconds.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                step: '01',
                title: 'Paste & Submit',
                desc: 'Paste a base64 Solana transaction or a Blink Action URL into the analyzer.',
              },
              {
                step: '02',
                title: 'Simulate & Detect',
                desc: 'TxGuard simulates on-chain, runs 10+ detectors, and calculates a risk score from 0–100.',
              },
              {
                step: '03',
                title: 'Sign with Confidence',
                desc: 'Review the AI-generated explanation and risk breakdown. Approve, caution, or reject.',
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-lg font-black text-primary">{item.step}</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-20 sm:py-28">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-gradient-to-b from-primary/10 to-transparent blur-[100px]" />
        </div>
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="glass-panel p-10 sm:p-14 rounded-3xl mb-8">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
              Ready to <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">Secure</span> Your Transactions?
            </h2>
            <p className="text-white/40 text-lg mb-8 max-w-lg mx-auto">
              No sign-up. No wallet connection. Just paste and analyze.
            </p>
            <button
              onClick={navigateToAnalyze}
              className="group px-10 py-4 rounded-2xl bg-gradient-to-r from-primary to-secondary text-darker font-bold text-lg shadow-2xl shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.03] active:scale-95 transition-all"
            >
              <span className="flex items-center gap-2">
                Open Analyzer
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </button>
          </div>

          {/* Extension CTA */}
          <div className="glass-panel p-8 sm:p-10 rounded-3xl border-primary/10">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/10 bg-primary/5 text-xs text-primary mb-3">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Browser Extension
                </div>
                <h3 className="text-xl font-extrabold text-white mb-2">Prefer real-time protection?</h3>
                <p className="text-sm text-white/40">Install the browser extension to auto-analyze every transaction before you sign.</p>
              </div>
              <button
                onClick={() => {
                  window.location.hash = '#/download';
                  window.dispatchEvent(new HashChangeEvent('hashchange'));
                }}
                className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-bold transition-all active:scale-95 whitespace-nowrap"
              >
                Get Extension
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Logo size={24} />
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
