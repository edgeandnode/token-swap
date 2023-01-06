import { Contract, Signer, ContractFactory, utils, BigNumber } from 'ethers'

import { logger } from './logging'
import { loadArtifact } from './artifacts'

import { GRTTokenSwap } from '../build/types/contracts/GRTTokenSwap'
import { Token } from '../build/types/contracts/tests/Token'

const hash = (input: string): string => utils.keccak256(`0x${input.replace(/^0x/, '')}`)

async function deployContract(
  args: Array<string | BigNumber>,
  sender: Signer,
  name: string,
  disableLogging?: boolean,
): Promise<Contract> {
  // Disable logging for tests
  if (disableLogging) logger.pause()

  // Deploy
  const artifact = loadArtifact(name)
  const factory = new ContractFactory(artifact.abi, artifact.bytecode)
  const contract = await factory.connect(sender).deploy(...args)
  const txHash = contract.deployTransaction.hash
  logger.log(`> Deploy ${name}, txHash: ${txHash}`)

  // Receipt
  if (!sender.provider) throw new Error('Sender has no provider')
  const creationCodeHash = hash(factory.bytecode)
  const runtimeCodeHash = hash(await sender.provider.getCode(contract.address))
  logger.log('= CreationCodeHash: ', creationCodeHash)
  logger.log('= RuntimeCodeHash: ', runtimeCodeHash)
  logger.success(`${name} has been deployed to address: ${contract.address}`)

  return contract as unknown as Promise<Contract>
}

export async function deployTokenSwap(
  args: Array<string | BigNumber>,
  sender: Signer,
  disableLogging?: boolean,
): Promise<GRTTokenSwap> {
  return deployContract(args, sender, 'GRTTokenSwap', disableLogging) as unknown as Promise<GRTTokenSwap>
}

export async function deployToken(
  args: Array<string | BigNumber>,
  sender: Signer,
  disableLogging?: boolean,
): Promise<Token> {
  return deployContract(args, sender, 'Token', disableLogging) as unknown as Promise<Token>
}
