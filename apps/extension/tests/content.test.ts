// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { RiskLevel, SignalType } from '@txguard/core';
import {
  detectBrowserThreats,
  detectFramingRisk,
  detectOverlayRisk,
  detectSeedPhraseInput,
  detectWalletSpoofingRisk,
  type BrowserThreatContext,
} from '../utils/browser-threat-detectors.js';

const overlayHtml = fs.readFileSync(path.join(__dirname, 'fixtures/transparent-overlay.html'), 'utf8');
const seedPhraseHtml = fs.readFileSync(path.join(__dirname, 'fixtures/seed-phrase-input.html'), 'utf8');
const fakeWalletHtml = fs.readFileSync(path.join(__dirname, 'fixtures/fake-wallet-modal.html'), 'utf8');
const iframeClickjackHtml = fs.readFileSync(path.join(__dirname, 'fixtures/iframe-clickjack.html'), 'utf8');
const benignModalHtml = fs.readFileSync(path.join(__dirname, 'fixtures/benign-modal.html'), 'utf8');
const walletDownloadHtml = fs.readFileSync(path.join(__dirname, 'fixtures/wallet-download-prompt.html'), 'utf8');

function setHtml(html: string) {
  document.body.innerHTML = html;
}

function context(overrides: Partial<BrowserThreatContext> = {}): BrowserThreatContext {
  return {
    url: 'https://example.test',
    hostname: 'example.test',
    isFramed: false,
    isTrustedOrigin: false,
    viewportWidth: 1024,
    viewportHeight: 768,
    ...overrides,
  };
}

describe('Browser Threat Detection DOM Logic', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('Seed Phrase Phishing', () => {
    it('detects seed phrase inputs in DOM', () => {
      setHtml(seedPhraseHtml);
      const signal = detectSeedPhraseInput(document, context());
      expect(signal).toMatchObject({
        type: SignalType.WALLET_SPOOFING,
        level: RiskLevel.CRITICAL,
      });
    });

    it('does not false-positive on benign modal', () => {
      setHtml(benignModalHtml);
      expect(detectSeedPhraseInput(document, context())).toBeNull();
    });

    it('does not false-positive on wallet download prompt', () => {
      setHtml(walletDownloadHtml);
      expect(detectSeedPhraseInput(document, context())).toBeNull();
    });
  });

  describe('Wallet Spoofing', () => {
    it('detects fake wallet controls in DOM', () => {
      setHtml(fakeWalletHtml);
      const signals = detectWalletSpoofingRisk(document, context());
      expect(signals).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: 'dom',
            signal: expect.objectContaining({ type: SignalType.WALLET_SPOOFING }),
          }),
        ]),
      );
    });

    it('benign modal has no wallet-like spoofing signals', () => {
      setHtml(benignModalHtml);
      expect(detectWalletSpoofingRisk(document, context())).toHaveLength(0);
    });
  });

  describe('Wallet Download Prompt Detection', () => {
    it('detects wallet download prompts from non-wallet domain', () => {
      setHtml(walletDownloadHtml);
      const signals = detectWalletSpoofingRisk(document, context());
      expect(signals.some((item) => item.signal.title === 'Suspicious Wallet Download Prompt')).toBe(true);
    });

    it('does not trigger on official wallet domains', () => {
      setHtml(walletDownloadHtml);
      const signals = detectWalletSpoofingRisk(document, context({ hostname: 'phantom.app' }));
      expect(signals.some((item) => item.signal.title === 'Suspicious Wallet Download Prompt')).toBe(false);
    });
  });

  describe('Clickjacking', () => {
    it('identifies transparent overlay risk characteristics', () => {
      setHtml(overlayHtml);
      const signals = detectOverlayRisk(document, context());
      expect(signals).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: 'dom',
            signal: expect.objectContaining({ type: SignalType.CLICKJACKING }),
          }),
        ]),
      );
    });

    it('does not trigger overlay risk on benign modal', () => {
      setHtml(benignModalHtml);
      expect(detectOverlayRisk(document, context())).toHaveLength(0);
    });

    it('detects framed page risk', () => {
      setHtml(iframeClickjackHtml);
      const signal = detectFramingRisk(context({ isFramed: true, crossOrigin: true, referrer: 'https://attacker.test' }));
      expect(signal).toMatchObject({
        category: 'origin',
        signal: expect.objectContaining({ type: SignalType.CLICKJACKING }),
      });
    });

    it('does not detect framed page risk for trusted origins', () => {
      const signal = detectFramingRisk(context({ isFramed: true, isTrustedOrigin: true }));
      expect(signal).toBeNull();
    });
  });

  describe('Aggregated production path', () => {
    it('returns critical signal for seed phrase phishing', () => {
      setHtml(seedPhraseHtml);
      const signals = detectBrowserThreats(document, context());
      expect(signals).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: SignalType.WALLET_SPOOFING,
            level: RiskLevel.CRITICAL,
          }),
        ]),
      );
    });

    it('does not produce signals for benign modal fixture', () => {
      setHtml(benignModalHtml);
      expect(detectBrowserThreats(document, context())).toHaveLength(0);
    });
  });
});
