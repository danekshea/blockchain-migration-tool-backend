import Moralis from "moralis";
import { EvmChain, EvmNftTransfer, EvmAddress } from '@moralisweb3/evm-utils';
import { PrismaClient } from '@prisma/client'
import { getClient } from './utils'
import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config();


async function getBurnTransfers(burnTransfers: EvmNftTransfer[] = [], cursor?: string, index: number = 0, usedtokenids: string[] = []): Promise<EvmNftTransfer[]> {

  //console.log(process.env.MORALIS_API_KEY);

  //Create the Moralis client
  await Moralis.start({
    apiKey: process.env.MORALIS_API_KEY,
  });

  //Get all transfers for a collection address and chain
  const response = await Moralis.EvmApi.nft.getNFTContractTransfers({
    address: process.env.ORIGIN_COLLECTION_ADDRESS!,
    chain: EvmChain.BSC,
    from_block: 21739231,
    to_block: 22739231,
    cursor: cursor
  });

  //console.log(response.result);

  //Optional timeout if you get rate limited
  //await new Promise(f => setTimeout(f, 500));

  //Iterate through and sort out the burn transfers and push them into an array, make sure no duplicate tokenIDs are loaded
  const burnAddress = EvmAddress.create(process.env.BURN_ADDRESS!);
  for(const element of response.result) {
    if (element.toAddress.lowercase == burnAddress.lowercase && !usedtokenids.includes(element.tokenId)) {
      burnTransfers.push(element);
      usedtokenids.push(element.tokenId);
    }
  }

  //Check if there's additional pages and cursor through them
  //If index is included, it's because you want to limit the requests while testing
  if (response.pagination && index < 100) {
    console.log(response.pagination.cursor)
    index++;
    return await getBurnTransfers(burnTransfers, response.pagination.cursor, index, usedtokenids);
  }
  return burnTransfers;
}


async function loadBurnTransfers(burnTransfers: EvmNftTransfer[]) {

  const prisma = new PrismaClient()
  console.log("Length of burn transfers: " + burnTransfers.length);
  for (const element of burnTransfers) {
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
      //console.log(burn);
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

  let tokensArray: { [receiverAddress: string]: any[] } = {};
  for (const burn of burnTransfers) {
    if (burn.fromAddress) {
      if (tokensArray[burn.fromAddress]) {
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

  let mintArray = [];
  let index = 0;
  for (let key in tokensArray) {
    mintArray[index] = {
      users: [{
        etherKey: key.toLowerCase(),
        tokens: tokensArray[key]
      }],
      contractAddress: tokenAddress
    }
    index++;
  }
  return mintArray;
}

async function cleanMintArray(mintArray: any[]) {
  //Remove burn addresses, no need to mint to them
  for (const element of mintArray) {
    if (element.users[0].etherKey == process.env.BURN_ADDRESS) {
      mintArray.splice(mintArray.indexOf(element), 1);
    }
  }

  //Write everything to file
  fs.writeFile('src/testing/cleanedMintArray.json', JSON.stringify(mintArray, null, '\t'), (err) => {
    if (err) {
      console.error(err);
    } else {
      console.log("Cleaned mint array written to data/batchifiedMintArray.json");
    }
  });
}

async function batchMintArray(mintArray: any[]) {

  //Mints per batch
  const batchsize = parseInt(process.env.MINTING_BATCH_SIZE!);

  //Delays between mint requests, recommendation is >200, at 200ms, we have 5 RPS
  const requestdelays = process.env.MINTING_BATCH_DELAY;

  //Create the IMX client for minting
  const client = await getClient('sandbox', process.env.MINTER_PRIVATE_KEY);

  let batchifiedMintArray = [];

  for (const element of mintArray) {
    if (element.users[0].tokens.length > batchsize) {
      console.log('Batching ' + element.users[0].tokens.length + ' tokens for ' + element.users[0].etherKey);

      //calculate the amount of batches
      const batchcount = Math.floor(element.users[0].tokens.length / batchsize);
      console.log('Batch count: ' + batchcount);

      //calculate the remainder after the batches have been created
      const remainder = element.users[0].tokens.length % batchsize;
      console.log('Remainder: ' + remainder);

      //loop for the batches
      let i: number = 0;
      let tokenindex: number = 0;
      while (i < batchcount) {

        let tokens = [];

        let j: number = 0

        while (j < batchsize) {
          //Create the token array according to the batch size
          tokens[j] = {
            id: element.users[0].tokens[j + tokenindex].id,
            blueprint: 'ipfs://' + process.env.IPFS_CID + '/' + element.users[0].tokens[j + tokenindex].id,
          };
          j++
        }
        tokenindex = tokenindex + j;

        batchifiedMintArray.push({
          users: [{
            etherKey: element.users[0].etherKey,
            tokens: tokens
          }],
          contractAddress: element.contractAddress
        })
        i++;
      }

      if (remainder != 0) {
        //console.log('tokenid after batches complete: ' + tokenid);
        let tokens = [];

        //Create the last remainder tokens which didn't get included in a batch
        let k: number = 0;
        while (k < remainder) {
          tokens[k] = {
            id: element.users[0].tokens[tokenindex + k].id,
            blueprint: 'ipfs://' + process.env.IPFS_CID + '/' + (tokenindex + k).toString(),
          };
          k++;
        }
        batchifiedMintArray.push({
          users: [{
            etherKey: element.users[0].etherKey,
            tokens: tokens
          }],
          contractAddress: element.contractAddress
        })
      }
    }
    else {
      batchifiedMintArray.push(element);
    }
    console.log(element.users[0].tokens.length);
    //console.log(element[0][1]);
    //console.log(element[0][1].length);
  }
  console.log("length of original: " + mintArray.length);
  console.log("length of batchified version: " + batchifiedMintArray.length);

  //Write everything to file
  fs.writeFile('src/testing/mintArray.json', JSON.stringify(mintArray, null, '\t'), (err) => {
    if (err) {
      console.error(err);
    } else {
      console.log("Mint array written to data/mintArray.json");
    }
  });

  //Write everything to file
  fs.writeFile('src/testing/batchifiedMintArray.json', JSON.stringify(batchifiedMintArray, null, '\t'), (err) => {
    if (err) {
      console.error(err);
    } else {
      console.log("Batchified mint array written to data/batchifiedMintArray.json");
    }
  });

  return mintArray;
}





// async function main() {
//   loadBurnTransfers(await getBurnTransfers());
// }

async function main() {
  //loads the database with burns
  loadBurnTransfers(await getBurnTransfers());

  //loads the mint array which is going to be passed to the minting function
  //const result = await batchMintArray(await loadUserMintArray());
  //cleanMintArray(result);

  //batchMintArray(await loadUserMintArray());

}

main();