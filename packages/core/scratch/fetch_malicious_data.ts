import { Connection, PublicKey } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

const signatures = [
  "VBFpG7RDDmRCyPmFZ9mQTrCKq3WbxSJVud4BWc1CAqmmrQAcahX85VRQ7NswHVrZYMWr1y2vQdHkZN8cZjwSFgs",
  "2o9miqmMRd4p4eYMAVj1Gz9s3odq9uMKe8yKLkeXfzh1MBfQurSVMinHeTwVktHN87erLszUVoTrfRawQzY5dYap",
  "62Vhn1rM6hJspfFk2zA8AK8vrzvvRyTStEHjzZtgqXzqnhJ8fcPSj6oT3djDtPKHiT9thuyyVNC9d9dcT8z2PEQY",
  "LQ2osRQbUuHs8pDrLzd7Gpqdm8ULmp17ymoU5jKMPLh5vk8qgZz7mNV84Dy3DAKhbkZ99kgAvngnj4PgcRd2Ej",
  "2u3gdAeUt6xTZa5qgHmppd4up9TyfRdpQ6JpYj7c8q7qrNNCv929m26QaLkP5MBKULKA5dN5Mc6RyBfwdnPieTzS",
  "4nyEuuVXZGq2DoPYcoJ36gwqQNgF4kzKSj8pr1cWPKJA2nSFPr84TEMqKYKkYRfiHfXsE8vC2aKXULtrJ8ELgvbw",
  "3q32ai92eVAaLmygTUCKif44NftyTMPXqgkB2kb1KHzv3PyjtLc2zFMiTKCgWLLCqiwbRivgEW16s244hqFu1Cx3",
  "63PdKjNw85WbvPf25tzKJExrLmF4PCUMRZyb9Ab6dC69d3Rs8GHZ6ie9SJEvB2mXoF1VgCo4ELbGJdZMcvbfghkm",
  "3jxhvnQeMcFfudZ6sFsqRzTJYgL9mgGGeSnGZquKk4bXU7nQ4EQU9by5xP38qFzYTBBouTxKku4SLUrLNvf39zzz",
  "V4LeTfqW1A6fZwFXwebFeDEuRna1zZHQPLafVH2bNWJjk3yKbFSYcB1w1MdWM4CZt4WamgA1cjbB2K3LNHRojjf"
];

const RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-mainnet.g.allnodes.com',
  'https://solana.public-rpc.com'
];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchTransactions() {
  const results = [];
  console.log(`Fetching ${signatures.length} transactions...`);

  for (let i = 0; i < signatures.length; i++) {
    const sig = signatures[i];
    let success = false;
    
    // Try each RPC endpoint
    for (const rpc of RPC_ENDPOINTS) {
      try {
        console.log(`  Trying ${rpc} for ${sig.slice(0, 8)}...`);
        const connection = new Connection(rpc, 'confirmed');
        const tx = await connection.getTransaction(sig, {
          maxSupportedTransactionVersion: 0,
          // @ts-ignore
        });

        if (tx) {
          const rawBase64 = Array.isArray(tx.transaction) ? tx.transaction[0] : null;
          
          if (rawBase64) {
            results.push({
              signature: sig,
              type: "STMT",
              data: rawBase64
            });
            console.log(`  ✓ Success`);
            success = true;
            break;
          }
        }
      } catch (err) {
        console.log(`  ✗ Failed: ${(err as any).message.slice(0, 50)}...`);
      }
      await sleep(2000); // 2s between RPC switches
    }
    
    if (!success) console.log(`  !! Could not fetch ${sig}`);
    await sleep(5000); // 5s between transactions
  }

  const outputPath = path.join(process.cwd(), 'src/benchmark/malicious_transactions.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nDone! Saved ${results.length} transactions to ${outputPath}`);
}

fetchTransactions().catch(console.error);
