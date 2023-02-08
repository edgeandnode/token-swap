import '@nomicfoundation/hardhat-chai-matchers'

import { expect } from 'chai'
import * as deployment from '../utils/deploy'
import { getAccounts, Account, toGRT, toBN, floorBN } from '../utils/helpers'
import { BigNumber, ethers, utils } from 'ethers'
import { latestBlockNumber, maxBN, mineNBlocks, nextBlockNumber, setAutoMine } from './helpers'

import { GRTTokenSwap } from '../build/types/contracts/GRTTokenSwap'
import { Token } from '../build/types/contracts/tests/Token'

const zero = toGRT('0')
const tenBillion = toGRT('10000000000')
const oneHundred = toGRT('100')
const oneMillion = toGRT('1000000')
const tenMillion = toGRT('10000000')
const hundredMillion = toGRT('100000000')

describe('GRT Token Swap contract', () => {
  // Accounts
  let deployer: Account
  let owner: Account
  let user1: Account // Standard token holder, will swap for canonical tokens
  let user2: Account // Standard token holder, will swap for canonical tokens
  let user3: Account // Canonical token holder, won't be able to swap

  // Contracts
  let tokenSwap: GRTTokenSwap
  let canonicalToken: Token
  let standardToken: Token

  before(async function () {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;[deployer, owner, user1, user2, user3] = await getAccounts()
  })

  beforeEach(async function () {
    canonicalToken = await deployment.deployToken([tenBillion], deployer.signer, true)
    standardToken = await deployment.deployToken([tenBillion], deployer.signer, true)
    tokenSwap = await deployment.deployTokenSwap([canonicalToken.address, standardToken.address], deployer.signer, true)

    await tokenSwap.transferOwnership(owner.address)

    // Airdrop some standard tokens
    await standardToken.connect(deployer.signer).transfer(user1.address, oneMillion)
    await standardToken.connect(deployer.signer).transfer(user2.address, hundredMillion)

    // Airdrop some canonical tokens
    await canonicalToken.connect(deployer.signer).transfer(tokenSwap.address, tenMillion)
    await canonicalToken.connect(deployer.signer).transfer(user3.address, oneMillion)
  })

  describe('constructor', function () {
    it('should set the canonical token', async function () {
      expect(await tokenSwap.canonicalGRT()).to.equal(canonicalToken.address)
    })

    it('should set the standard token', async function () {
      expect(await tokenSwap.standardGRT()).to.equal(standardToken.address)
    })
  })

  describe('getTokenBalances', function () {
    it('should return the swap contract token balances', async function () {
      const _canonicalBalance = await canonicalToken.balanceOf(tokenSwap.address)
      const _standardBalance = await standardToken.balanceOf(tokenSwap.address)
      const [canonicalBalance, standardBalance] = await tokenSwap.getTokenBalances()
      expect(canonicalBalance).to.equal(_canonicalBalance)
      expect(standardBalance).to.equal(_standardBalance)
    })
  })

  describe('swap', function () {
    it('should swap standard tokens for canonical tokens', async function () {
      await swap(standardToken, canonicalToken, tokenSwap, user1, oneHundred)
    })

    it('should revert when token amount is zero', async function () {
      // Swap it!
      const swapAmount = zero
      await standardToken.connect(user1.signer).approve(tokenSwap.address, swapAmount)
      const tx = tokenSwap.connect(user1.signer).swap(swapAmount)

      await expect(tx).revertedWithCustomError(tokenSwap, 'AmountMustBeGreaterThanZero')
    })

    it('should revert if contract is out of funds', async function () {
      // Swap it!
      const swapAmount = hundredMillion
      await standardToken.connect(user1.signer).approve(tokenSwap.address, swapAmount)
      const tx = tokenSwap.connect(user1.signer).swap(swapAmount)

      await expect(tx).revertedWithCustomError(tokenSwap, 'ContractOutOfFunds')
    })

    it('should revert if user has no standard tokens allowance', async function () {
      // Swap it!
      const swapAmount = oneHundred
      const tx = tokenSwap.connect(user3.signer).swap(swapAmount)

      await expect(tx).revertedWithCustomError(tokenSwap, 'InsufficientAllowance')
    })
  })

  describe('take', function () {
    beforeEach(async function () {
      // Make some swaps so the contract has a bit of both tokens
      await swap(standardToken, canonicalToken, tokenSwap, user1, oneHundred)
      await swap(standardToken, canonicalToken, tokenSwap, user2, oneHundred)
    })

    it('should allow owner to withdraw both token balances using sweep()', async function () {
      await sweep(standardToken, canonicalToken, tokenSwap, owner)
    })

    it('should revert when calling sweep() if one of the token balances is zero', async function () {
      // Take all standard tokens
      const standardTokenBalance = await standardToken.balanceOf(tokenSwap.address)
      await take(standardToken, standardToken, canonicalToken, tokenSwap, owner, standardTokenBalance)

      // Sweep it!
      const tx = tokenSwap.connect(owner.signer).sweep()

      // Check events
      await expect(tx).revertedWithCustomError(tokenSwap, 'AmountMustBeGreaterThanZero')
    })

    it('should allow owner withdrawing all standard token balance', async function () {
      // Take it!
      const standardTokenBalance = await standardToken.balanceOf(tokenSwap.address)
      await take(standardToken, standardToken, canonicalToken, tokenSwap, owner, standardTokenBalance)
    })

    it('should allow owner withdrawing all canonical token balance', async function () {
      // Take it!
      const canonicalTokenBalance = await canonicalToken.balanceOf(tokenSwap.address)
      await take(canonicalToken, standardToken, canonicalToken, tokenSwap, owner, canonicalTokenBalance)
    })
  })
})

