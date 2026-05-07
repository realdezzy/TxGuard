import { defineContentScript } from '#imports';

export default defineContentScript({
  matches: ['<all_urls>'],
  world: 'MAIN',
  main() {
    const log = (...args: any[]) => console.log('[TxGuard Inpage]', ...args);

    const analyzeTx = (transaction: any): Promise<{ approved: boolean; riskLevel?: string; riskScore?: number; explanation?: string }> => {
      return new Promise((resolve, reject) => {
        const eventId = crypto.randomUUID();
        
        const timeout = setTimeout(() => {
          window.removeEventListener('message', handleResponse);
          reject(new Error('TxGuard analysis timed out'));
        }, 30_000);

        const handleResponse = (event: MessageEvent) => {
          if (event.data?.type === 'TXGUARD_RESULT' && event.data?.eventId === eventId) {
            clearTimeout(timeout);
            window.removeEventListener('message', handleResponse);
            resolve({
              approved: event.data.approved,
              riskLevel: event.data.riskLevel,
              riskScore: event.data.riskScore,
              explanation: event.data.explanation,
            });
          }
        };

        window.addEventListener('message', handleResponse);

        window.postMessage({
          type: 'TXGUARD_ANALYZE_TX',
          eventId,
          transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        }, window.location.origin);
      });
    };

    const wrapSolanaProvider = (provider: any) => {
      if (!provider || provider.__isTxGuardWrapped) return;

      log('Wrapping Solana provider:', provider.name || 'unnamed');

      const originalSignTransaction = provider.signTransaction?.bind(provider);
      const originalSignAllTransactions = provider.signAllTransactions?.bind(provider);

      if (originalSignTransaction) {
        provider.signTransaction = async (transaction: any) => {
          log('Intercepted signTransaction');
          const result = await analyzeTx(transaction);
          if (result.approved) {
            return originalSignTransaction(transaction);
          }
          const riskInfo = result.riskLevel ? ` [${result.riskLevel} risk, score ${result.riskScore}]` : '';
          throw new Error(`Transaction rejected by TxGuard${riskInfo}`);
        };
      }

      if (originalSignAllTransactions) {
        provider.signAllTransactions = async (transactions: any[]) => {
          log('Intercepted signAllTransactions');
          for (let i = 0; i < transactions.length; i++) {
            const result = await analyzeTx(transactions[i]);
            if (!result.approved) {
              const riskInfo = result.riskLevel ? ` [${result.riskLevel} risk, score ${result.riskScore}]` : '';
              throw new Error(`Batch transaction #${i + 1} rejected by TxGuard${riskInfo}`);
            }
          }
          return originalSignAllTransactions(transactions);
        };
      }

      provider.__isTxGuardWrapped = true;
    };

    const scan = () => {
      const win = window as any;

      const providers: Array<{ name: string; obj: any }> = [];

      // Standard Solana provider (used by Phantom, Solflare in compatibility mode, etc.)
      if (win.solana) providers.push({ name: 'solana', obj: win.solana });

      // Wallet-specific namespaces
      if (win.solflare) providers.push({ name: 'solflare', obj: win.solflare });
      if (win.backpack) providers.push({ name: 'backpack', obj: win.backpack });
      if (win.coinbaseSolana) providers.push({ name: 'coinbaseSolana', obj: win.coinbaseSolana });

      // Nested namespaces
      if (win.phantom?.solana) providers.push({ name: 'phantom.solana', obj: win.phantom.solana });
      if (win.okxwallet?.solana) providers.push({ name: 'okxwallet.solana', obj: win.okxwallet.solana });
      if (win.trustwallet?.solana) providers.push({ name: 'trustwallet.solana', obj: win.trustwallet.solana });
      if (win.nightly?.solana) providers.push({ name: 'nightly.solana', obj: win.nightly.solana });
      if (win.bitget?.solana) providers.push({ name: 'bitget.solana', obj: win.bitget.solana });

      // Wallet Standard API (newer wallets)
      try {
        const walletStandard = win.navigator?.wallets as Array<{ accounts: any[]; signTransaction?: any; signAllTransactions?: any; name?: string }>;
        if (walletStandard && typeof walletStandard[Symbol.iterator] === 'function') {
          for (const wallet of walletStandard) {
            if (wallet.signTransaction || wallet.signAllTransactions) {
              providers.push({ name: wallet.name || 'wallet-standard', obj: wallet });
            }
          }
        }
      } catch { /* wallet standard not available */ }

      const wrapped = new Set<any>();
      for (const { name, obj } of providers) {
        if (wrapped.has(obj)) continue;
        wrapped.add(obj);
        wrapSolanaProvider(obj);
      }
    };

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          for (const node of m.addedNodes) {
            if (node.nodeName === 'SCRIPT') {
              scan();
              return;
            }
          }
        }
      }
    });
    
    if (document.documentElement) {
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    scan();
  },
});
