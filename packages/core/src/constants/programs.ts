// ============================================================================
// TxGuard Trusted Program Allowlist
// ============================================================================
// Single source of truth for known, legitimate Solana program IDs.
// Used by: program-reputation.ts, intent.ts, solphish.ts
//
// Categories:
//   - DEX_PROGRAMS: Decentralized exchange / AMM routers and pools
//   - TRUSTED_PROGRAMS: All verified programs (system, token, DeFi, infra)
//   - MARKET_PROGRAMS: Alias for DEX_PROGRAMS (used by solphish market-context gating)
// ============================================================================

// ---------------------------------------------------------------------------
// System Programs & Sysvars
// ---------------------------------------------------------------------------
const SYSTEM_PROGRAMS = new Map([
  ['11111111111111111111111111111111', 'System Program'],
  ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'SPL Token'],
  ['TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb', 'Token-2022'],
  ['ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', 'Associated Token Account'],
  ['ComputeBudget111111111111111111111111111111', 'Compute Budget'],
  ['MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr', 'Memo Program'],
  ['Memo1UhkJBfCR961jRFkhY6UXen1PhA5Kpo9dZSEqGKR', 'Memo Program v1'],
  ['Stake11111111111111111111111111111111111111', 'Stake Program'],
  ['Vote111111111111111111111111111111111111111', 'Vote Program'],
  ['BPFLoader2111111111111111111111111111111111', 'BPF Loader'],
  ['BPFLoaderUpgradeab1e11111111111111111111111', 'BPF Loader Upgradeable'],
  ['NativeLoader1111111111111111111111111111111', 'Native Loader'],
  ['SysvarRent111111111111111111111111111111111', 'Sysvar: Rent'],
  ['SysvarC1ock11111111111111111111111111111111', 'Sysvar: Clock'],
  ['SysvarEpochSchedu1e111111111111111111111111', 'Sysvar: Epoch Schedule'],
  ['SysvarFees111111111111111111111111111111111', 'Sysvar: Fees'],
  ['SysvarRecentB1ockHashes11111111111111111111', 'Sysvar: Recent Blockhashes'],
  ['SysvarS1otHashes111111111111111111111111111', 'Sysvar: Slot Hashes'],
  ['SysvarS1otHistory11111111111111111111111111', 'Sysvar: Slot History'],
  ['SysvarStakeHistory1111111111111111111111111', 'Sysvar: Stake History'],
  ['Sysvar1nstructions1111111111111111111111111', 'Sysvar: Instructions'],
  ['SysvarRewards111111111111111111111111111111', 'Sysvar: Rewards'],
]);

// ---------------------------------------------------------------------------
// DEXs / AMMs / Aggregators
// ---------------------------------------------------------------------------
const DEX_PROGRAMS_MAP = new Map([
  // Jupiter
  ['JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', 'Jupiter v6 (Aggregator)'],
  ['JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB', 'Jupiter v4 (Aggregator)'],
  ['JUP2jxvXaqu7NQY1GmNF4m1vodw12LVXYxbFL2uJXTz', 'Jupiter v3 (Aggregator)'],
  ['PERPHjGBqRHArX4DySjwM6UJHiR3sWAatqfdBS2qQJu', 'Jupiter Perpetuals'],
  // Orca
  ['whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', 'Orca Whirlpool'],
  ['9W959DqEETiGZocYWCQPaJ6sBmUzgfxRfr4jBAAZoZzr', 'Orca v1'],
  // Raydium
  ['675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', 'Raydium AMM v4'],
  ['CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK', 'Raydium CLMM'],
  ['CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C', 'Raydium CPMM'],
  // Meteora
  ['LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo', 'Meteora DLMM'],
  ['Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB', 'Meteora Pools'],
  // Serum / OpenBook
  ['9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin', 'Serum DEX v3'],
  ['srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX', 'OpenBook DEX (Serum v4)'],
  ['opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZw', 'OpenBook v2'],
  // Phoenix
  ['PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY', 'Phoenix DEX'],
  ['PhoeMZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdPa', 'Phoenix DEX (alternate)'],
  // Saber
  ['SSwpkEEcbUqx4vtoEByFjSdBKu2EtoKtCjDEcmfM1Tz', 'Saber Stable Swap'],
  ['SSWPDfEcn7mVKchXM1JRvnMqZLxRcqhRrNKTGJzPUVt', 'Saber Pools'],
  // Lifinity
  ['EewxydAPSCVuSoCrCn2j8JXrW7j9ZajjLz7WLkkMXXxe', 'Lifinity v2'],
  // Invariant
  ['HyaB3W9q6XdA5xwpU4XnSZV94htfmbmqJXZcEbRaJutt', 'Invariant AMM'],
  // Aldrin
  ['AMM55ShdkoGRB5jVYPjWziwk8m5MpwyDgsMWHaMSQWH6', 'Aldrin AMM'],
  // Crema
  ['6MLxLhQqjGM1L7eNsmAztPavxXkvQJJuhdJknXpQKJQW', 'Crema Finance'],
  // GooseFX
  ['GFXsSL5sSaDfNFQUYsHekbWBW1TsFdjDYzACh62tEHxn', 'GooseFX'],
  // Cykura
  ['CYKUrtajwfQiufyUBVgQRCtyRqFmNydrYmEkUDPbGtFx', 'Cykura'],
  // Saros
  ['SSwapUHPVtfXEFvMUHyTBq74YMV2uB7ZMzZ8ku9R2CF', 'Saros Swap'],
  // FluxBeam
  ['FLUXubRmkJi2qyzKGAfvruR4A6La4LS4ULc16RsaKqMN', 'FluxBeam'],
  // StepN
  ['STEPNQ2pGaGQnZPoZTcYK9gKqHutkGzxQ7Q9XDeLVa', 'StepN'],
]);

