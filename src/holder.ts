import "dotenv/config";
import { WalletBuilder } from '@midnight-ntwrk/wallet';
import { NetworkId } from '@midnight-ntwrk/zswap';
import { getWalletAddress } from "./utils/utils"
import { issueAgeCredential } from "./issuer";
import { EnvironmentManager } from "./utils/environment";
import chalk from 'chalk';


interface ZKPStatement {
    credentialType: string;
    conditions: Array<{
        attributeName: string;
        operator: 'lessThanOrEqual' | 'greaterThanOrEqual' | 'equals';
        value: string | number;
    }>;
    disclosedAttributes: string[];
}

const { indexer, indexerWS, node, proofServer } = EnvironmentManager.getNetworkConfig()

const HOLDER_SEED = process.env.SEEDHOLDER || 'ERROR: NO SEED HOLDER';

export const generateSelectiveDisclosureProof = async (signedVC: any) => {
    console.log(chalk.cyan("--- GENERATING ZKP PROOF ---"));

    if (!signedVC || HOLDER_SEED.includes("ERROR")) {
        console.error(chalk.red("🚨 ERROR: The signed VC and the Holder's seed are required."));
        return null;
    }

    const holderWallet = await WalletBuilder.build(
        indexer,
        indexerWS,
        proofServer,
        node,
        HOLDER_SEED,
        NetworkId.TestNet,
        'error'
    );

    const holderDID = await getWalletAddress(holderWallet);
    console.log(`Holder loaded: ${chalk.green(holderDID)}`);

    const birthDate = "2007-12-01";

    const statement: ZKPStatement = {
        credentialType: "AgeCredential",
        conditions: [
            {
                attributeName: "birthdate",
                operator: "lessThanOrEqual",
                value: birthDate
            }
        ],
        disclosedAttributes: ["firstName", "lastName"]
    };

    console.log(chalk.yellow(`\n Requesting ZKP proof: 'birthdate' <= ${birthDate}. (Requires Proof Server)...`));

    const verifiablePresentation = await (holderWallet as any).generateVerifiablePresentation({
        credential: signedVC,
        statement: statement,
    });

    console.log(chalk.green(`\n✅ Test Presentation (VP) Successfully Generated!`));

    await holderWallet.close();

    return verifiablePresentation;

}

const runHolderProcess = async () => {
    const signedVC = await issueAgeCredential(); 
    
    if (signedVC) {
        await generateSelectiveDisclosureProof(signedVC);
    }
}

if (require.main === module) {
    runHolderProcess().catch(error => {
        console.error(chalk.red("\n Error no holder:"), error);
    });
}