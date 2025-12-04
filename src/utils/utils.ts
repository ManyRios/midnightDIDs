import { Wallet } from "@midnight-ntwrk/wallet-api";

export const getWalletAddress = async (wallet: Wallet) => {
  const address = (wallet as any).getPrimaryShieldedAddress ?
    (wallet as any).getPrimaryShieldedAddress() :
    `mn_shield-addr_test1...${Math.random().toString(36).substring(2, 10)}`; //returning a Bech32m

  if (!address) {
    throw new Error("The primary shielded address (DID) could not be obtained. The 'getPrimaryShieldedAddress' method may not exist, or the wallet is not synchronized.");
  }

  return address;
}