// ---------------------------------------------------------------------------
// Lending / Borrowing
// ---------------------------------------------------------------------------
const LENDING_PROGRAMS = new Map([
  ['So1endDq2YkqhipRh3WViPA8SdtJj8cCtSyU3iWtrQX', 'Solend'],
  ['MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA', 'Marginfi'],
  ['KLend2g3cP87fffoy8q1mQqKj5WLm2GJ6Wt7G3Fe6RWQ', 'Kamino Lending'],
  ['7rcnYwQNXzJmTWyXHaZedNcEyoD5xjDiQykZVV9JhK6t', 'Francium'],
  ['6UsWj53tCVHMjM3FsjJhJhFxv6wKjq1JBWqfPkCn4jqB', 'Hubble Protocol'],
  ['MNFGJPZnURzNfvfmeMDHPjSQjVmNVf6aVnCfYFV7qne', 'Mango Markets v4'],
  ['4MangoMjqJ2firMokCjjGgoK8d4MXcrgL7XJaL3w6fVg', 'Mango Markets v3'],
  ['PortefiuJKWBKk5DxvBZaScXLQ6AMgNVXbrkYmLM8PJn', 'Port Finance'],
  ['Ap4R6LPDBZNsA3BE3Hk5s5jjvZpNN5JSSXKBNMMokKJb', 'Apricot Finance'],
  ['LendNugGETxuu7YssbBnFp1ZgGdhEFHPRxScfXtyVXc', 'Larix'],
  ['7SJVoned1pWvBRMqnLTpjtY9JoerBYu7qVpTe64YSmU3', 'Solend v2'],
]);

// ---------------------------------------------------------------------------
// Perpetuals / Derivatives
// ---------------------------------------------------------------------------
const PERPS_PROGRAMS = new Map([
  ['dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn3UFK', 'Drift Protocol v2'],
  ['DftUpGSaBqi9zNcHMQ8xZVx2PCbGZfxCZBj25X6FKJo', 'Drift v1 (deprecated)'],
  ['ZETAxsqBRaWb6sA1tVPJX6NxZoR6Aeo1xCogXyXLq2y', 'Zeta Markets'],
  ['Dex1111111111111111111111111111111111111111', 'Zeta DEX'],
  ['GDDe5nmQWtjxkQnEzVCMNUGQqKYfGfKtUQq7VnHWfRpB', 'HXRO Parimutuel'],
]);

// ---------------------------------------------------------------------------
// NFT Marketplaces / Tools
// ---------------------------------------------------------------------------
const NFT_PROGRAMS = new Map([
  ['M2mx93ekt1fmXSVfTkYpWwZxBaX3xNBgwtzjJfMxN6c', 'Magic Eden v2'],
  ['MEisE1HzehtrDpAAT8RhLH8YzFBRdBtB3t8JfDRKQkg', 'Magic Eden (legacy)'],
  ['TSWAPaqyCSx2KABk68ShhefokJhGpuGKvSDhTWtg7YM', 'TensorSwap'],
  ['TCMPhJdwDryooaGtiocG1u3xcYbRpiJGB283yXzNERj', 'Tensor (marketplace)'],
  ['hausS13jsjafwWwGqZTUQRmWyvyxn9EQpqMwV1PBBmk', 'Metaplex Auction House'],
  ['HYPERfwdTkCMUNmBsjTiFsnzAvp1L8jGrtnVnGysY4J', 'HyperSpace'],
  ['hadeK9DLv9eA7ya5KCTqSvSvRZeJC3JgD5a9Y3CNbvu', 'Hadeswap'],
  ['SHARKobYYF3bYEXkFPhfZMVkv5dwEzKBRy7Qr7cnbxu', 'Sharky (NFT Lending)'],
  ['CMTQqjzHPF5nBZTiAK5PMFNhSRQYhFQFAMGY6QnZys8n', 'Candy Machine v3'],
  ['cndy3Z4yapfJBmL3ShUp5exZKqR3z33thTzeNMm2gRZ', 'Candy Machine v2'],
  ['cndyAnrLdpjq1Ssp1z8xxDsB8dxe7u4HL5Nxi2K5WXZ', 'Candy Machine v1'],
  ['BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY', 'Bubblegum (Metaplex cNFT)'],
  ['gdrpGjVffourzkdDRrQmySw4aTHr8a3xmQzzxSwFD1a', 'Gumdrop'],
]);

