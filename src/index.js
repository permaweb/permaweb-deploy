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
	.option('sig-type', {
		alias: 's',
		type: 'string',
		description: 'The type of signer to be used for deployment.',
		choices: ['arweave', 'ethereum', 'polygon'],
		default: 'arweave',
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

	try {
		let signer;
		let token;

		// Creates the proper signer based on the sig-type value
		switch (argv['sig-type']) {
			case 'ethereum':
				signer = new EthereumSigner(DEPLOY_KEY);
				token = 'ethereum';
				break;
			case 'polygon':
				signer = new EthereumSigner(DEPLOY_KEY);
				token = 'pol';
				break;
			case 'arweave':
				const parsedKey = JSON.parse(Buffer.from(DEPLOY_KEY, 'base64').toString('utf-8')); // Parse DEPLOY_KEY for Arweave
				signer = new ArweaveSigner(parsedKey);
				token = 'arweave';
				break;
			default:
				throw new Error(
					`Invalid sig-type provided: ${argv['sig-type']}. Allowed values are 'arweave', 'ethereum', or 'polygon'.`
				);
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
