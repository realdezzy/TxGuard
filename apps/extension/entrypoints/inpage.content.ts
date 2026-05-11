import { defineContentScript } from '#imports';

export default defineContentScript({
  matches: ['<all_urls>'],
  world: 'MAIN',
  main() {
    const log = (...args: any[]) => console.log('[TxGuard Inpage]', ...args);

    const analyzeTx = (transaction: any): Promise<{
      approved: boolean;
      riskLevel?: string;
      riskScore?: number;
      explanation?: string;
    }> => {
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

        window.postMessage(
          {
            type: 'TXGUARD_ANALYZE_TX',
            eventId,
            transaction: transaction
              .serialize({ requireAllSignatures: false })
              .toString('base64'),
          },
          window.location.origin,
        );
      });
    };

    const checkMessageSafety = (): Promise<{
      approved: boolean;
      threatCount: number;
      riskLevel?: string;
    }> => {
      return new Promise((resolve) => {
        const eventId = crypto.randomUUID();

        const timeout = setTimeout(() => {
          window.removeEventListener('message', handleResponse);
          resolve({ approved: true, threatCount: 0 });
        }, 5_000);

        const handleResponse = (event: MessageEvent) => {
          if (event.data?.type === 'TXGUARD_MESSAGE_RESULT' && event.data?.eventId === eventId) {
            clearTimeout(timeout);
            window.removeEventListener('message', handleResponse);
            resolve({
              approved: event.data.approved,
              threatCount: event.data.threatCount ?? 0,
              riskLevel: event.data.riskLevel,
            });
          }
        };

        window.addEventListener('message', handleResponse);

        window.postMessage(
          { type: 'TXGUARD_CHECK_MESSAGE', eventId },
          window.location.origin,
        );
      });
    };

    const wrapMethod = (
      provider: any,
      prop: string,
      wrapper: (original: Function, walletName: string) => Function,
      walletName: string,
    ) => {
      const hasGetter = (p: string) => {
        const d = Object.getOwnPropertyDescriptor(provider, p);
        return d && typeof d.get === 'function';
      };
      const getOriginal = (p: string) => {
        if (hasGetter(p)) {
          return Object.getOwnPropertyDescriptor(provider, p)!
            .get!.call(provider)
            ?.bind(provider);
        }
        return provider[p]?.bind(provider);
      };

      const original = getOriginal(prop);
      if (!original) return false;

      const wrapped = wrapper(original, walletName);

      try {
        Object.defineProperty(provider, prop, {
          value: wrapped,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      } catch (err) {
        try {
          provider[prop] = wrapped;
        } catch {
          return false;
        }
      }

      return true;
    };

    const wrapSolanaProvider = (provider: any) => {
      if (!provider || provider.__isTxGuardWrapped) return provider;

      const walletName =
        provider.isPhantom ? 'Phantom' :
        provider.isSolflare ? 'Solflare' :
        provider.isBackpack ? 'Backpack' :
        provider.name || Object.getPrototypeOf(provider)?.constructor?.name || 'unnamed';

      const hasGetter = (prop: string) => {
        const d = Object.getOwnPropertyDescriptor(provider, prop);
        return d && typeof d.get === 'function';
      };

      let wrapFailures = 0;

      // signTransaction
      if (!wrapMethod(
        provider, 'signTransaction',
        (original) =>
          async function (this: any, transaction: any) {
            log('Intercepted signTransaction on', walletName);
            const result = await analyzeTx(transaction);
            if (result.approved) return original(transaction);
            const riskInfo = result.riskLevel ? ` [${result.riskLevel} risk, score ${result.riskScore}]` : '';
            throw new Error(`Transaction rejected by TxGuard${riskInfo}`);
          },
        walletName,
      )) wrapFailures++;

      // signAllTransactions
      if (!wrapMethod(
        provider, 'signAllTransactions',
        (original) =>
          async function (this: any, transactions: any[]) {
            log('Intercepted signAllTransactions on', walletName, `(${transactions.length} txs)`);
            for (let i = 0; i < transactions.length; i++) {
              const result = await analyzeTx(transactions[i]);
              if (!result.approved) {
                const riskInfo = result.riskLevel ? ` [${result.riskLevel} risk, score ${result.riskScore}]` : '';
                throw new Error(`Batch transaction #${i + 1} rejected by TxGuard${riskInfo}`);
              }
            }
            return original(transactions);
          },
        walletName,
      )) wrapFailures++;

      // signAndSendTransaction
      if (!wrapMethod(
        provider, 'signAndSendTransaction',
        (original) =>
          async function (this: any, transaction: any, options?: any) {
            log('Intercepted signAndSendTransaction on', walletName);
            const result = await analyzeTx(transaction);
            if (result.approved) return original(transaction, options);
            const riskInfo = result.riskLevel ? ` [${result.riskLevel} risk, score ${result.riskScore}]` : '';
            throw new Error(`Transaction rejected by TxGuard${riskInfo}`);
          },
        walletName,
      )) wrapFailures++;

      // signMessage
      if (!wrapMethod(
        provider, 'signMessage',
        (original) =>
          async function (this: any, message: Uint8Array, display?: string) {
            log('Intercepted signMessage on', walletName);
            const safety = await checkMessageSafety();
            if (!safety.approved) {
              throw new Error(
                `Message signing blocked by TxGuard — ${safety.threatCount} browser threat${safety.threatCount !== 1 ? 's' : ''} detected on this page`,
              );
            }
            return original(message, display);
          },
        walletName,
      )) wrapFailures++;

      // If any method failed, use a Proxy as fallback
      if (wrapFailures > 0) {
        log(`Provider ${walletName}: ${wrapFailures} methods non-writable, using Proxy`);
        return createProxyProvider(provider, walletName);
      }

      provider.__isTxGuardWrapped = true;
      return provider;
    };

    const createProxyProvider = (provider: any, walletName: string) => {
      const targets = new Set(['signTransaction', 'signAllTransactions', 'signAndSendTransaction', 'signMessage']);

      const proxy = new Proxy(provider, {
        get(target, prop, receiver) {
          const value = Reflect.get(target, prop, receiver);
          if (typeof prop === 'string' && targets.has(prop) && typeof value === 'function') {
            const original = value.bind(target);
            if (prop === 'signTransaction') {
              return async function (this: any, transaction: any) {
                log('Intercepted signTransaction on', walletName, '(proxy)');
                const result = await analyzeTx(transaction);
                if (result.approved) return original(transaction);
                const riskInfo = result.riskLevel ? ` [${result.riskLevel} risk, score ${result.riskScore}]` : '';
                throw new Error(`Transaction rejected by TxGuard${riskInfo}`);
              };
            }
            if (prop === 'signAllTransactions') {
              return async function (this: any, transactions: any[]) {
                log('Intercepted signAllTransactions on', walletName, `(${transactions.length} txs) (proxy)`);
                for (let i = 0; i < transactions.length; i++) {
                  const result = await analyzeTx(transactions[i]);
                  if (!result.approved) {
                    const riskInfo = result.riskLevel ? ` [${result.riskLevel} risk, score ${result.riskScore}]` : '';
                    throw new Error(`Batch transaction #${i + 1} rejected by TxGuard${riskInfo}`);
                  }
                }
                return original(transactions);
              };
            }
            if (prop === 'signAndSendTransaction') {
              return async function (this: any, transaction: any, options?: any) {
                log('Intercepted signAndSendTransaction on', walletName, '(proxy)');
                const result = await analyzeTx(transaction);
                if (result.approved) return original(transaction, options);
                const riskInfo = result.riskLevel ? ` [${result.riskLevel} risk, score ${result.riskScore}]` : '';
                throw new Error(`Transaction rejected by TxGuard${riskInfo}`);
              };
            }
            if (prop === 'signMessage') {
              return async function (this: any, message: Uint8Array, display?: string) {
                log('Intercepted signMessage on', walletName, '(proxy)');
                const safety = await checkMessageSafety();
                if (!safety.approved) {
                  throw new Error(
                    `Message signing blocked by TxGuard — ${safety.threatCount} browser threat${safety.threatCount !== 1 ? 's' : ''} detected on this page`,
                  );
                }
                return original(message, display);
              };
            }
          }
          return value;
        },
        set(target, prop, value) {
          return Reflect.set(target, prop, value);
        },
        has(target, prop) {
          return Reflect.has(target, prop);
        },
      });

      (proxy as any).__isTxGuardWrapped = true;
      return proxy;
    };

    const scan = () => {
      const win = window as any;

      const providers: Array<{ name: string; obj: any; winRoot?: any; key?: string }> = [];

      if (win.solana) providers.push({ name: 'solana', obj: win.solana, winRoot: win, key: 'solana' });
      if (win.solflare) providers.push({ name: 'solflare', obj: win.solflare, winRoot: win, key: 'solflare' });
      if (win.backpack) providers.push({ name: 'backpack', obj: win.backpack, winRoot: win, key: 'backpack' });
      if (win.coinbaseSolana) providers.push({ name: 'coinbaseSolana', obj: win.coinbaseSolana, winRoot: win, key: 'coinbaseSolana' });

      if (win.phantom?.solana) providers.push({ name: 'phantom.solana', obj: win.phantom.solana, winRoot: win.phantom, key: 'solana' });
      if (win.okxwallet?.solana) providers.push({ name: 'okxwallet.solana', obj: win.okxwallet.solana, winRoot: win.okxwallet, key: 'solana' });
      if (win.trustwallet?.solana) providers.push({ name: 'trustwallet.solana', obj: win.trustwallet.solana, winRoot: win.trustwallet, key: 'solana' });
      if (win.nightly?.solana) providers.push({ name: 'nightly.solana', obj: win.nightly.solana, winRoot: win.nightly, key: 'solana' });
      if (win.bitget?.solana) providers.push({ name: 'bitget.solana', obj: win.bitget.solana, winRoot: win.bitget, key: 'solana' });

      try {
        const walletStandard = win.navigator?.wallets as Array<any>;
        if (walletStandard && typeof walletStandard[Symbol.iterator] === 'function') {
          for (const wallet of walletStandard) {
            if (
              wallet.signTransaction ||
              wallet.signAllTransactions ||
              wallet.signAndSendTransaction ||
              wallet.signMessage
            ) {
              providers.push({
                name: wallet.name || 'wallet-standard',
                obj: wallet,
              });
            }
          }
        }
      } catch { /* wallet standard not available */ }

      const wrapped = new Set<any>();
      for (const { name, obj, winRoot, key } of providers) {
        if (wrapped.has(obj)) continue;
        const result = wrapSolanaProvider(obj);
        if (result !== obj && winRoot && key) {
          try { winRoot[key] = result; } catch { /* non-writable window property */ }
        }
        wrapped.add(result);
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
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }

    scan();
  },
});
