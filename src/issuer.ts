import "dotenv/config";
import { WalletBuilder } from '@midnight-ntwrk/wallet';
import { NetworkId } from '@midnight-ntwrk/zswap';
import chalk from 'chalk';
import { EnvironmentManager } from "./utils/environment";
import { getWalletAddress } from "./utils/utils"

const { indexer, indexerWS, node, proofServer } = EnvironmentManager.getNetworkConfig()

const ISSUER_SEED_HEX = process.env.ISSUER_SEED_HEX || "ERROR: THERE IS NO ISSUER SEED";
const OWNER_DID_ADDRESS = process.env.OWNER_DID_ADDRESS || "ERROR: THERE IS NO OWNER DID";

export const AGE_CREDENTIAL_PAYLOAD = {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    "type": ["VerifiableCredential", "AgeCredential"],
    "issuanceDate": new Date().toISOString(),
    "credentialSubject": {
        "id": null, 
        "firstName": "Alice",
        "lastName": "Smith",
        "birthdate": "2007-11-28",
    },
    "midnightPrivacyFields": ["birthdate"] 
};

export const issueAgeCredential = async () => {
    console.log(chalk.cyan("--- STARTING CREDENTIAL SIGNATURE ---"));

    if (ISSUER_SEED_HEX.includes("ERROR") || OWNER_DID_ADDRESS.includes("ERROR")) {
        console.error(chalk.red("🚨 ERROR: ENVIROMENT VARIABLES ARE NOT LOADED, PLEASE CHECK"));
        return null; 
    }

    const issuerWallet = await WalletBuilder.build(
        indexer, 
        indexerWS, 
        proofServer, 
        node, 
        ISSUER_SEED_HEX, 
        NetworkId.TestNet, 
        'error'
    );

    issuerWallet.start(); 
    
    const issuerDID = await getWalletAddress(issuerWallet);
    
    const vcPayload: any = { ...AGE_CREDENTIAL_PAYLOAD };
    vcPayload.issuer = issuerDID;
    vcPayload.credentialSubject.id = OWNER_DID_ADDRESS;
    const messageToSign = JSON.stringify(vcPayload);
    const signature = await (issuerWallet as any).signMessage(messageToSign);
    
    const signedVC = {
        ...vcPayload,
        proof: {
            type: "MidnightSignature",
            issuer: vcPayload.issuer,
            holder: vcPayload.credentialSubject.id,
            signature: signature.toBase64(), 
            midnightPrivacyFlags: vcPayload.midnightPrivacyFields
        }
    };

    console.log(chalk.green(`\n✅ Credential Successfully Signed by the Issuer: ${issuerDID}`));
    
    await issuerWallet.close();

    return signedVC; 
}


if (require.main === module) {
    issueAgeCredential().catch(error => {
        console.error(chalk.red("\n Error during the execution: "), error);
    });
}