import { RiskLevel, SignalType, type RiskSignal } from '@txguard/core';

export type SignalCategory = 'dom' | 'provider' | 'origin';

export interface CategorizedSignal {
  category: SignalCategory;
  signal: RiskSignal;
}

export interface BrowserThreatContext {
  url: string;
  hostname: string;
  referrer?: string;
  isFramed?: boolean;
  isTrustedOrigin?: boolean;
  crossOrigin?: boolean;
  viewportWidth?: number;
  viewportHeight?: number;
  solanaProvider?: unknown;
  phantomSolanaProvider?: unknown;
}

const SENSITIVE_TEXT = [
  'connect wallet',
  'sign transaction',
  'phantom',
  'solflare',
  'backpack',
  'seed phrase',
  'recovery phrase',
  'secret recovery',
  'private key',
  'mnemonic',
];

const SEED_PHRASE_TERMS = ['seed phrase', 'recovery phrase', 'secret recovery', 'private key', 'mnemonic'];
const WALLET_DOMAINS = ['phantom.app', 'solflare.com', 'backpack.app', 'glow.app'];
const WALLET_DOWNLOAD_TERMS = ['download phantom', 'install solflare', 'get backpack', 'download wallet'];

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function numericStyleValue(value: string, viewportSize = 0): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return 0;
  if (value.endsWith('vw') || value.endsWith('vh')) {
    return viewportSize * (parsed / 100);
  }
  return parsed;
}

function elementDimensions(element: Element): { width: number; height: number } {
  const htmlElement = element as HTMLElement;
  const rect = htmlElement.getBoundingClientRect();
  if (rect.width > 0 || rect.height > 0) {
    return { width: rect.width, height: rect.height };
  }

  const style = element.ownerDocument.defaultView?.getComputedStyle(htmlElement) ?? htmlElement.style;
  const viewportWidth = element.ownerDocument.defaultView?.innerWidth ?? 0;
  const viewportHeight = element.ownerDocument.defaultView?.innerHeight ?? 0;
  const width = numericStyleValue(style.width, viewportWidth);
  const height = numericStyleValue(style.height, viewportHeight);
  if (width > 0 || height > 0) return { width, height };
  if ((element.textContent ?? '').trim().length > 0) return { width: 1, height: 1 };

  return {
    width,
    height,
  };
}

export function isVisible(element: Element): boolean {
  const htmlElement = element as HTMLElement;
  const style = element.ownerDocument.defaultView?.getComputedStyle(htmlElement) ?? htmlElement.style;
  const { width, height } = elementDimensions(element);
  return (
    width > 0 &&
    height > 0 &&
    style.visibility !== 'hidden' &&
    style.display !== 'none' &&
    Number(style.opacity || '1') > 0.01
  );
}

function hasRenderedBox(element: Element): boolean {
  const htmlElement = element as HTMLElement;
  const style = element.ownerDocument.defaultView?.getComputedStyle(htmlElement) ?? htmlElement.style;
  const { width, height } = elementDimensions(element);
  return (
    width > 0 &&
    height > 0 &&
    style.visibility !== 'hidden' &&
    style.display !== 'none'
  );
}

