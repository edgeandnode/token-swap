import { BigNumber, Wallet } from 'ethers'
import { task } from 'hardhat/config'
import { promises as fs } from 'fs'

import { deployToken, deployTokenSwap } from '../utils/deploy'
import addresses from '../addresses.json'
import { SUPPORTED_CHAINS } from './chains'
import { getContractAt } from '../utils/contracts'

import { Token } from '../build/types'

task('deploy', 'Deploy the GRT token swap contract (use L2 network!)')
  .addOptionalParam('owner', 'Address of the contract owner, leave empty to use the deployer')
  .addOptionalParam('canonicalToken', 'Address of the canonical GRT token')
  .addOptionalParam('deprecatedToken', 'Address of the deprecated GRT token')
  .setAction(async (taskArgs, hre) => {
    const accounts = await hre.ethers.getSigners()

    // Validate chain ID
    const chainId = (hre.network.config.chainId as number).toString()
    if (!SUPPORTED_CHAINS.includes(chainId)) {
      throw new Error('Chain ID not supported. Are you sure you are on Arbitrum?')
    }

    // Get token contracts
    let deprecatedGRT: Token
    let canonicalGRT: Token
    if (chainId === '1337') {
      deprecatedGRT = await deployToken([BigNumber.from('10000000000')], accounts[0], false)
      canonicalGRT = await deployToken([BigNumber.from('10000000000')], accounts[0], false)
    } else {
      if (taskArgs.deprecatedToken === undefined || taskArgs.canonicalToken === undefined) {
        throw new Error('Token addresses not provided. Use --canonicalToken and --deprecatedToken.')
      }
      deprecatedGRT = getContractAt('Token', taskArgs.deprecatedToken) as Token
      canonicalGRT = getContractAt('Token', taskArgs.canonicalToken) as Token
    }

    // Deploy
    const tokenSwap = await deployTokenSwap(
      [canonicalGRT.address, deprecatedGRT.address],
      accounts[0] as unknown as Wallet,
    )
    addresses[chainId]['GRTTokenSwap'] = tokenSwap.address
    return fs.writeFile('addresses.json', JSON.stringify(addresses, null, 2))
  })
