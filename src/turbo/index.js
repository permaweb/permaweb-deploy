import fs from 'fs';
import mime from 'mime-types';
import path from 'path';
import { Readable } from 'stream';

import { TurboFactory } from '@ardrive/turbo-sdk';

// Gets MIME types for each file to tag the upload
function getContentType(filePath) {
	const res = mime.lookup(filePath);
	return res || 'application/octet-stream';
}

export async function uploadFile(path, turbo) {
	console.log(`Uploading file: ${path}...`);
	try {
		const fileSize = fs.statSync(path).size;
		const contentType = getContentType(path);
		const uploadResult = await turbo.uploadFile({
			fileStreamFactory: () => fs.createReadStream(path),
			fileSizeFactory: () => fileSize,
			signal: AbortSignal.timeout(10_000), // Cancel the upload after 10 seconds
			dataItemOpts: {
				tags: [
					{ name: 'Content-Type', value: contentType },
					{ name: 'App-Name', value: 'Permaweb-Deploy' },
				],
			},
		});

		console.log(`Uploaded ${path} with id:`, uploadResult.id);

		return uploadResult;
	} catch (err) {
		console.error(`Error uploading file ${path}:`, err);
	}
}

export async function uploadDirectory(argv, jwk) {
	const turbo = TurboFactory.authenticated({ privateKey: jwk });

	const deployFolder = argv.deployFolder;
	
	// Uses Arweave manifest version 0.2.0, which supports fallbacks
	let newManifest = {
		manifest: 'arweave/paths',
		version: '0.2.0',
		index: { path: 'index.html' },
		fallback: {},
		paths: {},
	};

	async function processFiles(dir) {
		const files = fs.readdirSync(dir);

		for (const file of files) {
			try {
				const filePath = path.join(dir, file);
				const relativePath = path.relative(deployFolder, filePath);

				if (fs.statSync(filePath).isDirectory()) {
					// Recursively process all files in a directory
					await processFiles(filePath);
				} else {
					const uploadResult = await uploadFile(filePath, turbo);

					// Adds uploaded file txId to the new manifest json
					newManifest.paths[relativePath] = { id: uploadResult.id };

					if (file === '404.html') {
						// Sets manifest fallback to 404.html if found
						newManifest.fallback.id = uploadResult.id;
					}
				}
			} catch (err) {
				console.error('ERROR:', err);
			}
		}
	}

	async function uploadManifest(manifest) {
		try {
			const manifestString = JSON.stringify(manifest);
			const uploadResult = await turbo.uploadFile({
				fileStreamFactory: () => Readable.from(Buffer.from(manifestString)),
				fileSizeFactory: () => Buffer.byteLength(manifestString),
				signal: AbortSignal.timeout(10_000),
				dataItemOpts: {
					tags: [
						{
							name: 'Content-Type',
							value: 'application/x.arweave-manifest+json',
						},
						{
							name: 'App-Name',
							value: 'Permaweb-Deploy',
						},
					],
				},
			});
			return uploadResult.id;
		} catch (error) {
			console.error('Error uploading manifest:', error);
			return null;
		}
	}

	// Starts processing files in the selected directory
	await processFiles(deployFolder);

	if (!newManifest.fallback.id) {
		// If no 404.html file is found, manifest fallback is set to the txId of index.html
		newManifest.fallback.id = newManifest.paths['index.html'].id;
	}

	const manifestId = await uploadManifest(newManifest);
	if (manifestId) {
		console.log(`Manifest uploaded with Id: ${manifestId}`);
		return manifestId;
	}
}
