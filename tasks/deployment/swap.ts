import { Wallet } from 'ethers'
import { task } from 'hardhat/config'
import { promises as fs } from 'fs'

import { deployTokenSwap } from '../../utils/deploy'
import addresses from '../../addresses.json'

task('deploy-swap', 'Deploy the GRT token swap contract (use L2 network!)')
  .addParam('owner', 'Address of the contract owner, leave empty to use the deployer')
  .addParam('canonicalToken', 'Address of the canonical GRT token')
  .addParam('standardToken', 'Address of the standard GRT token')
  .setAction(async (taskArgs, hre) => {
    const accounts = await hre.ethers.getSigners()
    const chainId = (hre.network.config.chainId as number).toString()
    const swap = await deployTokenSwap(
      [taskArgs.owner ?? accounts[0].address, taskArgs.canonicalToken, taskArgs.standardToken],
      accounts[0] as unknown as Wallet,
    )
    addresses[chainId]['GRTTokenSwap'] = swap.address
    return fs.writeFile('addresses.json', JSON.stringify(addresses, null, 2))
  })
