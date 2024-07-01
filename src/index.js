#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import Irys from '@irys/sdk';
import { createDataItemSigner, message, result } from '@permaweb/aoconnect';

const argv = yargs(hideBin(process.argv))
	.option('ant-process', {
		alias: 'a',
		type: 'string',
		description: 'The ANT process',
		demandOption: true,
	})
	.argv;

const DEPLOY_FOLDER = './dist';
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

	let jwk = JSON.parse(Buffer.from(DEPLOY_KEY, 'base64').toString('utf-8'));
	
	const irys = new Irys({ url: 'https://turbo.ardrive.io', token: 'arweave', key: jwk });

	try {
		console.log(`Deploying ${DEPLOY_FOLDER} folder`);

		const txResult = await irys.uploadFolder(DEPLOY_FOLDER, {
			indexFile: 'index.html',
		});

		const response = await message({
			process: ANT_PROCESS,
			signer: createDataItemSigner(jwk),
			tags: [
				{ name: 'Action', value: 'Set-Record' },
				{ name: 'Sub-Domain', value: '@' },
				{ name: 'Transaction-Id', value: txResult.id },
				{ name: 'TTL-Seconds', value: '3600' },
			],
		});

		const { Messages } = await result({ message: response, process: ANT_PROCESS });
		
		if (Messages && Messages.length > 0) {
			const responseAction = getTagValue(Messages[0].Tags, 'Action');
			if (responseAction) {
				if (responseAction === 'Set-Record-Notice') console.log(`Deployed Tx [${txResult.id}] to ANT process [${ANT_PROCESS}]`);
				else if (responseAction === 'Invalid-Set-Record-Notice') console.log('Error deploying bundle');
				else console.error('Error deploying bundle');
			}
		}
		else {
			console.error('Error deploying bundle')
		}
	} catch (e) {
		console.error(e);
	}
})();
