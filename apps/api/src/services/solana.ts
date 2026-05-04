import { Connection } from '@solana/web3.js';

const connections: Record<string, Connection> = {};

export function getSolanaConnection(cluster: string = 'devnet'): Connection {
  if (connections[cluster]) return connections[cluster];

  let rpcUrl = process.env['SOLANA_RPC_URL'] || 'https://api.devnet.solana.com';

  if (cluster === 'mainnet-beta') {
    rpcUrl = process.env['SOLANA_MAINNET_RPC_URL'] || 'https://api.mainnet-beta.solana.com';
  } else if (cluster === 'testnet') {
    rpcUrl = 'https://api.testnet.solana.com';
  } else if (cluster === 'devnet') {
    rpcUrl = process.env['SOLANA_DEVNET_RPC_URL'] || 'https://api.devnet.solana.com';
  }

  connections[cluster] = new Connection(rpcUrl, 'confirmed');
  return connections[cluster];
}
