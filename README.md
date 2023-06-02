# Introduction

The backend of a migration tool that migrates ERC721 tokens between EVM chains and StarkEx instances. The tool supports the following migration paths:
* (zk)EVM->StarkEx
* Stark->(zk)EVM
* (zk)EVM->(zk)EVM

The watcher will watch for burns on the origin chain and load them into the database via Prisma.
The minter will watch the DB for tokens that don't have the minted attribute.

The following EVM origin/destination chains are supported:
* Arbitrum
* Avalanche C-chain
* BNB
* Cronos
* ETH L1
* Fantom
* Immutable zkEVM(coming soon)
* Polygon PoS

The following StarkEx origin/destination chains are supported:
* Immutable X Mainnet
* Immutable X Sandbox

# Pre-requisites
* A deployed contract using the IMX base contracts
* A Moralis API key
* An Alchemy API key

## Installation
Install all the dependencies:
```bash
npm install
```
Copy the .env.example file and rename it to .env
```bash
cp .env.example .env
```
Fill in the .env file with the required information.

Initialize the database:
```bash
npx prisma migrate dev --name init
```

Fill out the config.ts file with the required information.

## Usage
Launch the watcher:
```bash
npm run watcher
```
Launch the minter:
```bash
npm run minter
```

Make sure to run each concurrently for successful migrations to happen.

In production, you'd likely run this with a process manager like pm2.
```bash
pm2 start npm --name "watcher" -- run watcher
```
```bash
pm2 start npm --name "minter" -- run minter
```
# Things to note
* 50k mints is the limit with an API key, contact Partner Success if you need to up this limit.
* There's the ability to offset the tokenIDs in the case that you don't want to mint tokenID:tokenID, be wary fo using this parameter and make sure you don't have collisions etc.

## Immediate to-do
* Add intelligent gas estimation to the EVM minting side
* More thorough testing of token offset parameter

## Long-term to-do
* Improve the efficiency of the minting requests, they're currently split by unique user addresses but optimally you'd concatenate multiple token arrays with different users into a single batch
* Add auditing to StarkEx watcher because it might miss assets due to an ordering issue with the IMX APIs
* Add support for other EVM NaaS providers than Moralis

## License
