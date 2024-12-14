#!/usr/bin/env node

import { ANT, ArweaveSigner } from '@ar.io/sdk';
import { EthereumSigner, TurboFactory } from '@ardrive/turbo-sdk';
import fs from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const argv = yargs(hideBin(process.argv))
	.option('ant-process', {
		alias: 'a',
		type: 'string',
		description: 'The ANT process.',
		demandOption: true,
	})
	.option('deploy-folder', {
		alias: 'd',
		type: 'string',
		description: 'Folder to deploy.',
		default: './dist',
	})
	.option('undername', {
		alias: 'u',
		type: 'string',
		description: 'ANT undername to update.',
		default: '@',
	})
	.option('eth', {
		alias: 'e',
		type: 'boolean',
		description: 'Connect with an ETH wallet instead of an Arweve wallet.',
	})
	.option('polygon', {
		alias: 'p',
		type: 'boolean',
		description: 'Connect with a POL/MATIC wallet instead of an Arweave wallet.',
	}).argv;

const DEPLOY_KEY = process.env.DEPLOY_KEY;
const ANT_PROCESS = argv.antProcess;

export function getTagValue(list, name) {
	for (let i = 0; i < list.length; i++) {
		if (list[i]) {
			if (list[i].name === name) {
				return list[i].value;
			}
		}
	}
	return STORAGE.none;
}

(async () => {
	if (!DEPLOY_KEY) {
		console.error('DEPLOY_KEY not configured');
		return;
	}

	if (!ANT_PROCESS) {
		console.error('ANT_PROCESS not configured');
		return;
	}

	if (argv.deployFolder.length == 0) {
		console.error('deploy folder must not be empty');
		return;
	}

	if (argv.undername.length == 0) {
		console.error('undername must not be empty');
		return;
	}

	if (!fs.existsSync(argv.deployFolder)) {
		console.error(`deploy folder [${argv.deployFolder}] does not exist`);
		return;
	}

	// Throw an error if both --eth and --pol are true
	if (argv.eth && argv.polygon) {
		console.error('Error: Cannot deploy with both ETH and POL.');
		process.exit(1); // Exit with an error code
	}

	let jwk;
	if (argv.polygon || argv.eth) jwk = DEPLOY_KEY;
	else {
		jwk = JSON.parse(Buffer.from(DEPLOY_KEY, 'base64').toString('utf-8'));
	}

	try {
		let signer;
		let token;

		// Creates proper signer based on wallet type.
		switch (true) {
			case argv.eth:
				signer = new EthereumSigner(jwk);
				token = 'ethereum';
				break;
			case argv.polygon:
				signer = new EthereumSigner(jwk);
				token = 'pol';
				break;
			default:
				signer = new ArweaveSigner(jwk);
				token = 'arweave';
				break;
		}

		const turbo = TurboFactory.authenticated({
			signer: signer,
			token: token,
		});

		const uploadResult = await turbo.uploadFolder({
			folderPath: argv['deploy-folder'],
			dataItemOpts: {
				tags: [
					{
						name: 'App-Name',
						value: 'Permaweb-Deploy',
					},
					// prevents identical transaction Ids from eth wallets
					{
						name: 'anchor',
						value: new Date().toISOString(),
					},
				],
			},
		});

		const manifestId = uploadResult.manifestResponse.id;

		//TODO: Add support for custom AO network configurations.
		const ant = ANT.init({ processId: ANT_PROCESS, signer });

		// Update the ANT record (assumes the signer is a controller or owner)
		await ant.setRecord(
			{
				undername: argv.undername,
				transactionId: manifestId,
				ttlSeconds: 3600,
			},
			{
				tags: [
					{
						name: 'GIT-HASH',
						value: process.env.GITHUB_SHA || '',
					},
					{
						name: 'App-Name',
						value: 'Permaweb-Deploy',
					},
					{
						name: 'anchor',
						value: new Date().toISOString(),
					},
				],
			}
		);

		console.log(`Deployed TxId [${manifestId}] to ANT [${ANT_PROCESS}] using undername [${argv.undername}]`);
	} catch (e) {
		console.error(e);
	}
})();