export function hasSensitiveText(element: Element): boolean {
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

export function isElementInside(parent: Element, possibleChild: Element): boolean {
  return parent === possibleChild || parent.contains(possibleChild);
}

function capLevel(level: string): RiskLevel {
  if (level === RiskLevel.CRITICAL || level === RiskLevel.HIGH) return RiskLevel.MEDIUM;
  return level as RiskLevel;
}

export function aggregateSignals(categorized: CategorizedSignal[], seedPhraseSignal: RiskSignal | null): RiskSignal[] {
  const result: RiskSignal[] = [];

  if (seedPhraseSignal) {
    result.push(seedPhraseSignal);
  }

  if (categorized.length === 0) return result;

  const categories = new Set(categorized.map((item) => item.category));
  const countsByCategory = new Map<SignalCategory, number>();
  for (const { category } of categorized) {
    countsByCategory.set(category, (countsByCategory.get(category) ?? 0) + 1);
  }

  let escalationLevel: RiskLevel = RiskLevel.MEDIUM;
  const multiCategory = categories.size >= 2;
  const hasCategoryQuorum = multiCategory &&
    [...categories].every((cat) => (countsByCategory.get(cat) ?? 0) >= 2);

  if (hasCategoryQuorum) {
    if (categories.has('provider') && (categories.has('dom') || categories.has('origin'))) {
      escalationLevel = RiskLevel.CRITICAL;
    } else if (categories.has('dom') && categories.has('origin')) {
      escalationLevel = RiskLevel.HIGH;
    } else if (categories.has('provider')) {
      escalationLevel = RiskLevel.HIGH;
    }
  } else if (categories.has('provider')) {
    escalationLevel = RiskLevel.HIGH;
  }

  const shouldEscalate = hasCategoryQuorum || categories.has('provider');
  for (const { signal } of categorized) {
    result.push({ ...signal, level: shouldEscalate ? escalationLevel : capLevel(signal.level) });
  }

  return result;
}

export function detectSeedPhraseInput(documentRef: Document, context: Pick<BrowserThreatContext, 'url'>): RiskSignal | null {
  const inputsAndLabels = [...documentRef.querySelectorAll('input, textarea, [contenteditable], label')];

  const asksForSeedPhrase = inputsAndLabels.some((element) => {
    const input = element as HTMLInputElement;
    const text = (element.textContent || input.value || '').toLowerCase();
    return SEED_PHRASE_TERMS.some((term) => text.includes(term));
  });

  if (!asksForSeedPhrase) return null;

  return {
    type: SignalType.WALLET_SPOOFING,
    level: RiskLevel.CRITICAL,
    title: 'Critical: Seed Phrase Requested',
    message: 'This page is asking for your seed phrase or private key. Never enter this information on a website. It is almost certainly a scam.',
    metadata: { url: context.url },
  };
}

export function detectFramingRisk(context: BrowserThreatContext): CategorizedSignal | null {
  if (!context.isFramed || context.isTrustedOrigin) return null;

  let crossOrigin = context.crossOrigin ?? false;
  if (!context.crossOrigin) {
    try {
      crossOrigin = window.top?.location.origin !== window.location.origin;
    } catch {
      crossOrigin = true;
    }
  }

  if (!crossOrigin) return null;

  return {
    category: 'origin',
    signal: {
      type: SignalType.CLICKJACKING,
      level: RiskLevel.HIGH,
      title: 'Page Is Cross-Origin Framed',
      message:
        'This page is embedded inside a different origin. Embedded wallet or transaction prompts can be used in clickjacking attacks.',
      metadata: { url: context.url, referrer: context.referrer ?? '' },
    },
  };
}

export function detectOverlayRisk(documentRef: Document, context: BrowserThreatContext): CategorizedSignal[] {
  if (context.isTrustedOrigin) return [];
  const viewportArea = (context.viewportWidth ?? 0) * (context.viewportHeight ?? 0);
  if (viewportArea <= 0) return [];

  const isDialogElement = (element: Element): boolean => {
    const htmlElement = element as HTMLElement;
    const role = htmlElement.getAttribute('role');
    const ariaModal = htmlElement.getAttribute('aria-modal');
    if (role === 'dialog' || role === 'alertdialog' || ariaModal === 'true') return true;
    const tagName = htmlElement.tagName.toLowerCase();
    if (tagName === 'dialog') return true;
    return false;
  };

  const candidates = [...documentRef.querySelectorAll('body *')].filter((element) => {
    if (!hasRenderedBox(element)) return false;
    if (isDialogElement(element)) return false;
    const htmlElement = element as HTMLElement;
    const style = element.ownerDocument.defaultView?.getComputedStyle(htmlElement) ?? htmlElement.style;
    const { width, height } = elementDimensions(element);
    const area = width * height;
    const zIndex = Number.parseInt(style.zIndex, 10);
    return (
      ['fixed', 'absolute', 'sticky'].includes(style.position) &&
      style.pointerEvents !== 'none' &&
      area / viewportArea > 0.45 &&
      (Number(style.opacity || '1') < 0.2 || (Number.isFinite(zIndex) && zIndex > 100000))
    );
  });

  const canCheckBeneath = typeof documentRef.elementFromPoint === 'function';

  return candidates.slice(0, 3).filter((element) => {
    if (!canCheckBeneath) return true;
    const rect = (element as HTMLElement).getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const topElement = documentRef.elementFromPoint(centerX, centerY);
    if (topElement === element || element.contains(topElement) || topElement?.contains(element)) {
      const beneath = documentRef.elementsFromPoint(centerX, centerY).find(
        (el) => el !== element && !element.contains(el) && !el.contains(element),
      );
      if (!beneath) return false;
      const tag = beneath.tagName.toLowerCase();
      if (!['button', 'a', 'input', 'textarea', 'select', 'form'].includes(tag)) {
        const isInteractive = beneath.getAttribute('role') === 'button' ||
          beneath.getAttribute('onclick') !== null ||
          (beneath as HTMLElement).tabIndex >= 0;
        if (!isInteractive) return false;
      }
    }
    return true;
  }).map((element) => {
    const { width, height } = elementDimensions(element);
    return {
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
          width: Math.round(width),
          height: Math.round(height),
        },
      },
    };
  });
}

