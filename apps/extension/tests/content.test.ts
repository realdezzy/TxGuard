import { describe, expect, it, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const overlayHtml = fs.readFileSync(path.join(__dirname, 'fixtures/transparent-overlay.html'), 'utf8');
const seedPhraseHtml = fs.readFileSync(path.join(__dirname, 'fixtures/seed-phrase-input.html'), 'utf8');
const fakeWalletHtml = fs.readFileSync(path.join(__dirname, 'fixtures/fake-wallet-modal.html'), 'utf8');
const iframeClickjackHtml = fs.readFileSync(path.join(__dirname, 'fixtures/iframe-clickjack.html'), 'utf8');
const benignModalHtml = fs.readFileSync(path.join(__dirname, 'fixtures/benign-modal.html'), 'utf8');
const walletDownloadHtml = fs.readFileSync(path.join(__dirname, 'fixtures/wallet-download-prompt.html'), 'utf8');

const SEED_PHRASE_TERMS = ['seed phrase', 'recovery phrase', 'secret recovery', 'private key', 'mnemonic'];
const WALLET_TERMS = ['phantom', 'solflare', 'backpack', 'approve', 'connect wallet', 'sign transaction'];
const WALLET_DOWNLOAD_TERMS = ['download phantom', 'install solflare', 'get backpack', 'download wallet'];

function detectsSeedPhraseInput(html: string): boolean {
  document.body.innerHTML = html;
  const inputs = [...document.querySelectorAll('input, textarea, [contenteditable], label')];
  return inputs.some(el => {
    const text = (el.textContent || (el as HTMLInputElement).value || '').toLowerCase();
    return SEED_PHRASE_TERMS.some(term => text.includes(term));
  });
}

function countWalletControls(html: string): number {
  document.body.innerHTML = html;
  return [...document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]')]
    .filter(el => {
      const text = (el.textContent ?? '').trim().toLowerCase();
      return WALLET_TERMS.some(term => text.includes(term));
    }).length;
}

function detectsWalletDownloadPrompt(html: string): boolean {
  document.body.innerHTML = html;
  const allText = (document.body.textContent ?? '').toLowerCase();
  return WALLET_DOWNLOAD_TERMS.some(term => allText.includes(term));
}

function hasTransparentOverlay(html: string): boolean {
  document.body.innerHTML = html;
  const elements = [...document.querySelectorAll('body *')];
  return elements.some(el => {
    const style = (el as HTMLElement).style;
    const position = style.position;
    const opacity = parseFloat(style.opacity || '1');
    const zIndex = parseInt(style.zIndex || '0', 10);
    const pointerEvents = style.pointerEvents;
    return (
      ['fixed', 'absolute', 'sticky'].includes(position) &&
      pointerEvents !== 'none' &&
      (opacity < 0.2 || zIndex > 9999)
    );
  });
}

function hasIframeEmbedding(html: string): boolean {
  document.body.innerHTML = html;
  return document.querySelectorAll('iframe').length > 0;
}

describe('Browser Threat Detection DOM Logic', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('Seed Phrase Phishing', () => {
    it('detects seed phrase inputs in DOM', () => {
      expect(detectsSeedPhraseInput(seedPhraseHtml)).toBe(true);
    });

    it('does not false-positive on benign modal', () => {
      expect(detectsSeedPhraseInput(benignModalHtml)).toBe(false);
    });

    it('does not false-positive on wallet download prompt', () => {
      expect(detectsSeedPhraseInput(walletDownloadHtml)).toBe(false);
    });
  });

  describe('Wallet Spoofing', () => {
    it('detects fake wallet controls in DOM', () => {
      expect(countWalletControls(fakeWalletHtml)).toBe(4);
    });

    it('benign modal has zero wallet-like controls', () => {
      expect(countWalletControls(benignModalHtml)).toBe(0);
    });
  });

  describe('Wallet Download Prompt Detection', () => {
    it('detects wallet download prompts from non-wallet domain', () => {
      expect(detectsWalletDownloadPrompt(walletDownloadHtml)).toBe(true);
    });

    it('does not trigger on benign modals', () => {
      expect(detectsWalletDownloadPrompt(benignModalHtml)).toBe(false);
    });

    it('does not trigger on fake wallet modal without download text', () => {
      expect(detectsWalletDownloadPrompt(fakeWalletHtml)).toBe(false);
    });
  });

  describe('Clickjacking — Transparent Overlay', () => {
    it('identifies transparent overlay risk characteristics', () => {
      expect(hasTransparentOverlay(overlayHtml)).toBe(true);
    });

    it('does not trigger on benign modal', () => {
      expect(hasTransparentOverlay(benignModalHtml)).toBe(false);
    });
  });

  describe('Clickjacking — iframe', () => {
    it('detects iframe embedding in clickjack fixture', () => {
      expect(hasIframeEmbedding(iframeClickjackHtml)).toBe(true);
    });

    it('iframe clickjack fixture also has transparent overlay', () => {
      expect(hasTransparentOverlay(iframeClickjackHtml)).toBe(true);
    });

    it('does not detect iframe in benign modal', () => {
      expect(hasIframeEmbedding(benignModalHtml)).toBe(false);
    });
  });
});
