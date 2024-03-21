import { config } from "@imtbl/sdk";

//Basic settings

//Supported chain ids are in the blockchain.ts file
export const originChain: number = 80001;

//Destination chaind ID, have a look in blockchain.ts but IMX mainnet is 5000, sandbox is 5001
export const destinationChain: number = 13472;

//Collection address that items are burnt from
export const originCollectionAddress: string = "0x04C707b1E99c301BF86eF9940b3AeF7090E52D4D";

//Collection address that migrated tokens are minted to
export const destinationCollectionAddress: string = "0xa8d248fa82e097df14b3bcda5515af97d4a62365";

//https://api.immutable.com for mainnet, https://api.sandbox.immutable.com for sandbox
export const IMX_API_URL: string = "https://api.sandbox.immutable.com";

//Environment used for the minting API configuration, config.Environment.MAINNET for mainnet, config.Environment.SANDBOX for sandbox
export const environment = config.Environment.SANDBOX;

//Address of the minting wallet for the Immutable minting API on sandbox
export const mintingAPIAddressSandbox: string = "0x9CcFbBaF5509B1a03826447EaFf9a0d1051Ad0CF";

//Address of the minting wallet for the Immutable minting API on mainnet
export const mintingAPIAddressMainnet: string = "0xbb7ee21AAaF65a1ba9B05dEe234c5603C498939E";

//General settings

//Address to look for transfers to which are considered a burn
export const burnAddress: string = "0x000000000000000000000000000000000000dead";

//Enable wallet address mapping, remember that the DB table for wallet addresses is used and needs to exist.
export const addressMappingEnabled: boolean = false;

//Token ID offset, this number is added to the original token ID to get the new token ID
export const tokenIDOffset: number = 0;

//Enable logging to file
export const enableFileLogging: boolean = true;

//IMX settings

//CID for the blueprint on IMX mints
export const IPFS_CID: string = "bafybeihj3uuw24fioheuxkpupgnnxx44vdezzmo5fr7m6dv3dfjgawvcwy";

//Amount of tokens to mint in each request
export const IMXMintingBatchSize: number = 200;

//Delay in (ms) between each minting request
export const IMXMintingBatchDelay: number = 0;

//Delay in (ms) between each minting request
export const IMXMintingRequestDelay: number = 5000;

//EVM settings

//ABI for the minting contract on the EVM side
export const contractABI: string = JSON.parse(
  '[{ "inputs": [], "stateMutability": "nonpayable", "type": "constructor" }, { "anonymous": false, "inputs": [ { "indexed": true, "internalType": "address", "name": "owner", "type": "address" }, { "indexed": true, "internalType": "address", "name": "approved", "type": "address" }, { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" } ], "name": "Approval", "type": "event" }, { "anonymous": false, "inputs": [ { "indexed": true, "internalType": "address", "name": "owner", "type": "address" }, { "indexed": true, "internalType": "address", "name": "operator", "type": "address" }, { "indexed": false, "internalType": "bool", "name": "approved", "type": "bool" } ], "name": "ApprovalForAll", "type": "event" }, { "anonymous": false, "inputs": [ { "indexed": true, "internalType": "address", "name": "previousOwner", "type": "address" }, { "indexed": true, "internalType": "address", "name": "newOwner", "type": "address" } ], "name": "OwnershipTransferred", "type": "event" }, { "anonymous": false, "inputs": [ { "indexed": false, "internalType": "address", "name": "account", "type": "address" } ], "name": "Paused", "type": "event" }, { "anonymous": false, "inputs": [ { "indexed": true, "internalType": "address", "name": "from", "type": "address" }, { "indexed": true, "internalType": "address", "name": "to", "type": "address" }, { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" } ], "name": "Transfer", "type": "event" }, { "anonymous": false, "inputs": [ { "indexed": false, "internalType": "address", "name": "account", "type": "address" } ], "name": "Unpaused", "type": "event" }, { "inputs": [ { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "tokenId", "type": "uint256" } ], "name": "approve", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "owner", "type": "address" } ], "name": "balanceOf", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" }, { "inputs": [ { "internalType": "uint256", "name": "tokenId", "type": "uint256" } ], "name": "burn", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [ { "internalType": "uint256", "name": "tokenId", "type": "uint256" } ], "name": "getApproved", "outputs": [ { "internalType": "address", "name": "", "type": "address" } ], "stateMutability": "view", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "owner", "type": "address" }, { "internalType": "address", "name": "operator", "type": "address" } ], "name": "isApprovedForAll", "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "name", "outputs": [ { "internalType": "string", "name": "", "type": "string" } ], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "owner", "outputs": [ { "internalType": "address", "name": "", "type": "address" } ], "stateMutability": "view", "type": "function" }, { "inputs": [ { "internalType": "uint256", "name": "tokenId", "type": "uint256" } ], "name": "ownerOf", "outputs": [ { "internalType": "address", "name": "", "type": "address" } ], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "pause", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "paused", "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "renounceOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "tokenId", "type": "uint256" } ], "name": "safeMint", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "from", "type": "address" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "tokenId", "type": "uint256" } ], "name": "safeTransferFrom", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "from", "type": "address" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "tokenId", "type": "uint256" }, { "internalType": "bytes", "name": "data", "type": "bytes" } ], "name": "safeTransferFrom", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "operator", "type": "address" }, { "internalType": "bool", "name": "approved", "type": "bool" } ], "name": "setApprovalForAll", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [ { "internalType": "bytes4", "name": "interfaceId", "type": "bytes4" } ], "name": "supportsInterface", "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "symbol", "outputs": [ { "internalType": "string", "name": "", "type": "string" } ], "stateMutability": "view", "type": "function" }, { "inputs": [ { "internalType": "uint256", "name": "tokenId", "type": "uint256" } ], "name": "tokenURI", "outputs": [ { "internalType": "string", "name": "", "type": "string" } ], "stateMutability": "view", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "from", "type": "address" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "tokenId", "type": "uint256" } ], "name": "transferFrom", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "newOwner", "type": "address" } ], "name": "transferOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "unpause", "outputs": [], "stateMutability": "nonpayable", "type": "function" }]'
);

//Time to wait between polling for transaction confirmation during mints on EVM chains, in milliseconds
export const transactionConfirmationPollingDelay: number = 3000;

//The offset at which blocks are polled for on EVM chains in units of blocks. 5 means poll when the watcher is 5 blocks behind.
export const EVMBlockPollingInterval: number = 5;

//Delays between reading from the DB and attempting to mint on EVM chains, in milliseconds
export const EVMMintingRequestDelay: number = 1000;

//Gas price for mints on EVM chains, in gwei
export const EVMMintingGasPrice: number = 280;

//Gas limit for mints on EVM chains
export const EVMMintingGasLimit: number = 146000;
