import { providers, Signer, Contract } from 'ethers'
import { logger } from './logging'
import { loadArtifact } from './artifacts'
import { GRTTokenSwap, IERC20 } from '../build/types'

export interface SwapContracts {
  GRTTokenSwap?: GRTTokenSwap
  Token?: IERC20
}

export const getContractAt = (
  name: string,
  address: string,
  signerOrProvider?: Signer | providers.Provider,
): Contract => {
  return new Contract(address, loadArtifact(name).abi, signerOrProvider)
}

export const loadContracts = (
  swapAddress: string | undefined,
  tokenAddress: string | undefined,
  signerOrProvider?: Signer | providers.Provider,
): SwapContracts => {
  const contracts = {}
  try {
    if (swapAddress) {
      const grtTokenSwap = getContractAt('GRTTokenSwap', swapAddress)
      contracts['GRTTokenSwap'] = grtTokenSwap
      if (signerOrProvider) {
        contracts['GRTTokenSwap'] = contracts['GRTTokenSwap'].connect(signerOrProvider)
      }
    }
    if (tokenAddress) {
      const token = getContractAt('Token', tokenAddress)
      contracts['Token'] = token
      if (signerOrProvider) {
        contracts['Token'] = contracts['Token'].connect(signerOrProvider)
      }
    }
  } catch (err) {
    logger.warn(`Could not load contracts`)
  }
  return contracts as SwapContracts
}