#!/usr/bin/env node
import { EthereumSigner, TurboFactory } from '@ardrive/turbo-sdk';
import fs from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { ANT, AOProcess, ARIO, ARIO_MAINNET_PROCESS_ID, ARIO_TESTNET_PROCESS_ID, ArweaveSigner } from '@ar.io/sdk';
import { connect } from '@permaweb/aoconnect';

const arweaveTxIdRegex = /^[a-zA-Z0-9-_]{43}$/;

const argv = yargs(hideBin(process.argv))
	.version('2.1.0')
	.help()
	.usage('Usage: $0 --arns-name <name> [options]')
	.example('$0 --arns-name my-app', 'Deploy to my-app.arweave.dev')
	.example('$0 --arns-name my-app --undername staging', 'Deploy to staging.my-app.arweave.dev')
	.option('ario-process', {
		alias: 'p',
		type: 'string',
		description: 'The ARIO process to use',
		demandOption: true,
		default: ARIO_MAINNET_PROCESS_ID,
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
		description: 'File to deploy.',
	})
	.option('ttl-seconds', {
		alias: 't',
		type: 'number',
		description: 'ArNS TTL Seconds',
		default: 3600,
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
		choices: [
			'arweave',
			'ethereum',
			'polygon',
			// 'solana',
			'kyve',
		],
		default: 'arweave',
	})
	.check((argv) => {
		if (argv.ttl < 60 || argv.ttl > 86400) {
			throw new Error('TTL must be between 60 seconds (1 minute) and 86400 seconds (1 day)');
		}
		return true;
	}).argv;

const DEPLOY_KEY = process.env.DEPLOY_KEY;
const ARNS_NAME = argv['arns-name'];
let ARIO_PROCESS = argv['ario-process'];
const TTL_SECONDS = argv['ttl-seconds'];

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

	if (!Number.isFinite(TTL_SECONDS) || TTL_SECONDS < 60 || TTL_SECONDS > 86400) {
		console.error('TTL_SECONDS must be a number between 60 and 86400 seconds');
		process.exit(1);
	}

	if (argv.deployFile && !fs.existsSync(argv.deployFile)) {
		console.error(`deploy-file [${argv.deployFolder}] does not exist`);
		process.exit(1);
	} else {
		if (!fs.existsSync(argv.deployFolder)) {
			console.error(`deploy-folder [${argv.deployFolder}] does not exist`);
			process.exit(1);
		}
	}

	if (argv.undername.length === 0) {
		console.error('undername must be set');
		process.exit(1);
	}

	const ario = ARIO.init({
		process: new AOProcess({
			processId: ARIO_PROCESS,
			ao: connect({
				MODE: 'legacy',
				CU_URL: 'https://cu.ardrive.io',
			}),
		}),
	});

	const arnsNameRecord = await ario.getArNSRecord({ name: ARNS_NAME }).catch((e) => {
		console.error(`ARNS name [${ARNS_NAME}] does not exist`);
		process.exit(1);
	});

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
				const jwk = JSON.parse(Buffer.from(DEPLOY_KEY, 'base64').toString('utf-8'));
				signer = new ArweaveSigner(jwk);
				token = 'arweave';
				break;
			case 'kyve':
				signer = new EthereumSigner(DEPLOY_KEY);
				token = 'kyve';
				break;
			default:
				throw new Error(
					`Invalid sig-type provided: ${argv['sig-type']}. Allowed values are 'arweave', 'ethereum', 'polygon', or 'kyve'.`
				);
		}

		const turbo = TurboFactory.authenticated({
			signer: signer,
			token: token,
		});

		let uploadResult;
		let manifestId;
		if (argv['deploy-file']) {
			uploadResult = await turbo.uploadFile({
				file: argv['deploy-file'],
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
			manifestId = uploadResult.id;
		} else {
			uploadResult = await turbo.uploadFolder({
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
		manifestId = uploadResult.manifestResponse.id;
		}


		console.log('-------------------- DEPLOY DETAILS --------------------');
		console.log(`Tx ID: ${manifestId}`);
		console.log(`ArNS Name: ${ARNS_NAME}`);
		console.log(`Undername: ${argv.undername}`);
		console.log(`ANT: ${arnsNameRecord.processId}`);
		console.log(`AR IO Process: ${ARIO_PROCESS}`);
		console.log(`TTL Seconds: ${TTL_SECONDS}`);
		console.log('--------------------------------------------------------');

		const ant = ANT.init({ processId: arnsNameRecord.processId, signer });

		// Update the ANT record (assumes the JWK is a controller or owner)
		await ant.setRecord(
			{
				undername: argv.undername,
				transactionId: manifestId,
				ttlSeconds: argv['ttl-seconds'],
			},
			{
				tags: [
					{
						name: 'App-Name',
						value: 'Permaweb-Deploy',
					},
					...(process.env.GITHUB_SHA
						? [
								{
									name: 'GIT-HASH',
									value: process.env.GITHUB_SHA,
								},
						  ]
						: []),
				],
			}
		);

		console.log(
			`Deployed TxId [${manifestId}] to name [${ARNS_NAME}] for ANT [${arnsNameRecord.processId}] using undername [${argv.undername}]`
		);
	} catch (e) {
		console.error('Deployment failed:', e);
		process.exit(1); // Exit with error code
	}
})();
