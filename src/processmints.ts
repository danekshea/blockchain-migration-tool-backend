import Moralis from "moralis";
import { EvmChain, EvmNftTransfer, EvmAddress } from '@moralisweb3/evm-utils';
import { PrismaClient } from '@prisma/client'
import { getClient } from './utils'
import * as dotenv from 'dotenv';
dotenv.config();


async function getBurnTransfers(burnTransfers: EvmNftTransfer[] = [], cursor?: string, index: number = 0): Promise<EvmNftTransfer[]> {

  //Create the Moralis client
  await Moralis.start({
    apiKey: process.env.MORALIS_API_KEY,
  });

  //Get all transfers for a collection address and chain
  const response = await Moralis.EvmApi.nft.getNFTContractTransfers({
    address: process.env.ORIGIN_COLLECTION_ADDRESS!,
    chain: EvmChain.POLYGON,
    cursor: cursor
  });

  //await new Promise(f => setTimeout(f, 500));

  const burnAddress = EvmAddress.create(process.env.BURN_ADDRESS!);
  //Iterate through and sort out the burn transfers and push them into an array
  response.result.forEach((element, index) => {
    if (element.toAddress.lowercase == burnAddress.lowercase) {
      burnTransfers.push(element);
    }
  });

  //Check if there's additional pages and cursor through them
  if(response.pagination && index<100) {
    console.log(response.pagination.cursor)
    index++;
    return await getBurnTransfers(burnTransfers, response.pagination.cursor, index);
  }
  //console.log(burnTransfers);
  return burnTransfers;
}


async function loadBurnTransfers(burnTransfers: EvmNftTransfer[]) {

  const prisma = new PrismaClient()
  console.log("Length of burn transfers: " + burnTransfers.length);
    for(const element of burnTransfers) {
      try {
        const burn = await prisma.burn.create({
          data: {
            minted: 0,
            chain: element.chain.apiId,
            blockNumber: element.blockNumber.toString(),
            blockTimestamp: element.blockTimestamp,
            txHash: element.transactionHash,
            tokenAddress: element.tokenAddress.lowercase,
            tokenId: element.tokenId,
            fromAddress: element.fromAddress?.lowercase,
            toAddress: element.toAddress.lowercase
          },
        })
        console.log(burn);
      }
      catch (error) {
        console.log(error);
      }
    }
    prisma.$disconnect
}

async function loadUserMintArray() {
  const prisma = new PrismaClient();

  const burnTransfers = await prisma.burn.findMany({
    where: { minted: 0 },
  });

  //IPFS Blueprint CID
  const CID = 'bafybeihj3uuw24fioheuxkpupgnnxx44vdezzmo5fr7m6dv3dfjgawvcwy'

  //Token address for the collection you want to mint to
  const tokenAddress = '0x43b2a84416bdad7091148a97f4c974dc0c2f0227';

  let tokensArray: {[receiverAddress: string]: any[]} = {};
  for(const burn of burnTransfers) {
      if(burn.fromAddress) {
        if(tokensArray[burn.fromAddress]) {
          tokensArray[burn.fromAddress].push({
            id: burn.tokenId,
            blueprint: 'ipfs://' + CID + '/' + burn.tokenId
          });
        }
        else {
          tokensArray[burn.fromAddress] = [{
            id: burn.tokenId,
            blueprint: 'ipfs://' + CID + '/' + burn.tokenId
          }];
        }
      }
  }

  let mintBatchArray = [];
  let index = 0;
  for(let key in tokensArray) {
    mintBatchArray[index] = {
      users: [{
        etherKey: key.toLowerCase(),
        tokens: tokensArray[key]
      }],
      contractAddress: tokenAddress
    }
    index++; 
  }

  return mintBatchArray;
}

async function mintUserBatches(mintBatchArray: any[]) {
  
  //Mints per batch
  const batchsize = parseInt(process.env.MINTING_BATCH_SIZE!);

  //Delays between mint requests, recommendation is >200, at 200ms, we have 5 RPS
  const requestdelays = process.env.MINTING_BATCH_DELAY;

  for(const element of mintBatchArray) {
    if(element.users[0].tokens.length > batchsize) {
      //calculate the amount of batches
      const batchcount = Math.floor(element.users[0].tokens.length/batchsize);
      console.log('Batch count: ' + batchcount);

      //calculate the remainder after the batches have been created
      const remainder = element.users[0].tokens.length % batchsize;
      console.log('Remainder: ' + remainder);
      
    }
    
    console.log(element.users[0].tokens.length);
    //console.log(element[0][1]);
    //console.log(element[0][1].length);
  }
}



//   const client = await getClient('sandbox', process.env.MINTER_PRIVATE_KEY);

//   //loop for the batches
//   let tokenindex = 0;
//   let i: number = 0;
//   while(i < batchcount) { 

//     const tokens = [];

//     let j: number = 0;
//     while(j < batchsize) {
//       //Create the token array according to the batch size
//       tokens[j] = {
//         id: burnTransfers[j].tokenId,
//         blueprint: 'ipfs://' + CID + '/' + (burnTransfers[j].tokenId + j).toString(),
//       };
//       j++ 
//     }
//     tokenindex += j;

//     //Mint the batch
//     const result = await mintV2(ownerPrivateKey, tokens, tokenAddress, receiver, network);
//     console.log(result)

//     //Structure the requests so they meet rate limits
//     await new Promise(f => setTimeout(f, requestdelays));

//     i++;
//   }
//   console.log('tokenid after batches complete: ' + tokenid);
//   const tokens = [];

//   //Create the last remainder tokens which didn't get included in a batch
//   let k: number = 0;
//   while(k < remainder) {
//     tokens[k] = {
//       id: (tokenid + k).toString(),
//       blueprint: 'ipfs://' + CID + '/' + (tokenid + k).toString(),
//     };
//     k++;
//   }

//   console.log(burnTransfers);
// }

// async function main() {
//   loadBurnTransfers(await getBurnTransfers());
// }

async function main() {
   mintUserBatches(await loadUserMintArray());
}

main();