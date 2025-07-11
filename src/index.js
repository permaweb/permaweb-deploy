#!/usr/bin/env node

import fs from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { ANT, AOProcess, ARIO, ARIO_MAINNET_PROCESS_ID, ARIO_TESTNET_PROCESS_ID, ArweaveSigner } from '@ar.io/sdk';
import { TurboFactory } from '@ardrive/turbo-sdk';
import { connect } from '@permaweb/aoconnect';

import { uploadDirectory, uploadFile } from './turbo';

const arweaveTxIdRegex = /^[a-zA-Z0-9-_]{43}$/;

const argv = yargs(hideBin(process.argv))
	.option('ario-process', {
		alias: 'p',
		type: 'string',
		description: 'The ARIO process to use',
		demandOption: true,
		default: ARIO_MAINNET_PROCESS_ID
	})
	.option('arns-name', {
		alias: 'n',
		type: 'string',
		description: 'The ARNS name',
		demandOption: true,
	})
	.option('deploy-folder', {
		alias: 'd',
		type: 'string',
		description: 'Folder to deploy.',
		default: './dist',
	})
	.option('deploy-file', {
		alias: 'f',
		type: 'string',
		description: 'File to deploy.'
	})
	.option('undername', {
		alias: 'u',
		type: 'string',
		description: 'ANT undername to update.',
		default: '@',
	}).argv;

const DEPLOY_KEY = process.env.DEPLOY_KEY;
const ARNS_NAME = argv.arnsName;
let ARIO_PROCESS = argv.arioProcess;
if (ARIO_PROCESS === 'mainnet') {
	ARIO_PROCESS = ARIO_MAINNET_PROCESS_ID;
} else if (ARIO_PROCESS === 'testnet') {
	ARIO_PROCESS = ARIO_TESTNET_PROCESS_ID;
}

(async () => {
	if (!ARIO_PROCESS || !arweaveTxIdRegex.test(ARIO_PROCESS)) {
		console.error('ARIO_PROCESS must be a valid Arweave transaction ID, or "mainnet" or "testnet"');
		process.exit(1);
	}

	if (!DEPLOY_KEY) {
		console.error('DEPLOY_KEY not configured');
		process.exit(1);
	}

	if (!ARNS_NAME) {
		console.error('ARNS_NAME not configured');
		process.exit(1);
	}

	if (argv.deployFile && !fs.existsSync(argv.deployFile)) {
		console.error(`deploy-file [${argv.deployFolder}] does not exist`);
		process.exit(1);
	}
	else {
		if (!fs.existsSync(argv.deployFolder)) {
			console.error(`deploy-folder [${argv.deployFolder}] does not exist`);
			process.exit(1);
		}
	}

	if (argv.undername.length === 0) {
		console.error('undername must be set');
		process.exit(1);
	}

	const jwk = JSON.parse(Buffer.from(DEPLOY_KEY, 'base64').toString('utf-8'));
	const ario = ARIO.init({
		process: new AOProcess({
			processId: ARIO_PROCESS,
			ao: connect({
				MODE: 'legacy',
				CU_URL: 'https://cu.ardrive.io'
			})
		})
	});

	const arnsNameRecord = await ario.getArNSRecord({ name: ARNS_NAME }).catch((e) => {
		console.error(`ARNS name [${ARNS_NAME}] does not exist`);
		process.exit(1);
	});

	try {
		let txId;
		if (argv.deployFile) {
			const turbo = TurboFactory.authenticated({ privateKey: jwk });
			txId = (await uploadFile(argv.deployFile, turbo)).id;
		}
		else {
			txId = await uploadDirectory(argv, jwk);
		}

		const signer = new ArweaveSigner(jwk);
		const ant = ANT.init({ processId: arnsNameRecord.processId, signer });

		// Update the ANT record (assumes the JWK is a controller or owner)
		await ant.setRecord(
			{
				undername: argv.undername,
				transactionId: txId,
				ttlSeconds: 3600,
			},
			{
				tags: [
					{
						name: 'App-Name',
						value: 'Permaweb-Deploy',
					},
					...(process.env.GITHUB_SHA ? [{
						name: 'GIT-HASH',
						value: process.env.GITHUB_SHA,
					}] : []),
				]
			}
		);

		console.log(`Deployed TxId [${txId}] to name [${ARNS_NAME}] for ANT [${arnsNameRecord.processId}] using undername [${argv.undername}]`);
	} catch (e) {
		console.error('Deployment failed:', e);
		process.exit(1); // Exit with error code
	}
})();
