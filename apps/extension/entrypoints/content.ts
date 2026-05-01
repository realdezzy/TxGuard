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

    let lastReportTimestamp = 0;
    const REPORT_THROTTLE_MS = 5000;

    let trustedOrigins: string[] = [];

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
      browser.runtime.sendMessage({ type: 'BROWSER_THREAT', report }).catch(() => undefined);
    };

    const isOriginTrusted = () => trustedOrigins.some(o => location.origin === o);

    const detectFramingRisk = () => {
      if (window.top === window.self) return;
      if (isOriginTrusted()) return;
      rememberThreat({
        type: SignalType.CLICKJACKING,
        level: RiskLevel.HIGH,
        title: 'Page Is Running Inside a Frame',
        message:
          'This page is embedded inside another page. Embedded wallet or transaction prompts can be used in clickjacking attacks.',
        metadata: { url: location.href, referrer: document.referrer },
      }, 'frame');
    };

    const detectOverlayRisk = () => {
      if (isOriginTrusted()) return;
      const viewportArea = window.innerWidth * window.innerHeight;
      if (viewportArea <= 0) return;

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
        rememberThreat({
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
        });
      }
    };

    const detectWalletSpoofingRisk = () => {
      const seedPhraseTerms = ['seed phrase', 'recovery phrase', 'secret recovery', 'private key', 'mnemonic'];
      const inputsAndLabels = [...document.querySelectorAll('input, textarea, [contenteditable], label')];
      
      const asksForSeedPhrase = inputsAndLabels.some(el => {
        const text = (el.textContent || (el as HTMLInputElement).value || '').toLowerCase();
        return seedPhraseTerms.some(term => text.includes(term));
      });

      if (asksForSeedPhrase) {
        rememberThreat({
          type: SignalType.WALLET_SPOOFING,
          level: RiskLevel.CRITICAL,
          title: 'Critical: Seed Phrase Requested',
          message: 'This page is asking for your seed phrase or private key. Never enter this information on a website. It is almost certainly a scam.',
          metadata: { url: location.href },
        }, 'page');
        return;
      }

      const walletLikeControls = [...document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]')]
        .filter((element) => isVisible(element) && hasSensitiveText(element));

      if (walletLikeControls.length >= 3 && !(window as { solana?: unknown }).solana) {
        rememberThreat({
          type: SignalType.WALLET_SPOOFING,
          level: RiskLevel.MEDIUM,
          title: 'Wallet UI Spoofing Risk',
          message:
            'This page shows multiple wallet-like controls but no Solana provider is available in the page context. Verify the site before interacting.',
          metadata: {
            url: location.href,
            controls: walletLikeControls.slice(0, 5).map((element) => escapeHtml((element.textContent ?? '').trim().slice(0, 80))),
          },
        }, 'page');
      }

      // Provider mismatch detection
      const solana = (window as any).solana;
      const phantomSolana = (window as any).phantom?.solana;
      if (solana && phantomSolana && solana !== phantomSolana) {
        const solanaKey = solana.publicKey?.toBase58?.() ?? null;
        const phantomKey = phantomSolana.publicKey?.toBase58?.() ?? null;
        if (solanaKey && phantomKey && solanaKey !== phantomKey) {
          rememberThreat({
            type: SignalType.WALLET_SPOOFING,
            level: RiskLevel.HIGH,
            title: 'Wallet Provider Mismatch',
            message: 'window.solana and window.phantom.solana expose different public keys. A malicious script may have injected a fake provider.',
            metadata: { url: location.href },
          }, 'page');
        }
      }

      // Wallet download prompt from non-wallet domain
      const walletDomains = ['phantom.app', 'solflare.com', 'backpack.app', 'glow.app'];
      const isWalletDomain = walletDomains.some(d => location.hostname.endsWith(d));
      if (!isWalletDomain) {
        const downloadTerms = ['download phantom', 'install solflare', 'get backpack', 'download wallet'];
        const pageText = (document.body.textContent ?? '').toLowerCase();
        if (downloadTerms.some(term => pageText.includes(term))) {
          rememberThreat({
            type: SignalType.WALLET_SPOOFING,
            level: RiskLevel.MEDIUM,
            title: 'Suspicious Wallet Download Prompt',
            message: 'This page prompts you to download a wallet extension but is not an official wallet domain. Verify the source before downloading.',
            metadata: { url: location.href, domain: location.hostname },
          }, 'page');
        }
      }
    };

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

    detectFramingRisk();
    detectOverlayRisk();
    detectWalletSpoofingRisk();
    setTimeout(reportThreats, 1000);
    window.addEventListener('click', detectClickTargetMismatch, true);

    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || typeof data !== 'object' || data.type !== 'TXGUARD_ANALYZE_TX') return;
      if (typeof data.transaction !== 'string' || typeof data.eventId !== 'string') return;

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

      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);
        display: flex; align-items: center; justify-content: center;
        z-index: 2147483647; font-family: sans-serif; color: white;
      `;

      const card = document.createElement('div');
      card.style.cssText = `
        width: 480px; background: #0a0a0a; border: 1px solid rgba(255,255,255,0.1);
        border-radius: 24px; padding: 32px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
      `;

      const riskColor = analysis.riskLevel === 'CRITICAL' ? '#ef4444' : '#f97316';
      
      const explanation = escapeHtml(analysis.explanation);
      const riskLevel = escapeHtml(analysis.riskLevel);
      const riskScore = escapeHtml(String(analysis.riskScore));

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
          <div>
            <h2 style="margin: 0; font-size: 24px; font-weight: 800;">TxGuard Warning</h2>
            <p style="margin: 4px 0 0; color: rgba(255,255,255,0.5); font-size: 14px;">Suspicious transaction detected</p>
          </div>
          <div style="background: ${riskColor}20; color: ${riskColor}; padding: 6px 12px; border-radius: 8px; font-weight: 800; font-size: 12px; border: 1px solid ${riskColor}30;">
            ${riskLevel} (${riskScore})
          </div>
        </div>

        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 20px; margin-bottom: 24px;">
           <h3 style="margin: 0 0 8px; font-size: 14px; color: ${riskColor}; text-transform: uppercase; letter-spacing: 0.05em;">AI Risk Analysis</h3>
           <p style="margin: 0; font-size: 15px; line-height: 1.6; color: rgba(255,255,255,0.9); font-style: italic;">
             "${explanation}"
           </p>
        </div>

        <div style="display: grid; grid-template-cols: 1fr 1fr; gap: 16px; margin-bottom: 32px;">
           <div style="background: rgba(255,255,255,0.02); padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
             <div style="font-size: 10px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Risk Score</div>
             <div style="font-size: 18px; font-weight: 700; color: #ef4444;">${riskScore}/100</div>
           </div>
           <div style="background: rgba(255,255,255,0.02); padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
             <div style="font-size: 10px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Signals</div>
             <div style="font-size: 18px; font-weight: 700; color: #f97316;">${escapeHtml(String(analysis.signals.length))} detected</div>
           </div>
        </div>

        <div style="display: flex; gap: 12px;">
          <button id="txguard-reject" style="flex: 1; height: 52px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: white; font-weight: 700; cursor: pointer; transition: all 0.2s;">
            Reject Transaction
          </button>
          <button id="txguard-approve" style="flex: 1; height: 52px; border-radius: 12px; border: none; background: #eab308; color: #000; font-weight: 700; cursor: pointer; transition: all 0.2s;">
            Continue Anyway
          </button>
        </div>
      `;

      shadow.appendChild(overlay);
      overlay.appendChild(card);
      document.body.appendChild(container);

      shadow.getElementById('txguard-reject')?.addEventListener('click', () => {
        container.remove();
        onDecision(false);
      });

      shadow.getElementById('txguard-approve')?.addEventListener('click', () => {
        if (confirm('Are you absolutely sure? This action is risky.')) {
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
