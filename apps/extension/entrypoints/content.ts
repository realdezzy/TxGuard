import { defineContentScript } from '#imports';
import type { RiskSignal, TransactionAnalysis } from '@txguard/core';

const RiskLevel = {
  SAFE: 'SAFE',
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;

const SignalType = {
  CLICKJACKING: 'CLICKJACKING',
  WALLET_SPOOFING: 'WALLET_SPOOFING',
} as const;

type SignalCategory = 'dom' | 'provider' | 'origin';

interface CategorizedSignal {
  category: SignalCategory;
  signal: RiskSignal;
}

interface BrowserThreatReport {
  url: string;
  title: string;
  signals: RiskSignal[];
  timestamp: number;
}

type DecisionHandler = (approved: boolean) => void;

const SENSITIVE_TEXT = [
  'connect wallet',
  'sign transaction',
  'approve',
  'swap',
  'claim',
  'mint',
  'phantom',
  'solflare',
  'backpack',
  'seed phrase',
  'recovery phrase',
  'secret recovery',
  'private key',
  'mnemonic',
];

const MAX_TX_PAYLOAD_BYTES = 1_048_576;
const EVENT_ID_PATTERN = /^[a-zA-Z0-9\-]+$/;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function isVisible(element: Element): boolean {
  const htmlElement = element as HTMLElement;
  const style = window.getComputedStyle(htmlElement);
  const rect = htmlElement.getBoundingClientRect();
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.visibility !== 'hidden' &&
    style.display !== 'none' &&
    Number(style.opacity || '1') > 0.01
  );
}

