import { defineContentScript } from '#imports';

export default defineContentScript({
  matches: ['<all_urls>'],
  world: 'MAIN',
  main() {
    const log = (...args: any[]) => console.log('[TxGuard Inpage]', ...args);

    const analyzeTx = (transaction: any): Promise<boolean> => {
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
            resolve(event.data.approved);
          }
        };

        window.addEventListener('message', handleResponse);

        window.postMessage({
          type: 'TXGUARD_ANALYZE_TX',
          eventId,
          transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
        }, '*');
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
          const approved = await analyzeTx(transaction);
          if (approved) {
            return originalSignTransaction(transaction);
          } else {
            throw new Error('Transaction rejected by TxGuard');
          }
        };
      }

      if (originalSignAllTransactions) {
        provider.signAllTransactions = async (transactions: any[]) => {
          log('Intercepted signAllTransactions');
          for (const tx of transactions) {
            const approved = await analyzeTx(tx);
            if (!approved) {
              throw new Error('Batch transaction rejected by TxGuard');
            }
          }
          return originalSignAllTransactions(transactions);
        };
      }

      provider.__isTxGuardWrapped = true;
    };

    const scan = () => {
      if ((window as any).solana) {
        wrapSolanaProvider((window as any).solana);
      }
      if ((window as any).phantom?.solana) {
        wrapSolanaProvider((window as any).phantom.solana);
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
