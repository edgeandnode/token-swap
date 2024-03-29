import { ethers, Wallet } from 'ethers'
import { task } from 'hardhat/config'
import { GRTTokenSwap, Token } from '../build/types'
import { getContractAt } from '../utils/contracts'
import { SUPPORTED_CHAINS } from './chains'
import inquirer from 'inquirer'

task('swap', 'Swap deprecated GRT tokens for the cannonical GRT tokens in Arbitrum (use L2 network!)').setAction(
  async (taskArgs, hre) => {
    console.log('*** Arbitrum GRT Token Swap ***')
    console.log('This script will swap all deprecated GRT tokens for the cannonical GRT tokens on Arbitrum')

    // Validate chain ID
    const chainId = (hre.network.config.chainId as number).toString()
    if (!SUPPORTED_CHAINS.includes(chainId)) {
      throw new Error('Chain ID not supported. Are you sure you are on Arbitrum?')
    }
    console.log(`\nRunning on chain: ${hre.network.name} - ${chainId}`)

    // Get contracts
    console.log('\nGetting contracts...')

    const tokenSwap = hre.contracts.GRTTokenSwap as GRTTokenSwap
    if (tokenSwap === undefined) {
      throw new Error('Token swap contract not found')
    }
    console.log(`> Token swap: ${tokenSwap.address}`)

    // Get the GRT addresses for the chain
    const canonicalGRTAddress = await tokenSwap.canonicalGRT()
    const deprecatedGRTAddress = await tokenSwap.deprecatedGRT()
    const deprecatedGRT = getContractAt('Token', deprecatedGRTAddress) as Token
    const canonicalGRT = getContractAt('Token', canonicalGRTAddress) as Token

    if (deprecatedGRT === undefined) {
      throw new Error('Deprecated GRT contract not found')
    }

    if (canonicalGRT === undefined) {
      throw new Error('Canonical GRT contract not found')
    }

    console.log(`> Deprecated GRT: ${deprecatedGRTAddress}`)
    console.log(`> Canonical GRT: ${canonicalGRTAddress}`)

    // User account
    const accounts = await hre.ethers.getSigners()
    console.log(`\nTarget account address: ${accounts[0].address}`)

    // Get the balance of the deprecated GRT
    let deprecatedBalance = await deprecatedGRT.connect(accounts[0]).balanceOf(accounts[0].address)
    let canonicalBalance = await canonicalGRT.connect(accounts[0]).balanceOf(accounts[0].address)

    console.log(`\nCurrent balances:`)
    console.log(`> ETH balance: ${ethers.utils.formatEther(await accounts[0].getBalance())} ETH`)
    console.log(`> Deprecated GRT: ${ethers.utils.formatEther(deprecatedBalance)} GRT`)
    console.log(`> Canonical GRT: ${ethers.utils.formatEther(canonicalBalance)} GRT`)

    const swapIt = await confirm('Are you sure you want to continue?')

    // Swap it!
    if (swapIt) {
      console.log(`Approving swap contract to pull deprecated GRT...`)
      await deprecatedGRT.connect(accounts[0]).approve(tokenSwap.address, ethers.constants.MaxUint256)

      console.log(`Swapping tokens...`)
      const tx = await tokenSwap.connect(accounts[0]).swapAll({ gasLimit: 8_000_000 })
      const receipt = await tx.wait()
      console.log(`Transaction hash: ${receipt.transactionHash}`)
      console.log(`Transaction status: ${receipt.status ? 'Success' : 'Failure'}`)

      console.log(`Setting deprecated GRT allowance to zero...`)
      await deprecatedGRT.connect(accounts[0]).approve(tokenSwap.address, ethers.constants.Zero)

      console.log('Swap complete!')

      // Get new balances
      deprecatedBalance = await deprecatedGRT.connect(accounts[0]).balanceOf(accounts[0].address)
      canonicalBalance = await canonicalGRT.connect(accounts[0]).balanceOf(accounts[0].address)

      console.log(`\nNew balances:`)
      console.log(`> Deprecated GRT: ${ethers.utils.formatEther(deprecatedBalance)} GRT`)
      console.log(`> Canonical GRT: ${ethers.utils.formatEther(canonicalBalance)} GRT`)
    }
  },
)

export const confirm = async (message: string): Promise<boolean> => {
  const res = await inquirer.prompt({
    name: 'confirm',
    type: 'confirm',
    message,
  })
  if (!res.confirm) {
    console.log('Aborting...')
    return false
  }
  return true
}
