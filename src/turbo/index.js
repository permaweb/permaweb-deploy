import { TurboFactory } from '@ardrive/turbo-sdk';
import fs from 'fs';
import mime from 'mime-types';
import path from 'path';
import { Readable } from 'stream';

// Gets MIME types for each file to tag the upload
async function getContentType(filePath) {
	return mime.lookup(filePath);
}

export default async function TurboDeploy(argv, jwk) {
	const turbo = TurboFactory.authenticated({ privateKey: jwk });

	const deployFolder = argv.deployFolder;
	//Uses Arweave manifest version 0.2.0, which supports fallbacks
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
					// recursively process all files in a directory
					await processFiles(filePath);
				} else {
					console.log(`Uploading file: ${relativePath}`);
					try {
						const fileSize = fs.statSync(filePath).size;
						const contentType = await getContentType(filePath);
						const uploadResult = await turbo.uploadFile({
							fileStreamFactory: () => fs.createReadStream(filePath),
							fileSizeFactory: () => fileSize,
							signal: AbortSignal.timeout(10_000), // cancel the upload after 10 seconds
							dataItemOpts: {
								tags: [
									{ name: 'Content-Type', value: contentType },
									{ name: 'App-Name', value: 'Permaweb-Deploy' },
								],
							},
						});

						console.log(`Uploaded ${relativePath} with id:`, uploadResult.id);
						// adds uploaded file txId to the new manifest json
						newManifest.paths[relativePath] = { id: uploadResult.id };

						if (file === '404.html') {
							// sets manifest fallback to 404.html if found
							newManifest.fallback.id = uploadResult.id;
						}
					} catch (err) {
						console.error(`Error uploading file ${relativePath}:`, err);
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

	// starts processing files in the selected directory
	await processFiles(deployFolder);

	if (!newManifest.fallback.id) {
		// if no 404.html file is found, manifest fallback is set to the txId of index.html
		newManifest.fallback.id = newManifest.paths['index.html'].id;
	}

	const manifestId = await uploadManifest(newManifest);
	if (manifestId) {
		console.log(`Manifest uploaded with Id: ${manifestId}`);
		return manifestId;
	}
}
