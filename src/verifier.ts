import "dotenv/config";
import chalk from 'chalk';
import { WalletBuilder } from '@midnight-ntwrk/wallet';
import { NetworkId } from '@midnight-ntwrk/zswap';
import { EnvironmentManager } from "./utils/environment";
import { getWalletAddress } from "./utils/utils"
import { issueAgeCredential } from './issuer';
import { generateSelectiveDisclosureProof } from './holder';

const { indexer, indexerWS, node, proofServer } = EnvironmentManager.getNetworkConfig()

const ISSUER_DID_ADDRESS = process.env.ISSUER_DID_ADDRESS || "ERROR: NO ISSUER DID";
const VERIFIER_SEED_HEX = process.env.VERIFIER_SEED_HEX || "0000000000000000000000000000000000000000000000000000000000000001";

export const runVerificationProcess = async () => {
    console.log(chalk.yellow("--- STARTING FLOW: ISSUE -> TEST -> VERIFICATION ---"));

    if (ISSUER_DID_ADDRESS.includes("ERROR")) {
        console.error(chalk.red("🚨 ERROR: Make sure the environment variables are loaded. Run 'did-management.ts'' primero."));
        return;
    }

    const signedVC = await issueAgeCredential();
    if (!signedVC) return;

    const verifiablePresentation = await generateSelectiveDisclosureProof(signedVC);
    if (!verifiablePresentation) return;

    console.log(chalk.yellow("\n--- CONNECTING TO VERIFIER CONTRACT ON MIDNIGHT ---"));

    const verifierWallet = await WalletBuilder.build(
        indexer,
        indexerWS,
        proofServer,
        node,
        VERIFIER_SEED_HEX,
        NetworkId.TestNet,
        'error'
    );

    verifierWallet.start();

    const verifierDID = await getWalletAddress(verifierWallet);
    console.log(`Verifier Loaded: ${chalk.green(verifierDID)}`);

    const contractId = 'mn_compact-contract_test1...'; 
    console.log(`Conectado al Verifier Contract: ${chalk.magenta(contractId)}`);

    console.log(chalk.yellow(`\nExecuting verification ZKP...`));

    const verificationResult = await (verifierWallet as any).callContractFunction({
        contractId: contractId,
        functionName: 'verifyAgeProof',
        args: [
            JSON.stringify(verifiablePresentation),
            ISSUER_DID_ADDRESS
        ]
    });

    await verifierWallet.close();

    const isValid = verificationResult && verificationResult.length > 0 ? verificationResult[0] : false;

    console.log(chalk.cyan("\n============================================="));
    console.log(chalk.cyan(`       FINAL VERIFICATION RESULT       `));
    console.log(chalk.cyan("============================================="));

    if (isValid) {
        console.log(chalk.bgGreen.black.bold(` ✅ SUCCESS: ZKP TEST VALIDATED BY ON-CHAIN ​​CONTRACT `));
    } else {
        console.log(chalk.bgRed.black.bold(` ❌ FAIL: THE ZKP TEST VERIFICATION FAILED `));
    }
    console.log(chalk.cyan("============================================="));
};

runVerificationProcess().catch(error => {
    console.error(chalk.red("\nFatal error during verification:"), error);
});