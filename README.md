# GRT Token Swap

This repository contains a token swap contract for the "Arbitrum deprecated GRT". It allows users to exchange 1:1 their "Arbitrum deprecated GRT" tokens for the canonical GRT without bridging back and forth between L1 and L2.

## Motivation

Arbitrum allows users to bridge tokens to L2 using a standard ERC20 gateway. This is the default behavior unless the token implements a custom gateway. Bridged tokens on L2 are handled by a copy of the L1 token contract deployed on L2. This is the ["Arbitrum deprecated GRT" token](https://arbiscan.io/token/0x23A941036Ae778Ac51Ab04CEa08Ed6e2FE103614), which has seen activity since shortly after the launch of Arbitrum in June 2021.

Later on, in November 2022, The Graph Team deployed a custom gateway for the GRT token and a custom L2 token contract. This is the [canonical GRT token](https://arbiscan.io/address/0x9623063377AD1B27544C965cCd7342f7EA7e88C7) and the one that supports the protocol going forward.

In order to participate in the protocol, holders of the "Arbitrum deprecated GRT" need to swap their tokens for the canonical GRT. There are two alternatives for this:
1) Bridge "Arbitrum deprecated GRT" to L1 using the standard ERC20 gateway, then bridge the GRT back to L2 using the custom GRT gateway. This is a cumbersome and costly process involving multiple transactions, wait times and fees.
2) Swap the "Arbitrum deprecated GRT" for the canonical GRT on L2 using this contract. This only requires two transactions on L2 (approve and swap) and no bridging, so it's much cheaper and faster.


Read more about Arbitrum token bridging here: https://developer.arbitrum.io/asset-bridging#bridging-erc20-tokens


## How to swap your tokens using this repository

1) Setup > clone this repository, install dependencies and build it: 

```bash
git clone http://github.com/edgeandnode/token-swap.git
cd token-swap
yarn install
yarn build
```

2) Run the swap command: 

_Note_: Please handle your private keys/mnemonic with care!

If you want to use a private key: `PRIVATE_KEY=<PRIVATE_KEY> hh swap --network <NETWORK_NAME>`
If you want to use mnemonic: `MNEMONIC="<MNEMONIC>" hh swap --network <NETWORK_NAME>`

- `NETWORK_NAME` can be one of `arbitrum-one` or `arbitrum-goerli`
- `PRIVATE_KEY` is the private key of the account that will have it's deprecated GRT swapped
- `MNEMONIC` is the mnemonic of the account that will have it's deprecated GRT swapped

The script will swap **ALL** of your deprecated GRT tokens for the canonical ones.

# Development
## Deploy instructions

Deploy with:

```bash
hh deploy --network <NETWORK_NAME> --canonicalToken <TOKEN_ADDRESS> --deprecatedToken <DEPRECATED_TOKEN_ADDRESS>
```

- `NETWORK_NAME` can be one of `arbitrum-one`, `arbitrum-goerli` or `localhost`.
- `TOKEN_ADDRESS` is the address of the canonical GRT token.
- `DEPRECATED_TOKEN_ADDRESS` is the address of the "Arbitrum deprecated GRT" token.

When deploying to `localhost` the token addresses are not required as the script will deploy them from scratch.


## Testing

Run the test suite with:

```bash
yarn test
```