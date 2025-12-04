import "dotenv/config";
import { WalletBuilder } from "@midnight-ntwrk/wallet";
import { NetworkId } from '@midnight-ntwrk/zswap';
import { generateRandomSeed, HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { Buffer } from "buffer";
import chalk from "chalk";
import { EnvironmentManager } from "./utils/environment";
import { getWalletAddress } from "./utils/utils"

const { indexer, indexerWS, node, proofServer } = EnvironmentManager.getNetworkConfig()


const generateSeed = (): Buffer => {
  const seed = generateRandomSeed();
  const generatedHDWallet = HDWallet.fromSeed(seed);

  if (generatedHDWallet.type !== "seedOk") {
    throw new Error("Error initializing HD Wallet");
  }

  const zswapKey = generatedHDWallet.hdWallet
    .selectAccount(0)
    .selectRole(Roles.Zswap)
    .deriveKeyAt(0)


  if (zswapKey.type === "keyDerived") {
    return Buffer.from(zswapKey.key);
  } else {
    throw new Error("Error deriving the key");
  }
}


const buildStartWallet = async (name: string) => {
  console.log(chalk.blue(`\n--- Building Wallet for ${name} ---`));

  const derivedSeedBuffer = generateSeed();
  const derivedSeedToHex = derivedSeedBuffer.toString('hex');

  console.log(`[!] Seed HD (Hex) ${name}: ${chalk.yellow(derivedSeedToHex)}`);
  
  const wallet = await WalletBuilder.build(
    indexer,
    indexerWS,
    proofServer,
    node,
    derivedSeedToHex,
    NetworkId.TestNet,
    'error'
  );

  wallet.start();

  await new Promise(resolve => setTimeout(resolve, 2000));

  const did = await getWalletAddress(wallet);

  console.log(chalk.green(`✅ Wallet ${name} initialized. (DID): ${chalk.bold(did)}`));

  return { wallet, did, seed: derivedSeedToHex };
}

const setupIdentities = async () => {
  console.log(chalk.cyan("--- IDENTITY CONFIGURATION FOR DIDs ---"));

  // Identity 1: Issuer(KYC Authority)
  const issuerResult = await buildStartWallet("Issuer");

  // Identity 2: Owner(User)
  const ownerResult = await buildStartWallet("owner");

  console.log(`Issuer DID/Address: ${chalk.green(issuerResult.did)}`);
  console.log(`Owner DID/Address: ${chalk.green(ownerResult.did)}`);

  // Use HD Seeds and DIDs/Addresses to sign VCs.

  // Close wallets after gets the information

  await issuerResult.wallet.close();
  await ownerResult.wallet.close();
}

setupIdentities().catch(error => {
    console.error(chalk.red("\n Fatal Error during configuration"), error);
});

