# GRT Token Swap

This repository contains a token swap contract for the "Arbitrum standard GRT". It allows users to exchange 1:1 their "Arbitrum standard GRT" tokens for the canonical GRT without bridging back and forth between L1 and L2.

## Motivation

Arbitrum allows users to bridge tokens to L2 using a standard ERC20 gateway. This is the default behavior unless the token implements a custom gateway. Bridged tokens on L2 are handled by a copy of the L1 token contract deployed on L2. This is the ["Arbitrum standard GRT" token](https://arbiscan.io/token/0x23A941036Ae778Ac51Ab04CEa08Ed6e2FE103614), which has seen activity since shortly after the launch of Arbitrum in June 2021.

Later on, in November 2022, The Graph Team deployed a custom gateway for the GRT token and a custom L2 token contract. This is the [canonical GRT token](https://arbiscan.io/address/0x9623063377AD1B27544C965cCd7342f7EA7e88C7) and the one that supports the protocol going forward.

In order to participate in the protocol, holders of the "Arbitrum standard GRT" need to swap their tokens for the canonical GRT. There are two alternatives for this:
1) Bridge "Arbitrum standard GRT" to L1 using the standard ERC20 gateway, then bridge the GRT back to L2 using the custom GRT gateway. This is a cumbersome and costly process involving multiple transactions, wait times and fees.
2) Swap the "Arbitrum standard GRT" for the canonical GRT on L2 using this contract. This only requires two transactions on L2 (approve and swap) and no bridging, so it's much cheaper and faster.


Read more about Arbitrum token bridging here: https://developer.arbitrum.io/asset-bridging#bridging-erc20-tokens

## Testing

Run the test suite with:

```bash
yarn test
```

## Using the console

TBD

## Deploy instructions

TBD