function providerPublicKey(provider: unknown): string | null {
  const candidate = provider as { publicKey?: { toBase58?: () => string } } | null | undefined;
  return candidate?.publicKey?.toBase58?.() ?? null;
}

export function detectWalletSpoofingRisk(documentRef: Document, context: BrowserThreatContext): CategorizedSignal[] {
  const results: CategorizedSignal[] = [];

  const walletLikeControls = [...documentRef.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]')]
    .filter((element) => isVisible(element) && hasSensitiveText(element));

  if (walletLikeControls.length >= 5 && !context.solanaProvider) {
    results.push({
      category: 'dom',
      signal: {
        type: SignalType.WALLET_SPOOFING,
        level: RiskLevel.MEDIUM,
        title: 'Wallet UI Spoofing Risk',
        message:
          'This page shows multiple wallet-like controls but no Solana provider is available in the page context. Verify the site before interacting.',
        metadata: {
          url: context.url,
          controls: walletLikeControls.slice(0, 5).map((element) => escapeHtml((element.textContent ?? '').trim().slice(0, 80))),
        },
      },
    });
  }

  if (context.solanaProvider && context.phantomSolanaProvider && context.solanaProvider !== context.phantomSolanaProvider) {
    const solanaKey = providerPublicKey(context.solanaProvider);
    const phantomKey = providerPublicKey(context.phantomSolanaProvider);
    if (solanaKey && phantomKey && solanaKey !== phantomKey) {
      results.push({
        category: 'provider',
        signal: {
          type: SignalType.WALLET_SPOOFING,
          level: RiskLevel.HIGH,
          title: 'Wallet Provider Mismatch',
          message: 'window.solana and window.phantom.solana expose different public keys. A malicious script may have injected a fake provider.',
          metadata: { url: context.url },
        },
      });
    }
  }

  const isWalletDomain = WALLET_DOMAINS.some((domain) => context.hostname.endsWith(domain));
  if (!isWalletDomain) {
    const pageText = (documentRef.body.textContent ?? '').toLowerCase();
    if (WALLET_DOWNLOAD_TERMS.some((term) => pageText.includes(term))) {
      results.push({
        category: 'origin',
        signal: {
          type: SignalType.WALLET_SPOOFING,
          level: RiskLevel.MEDIUM,
          title: 'Suspicious Wallet Download Prompt',
          message: 'This page prompts you to download a wallet extension but is not an official wallet domain. Verify the source before downloading.',
          metadata: { url: context.url, domain: context.hostname },
        },
      });
    }
  }

  return results;
}

export function detectBrowserThreats(documentRef: Document, context: BrowserThreatContext): RiskSignal[] {
  const seedSignal = detectSeedPhraseInput(documentRef, context);
  const categorized: CategorizedSignal[] = [];

  const framing = detectFramingRisk(context);
  if (framing) categorized.push(framing);

  categorized.push(...detectOverlayRisk(documentRef, context));
  categorized.push(...detectWalletSpoofingRisk(documentRef, context));

  return aggregateSignals(categorized, seedSignal);
}
