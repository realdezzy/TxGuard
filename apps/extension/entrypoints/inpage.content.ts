import { defineContentScript } from '#imports';

export default defineContentScript({
  matches: ['<all_urls>'],
  world: 'MAIN',
  main() {
    const log = (...args: any[]) => console.log('[TxGuard Inpage]', ...args);

    const wrapSolanaProvider = (provider: any) => {
      if (!provider || provider.__isTxGuardWrapped) return;

      log('Wrapping Solana provider:', provider.name || 'unnamed');

      const originalSignTransaction = provider.signTransaction?.bind(provider);
      const originalSignAllTransactions = provider.signAllTransactions?.bind(provider);

      if (originalSignTransaction) {
        provider.signTransaction = async (transaction: any) => {
          log('Intercepted signTransaction');

          return new Promise((resolve, reject) => {
            const eventId = Math.random().toString(36).substring(7);
            
            const handleResponse = (event: MessageEvent) => {
              if (event.data?.type === 'TXGUARD_RESULT' && event.data?.eventId === eventId) {
                window.removeEventListener('message', handleResponse);
                
                if (event.data.approved) {
                  resolve(originalSignTransaction(transaction));
                } else {
                  reject(new Error('Transaction rejected by TxGuard'));
                }
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
      }

      if (originalSignAllTransactions) {
        provider.signAllTransactions = async (transactions: any[]) => {
          log('Intercepted signAllTransactions');
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

    setInterval(scan, 1000);
    scan();
  },
});
