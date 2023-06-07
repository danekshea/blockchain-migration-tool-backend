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
* A deployed contract using the IMX base contracts(if interacting with StarkEx)
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

Configure the tool in configure.ts. The simplest implementation is a 1:1 tokenID and wallet address mapping. 

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
# Features
## Token Offsets
Tokens can be minted with offset token IDs meaning that if tokenID 1 on originChain can become tokenID 10001 on destination chain. Use caution when using this feature as it can lead to collisions and lack of traceability if the mapping data is lost.

## Address Mapping
Address mapping is supported where a wallet address on the origin chain can be mapped to a different address on the destination chain. This is useful for example if you want to migrate tokens from a wallet to a smart contract or from a wallet that only works on the origin chain. Again, use caution when using this feature as it can lead to collisions and lack of traceability if the mapping data is lost. Additionally, make sure that you can verify the destination address. A fool proof way of doing this is asking the origin address to sign a message with the destination address.

# Things to note
* 50k mints is the limit with an API key, contact Partner Success if you need to up this limit.
* There's the ability to offset the tokenIDs in the case that you don't want to mint tokenID:tokenID, be wary fo using this parameter and make sure you don't have collisions etc.
* The Moralis SDK has issues with return values and types, at least within 2.22.0, this was previously experienced on another project within our team as well. In the end, I had to implement my own Axios requests. Beware if you try to leverage the Moralis SDK.
* The tokenID offset and address mapping has been done upon entry into the DB for data integrity purposes and better type safety for the minter.

## Immediate to-do
* Add intelligent gas estimation to the EVM minting side
* Improve transaction confirmaton logic, there's issues where the confirmation on Polygon PoS for example can take over 10 minutes
* Rectify variable shadowing

## Long-term to-do
* Improve error logging, for example a duplicate mint just puts the whole message into the message field, ideally it should break down the stack etc.
* Improve the efficiency of the minting requests, they're currently split by unique user addresses but optimally you'd concatenate multiple token arrays with different users into a single batch
* Add auditing to StarkEx watcher because it might miss assets due to an ordering issue with the IMX APIs
* Maybe move everything into a config object rather than individual variables
* The tool could be reworked fairly easily to process multiple origin and destination collection addresses at once, not sure it's necessary or within the scope of this project.

## License
MIT License