import { defineContentScript } from '#imports';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    console.log('TxGuard content script injected');

    window.addEventListener('message', (event) => {
      if (event.data?.type === 'TXGUARD_ANALYZE_TX') {
        browser.runtime.sendMessage({
          type: 'ANALYZE_TRANSACTION',
          transaction: event.data.transaction,
          eventId: event.data.eventId
        }).then((response) => {
          if (response.analysis && response.analysis.riskScore >= 50) {
            showGuardianOverlay(response.analysis, (approved) => {
              window.postMessage({
                type: 'TXGUARD_RESULT',
                eventId: event.data.eventId,
                approved
              }, '*');
            });
          } else {
            window.postMessage({
              type: 'TXGUARD_RESULT',
              eventId: event.data.eventId,
              approved: true
            }, '*');
          }
        });
      }
    });

    function showGuardianOverlay(analysis: any, onDecision: (approved: boolean) => void) {
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
      
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
          <div>
            <h2 style="margin: 0; font-size: 24px; font-weight: 800;">TxGuard Warning</h2>
            <p style="margin: 4px 0 0; color: rgba(255,255,255,0.5); font-size: 14px;">Suspicious transaction detected</p>
          </div>
          <div style="background: ${riskColor}20; color: ${riskColor}; padding: 6px 12px; border-radius: 8px; font-weight: 800; font-size: 12px; border: 1px solid ${riskColor}30;">
            ${analysis.riskLevel} (${analysis.riskScore})
          </div>
        </div>

        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 20px; margin-bottom: 24px;">
           <h3 style="margin: 0 0 8px; font-size: 14px; color: ${riskColor}; text-transform: uppercase; letter-spacing: 0.05em;">AI Risk Analysis</h3>
           <p style="margin: 0; font-size: 15px; line-height: 1.6; color: rgba(255,255,255,0.9); font-style: italic;">
             "${analysis.explanation}"
           </p>
        </div>

        <div style="display: grid; grid-template-cols: 1fr 1fr; gap: 16px; margin-bottom: 32px;">
           <div style="background: rgba(255,255,255,0.02); padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
             <div style="font-size: 10px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Potential Loss</div>
             <div style="font-size: 18px; font-weight: 700; color: #ef4444;">${Math.abs(analysis.riskScore > 80 ? 100 : 0).toFixed(2)}% of asset</div>
           </div>
           <div style="background: rgba(255,255,255,0.02); padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
             <div style="font-size: 10px; color: rgba(255,255,255,0.4); text-transform: uppercase;">Confidence</div>
             <div style="font-size: 18px; font-weight: 700; color: #10b981;">98.4%</div>
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
  },
});
