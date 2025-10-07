import { ArweaveSigner } from '@ar.io/sdk'
import { EthereumSigner } from '@ardrive/turbo-sdk'

import type { SignerType } from '../types/index.js'

export function createSigner(sigType: SignerType, deployKey: string) {
  switch (sigType) {
    case 'ethereum': {
      return {
        signer: new EthereumSigner(deployKey),
        token: 'ethereum' as const,
      }
    }

    case 'polygon': {
      return {
        signer: new EthereumSigner(deployKey),
        token: 'pol' as const,
      }
    }

    case 'arweave': {
      const jwk = JSON.parse(Buffer.from(deployKey, 'base64').toString('utf8'))
      return {
        signer: new ArweaveSigner(jwk),
        token: 'arweave' as const,
      }
    }

    case 'kyve': {
      return {
        signer: new EthereumSigner(deployKey),
        token: 'kyve' as const,
      }
    }

    default: {
      throw new Error(
        `Invalid sig-type provided: ${sigType}. Allowed values are 'arweave', 'ethereum', 'polygon', or 'kyve'.`,
      )
    }
  }
}