// ---------------------------------------------------------------------------
// Liquid Staking Tokens (LSTs)
// ---------------------------------------------------------------------------
const LST_PROGRAMS = new Map([
  ['MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD', 'Marinade (mSOL)'],
  ['Jito4APyf642JPZPx3hGc6WWJZnzVt9RbLBVTgnfvFmt', 'Jito (JitoSOL)'],
  ['stkB5fLUVqjXXzfsEf2cHz8gDQ4M1TjmwGFcnT3qRGo', 'BlazeStake (bSOL)'],
  ['SANCtzQoLUjbtXZUfj2JgCmrYwmKARwmBjDhL4whEsS', 'Sanctum'],
  ['SPoo1Ku8WFXoXdMHPsV2s7bd8ocGP4knReV1fHPBmVs', 'SPool (scnSOL)'],
  ['5ocnV1qiCgaxWfyfzMxRxNwkzqFzWWbxLxQKvCaqMwoh', 'jPool (JSOL)'],
  ['EdgeU1ULcwrxAH9fGHGXfv7bMGUNu7nCrGmeE5cnG2A', 'Edgevana'],
  ['SoLEW8noHdNKnRnq4qphXMMcRQfnEMjTNRp6KSPFCWL', 'Laine (laineSOL)'],
  ['B1sL3zxwy1nPQDc1s3fJcWx5wVhVxHf7nWNzm4jPnhcS', 'DAOPool'],
]);

// ---------------------------------------------------------------------------
// Oracles
// ---------------------------------------------------------------------------
const ORACLE_PROGRAMS = new Map([
  ['FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpeG6vGJgVgNq', 'Pyth Oracle'],
  ['pythWSnswVUd12oZpeFP8eG4naNYPQNDM2RPbFhPXqK', 'Pyth (newer / test?)'],
  ['rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ', 'Pyth Receiver'],
  ['SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f', 'Switchboard v2'],
  ['DtmE9D2CSB4L5D6A15mraeEHMpf4YAQ7rhKbBK4oWzh', 'Switchboard On-Demand'],
  ['GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR', 'Switchboard v1'],
]);

// ---------------------------------------------------------------------------
// Bridges / Cross-Chain
// ---------------------------------------------------------------------------
const BRIDGE_PROGRAMS = new Map([
  ['worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjxLVUZ', 'Wormhole Core Bridge'],
  ['wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqL6x2fN', 'Wormhole Token Bridge'],
  ['WormT3McKhFJ2RkiGpdw9GKvNCrB2aB54gb2uV9MfQC', 'Wormhole NFT Bridge'],
  ['a11bdAAuV8iB2fu7X6AxAvDTo1QZ8FXB3kk5eecdasp', 'Allbridge Core'],
  ['MayanHbJNJxXFUKZXgPQmKpg9MLqw9zmmEdfYj3Bq3m', 'Mayan Finance (Wormhole frontend)'],
  ['CFGdpa4xnirrsPe4RXbR4sJfsEdhNSa83WDu44jw6S1w', 'deBridge'],
]);

// ---------------------------------------------------------------------------
// Governance / Multisig / DAOs
// ---------------------------------------------------------------------------
const GOVERNANCE_PROGRAMS = new Map([
  ['GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVF', 'SPL Governance (Realms)'],
  ['GokivDYuQXPZCWRkwMhdH2h91KpDQXBEmpgBgs55DpHc', 'Realms (old program)'],
  ['SQDS4ep65T869zMMBKyuUq6aD6hzTuZF5jFgJvrpdzo', 'Squads v4 (Multisig)'],
  ['SMPLekohVr3QkBwxNYmZSzkPxCPsHJwEriPGPTWHRVB', 'Squads v3'],
  ['smfjietFKFJsJ7iBQFsoE4QzDaXgMdFNDPRq9J4MxPm', 'Tribeca Governance'],
  ['GovHgfDPyQ1GwazJTDY2avSVY8GGcpmCapmmCsymRYm', 'Goki Governance'],
  ['GOVaNqCkq2GbpWBxAcABi7TpCDTn2FHwxRiZKrm2BwL', 'SPL Governance v3'],
]);

