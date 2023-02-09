import '@nomicfoundation/hardhat-chai-matchers'

import { expect } from 'chai'
import * as deployment from '../utils/deploy'
import { getAccounts, Account, toGRT } from '../utils/helpers'
import { BigNumber } from 'ethers'

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
  let user1: Account // Deprecated token holder, will swap for canonical tokens
  let user2: Account // Deprecated token holder, will swap for canonical tokens
  let user3: Account // Canonical token holder, won't be able to swap

  // Contracts
  let tokenSwap: GRTTokenSwap
  let canonicalToken: Token
  let deprecatedToken: Token

  before(async function () {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;[deployer, owner, user1, user2, user3] = await getAccounts()
  })

  beforeEach(async function () {
    canonicalToken = await deployment.deployToken([tenBillion], deployer.signer, true)
    deprecatedToken = await deployment.deployToken([tenBillion], deployer.signer, true)
    tokenSwap = await deployment.deployTokenSwap(
      [canonicalToken.address, deprecatedToken.address],
      deployer.signer,
      true,
    )

    await tokenSwap.transferOwnership(owner.address)

    // Airdrop some deprecated tokens
    await deprecatedToken.connect(deployer.signer).transfer(user1.address, oneMillion)
    await deprecatedToken.connect(deployer.signer).transfer(user2.address, hundredMillion)

    // Airdrop some canonical tokens
    await canonicalToken.connect(deployer.signer).transfer(tokenSwap.address, tenMillion)
    await canonicalToken.connect(deployer.signer).transfer(user3.address, oneMillion)
  })

  describe('constructor', function () {
    it('should set the canonical token', async function () {
      expect(await tokenSwap.canonicalGRT()).to.equal(canonicalToken.address)
    })

    it('should set the deprecated token', async function () {
      expect(await tokenSwap.deprecatedGRT()).to.equal(deprecatedToken.address)
    })
  })

  describe('getTokenBalances', function () {
    it('should return the swap contract token balances', async function () {
      const _canonicalBalance = await canonicalToken.balanceOf(tokenSwap.address)
      const _deprecatedBalance = await deprecatedToken.balanceOf(tokenSwap.address)
      const [canonicalBalance, deprecatedBalance] = await tokenSwap.getTokenBalances()
      expect(canonicalBalance).to.equal(_canonicalBalance)
      expect(deprecatedBalance).to.equal(_deprecatedBalance)
    })
  })

  describe('swap', function () {
    it('should swap deprecated tokens for canonical tokens', async function () {
      await swap(deprecatedToken, canonicalToken, tokenSwap, user1, oneHundred)
    })

    it('should revert when token amount is zero', async function () {
      // Swap it!
      const swapAmount = zero
      await deprecatedToken.connect(user1.signer).approve(tokenSwap.address, swapAmount)
      const tx = tokenSwap.connect(user1.signer).swap(swapAmount)

      await expect(tx).revertedWithCustomError(tokenSwap, 'AmountMustBeGreaterThanZero')
    })

    it('should revert if contract is out of funds', async function () {
      // Swap it!
      const swapAmount = hundredMillion
      await deprecatedToken.connect(user1.signer).approve(tokenSwap.address, swapAmount)
      const tx = tokenSwap.connect(user1.signer).swap(swapAmount)

      await expect(tx).revertedWithCustomError(tokenSwap, 'ContractOutOfFunds')
    })

    it('should revert if user has no deprecated tokens allowance', async function () {
      // Swap it!
      const swapAmount = oneHundred
      const tx = tokenSwap.connect(user3.signer).swap(swapAmount)

      await expect(tx).revertedWith('ERC20: insufficient allowance')
    })
  })

  describe('sweep', function () {
    beforeEach(async function () {
      // Make some swaps so the contract has a bit of both tokens
      await swap(deprecatedToken, canonicalToken, tokenSwap, user1, oneHundred)
      await swap(deprecatedToken, canonicalToken, tokenSwap, user2, oneHundred)
    })

    it('should allow owner to withdraw both token balances', async function () {
      await sweep(deprecatedToken, canonicalToken, tokenSwap, owner)
    })

    it('should revert if caller is not owner', async function () {
      const tx = tokenSwap.connect(user1.signer).sweep()
      await expect(tx).revertedWith('Ownable: caller is not the owner')
    })

    it('should allow multiple calls', async function () {
      await sweep(deprecatedToken, canonicalToken, tokenSwap, owner)
      await sweep(deprecatedToken, canonicalToken, tokenSwap, owner)
    })
  })

  describe('takeDeprecated', function () {
    beforeEach(async function () {
      // Make some swaps so the contract has a bit of both tokens
      await swap(deprecatedToken, canonicalToken, tokenSwap, user1, oneHundred)
      await swap(deprecatedToken, canonicalToken, tokenSwap, user2, oneHundred)
    })

    it('should allow owner withdrawing all deprecated token balance', async function () {
      const deprecatedTokenBalance = await deprecatedToken.balanceOf(tokenSwap.address)
      await take(deprecatedToken, deprecatedToken, canonicalToken, tokenSwap, owner, deprecatedTokenBalance)
    })

    it('should revert if caller is not the owner', async function () {
      const deprecatedTokenBalance = await deprecatedToken.balanceOf(tokenSwap.address)
      const tx = tokenSwap.connect(user1.signer).takeDeprecated(deprecatedTokenBalance)
      await expect(tx).revertedWith('Ownable: caller is not the owner')
    })
  })
  describe('takeCanonical', function () {
    beforeEach(async function () {
      // Make some swaps so the contract has a bit of both tokens
      await swap(deprecatedToken, canonicalToken, tokenSwap, user1, oneHundred)
      await swap(deprecatedToken, canonicalToken, tokenSwap, user2, oneHundred)
    })

    it('should allow owner withdrawing all canonical token balance', async function () {
      const canonicalTokenBalance = await canonicalToken.balanceOf(tokenSwap.address)
      await take(canonicalToken, deprecatedToken, canonicalToken, tokenSwap, owner, canonicalTokenBalance)
    })

    it('should revert if caller is not the owner', async function () {
      const canonicalTokenBalance = await canonicalToken.balanceOf(tokenSwap.address)
      const tx = tokenSwap.connect(user1.signer).takeCanonical(canonicalTokenBalance)
      await expect(tx).revertedWith('Ownable: caller is not the owner')
    })
  })
})

