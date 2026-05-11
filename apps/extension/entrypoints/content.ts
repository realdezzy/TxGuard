import { defineContentScript } from '#imports';
import { RiskLevel, SignalType, type RiskSignal, type TransactionAnalysis } from '@txguard/core';
import { calculateRiskScore, scoreToRiskLevel, scoreToRecommendation } from '@txguard/core';
import {
  detectBrowserThreats,
  detectSeedPhraseInput,
  detectWalletSpoofingRisk,
  escapeHtml,
  hasSensitiveText,
  isElementInside,
  isVisible,
  type BrowserThreatContext,
} from '../utils/browser-threat-detectors.js';

interface BrowserThreatReport {
  url: string;
  title: string;
  signals: RiskSignal[];
  timestamp: number;
}

type DecisionHandler = (approved: boolean) => void;

const MAX_TX_PAYLOAD_BYTES = 1_048_576;
const EVENT_ID_PATTERN = /^[a-zA-Z0-9\-]+$/;

function buildBrowserAnalysis(report: BrowserThreatReport): TransactionAnalysis {
  const { riskScore, whyScore, scoreVarianceHint } = calculateRiskScore(report.signals);

  return {
    instructions: [],
    signals: report.signals,
    simulation: null,
    riskScore,
    whyScore,
    scoreVarianceHint,
    riskLevel: scoreToRiskLevel(riskScore),
    recommendation: scoreToRecommendation(riskScore),
    explanation: report.signals.map((signal) => signal.message).join('\n'),
    timestamp: report.timestamp,
  };
}

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: false,
  main() {
    console.log('TxGuard content script injected');

    const isIframe = window.top !== window.self;

    const SAFE_DOMAINS = new Set([
      'youtube.com', 'youtu.be',
      'google.com', 'google.co',
      'github.com', 'gitlab.com',
      'stackoverflow.com',
      'wikipedia.org',
      'reddit.com',
      'twitter.com', 'x.com',
      'instagram.com', 'facebook.com',
      'netflix.com', 'spotify.com',
      'amazon.com', 'ebay.com',
      'office.com', 'outlook.com',
      'discord.com', 'slack.com',
      'notion.so', 'figma.com',
      'localhost', '127.0.0.1', '192.168.',
      '10.0.', '172.16.', '172.17.', '172.18.', '172.19.',
      '172.20.', '172.21.', '172.22.', '172.23.', '172.24.',
      '172.25.', '172.26.', '172.27.', '172.28.', '172.29.',
      '172.30.', '172.31.',
    ]);

    function isSafeDomain(): boolean {
      const hostname = location.hostname;
      if (hostname === '') return true;
      if (hostname === 'localhost' || hostname.startsWith('127.') || hostname.startsWith('192.168.')) return true;
      if (/^10\.\d+\.\d+\.\d+$/.test(hostname)) return true;
      if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(hostname)) return true;
      for (const safe of SAFE_DOMAINS) {
        if (hostname === safe || hostname.endsWith('.' + safe)) return true;
      }
      return false;
    }

    function hasWalletOrCryptoContext(): boolean {
      if ((window as { solana?: unknown }).solana) return true;
      if ((window as { solflare?: unknown }).solflare) return true;
      if ((window as { phantom?: { solana?: unknown } }).phantom?.solana) return true;
      if ((window as { backpack?: unknown }).backpack) return true;
      if ((window as { coinbaseSolana?: unknown }).coinbaseSolana) return true;
      if ((window as { okxwallet?: { solana?: unknown } }).okxwallet?.solana) return true;

      try {
        const walletStandard = (window.navigator as any)?.wallets;
        if (walletStandard && typeof walletStandard[Symbol.iterator] === 'function') {
          for (const w of walletStandard) {
            if (w?.signTransaction || w?.signAllTransactions) return true;
          }
        }
      } catch { /* ignore */ }

      return false;
    }

    const skipThreatDetection = isIframe || isSafeDomain();

    const browserThreats = new Map<string, RiskSignal>();
    const MAX_THREATS = 20;
    const REPORT_THROTTLE_MS = 5_000;
    let lastReportTimestamp = 0;
    let trustedOrigins: string[] = [];

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
    let riskBadge: HTMLElement | null = null;

    const showRiskBadge = (analysis: TransactionAnalysis) => {
      if (riskBadge) {
        riskBadge.remove();
        riskBadge = null;
      }

      const riskColor = analysis.riskLevel === RiskLevel.CRITICAL ? '#ef4444' :
                        analysis.riskLevel === RiskLevel.HIGH ? '#f97316' :
                        analysis.riskLevel === RiskLevel.MEDIUM ? '#eab308' : '#22c55e';

      const badge = document.createElement('div');
      badge.id = 'txguard-risk-badge';
      const shadow = badge.attachShadow({ mode: 'open' });

      const style = document.createElement('style');
      style.textContent = `
        .badge-wrap {
          position: fixed; bottom: 20px; right: 20px; z-index: 2147483646;
          display: flex; align-items: center; gap: 10px;
          padding: 10px 16px;
          background: rgba(10, 10, 10, 0.9); backdrop-filter: blur(10px);
          border: 1px solid ${riskColor}33; border-radius: 14px;
          font-family: system-ui, -apple-system, sans-serif; color: white;
          cursor: pointer; user-select: none;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
          animation: txguard-badge-in 0.4s cubic-bezier(0.16,1,0.3,1);
          transition: all 0.2s;
        }
        .badge-wrap:hover {
          background: rgba(15, 15, 15, 0.95);
          border-color: ${riskColor}66;
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.5);
        }
        @keyframes txguard-badge-in {
          from { transform: translateY(12px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .close-badge {
          display: flex; align-items: center; justify-content: center;
          width: 20px; height: 20px; border-radius: 50%;
          background: rgba(255,255,255,0.08); border: none; cursor: pointer;
          color: rgba(255,255,255,0.4); font-size: 11px; transition: all 0.15s;
        }
        .close-badge:hover { background: rgba(255,255,255,0.15); color: white; }
      `;
      shadow.appendChild(style);

      const badgeInner = document.createElement('div');
      badgeInner.className = 'badge-wrap';
      badgeInner.innerHTML = `
        <div style="
          width: 10px; height: 10px; border-radius: 50%;
          background: ${riskColor}; box-shadow: 0 0 8px ${riskColor};
          animation: txguard-badge-in 0.4s ease;
        "></div>
        <div>
          <div style="font-size: 11px; font-weight: 800; color: ${riskColor}; text-transform: uppercase; letter-spacing: 0.04em;">
            ${analysis.riskLevel} Risk
          </div>
          <div style="font-size: 10px; color: rgba(255,255,255,0.4);">
            ${analysis.signals.length} signal${analysis.signals.length !== 1 ? 's' : ''} detected
          </div>
        </div>
        <button class="close-badge" title="Dismiss">✕</button>
      `;
      shadow.appendChild(badgeInner);
      document.body.appendChild(badge);

      shadow.querySelector('.close-badge')?.addEventListener('click', (e) => {
        e.stopPropagation();
        badge.remove();
        riskBadge = null;
      });

      badgeInner.addEventListener('click', () => {
        showThreatToast(analysis);
      });

      riskBadge = badge;
    };

    const showThreatToast = (analysis: TransactionAnalysis) => {
      if (toastContainer) {
        toastContainer.remove();
        toastContainer = null;
      }
      if (analysis.riskLevel === RiskLevel.SAFE) return;

      toastContainer = document.createElement('div');
      toastContainer.id = 'txguard-threat-toast';
      const shadow = toastContainer.attachShadow({ mode: 'open' });

      const riskColor = analysis.riskLevel === RiskLevel.CRITICAL ? '#ef4444' : 
                        analysis.riskLevel === RiskLevel.HIGH ? '#f97316' : '#eab308';

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
        .toast-body { cursor: pointer; transition: all 0.2s; }
        .toast-body:hover { background: rgba(15, 15, 15, 0.95) !important; border-color: rgba(255,255,255,0.15) !important; }
        .signal-row { cursor: default; }
      `;
      shadow.appendChild(styleTag);

      let isExpanded = false;
      let dismissTimer: ReturnType<typeof setTimeout>;

      const dismiss = () => {
        if (!toastContainer) return;
        clearTimeout(dismissTimer);
        toast.querySelector('.toast-body')!.animate(
          [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.95)' }],
          { duration: 200, fill: 'forwards' }
        ).onfinish = () => {
          toastContainer?.remove();
          toastContainer = null;
        };
      };

      const expand = () => {
        if (isExpanded) return;
        isExpanded = true;
        clearTimeout(dismissTimer);

        const sorted = [...analysis.signals].sort((a, b) => {
          const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, SAFE: 4 } as Record<string, number>;
          return (order[a.level] ?? 5) - (order[b.level] ?? 5);
        });

        const signalRows = sorted.map(s => {
          const color = s.level === 'CRITICAL' ? '#ef4444' :
                        s.level === 'HIGH' ? '#f97316' :
                        s.level === 'MEDIUM' ? '#eab308' : '#22c55e';
          return `
            <div class="signal-row" style="
              display: flex; align-items: flex-start; gap: 10px;
              padding: 10px; border-radius: 10px;
              background: rgba(255,255,255,0.03);
              border: 1px solid rgba(255,255,255,0.05);
              margin-bottom: 8px;
            ">
              <span style="
                display: inline-block; width: 8px; height: 8px; border-radius: 50%;
                background: ${color}; box-shadow: 0 0 6px ${color};
                margin-top: 3px; flex-shrink: 0;
              "></span>
              <div style="min-width: 0;">
                <div style="font-size: 12px; font-weight: 700; color: ${color}; margin-bottom: 2px;">
                  ${escapeHtml(s.title)}
                </div>
                <div style="font-size: 11px; line-height: 1.4; color: rgba(255,255,255,0.6);">
                  ${escapeHtml(s.message)}
                </div>
              </div>
            </div>
          `;
        }).join('');

        const body = shadow.querySelector('.toast-body') as HTMLElement;
        body.style.maxHeight = '70vh';
        body.style.overflow = 'auto';
        body.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 10px; height: 10px; border-radius: 50%; background: ${riskColor}; box-shadow: 0 0 10px ${riskColor};"></div>
              <span style="font-weight: 800; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: ${riskColor};">
                ${analysis.riskLevel} Risk Detected
              </span>
            </div>
            <span style="font-size: 11px; color: rgba(255,255,255,0.3);">Score: ${analysis.riskScore}/100 · ${analysis.signals.length} signal${analysis.signals.length !== 1 ? 's' : ''}</span>
          </div>
          <div style="margin-bottom: 14px; padding: 12px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05);">
            <p style="margin: 0; font-size: 13px; line-height: 1.5; color: rgba(255,255,255,0.8);">
              ${escapeHtml(analysis.explanation)}
            </p>
          </div>
          ${signalRows}
          <div style="display: flex; gap: 8px; margin-top: 12px;">
            <button id="txguard-toast-dismiss" style="
              flex: 1; padding: 10px; border-radius: 10px;
              background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1);
              color: rgba(255,255,255,0.7); font-size: 12px; font-weight: 700; cursor: pointer;
              transition: background 0.15s;
            ">Dismiss</button>
          </div>
        `;

        shadow.getElementById('txguard-toast-dismiss')?.addEventListener('click', dismiss);
        body.style.cursor = 'default';
      };

      const toast = document.createElement('div');
      toast.style.cssText = `
        position: fixed; top: 24px; right: 24px; width: 360px;
        z-index: 2147483647; animation: txguard-slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      `;

      toast.innerHTML = `
        <div class="toast-body" style="
          background: rgba(10, 10, 10, 0.85); backdrop-filter: blur(12px);
          border: 1px solid ${riskColor}33; border-radius: 16px;
          padding: 20px; color: white; font-family: system-ui, -apple-system, sans-serif;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
        ">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 10px; height: 10px; border-radius: 50%; background: ${riskColor}; box-shadow: 0 0 10px ${riskColor};"></div>
            <span style="font-weight: 800; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: ${riskColor};">
              ${analysis.riskLevel} Risk Detected
            </span>
            <button id="close-toast" style="margin-left: auto; background: none; border: none; color: rgba(255,255,255,0.4); cursor: pointer; padding: 4px; font-size: 16px;">✕</button>
          </div>
          <p style="margin: 12px 0 0; font-size: 14px; line-height: 1.5; color: rgba(255,255,255,0.8);">
            ${escapeHtml(analysis.explanation.split('\n')[0])}
          </p>
          <div style="margin-top: 12px; font-size: 11px; color: rgba(255,255,255,0.4); display: flex; justify-content: space-between; align-items: center;">
            <span>${analysis.signals.length} signal${analysis.signals.length !== 1 ? 's' : ''} detected</span>
            <span style="background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; color: rgba(255,255,255,0.5);">Score: ${analysis.riskScore}</span>
          </div>
          <div style="margin-top: 10px; text-align: center;">
            <span style="font-size: 10px; color: rgba(255,255,255,0.25);">Click to review details</span>
          </div>
        </div>
      `;

      shadow.appendChild(toast);
      document.body.appendChild(toastContainer);

      shadow.querySelector('.toast-body')?.addEventListener('click', expand);
      shadow.getElementById('close-toast')?.addEventListener('click', dismiss);

      dismissTimer = setTimeout(dismiss, 10_000);
    };

    let lastPhishCheck = 0;
    const PHISH_CHECK_TTL = 30 * 60_000; // 30 min

    const checkDomainReputation = async () => {
      if (isSafeDomain()) return;
      const now = Date.now();
      if (now - lastPhishCheck < PHISH_CHECK_TTL) return;
      lastPhishCheck = now;

      let hostname = location.hostname;
      if (hostname.startsWith('www.')) hostname = hostname.slice(4);

      try {
        const result = await browser.runtime.sendMessage({
          type: 'CHECK_PHISHING_DOMAIN',
          domain: hostname,
        }) as { threat: boolean; severity: string; riskScore: number };

        if (result?.threat) {
          rememberThreat({
            type: SignalType.EXTERNAL_THREAT,
            level: result.severity === 'critical' ? RiskLevel.CRITICAL :
                   result.severity === 'high' ? RiskLevel.HIGH :
                   result.severity === 'medium' ? RiskLevel.MEDIUM : RiskLevel.LOW,
            title: 'Known Phishing Domain',
            message: `This domain (${hostname}) is flagged as "${result.severity}" by the PhishDestroy threat intelligence network (score: ${result.riskScore}/100).`,
            metadata: {
              domain: hostname,
              source: 'PhishDestroy API',
              severity: result.severity,
              riskScore: result.riskScore,
              scope: 'page',
            },
          }, 'page');
          reportThreats(true);
        }
      } catch {
        // PhishDestroy check failed silently
      }
    };

    const reportThreats = (force = false) => {
      if (browserThreats.size === 0) return;
      const now = Date.now();
      if (!force && now - lastReportTimestamp < REPORT_THROTTLE_MS) return;
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
      if (analysis.riskLevel !== RiskLevel.SAFE) {
        showRiskBadge(analysis);
      }

      browser.runtime.sendMessage({ type: 'BROWSER_THREAT', report }).catch(() => undefined);
    };

    const isOriginTrusted = () => trustedOrigins.some((origin) => location.origin === origin);

    const buildThreatContext = (): BrowserThreatContext => ({
      url: location.href,
      hostname: location.hostname,
      referrer: document.referrer,
      isFramed: window.top !== window.self,
      isTrustedOrigin: isOriginTrusted(),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      solanaProvider: (window as { solana?: unknown }).solana,
      phantomSolanaProvider: (window as { phantom?: { solana?: unknown } }).phantom?.solana,
      hasWalletProvider: hasWalletOrCryptoContext(),
    });

    function runAllDetectors() {
      for (const signal of detectBrowserThreats(document, buildThreatContext())) {
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

    // Initial scan — only if page warrants threat detection
    if (!skipThreatDetection) {
      runAllDetectors();
      setTimeout(reportThreats, 1000);
      window.addEventListener('click', detectClickTargetMismatch, true);
    }
    // PhishDestroy domain check runs on every page (even safe-listed ones)
    // and force-reports if the domain is flagged
    setTimeout(() => checkDomainReputation(), 300);

    // MutationObserver for lazy-loaded threats — only on relevant pages
    let mutationScanCount = 0;
    const MAX_MUTATION_SCANS = 10;
    let mutationDebounce: ReturnType<typeof setTimeout> | null = null;

    if (!skipThreatDetection) {
      const observer = new MutationObserver(() => {
      if (mutationScanCount >= MAX_MUTATION_SCANS) return;
      if (mutationDebounce) clearTimeout(mutationDebounce);
      mutationDebounce = setTimeout(() => {
        mutationScanCount++;
        const context = buildThreatContext();
        const seedSignal = detectSeedPhraseInput(document, context);
        if (seedSignal) {
          rememberThreat(seedSignal, 'page');
          reportThreats();
        }
        const spoofing = detectWalletSpoofingRisk(document, context);
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
    }

    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      // Handle transaction analysis requests
      if (data.type === 'TXGUARD_ANALYZE_TX') {
        if (typeof data.transaction !== 'string' || typeof data.eventId !== 'string') return;
        if (data.transaction.length > MAX_TX_PAYLOAD_BYTES) return;
        if (!EVENT_ID_PATTERN.test(data.eventId)) return;

        browser.runtime.sendMessage({
          type: 'ANALYZE_TRANSACTION',
          transaction: data.transaction,
          eventId: data.eventId
        }).then((response) => {
          if (response?.error || response?.approved === false && !response?.requiresUserDecision) {
            window.postMessage({
              type: 'TXGUARD_RESULT',
              eventId: data.eventId,
              approved: false,
              error: response?.error || 'Analysis rejected the transaction',
              riskLevel: response?.analysis?.riskLevel,
              riskScore: response?.analysis?.riskScore,
              explanation: response?.analysis?.explanation,
            }, window.location.origin);
            return;
          }
          if (response?.analysis && response.requiresUserDecision) {
            showGuardianOverlay(response.analysis, (approved) => {
              window.postMessage({
                type: 'TXGUARD_RESULT',
                eventId: data.eventId,
                approved,
                riskLevel: response.analysis.riskLevel,
                riskScore: response.analysis.riskScore,
              }, window.location.origin);
            });
          } else {
            window.postMessage({
              type: 'TXGUARD_RESULT',
              eventId: data.eventId,
              approved: true,
            }, window.location.origin);
          }
        }).catch((err) => {
          window.postMessage({
            type: 'TXGUARD_RESULT',
            eventId: data.eventId,
            approved: false,
            error: err instanceof Error ? err.message : 'Analysis failed',
          }, window.location.origin);
        });
        return;
      }

      // Handle message signing safety check
      if (data.type === 'TXGUARD_CHECK_MESSAGE') {
        if (typeof data.eventId !== 'string') return;
        const threats = [...browserThreats.values()];
        const hasCritical = threats.some((s) => s.level === RiskLevel.CRITICAL);
        const hasHigh = threats.some((s) => s.level === RiskLevel.HIGH);
        window.postMessage({
          type: 'TXGUARD_MESSAGE_RESULT',
          eventId: data.eventId,
          approved: !hasCritical,
          threatCount: threats.length,
          riskLevel: hasCritical ? 'CRITICAL' : hasHigh ? 'HIGH' : threats.length > 0 ? 'MEDIUM' : 'SAFE',
        }, window.location.origin);
        return;
      }
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
