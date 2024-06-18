#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import Arweave from 'arweave';
import Irys from '@irys/sdk';
import { defaultCacheOptions, WarpFactory } from 'warp-contracts';

const DEPLOY_FOLDER = './dist';
const DEPLOY_KEY = process.env.DEPLOY_KEY;

const argv = yargs(hideBin(process.argv))
  .option('ant-contract', {
    alias: 'a',
    type: 'string',
    description: 'The ANT contract address',
    demandOption: true,
  })
  .argv;

const ANT_CONTRACT = argv.antContract;

(async () => {
    if (!DEPLOY_KEY) { 
        console.error('DEPLOY_KEY not configured'); 
        return; 
    }

    if (!ANT_CONTRACT) { 
        console.error('ANT_CONTRACT not configured'); 
        return; 
    }

    const jwk = JSON.parse(Buffer.from(DEPLOY_KEY, 'base64').toString('utf-8'));
    const irys = new Irys({ url: 'https://turbo.ardrive.io', token: 'arweave', key: jwk });
    const arweave = Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' });
    
    const warp = WarpFactory.custom(arweave, defaultCacheOptions, 'mainnet').useArweaveGateway().build();
    const warpContract = warp.contract(ANT_CONTRACT).connect(jwk);
    const contractState = (await warpContract.readState()).cachedValue.state;

    try {
        console.log(contractState);
        console.log(`Deploying ${DEPLOY_FOLDER} folder`);

        const txResult = await irys.uploadFolder(DEPLOY_FOLDER, {
            indexFile: 'index.html',
        });

        await new Promise((r) => setTimeout(r, 1000));
        await warpContract.writeInteraction(
            {
                function: 'setRecord',
                subDomain: '@',
                transactionId: txResult.id,
                ttlSeconds: 3600,
            },
            { disableBundling: true }
        );

        console.log(`Deployed [${txResult.id}] to [${contractState.name}]`);
    } catch (e) {
        console.error(e);
    }
})();
