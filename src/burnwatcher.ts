import Moralis from "moralis";
import { EvmNftTransfer, EvmAddress } from '@moralisweb3/common-evm-utils';
import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv';
import { getCurrentBlock } from "./utils";
dotenv.config();

//Retrieves the burn transfers from a certain block range and curses through them recursively
async function getBurnTransfersByBlockRange(burnTransfers: EvmNftTransfer[] = [], fromBlock: number, toBlock: number, cursor?: string, index: number = 0, usedtokenids: string[] = []): Promise<EvmNftTransfer[]> {
  const todayDate = new Date();
  const currentblockresponse = await Moralis.EvmApi.block.getDateToBlock({
    date: todayDate.toString(),
    chain: process.env.ORIGIN_CHAIN_ID,
  });
  const currentblock = currentblockresponse.result.block;

  //Check to make sure the user has put a block number that's not higher than the current block
  if (toBlock > currentblock) {
    console.log("Trying to get a block higher than the current block, setting to current block");
    toBlock = currentblock;
  }

  //Check to make sure the fromBlock is less than the toBlock
  if (fromBlock > toBlock) {
    console.log("Trying to get a fromBlock higher than the toBlock, setting fromBlock to 1");
    fromBlock = 1;
  }

  //Moralis doesn't allow requests for more than 1m blocks at a time
  if (toBlock - fromBlock > 1000000) {
    console.log("Moralis API doesn't allow more than 1 million blocks in a request, setting toBlock to " + fromBlock + 1000000);
    toBlock = fromBlock + 1000000;
  }


  //Get all transfers for a collection address and chain
  try {
    const response = await Moralis.EvmApi.nft.getNFTContractTransfers({
      address: process.env.ORIGIN_COLLECTION_ADDRESS!,
      chain: process.env.ORIGIN_CHAIN_ID,
      fromBlock: fromBlock,
      toBlock: toBlock,
      cursor: cursor
    });

    //console.log(response.result);

    //Optional timeout if you get rate limited
    //await new Promise(f => setTimeout(f, 500));

    //Iterate through and sort out the burn transfers and push them into an array, make sure no duplicate tokenIDs are loaded
    const burnAddress = EvmAddress.create(process.env.BURN_ADDRESS!);
    for (const element of response.result) {
      if (element.toAddress.lowercase == burnAddress.lowercase && !usedtokenids.includes(element.tokenId)) {
        burnTransfers.push(element);
        usedtokenids.push(element.tokenId);
      }
    }

    //Check if there's additional pages and cursor through them
    //If index is included, it's because you want to limit the requests while testing
    //if (response.pagination && index < 5) {
    if (response.pagination.cursor != null) {
      console.log("Cursing through page " + (index + 1) + " of transfers in block range " + fromBlock + "-" + toBlock + "...");
      console.log(response.pagination);
      index++;
      return await getBurnTransfersByBlockRange(burnTransfers, fromBlock, toBlock, response.pagination.cursor, index, usedtokenids);
    }

    console.log("Found " + burnTransfers.length + " burn transfers in block range")
    return burnTransfers;
  }
  catch (err) {
    console.log(err);
    console.log("Errored out, retrying in 1 second...");
    await new Promise(f => setTimeout(f, 1000));
    return await getBurnTransfersByBlockRange(burnTransfers, fromBlock, toBlock, cursor, index, usedtokenids);
  }

}

//Backfills burn transfers into the DB in the range defined at the block interval also defined, this is typically used for catching up rather than active monitoring
async function backFillBurnTransfers(prisma: PrismaClient, fromBlock: number, toBlock: number, blockinterval: number) {
  if ((toBlock - fromBlock) < blockinterval) {
    console.log("Block interval is larger than the block range, setting block interval to block range");
    blockinterval = toBlock - fromBlock;
  }

  const backfills: number = (toBlock - fromBlock) / blockinterval;
  console.log("Batches of blocks to backfill: " + backfills);

  let indexblock = fromBlock;

  while (indexblock < toBlock) {
    //If you're at the end, make sure you don't go past toBlock
    if (indexblock + blockinterval > toBlock) {
      blockinterval = toBlock - indexblock;
    }
    console.log("Getting blocks in block range: " + indexblock + "-" + (indexblock + blockinterval));
    const burnTransfers = await getBurnTransfersByBlockRange([], indexblock, indexblock + blockinterval);
    if (burnTransfers.length > 0) {
      await loadBurnTransfers(prisma, burnTransfers);
    }
    indexblock += blockinterval;
  }

  console.log('Done backfilling burn transfers in block range ' + fromBlock + '-' + toBlock);
}

//Loads the burn transfers into the database
async function loadBurnTransfers(prisma: PrismaClient, burnTransfers: EvmNftTransfer[]) {
  console.log("Loading " + burnTransfers.length + " burn transfers into the database");
  for (const element of burnTransfers) {
    try {
      const burn = await prisma.burn.create({
        data: {
          minted: 0,
          chain: element.chain.decimal,
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

//Monitors looking forward from the last polled block at a specified interval
async function monitorBurnTransfers(prisma: PrismaClient, last_polled_block: number, block_polling_interval: number) {
  try {
    const todayDate = new Date();
    const currentblockresponse = await Moralis.EvmApi.block.getDateToBlock({
      date: todayDate.toString(),
      chain: process.env.ORIGIN_CHAIN_ID,
    });
    const currentblock = currentblockresponse.result.block;

    if (currentblock - last_polled_block >= block_polling_interval) {
      console.log("Current block " + currentblock + " exceeds the last polled block " + last_polled_block + " by the block polling interval " + block_polling_interval + ", backfilling...");
      await backFillBurnTransfers(prisma, last_polled_block, currentblock, block_polling_interval);
      monitorBurnTransfers(prisma, currentblock, block_polling_interval);
    }
    else {
      console.log("Current block " + currentblock + " does not exceed the last polled block " + last_polled_block + " by the block polling interval " + block_polling_interval);
      //Delay before checking again
      await new Promise(f => setTimeout(f, 1000));
      monitorBurnTransfers(prisma, last_polled_block, block_polling_interval);
    }
  }
  catch (err) {
    console.log(err);
    console.log("Errored out, retrying in 1 second...");
    await new Promise(f => setTimeout(f, 1000));
    monitorBurnTransfers(prisma, last_polled_block, block_polling_interval);
  }
}

//Just monitor from the current block forward
async function main() {
  //Create the Moralis client
  await Moralis.start({
    apiKey: process.env.MORALIS_API_KEY,
  });
  
  const prisma = new PrismaClient();
  const currentBlock = await getCurrentBlock();
  monitorBurnTransfers(prisma, currentBlock, 5);
}

main();