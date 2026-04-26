import { Connection } from '@solana/web3.js';

let connection: Connection | null = null;

export function getSolanaConnection(): Connection {
  if (!connection) {
    const rpcUrl = process.env['SOLANA_RPC_URL'] || 'https://api.mainnet-beta.solana.com';
    connection = new Connection(rpcUrl, 'confirmed');
  }
  return connection;
}