async function swap(
  standardToken: Token,
  canonicalToken: Token,
  tokenSwap: GRTTokenSwap,
  user: Account,
  amount: BigNumber,
) {
  // State before
  const userCanonicalBalanceBefore = await canonicalToken.balanceOf(user.address)
  const userStandardBalanceBefore = await standardToken.balanceOf(user.address)
  const [swapCanonicalBalanceBefore, swapStandardBalanceBefore] = await tokenSwap.getTokenBalances()

  // Swap it!
  await standardToken.connect(user.signer).approve(tokenSwap.address, amount)
  const tx = tokenSwap.connect(user.signer).swap(amount)

  // Check events
  await expect(tx).emit(tokenSwap, 'TokensSwapped').withArgs(user.address, amount)

  // State after
  const userCanonicalBalanceAfter = await canonicalToken.balanceOf(user.address)
  const userStandardBalanceAfter = await standardToken.balanceOf(user.address)
  const [swapCanonicalBalanceAfter, swapStandardBalanceAfter] = await tokenSwap.getTokenBalances()

  // Check user balance
  expect(userStandardBalanceAfter).to.equal(userStandardBalanceBefore.sub(amount))
  expect(userCanonicalBalanceAfter).to.equal(userCanonicalBalanceBefore.add(amount))

  // Check contract balance
  expect(swapStandardBalanceAfter).to.equal(swapStandardBalanceBefore.add(amount))
  expect(swapCanonicalBalanceAfter).to.equal(swapCanonicalBalanceBefore.sub(amount))
}

async function sweep(standardToken: Token, canonicalToken: Token, tokenSwap: GRTTokenSwap, owner: Account) {
  // State before
  const ownerCanonicalBalanceBefore = await canonicalToken.balanceOf(owner.address)
  const ownerStandardBalanceBefore = await standardToken.balanceOf(owner.address)
  const [swapCanonicalBalanceBefore, swapStandardBalanceBefore] = await tokenSwap.getTokenBalances()

  // Sweep it!
  const tx = tokenSwap.connect(owner.signer).sweep()

  // Check events
  await expect(tx)
    .emit(tokenSwap, 'TokensTaken')
    .withArgs(owner.address, standardToken.address, swapStandardBalanceBefore)
  await expect(tx)
    .emit(tokenSwap, 'TokensTaken')
    .withArgs(owner.address, canonicalToken.address, swapCanonicalBalanceBefore)

  // State after
  const ownerCanonicalBalanceAfter = await canonicalToken.balanceOf(owner.address)
  const ownerStandardBalanceAfter = await standardToken.balanceOf(owner.address)
  const [swapCanonicalBalanceAfter, swapStandardBalanceAfter] = await tokenSwap.getTokenBalances()

  // Check owner balance
  expect(ownerStandardBalanceAfter).to.equal(ownerStandardBalanceBefore.add(swapStandardBalanceBefore))
  expect(ownerCanonicalBalanceAfter).to.equal(ownerCanonicalBalanceBefore.add(swapCanonicalBalanceBefore))

  // Check contract balance
  expect(swapStandardBalanceAfter).to.equal(zero)
  expect(swapCanonicalBalanceAfter).to.equal(zero)
}

async function take(
  token: Token,
  standardToken: Token,
  canonicalToken: Token,
  tokenSwap: GRTTokenSwap,
  owner: Account,
  amount: BigNumber,
) {
  // State before
  const ownerBalanceBefore = await token.balanceOf(owner.address)
  const swapBalanceBefore = await token.balanceOf(tokenSwap.address)

  // Take it!
  const method = token.address === standardToken.address ? 'takeStandard' : 'takeCanonical'
  const tx = tokenSwap.connect(owner.signer)[method.toString()](amount)

  // Check events
  await expect(tx).emit(tokenSwap, 'TokensTaken').withArgs(owner.address, token.address, swapBalanceBefore)

  // State after
  const ownerBalanceAfter = await token.balanceOf(owner.address)
  const swapBalanceAfter = await token.balanceOf(tokenSwap.address)

  // Check balances
  expect(ownerBalanceAfter).to.equal(ownerBalanceBefore.add(swapBalanceBefore))
  expect(swapBalanceAfter).to.equal(zero)
}
