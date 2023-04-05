# Introduction

The backend of a migration tool that migrates ERC721 tokens from any Moralis-supported EVM L1 to IMX's StarkEx instance.

The watcher will watch for burns on the origin chain and load them into the database via Prisma.
The minter will watch the DB for tokens that don't have the minted attribute.

The following EVM origin chains are supported:
* Arbitrum
* Avalanche C-chain
* BNB
* ETH L1
* Fantom
* Polygon PoS

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
Rename .env.example to .env and complete the configuration.

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
## Contributing

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.

Please make sure to update tests as appropriate.

## Immediate to-do
* Add error handling to checking if users are registered on IMX, currently the error handling doesn't account for rate limiting issues etc.

## Long-term to-do
* Improve the efficiency of the minting requests, they're currently split by unique user addresses but optimally you'd concatenate multiple token arrays with different users into a single batch
* Introduce types for the mint arrays etc.

## License

Not sure yet.