async function swap(
  deprecatedToken: Token,
  canonicalToken: Token,
  tokenSwap: GRTTokenSwap,
  user: Account,
  amount: BigNumber,
) {
  // State before
  const userCanonicalBalanceBefore = await canonicalToken.balanceOf(user.address)
  const userDeprecatedBalanceBefore = await deprecatedToken.balanceOf(user.address)
  const [swapCanonicalBalanceBefore, swapDeprecatedBalanceBefore] = await tokenSwap.getTokenBalances()

  // Swap it!
  await deprecatedToken.connect(user.signer).approve(tokenSwap.address, amount)
  const tx = tokenSwap.connect(user.signer).swap(amount)

  // Check events
  await expect(tx).emit(tokenSwap, 'TokensSwapped').withArgs(user.address, amount)

  // State after
  const userCanonicalBalanceAfter = await canonicalToken.balanceOf(user.address)
  const userDeprecatedBalanceAfter = await deprecatedToken.balanceOf(user.address)
  const [swapCanonicalBalanceAfter, swapDeprecatedBalanceAfter] = await tokenSwap.getTokenBalances()

  // Check user balance
  expect(userDeprecatedBalanceAfter).to.equal(userDeprecatedBalanceBefore.sub(amount))
  expect(userCanonicalBalanceAfter).to.equal(userCanonicalBalanceBefore.add(amount))

  // Check contract balance
  expect(swapDeprecatedBalanceAfter).to.equal(swapDeprecatedBalanceBefore.add(amount))
  expect(swapCanonicalBalanceAfter).to.equal(swapCanonicalBalanceBefore.sub(amount))
}

async function sweep(deprecatedToken: Token, canonicalToken: Token, tokenSwap: GRTTokenSwap, owner: Account) {
  // State before
  const ownerCanonicalBalanceBefore = await canonicalToken.balanceOf(owner.address)
  const ownerDeprecatedBalanceBefore = await deprecatedToken.balanceOf(owner.address)
  const [swapCanonicalBalanceBefore, swapDeprecatedBalanceBefore] = await tokenSwap.getTokenBalances()

  // Sweep it!
  const tx = tokenSwap.connect(owner.signer).sweep()

  // Check events
  await expect(tx)
    .emit(tokenSwap, 'TokensTaken')
    .withArgs(owner.address, deprecatedToken.address, swapDeprecatedBalanceBefore)
  await expect(tx)
    .emit(tokenSwap, 'TokensTaken')
    .withArgs(owner.address, canonicalToken.address, swapCanonicalBalanceBefore)

  // State after
  const ownerCanonicalBalanceAfter = await canonicalToken.balanceOf(owner.address)
  const ownerDeprecatedBalanceAfter = await deprecatedToken.balanceOf(owner.address)
  const [swapCanonicalBalanceAfter, swapDeprecatedBalanceAfter] = await tokenSwap.getTokenBalances()

  // Check owner balance
  expect(ownerDeprecatedBalanceAfter).to.equal(ownerDeprecatedBalanceBefore.add(swapDeprecatedBalanceBefore))
  expect(ownerCanonicalBalanceAfter).to.equal(ownerCanonicalBalanceBefore.add(swapCanonicalBalanceBefore))

  // Check contract balance
  expect(swapDeprecatedBalanceAfter).to.equal(zero)
  expect(swapCanonicalBalanceAfter).to.equal(zero)
}

async function take(
  token: Token,
  deprecatedToken: Token,
  canonicalToken: Token,
  tokenSwap: GRTTokenSwap,
  owner: Account,
  amount: BigNumber,
) {
  // State before
  const ownerBalanceBefore = await token.balanceOf(owner.address)
  const swapBalanceBefore = await token.balanceOf(tokenSwap.address)

  // Take it!
  const method = token.address === deprecatedToken.address ? 'takeDeprecated' : 'takeCanonical'
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