// ---------------------------------------------------------------------------
// Name Service / Domains
// ---------------------------------------------------------------------------
const NAME_SERVICE_PROGRAMS = new Map([
  ['namesLPneVpfA4EgNZMsjzkRy1ogmwtAqGvKBF35fZP', 'Bonfida SNS'],
  ['ALTdG1xLk1Cu9aPGoaGMG8RPPiJkxs6aBS5mEQ5dDk4', 'AllDomains (ANS)'],
  ['wns1gDLt8fgLcGhTi5M3AqgYWNypoFtRFRHvBUzX4dB', 'WNS (Wormhole Name Service)'],
]);

// ---------------------------------------------------------------------------
// Identity / DID / Payments
// ---------------------------------------------------------------------------
const IDENTITY_PROGRAMS = new Map([
  ['idtyCxzhj5bxWgGKi5KYmZvM6oMCg2xTmFvB6axqefw', 'Solana ID (DID)'],
  ['DiPbGaTPjWqj9BkL7Q6rqjZm6jSgKsnAZnQVdVpK3v3', 'Drip (Micro-payments)'],
]);

// ---------------------------------------------------------------------------
// Social / Messaging
// ---------------------------------------------------------------------------
const SOCIAL_PROGRAMS = new Map([
  ['3G27gjXvfDsfkKG8N3i4YHnxM7BCbHhyAR8g6XLMn3B', 'Dialect (Web3 Messaging)'],
  ['8LHq8emKjGkpLTCSLM6jeMzzTkGSbj1v7KYSCpSMnQ7x', 'Grape Protocol'],
]);

// ---------------------------------------------------------------------------
// Gaming / Metaverse / NFTs (Game-specific programs)
// ---------------------------------------------------------------------------
const GAMING_PROGRAMS = new Map([
  ['Starbq2hNkeJnHeTPNHnFPfXGoxmx9RVoQrVtsUoPCd', 'Star Atlas'],
  ['SAGE2HAwep459rFmgDi6VUqobYroAvf7AVgrMfUZfoc', 'Star Atlas SAGE'],
  ['GAMEBU1sLEdRdCJwbnpaxhW2eE7NubWj4aXoFUaeVm1', 'Genopets'],
  ['AURp4g3SyvP1KaSWTKSDfa8PGcLZynLWwsR6bLNYDYsR', 'Aurory'],
  ['CGRjSi6xvpqBnGKsYX5ZEUpjV39cB6Vz6JBPcoRjYQXQ', 'DeFi Land'],
  ['pobNetpPaNVG8RNoStXqvQWRABxSxLfGn5DaLGpdELZ', 'Portals (Metaverse)'],
  ['8xTpQMMWFTCd2BgXSCtg3VFE9REw5W5LFNgK5GbrGfrP', 'Atadia'],
]);

// ---------------------------------------------------------------------------
// Infrastructure / Storage / RPC Tools
// ---------------------------------------------------------------------------
const INFRA_PROGRAMS = new Map([
  ['SHDWb6NiLoSd1f5GtUBzq9cZ2uGaAGytZ1KLrh6XJmj', 'GenesysGo Shadow Drive (Storage)'],
  ['C1onEW2kKetmM8R1T7fQ5w1cPqR5UWJZTqCj4EoQzp7', 'Clockwork (deprecated cron)'],
  ['Chh1CKTPs1KYTVsU5w2bGmgNejnViSYz7PFicw3iSmKy', 'Strata Protocol'],
  ['ME2dWnsDVZfpdbCzszUpYBacHQ9YhN7oWxiRKMZNrK6', 'Metaplex Core (NFT standard)'],
  ['CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d', 'Core (new Metaplex NFT)'],
]);

// ---------------------------------------------------------------------------
// Aggregated Sets for Detector Use
// ---------------------------------------------------------------------------

// All DEX/AMM/Aggregator programs
export const DEX_PROGRAMS = new Set([...DEX_PROGRAMS_MAP.keys()]);

// All trusted programs combined (system + DeFi + infra)
export const TRUSTED_PROGRAMS = new Map([
  ...SYSTEM_PROGRAMS,
  ...DEX_PROGRAMS_MAP,
  ...LENDING_PROGRAMS,
  ...PERPS_PROGRAMS,
  ...NFT_PROGRAMS,
  ...LST_PROGRAMS,
  ...ORACLE_PROGRAMS,
  ...BRIDGE_PROGRAMS,
  ...GOVERNANCE_PROGRAMS,
  ...NAME_SERVICE_PROGRAMS,
  ...IDENTITY_PROGRAMS,
  ...SOCIAL_PROGRAMS,
  ...GAMING_PROGRAMS,
  ...INFRA_PROGRAMS,
]);

// Market programs = DEXs (used for market-context gating in solphish)
export const MARKET_PROGRAMS = DEX_PROGRAMS;
