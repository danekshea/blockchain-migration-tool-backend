//Supported chain ids are in the blockchain.ts file
export const originChainId:number = 137;

//Destination chaind ID, have a look in blockchain.ts but IMX mainnet is 5000, sandbox is 5001
export const destinationChainId:number = 5001;

//Collection address that items are burnt from
export const originCollectionAddress:string = '0x0551b1C0B01928Ab22A565b58427FF0176De883C';

//Collection address that migrated tokens are minted to
export const destinationCollectionAddress:string = '0x82633202e463d7a39e6c03a843f0f4e83b7e9aa3';

//CID for the blueprint on IMX mints
export const IPFS_CID:string = "bafybeihj3uuw24fioheuxkpupgnnxx44vdezzmo5fr7m6dv3dfjgawvcwy";

//Amount of tokens to mint in each request
export const mintingBatchSize:number = 200;

//Delay in (ms) between each minting request
export const mintingBatchDelay:number = 0;

//Delay in (ms) between each minting request
export const mintingRequestDelay:number = 5000;

//Address to look for transfers to which are considered a burn
export const burnAddress:string = "0x0000000000000000000000000000000000000000";