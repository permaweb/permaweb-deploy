#!/usr/bin/env node

import { ANT, ArweaveSigner } from '@ar.io/sdk';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import Irys from '@irys/sdk';

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

	// TODO: allow optional (subdomain input, default to '@')

	let jwk = JSON.parse(Buffer.from(DEPLOY_KEY, 'base64').toString('utf-8'));
	
	const irys = new Irys({ url: 'https://turbo.ardrive.io', token: 'arweave', key: jwk });

	try {
		console.log(`Deploying ${DEPLOY_FOLDER} folder`);

		const txResult = await irys.uploadFolder(DEPLOY_FOLDER, {
			indexFile: 'index.html',
		});

		const signer = new ArweaveSigner(jwk);
		const ant = ANT.init({ processId: ANT_PROCESS, signer });

		// update the ANT record (assumes the JWK is a controller or owner)
		await ant.setRecord({
			subDomain: '@',
			txId: txResult.id,
			ttl: 3600,
		}, {
			name: 'GIT-HASH', value: process.env.GITHUB_SHA,
		})

		console.log(`Deployed ${DEPLOY_FOLDER} folder with txId: ${txResult.id}`);
	} catch (e) {
		console.error(e);
	}
})();