function hasSensitiveText(element: Element): boolean {
  const text = (element.textContent ?? '').trim().toLowerCase();
  const aria = [
    element.getAttribute('aria-label'),
    element.getAttribute('title'),
    element.getAttribute('data-testid'),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const haystack = `${text} ${aria}`;
  return SENSITIVE_TEXT.some((term) => haystack.includes(term));
}

function isElementInside(parent: Element, possibleChild: Element): boolean {
  return parent === possibleChild || parent.contains(possibleChild);
}

// --- Signal aggregation ---
// Single heuristic caps at MEDIUM. CRITICAL only from multi-category or seed phrase.
function aggregateSignals(categorized: CategorizedSignal[], seedPhraseSignal: RiskSignal | null): RiskSignal[] {
  const result: RiskSignal[] = [];

  // Seed phrase is unconditionally CRITICAL
  if (seedPhraseSignal) {
    result.push(seedPhraseSignal);
  }

  if (categorized.length === 0) return result;

  const categories = new Set(categorized.map((c) => c.category));

  // Determine escalation based on category combination
  let escalationLevel: typeof RiskLevel[keyof typeof RiskLevel] = RiskLevel.MEDIUM;
  if (categories.has('provider') && (categories.has('dom') || categories.has('origin'))) {
    escalationLevel = RiskLevel.CRITICAL;
  } else if (categories.has('dom') && categories.has('origin')) {
    escalationLevel = RiskLevel.HIGH;
  } else if (categories.has('provider')) {
    escalationLevel = RiskLevel.HIGH;
  }

  const shouldEscalate = categories.size >= 2;

  for (const { signal } of categorized) {
    const cappedLevel = shouldEscalate ? escalationLevel : capLevel(signal.level);
    result.push({ ...signal, level: cappedLevel });
  }

  return result;
}

function capLevel(level: string): typeof RiskLevel[keyof typeof RiskLevel] {
  if (level === RiskLevel.CRITICAL || level === RiskLevel.HIGH) return RiskLevel.MEDIUM;
  return level as typeof RiskLevel[keyof typeof RiskLevel];
}

function buildBrowserAnalysis(report: BrowserThreatReport): TransactionAnalysis {
  const riskScore = Math.min(
    100,
    report.signals.reduce((score, signal) => {
      if (signal.level === RiskLevel.CRITICAL) return score + 45;
      if (signal.level === RiskLevel.HIGH) return score + 35;
      if (signal.level === RiskLevel.MEDIUM) return score + 20;
      return score + 10;
    }, 0),
  );

  const riskLevel =
    riskScore >= 80 ? RiskLevel.CRITICAL :
    riskScore >= 60 ? RiskLevel.HIGH :
    riskScore >= 35 ? RiskLevel.MEDIUM :
    riskScore >= 15 ? RiskLevel.LOW :
    RiskLevel.SAFE;

  return {
    instructions: [],
    signals: report.signals,
    simulation: null,
    riskScore,
    riskLevel,
    recommendation: riskScore >= 60 ? 'REJECT' : riskScore >= 25 ? 'CAUTION' : 'APPROVE',
    explanation: report.signals.map((signal) => signal.message).join('\n'),
    timestamp: report.timestamp,
  };
}

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  main() {
    console.log('TxGuard content script injected');

    const browserThreats = new Map<string, RiskSignal>();
    const MAX_THREATS = 20;

    const rememberThreat = (signal: RiskSignal, scope: 'page' | 'frame' | 'click' = 'page') => {
      if (browserThreats.size >= MAX_THREATS) return;
      const signalWithScope = {
        ...signal,
        metadata: { ...signal.metadata, scope }
      };
      const key = `${signalWithScope.type}:${signalWithScope.title}:${JSON.stringify(signalWithScope.metadata ?? {})}`;
      browserThreats.set(key, signalWithScope);
    };

    let toastContainer: HTMLElement | null = null;

    const showThreatToast = (analysis: TransactionAnalysis) => {
      if (toastContainer) return; // Only one toast at a time
      if (analysis.riskLevel === RiskLevel.SAFE) return;

      toastContainer = document.createElement('div');
      toastContainer.id = 'txguard-threat-toast';
      const shadow = toastContainer.attachShadow({ mode: 'open' });

      const toast = document.createElement('div');
      const riskColor = analysis.riskLevel === RiskLevel.CRITICAL ? '#ef4444' : 
                        analysis.riskLevel === RiskLevel.HIGH ? '#f97316' : '#eab308';
      
      toast.style.cssText = `
        position: fixed; top: 24px; right: 24px; width: 360px;
        background: rgba(10, 10, 10, 0.8); backdrop-filter: blur(12px);
        border: 1px solid ${riskColor}40; border-radius: 16px;
        padding: 20px; color: white; font-family: system-ui, -apple-system, sans-serif;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
        z-index: 2147483647; animation: txguard-slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        display: flex; flex-direction: column; gap: 12px;
      `;

      const styleTag = document.createElement('style');
      styleTag.textContent = `
        @keyframes txguard-slide-in {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes txguard-fade-out {
          from { opacity: 1; transform: scale(1); }
          to { opacity: 0; transform: scale(0.95); }
        }
      `;
      shadow.appendChild(styleTag);

      toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 10px; height: 10px; border-radius: 50%; background: ${riskColor}; box-shadow: 0 0 10px ${riskColor};"></div>
          <span style="font-weight: 800; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: ${riskColor};">
            ${analysis.riskLevel} Risk Detected
          </span>
          <button id="close-toast" style="margin-left: auto; background: none; border: none; color: rgba(255,255,255,0.4); cursor: pointer; padding: 4px;">✕</button>
        </div>
        <p style="margin: 0; font-size: 14px; line-height: 1.5; color: rgba(255,255,255,0.8);">
          ${escapeHtml(analysis.explanation.split('\n')[0])}
        </p>
        <div style="font-size: 11px; color: rgba(255,255,255,0.4); display: flex; justify-content: space-between; align-items: center;">
          <span>TxGuard Browser Security</span>
          <span style="background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px;">Score: ${analysis.riskScore}</span>
        </div>
      `;

      shadow.appendChild(toast);
      document.body.appendChild(toastContainer);

      const dismiss = () => {
        if (!toastContainer) return;
        toast.style.animation = 'txguard-fade-out 0.3s forwards';
        setTimeout(() => {
          toastContainer?.remove();
          toastContainer = null;
        }, 300);
      };

      shadow.getElementById('close-toast')?.addEventListener('click', dismiss);
      setTimeout(dismiss, 8000);
    };

    const reportThreats = () => {
      if (browserThreats.size === 0) return;
      const now = Date.now();
      if (now - lastReportTimestamp < REPORT_THROTTLE_MS) return;
      lastReportTimestamp = now;

      const report: BrowserThreatReport = {
        url: location.href,
        title: document.title,
        signals: [...browserThreats.values()],
        timestamp: now,
      };

      const analysis = buildBrowserAnalysis(report);
      if (analysis.riskLevel !== RiskLevel.SAFE && analysis.riskLevel !== RiskLevel.LOW) {
        showThreatToast(analysis);
      }

      browser.runtime.sendMessage({ type: 'BROWSER_THREAT', report }).catch(() => undefined);
    };

    const isOriginTrusted = () => trustedOrigins.some(o => location.origin === o);

    // --- Individual detectors return categorized signals ---

    function detectSeedPhraseInput(): RiskSignal | null {
      const seedPhraseTerms = ['seed phrase', 'recovery phrase', 'secret recovery', 'private key', 'mnemonic'];
      const inputsAndLabels = [...document.querySelectorAll('input, textarea, [contenteditable], label')];

      const asksForSeedPhrase = inputsAndLabels.some(el => {
        const text = (el.textContent || (el as HTMLInputElement).value || '').toLowerCase();
        return seedPhraseTerms.some(term => text.includes(term));
      });

      if (asksForSeedPhrase) {
        return {
          type: SignalType.WALLET_SPOOFING,
          level: RiskLevel.CRITICAL,
          title: 'Critical: Seed Phrase Requested',
          message: 'This page is asking for your seed phrase or private key. Never enter this information on a website. It is almost certainly a scam.',
          metadata: { url: location.href },
        };
      }
      return null;
    }

    function detectFramingRisk(): CategorizedSignal | null {
      if (window.top === window.self) return null;
      if (isOriginTrusted()) return null;
      return {
        category: 'origin',
        signal: {
          type: SignalType.CLICKJACKING,
          level: RiskLevel.HIGH,
          title: 'Page Is Running Inside a Frame',
          message:
            'This page is embedded inside another page. Embedded wallet or transaction prompts can be used in clickjacking attacks.',
          metadata: { url: location.href, referrer: document.referrer },
        },
      };
    }

    function detectOverlayRisk(): CategorizedSignal[] {
      if (isOriginTrusted()) return [];
      const viewportArea = window.innerWidth * window.innerHeight;
      if (viewportArea <= 0) return [];

      const results: CategorizedSignal[] = [];
      const candidates = [...document.querySelectorAll('body *')].filter((element) => {
        if (!isVisible(element)) return false;
        const style = window.getComputedStyle(element as HTMLElement);
        const rect = element.getBoundingClientRect();
        const area = rect.width * rect.height;
        const zIndex = Number.parseInt(style.zIndex, 10);
        return (
          ['fixed', 'absolute', 'sticky'].includes(style.position) &&
          style.pointerEvents !== 'none' &&
          area / viewportArea > 0.45 &&
          (Number(style.opacity || '1') < 0.2 || zIndex > 9999)
        );
      });

      for (const element of candidates.slice(0, 3)) {
        const rect = element.getBoundingClientRect();
        results.push({
          category: 'dom',
          signal: {
            type: SignalType.CLICKJACKING,
            level: RiskLevel.HIGH,
            title: 'Suspicious Page Overlay',
            message:
              'A large high-priority or transparent overlay is intercepting pointer events. This pattern is commonly used to redirect clicks.',
            metadata: {
              tagName: element.tagName,
              className: (element as HTMLElement).className?.toString().slice(0, 120),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
          },
        });
      }

      return results;
    }

    function detectWalletSpoofingRisk(): CategorizedSignal[] {
      const results: CategorizedSignal[] = [];

      const walletLikeControls = [...document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]')]
        .filter((element) => isVisible(element) && hasSensitiveText(element));

      if (walletLikeControls.length >= 3 && !(window as { solana?: unknown }).solana) {
        results.push({
          category: 'dom',
          signal: {
            type: SignalType.WALLET_SPOOFING,
            level: RiskLevel.MEDIUM,
            title: 'Wallet UI Spoofing Risk',
            message:
              'This page shows multiple wallet-like controls but no Solana provider is available in the page context. Verify the site before interacting.',
            metadata: {
              url: location.href,
              controls: walletLikeControls.slice(0, 5).map((element) => escapeHtml((element.textContent ?? '').trim().slice(0, 80))),
            },
          },
        });
      }

      // Provider mismatch detection
      const solana = (window as any).solana;
      const phantomSolana = (window as any).phantom?.solana;
      if (solana && phantomSolana && solana !== phantomSolana) {
        const solanaKey = solana.publicKey?.toBase58?.() ?? null;
        const phantomKey = phantomSolana.publicKey?.toBase58?.() ?? null;
        if (solanaKey && phantomKey && solanaKey !== phantomKey) {
          results.push({
            category: 'provider',
            signal: {
              type: SignalType.WALLET_SPOOFING,
              level: RiskLevel.HIGH,
              title: 'Wallet Provider Mismatch',
              message: 'window.solana and window.phantom.solana expose different public keys. A malicious script may have injected a fake provider.',
              metadata: { url: location.href },
            },
          });
        }
      }

      // Wallet download prompt from non-wallet domain
      const walletDomains = ['phantom.app', 'solflare.com', 'backpack.app', 'glow.app'];
      const isWalletDomain = walletDomains.some(d => location.hostname.endsWith(d));
      if (!isWalletDomain) {
        const downloadTerms = ['download phantom', 'install solflare', 'get backpack', 'download wallet'];
        const pageText = (document.body.textContent ?? '').toLowerCase();
        if (downloadTerms.some(term => pageText.includes(term))) {
          results.push({
            category: 'origin',
            signal: {
              type: SignalType.WALLET_SPOOFING,
              level: RiskLevel.MEDIUM,
              title: 'Suspicious Wallet Download Prompt',
              message: 'This page prompts you to download a wallet extension but is not an official wallet domain. Verify the source before downloading.',
              metadata: { url: location.href, domain: location.hostname },
            },
          });
        }
      }

      return results;
    }

    function runAllDetectors() {
      const seedSignal = detectSeedPhraseInput();
      const categorized: CategorizedSignal[] = [];

      const framing = detectFramingRisk();
      if (framing) categorized.push(framing);

      categorized.push(...detectOverlayRisk());
      categorized.push(...detectWalletSpoofingRisk());

      const aggregated = aggregateSignals(categorized, seedSignal);

      for (const signal of aggregated) {
        rememberThreat(signal, signal.metadata?.scope as 'page' | 'frame' | 'click' ?? 'page');
      }
    }

    const detectClickTargetMismatch = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!hasSensitiveText(target.closest('button, a, [role="button"], input') ?? target)) return;

      const elements = document.elementsFromPoint(event.clientX, event.clientY);
      const topVisible = elements.find((element) => isVisible(element));
      if (!topVisible || isElementInside(target, topVisible) || isElementInside(topVisible, target)) return;

      rememberThreat({
        type: SignalType.CLICKJACKING,
        level: RiskLevel.CRITICAL,
        title: 'Click Target Is Obscured',
        message:
          'The visible element under the pointer does not match the sensitive control receiving the click. This is a strong clickjacking signal.',
        metadata: {
          targetTag: target.tagName,
          topTag: topVisible.tagName,
          targetText: escapeHtml((target.textContent ?? '').trim().slice(0, 80)),
          topText: escapeHtml((topVisible.textContent ?? '').trim().slice(0, 80)),
        },
      }, 'click');
      reportThreats();
    };

    browser.storage.local.get('settings').then(data => {
      const settings = (data.settings || {}) as Record<string, any>;
      trustedOrigins = settings.trustedOrigins ?? [];
    }).catch(() => undefined);

    // Initial scan
    runAllDetectors();
    setTimeout(reportThreats, 1000);
    window.addEventListener('click', detectClickTargetMismatch, true);

    // MutationObserver for lazy-loaded threats
    let mutationScanCount = 0;
    const MAX_MUTATION_SCANS = 10;
    let mutationDebounce: ReturnType<typeof setTimeout> | null = null;

    const observer = new MutationObserver(() => {
      if (mutationScanCount >= MAX_MUTATION_SCANS) return;
      if (mutationDebounce) clearTimeout(mutationDebounce);
      mutationDebounce = setTimeout(() => {
        mutationScanCount++;
        const seedSignal = detectSeedPhraseInput();
        if (seedSignal) {
          rememberThreat(seedSignal, 'page');
          reportThreats();
        }
        const spoofing = detectWalletSpoofingRisk();
        if (spoofing.length > 0) {
          for (const s of spoofing) {
            rememberThreat(s.signal, 'page');
          }
          reportThreats();
        }
      }, 500);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false,
    });

    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || typeof data !== 'object' || data.type !== 'TXGUARD_ANALYZE_TX') return;
      if (typeof data.transaction !== 'string' || typeof data.eventId !== 'string') return;

      // Validate payload constraints
      if (data.transaction.length > MAX_TX_PAYLOAD_BYTES) return;
      if (!EVENT_ID_PATTERN.test(data.eventId)) return;

      browser.runtime.sendMessage({
        type: 'ANALYZE_TRANSACTION',
        transaction: data.transaction,
        eventId: data.eventId
      }).then((response) => {
        if (response.analysis && response.analysis.riskScore >= 50) {
          showGuardianOverlay(response.analysis, (approved) => {
            window.postMessage({
              type: 'TXGUARD_RESULT',
              eventId: data.eventId,
              approved
            }, '*');
          });
        } else {
          window.postMessage({
            type: 'TXGUARD_RESULT',
            eventId: data.eventId,
            approved: true
          }, '*');
        }
      });
    });

    function showGuardianOverlay(analysis: TransactionAnalysis, onDecision: DecisionHandler) {
      const container = document.createElement('div');
      container.id = 'txguard-guardian-overlay';
      const shadow = container.attachShadow({ mode: 'open' });

      const riskColor = analysis.riskLevel === 'CRITICAL' ? '#ef4444' : 
                        analysis.riskLevel === 'HIGH' ? '#f97316' : 
                        analysis.riskLevel === 'MEDIUM' ? '#eab308' : '#22c55e';

      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.85); backdrop-filter: blur(12px);
        display: flex; align-items: center; justify-content: center;
        z-index: 2147483647; font-family: system-ui, -apple-system, sans-serif; color: white;
      `;

      const glow = document.createElement('div');
      glow.style.cssText = `
        position: absolute; width: 400px; height: 400px;
        background: ${riskColor}; filter: blur(150px);
        opacity: 0.15; border-radius: 50%; pointer-events: none;
        animation: txguard-pulse 4s infinite alternate;
      `;

      const styleTag = document.createElement('style');
      styleTag.textContent = `
        @keyframes txguard-pulse {
          from { transform: scale(1); opacity: 0.1; }
          to { transform: scale(1.2); opacity: 0.2; }
        }
        @keyframes txguard-pop {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        button:hover { filter: brightness(1.1); transform: translateY(-1px); }
        button:active { transform: translateY(0); }
      `;
      shadow.appendChild(styleTag);

      const card = document.createElement('div');
      card.style.cssText = `
        width: 520px; background: rgba(15, 15, 15, 0.9); 
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 28px; padding: 40px; 
        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8);
        position: relative; overflow: hidden;
        animation: txguard-pop 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      `;

      const explanation = escapeHtml(analysis.explanation);
      const riskLevel = escapeHtml(analysis.riskLevel);
      const riskScore = escapeHtml(String(analysis.riskScore));

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px;">
          <div>
            <h2 style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.02em;">Security Alert</h2>
            <p style="margin: 4px 0 0; color: rgba(255,255,255,0.5); font-size: 15px;">Transaction blocked for your protection</p>
          </div>
          <div style="background: ${riskColor}20; color: ${riskColor}; padding: 8px 16px; border-radius: 12px; font-weight: 900; font-size: 13px; border: 1px solid ${riskColor}40; text-transform: uppercase; letter-spacing: 0.05em;">
            ${riskLevel}
          </div>
        </div>

        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 24px; margin-bottom: 32px;">
           <h3 style="margin: 0 0 12px; font-size: 12px; color: ${riskColor}; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 800;">Risk Analysis</h3>
           <p style="margin: 0; font-size: 16px; line-height: 1.6; color: rgba(255,255,255,0.9);">
             ${explanation}
           </p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px;">
           <div style="background: rgba(255,255,255,0.02); padding: 16px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05);">
             <div style="font-size: 10px; color: rgba(255,255,255,0.4); text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em; margin-bottom: 4px;">Risk Score</div>
             <div style="font-size: 24px; font-weight: 800; color: ${riskColor};">${riskScore}<span style="font-size: 14px; color: rgba(255,255,255,0.3); margin-left: 2px;">/100</span></div>
           </div>
           <div style="background: rgba(255,255,255,0.02); padding: 16px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05);">
             <div style="font-size: 10px; color: rgba(255,255,255,0.4); text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em; margin-bottom: 4px;">Signals</div>
             <div style="font-size: 24px; font-weight: 800; color: #fff;">${escapeHtml(String(analysis.signals.length))} <span style="font-size: 14px; color: rgba(255,255,255,0.3);">detected</span></div>
           </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px;">
          <button id="txguard-reject" style="width: 100%; height: 56px; border-radius: 16px; border: none; background: white; color: black; font-size: 16px; font-weight: 800; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);">
            Reject Transaction
          </button>
          <button id="txguard-approve" style="width: 100%; height: 48px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.4); font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
            I trust this site, continue anyway
          </button>
        </div>
      `;

      shadow.appendChild(overlay);
      overlay.appendChild(glow);
      overlay.appendChild(card);
      document.body.appendChild(container);

      shadow.getElementById('txguard-reject')?.addEventListener('click', () => {
        container.remove();
        onDecision(false);
      });

      shadow.getElementById('txguard-approve')?.addEventListener('click', () => {
        if (confirm('CRITICAL WARNING: This transaction has been flagged as high risk. Continuing may result in a total loss of funds. Are you absolutely sure?')) {
          container.remove();
          onDecision(true);
        }
      });
    }

    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      
      if (anchor && anchor.href) {
        const isBlink = anchor.href.includes('/api/actions/') || anchor.href.startsWith('solana-action:');
        
        if (isBlink) {
          console.log('Blink URL detected:', anchor.href);
          
          browser.runtime.sendMessage({
            type: 'ANALYZE_BLINK',
            url: anchor.href
          });
        }
      }
    });

    browser.runtime.onMessage.addListener((message: { type?: string }, _sender, sendResponse) => {
      if (message.type === 'GET_BROWSER_THREATS') {
        const report: BrowserThreatReport = {
          url: location.href,
          title: document.title,
          signals: [...browserThreats.values()],
          timestamp: Date.now(),
        };
        sendResponse({ report, analysis: buildBrowserAnalysis(report) });
      }
    });
  },
});
