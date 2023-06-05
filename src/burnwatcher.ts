import Moralis from "moralis";
import { EvmNftTransfer, EvmAddress } from "@moralisweb3/common-evm-utils";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import { getCurrentBlock, convertEvmNftTransferToBurnList, convertIMXTransferToBurn, convertIMXTransfersToBurns } from "./utils";
import { NftTransfer, burn } from "./type";
import { ImmutableX, Config, ImmutableXConfiguration, Transfer } from "@imtbl/core-sdk";
import { ListTransfersResponse } from "@imtbl/core-sdk";
import logger from "./logger";
import { getTransfersFromContract } from "./moralis";
import { burnAddress, originChainId, originCollectionAddress } from "./config";
dotenv.config();

//Retrieves the burn transfers from a certain block range and curses through them recursively
async function getEVMBurnTransfersByBlockRange(
  burnTransfers: NftTransfer[] = [],
  chainId: number,
  collectionAddress: string,
  burnAddress: string,
  fromBlock: number,
  toBlock: number,
  cursor?: string,
  index: number = 0,
  usedtokenids: number[] = []
): Promise<NftTransfer[]> {
  const todayDate = new Date();
  const currentblockresponse = await Moralis.EvmApi.block.getDateToBlock({
    date: todayDate.toString(),
    chain: chainId,
  });
  const currentblock = currentblockresponse.result.block;

  //Check to make sure the user has put a block number that's not higher than the current block
  if (toBlock > currentblock) {
    logger.info("Trying to get a block higher than the current block, setting to current block");
    toBlock = currentblock;
  }

  //Check to make sure the fromBlock is less than the toBlock
  if (fromBlock > toBlock) {
    logger.info("Trying to get a fromBlock higher than the toBlock, setting fromBlock to 1");
    fromBlock = 1;
  }

  //Moralis doesn't allow requests for more than 1m blocks at a time
  if (toBlock - fromBlock > 1000000) {
    toBlock = fromBlock + 1000000;
    logger.info("Moralis API doesn't allow more than 1 million blocks in a request, setting toBlock to " + toBlock);
  }

  try {
    const response = await getTransfersFromContract(collectionAddress, chainId, fromBlock, toBlock, cursor);
    //Optional timeout if you get rate limited
    //await new Promise(f => setTimeout(f, 500));

    //Iterate through and sort out the burn transfers and push them into an array, make sure no duplicate tokenIDs are loaded
    for (const element of response.transfers) {
      if (element.toAddress == burnAddress.toLowerCase() && !usedtokenids.includes(element.tokenId)) {
        burnTransfers.push(element);
        usedtokenids.push(element.tokenId);
      }
    }

    //Check if there's additional pages and cursor through them
    //If index is included, it's because you want to limit the requests while testing
    //if (response.pagination && index < 5) {
    if (response.cursor != null) {
      logger.info("Cursing through page " + (index + 1) + " of transfers in block range " + fromBlock + "-" + toBlock + "...");
      index++;
      return await getEVMBurnTransfersByBlockRange(
        burnTransfers,
        chainId,
        collectionAddress,
        burnAddress,
        fromBlock,
        toBlock,
        response.cursor,
        index,
        usedtokenids
      );
    }

    logger.info("Found " + burnTransfers.length + " burn transfer(s) in block range");
    return burnTransfers;
  } catch (err) {
    logger.error(err);
    logger.warn("Errored out, retrying in 1 second...");
    await new Promise((f) => setTimeout(f, 1000));
    return await getEVMBurnTransfersByBlockRange(
      burnTransfers,
      chainId,
      collectionAddress,
      burnAddress,
      fromBlock,
      toBlock,
      cursor,
      index,
      usedtokenids
    );
  }
}

//Backfills burn transfers into the DB in the range defined at the block interval also defined, this is typically used for catching up rather than active monitoring
async function backFillEVMBurnTransfers(
  prisma: PrismaClient,
  chainId: number,
  collectionAddress: string,
  burnAddress: string,
  fromBlock: number,
  toBlock: number,
  blockinterval: number
): Promise<boolean> {
  try {
    if (toBlock - fromBlock < blockinterval) {
      logger.warn("Block interval is larger than the block range, setting block interval to block range");
      blockinterval = toBlock - fromBlock;
    }

    const backfills: number = (toBlock - fromBlock) / blockinterval;
    logger.info("Batches of blocks to backfill: " + backfills);

    let indexblock = fromBlock;

    while (indexblock < toBlock) {
      //If you're at the end, make sure you don't go past toBlock
      if (indexblock + blockinterval > toBlock) {
        blockinterval = toBlock - indexblock;
      }
      logger.info(
        "Getting blocks in block range " + indexblock + "-" + (indexblock + blockinterval) + " for collection address " + collectionAddress
      );
      const burnTransfers = await getEVMBurnTransfersByBlockRange(
        [],
        chainId,
        collectionAddress,
        burnAddress,
        indexblock,
        indexblock + blockinterval
      );
      const convertedBurnTransfers = convertEvmNftTransferToBurnList(burnTransfers);

      if (convertedBurnTransfers.length > 0) {
        logger.info(convertedBurnTransfers);
      }

      if (burnTransfers.length > 0) {
        await loadBurnTransfers(prisma, convertedBurnTransfers);
      }
      indexblock += blockinterval;
    }
    logger.info("Done backfilling burn transfers in block range " + fromBlock + "-" + toBlock + " for collection address " + collectionAddress);
    return true;
  } catch (error) {
    logger.error("Error backfilling burn transfers: ", error);
    return false;
  }
}

//Monitors looking forward from the last polled block at a specified interval
async function monitorEVMBurnTransfers(
  prisma: PrismaClient,
  chainId: number,
  collectionAddress: string,
  burnAddress: string,
  last_polled_block: number,
  block_polling_interval: number
) {
  try {
    const currentblock = await getCurrentBlock(chainId);

    if (currentblock - last_polled_block >= block_polling_interval) {
      logger.info(
        "Current block " +
          currentblock +
          " exceeds the last polled block " +
          last_polled_block +
          " by the block polling interval " +
          block_polling_interval +
          ", backfilling..."
      );
      await backFillEVMBurnTransfers(prisma, chainId, collectionAddress, burnAddress, last_polled_block, currentblock, block_polling_interval);
      monitorEVMBurnTransfers(prisma, chainId, collectionAddress, burnAddress, currentblock, block_polling_interval);
    } else {
      logger.info(
        "Current block " +
          currentblock +
          " does not exceed the last polled block " +
          last_polled_block +
          " by the block polling interval " +
          block_polling_interval
      );
      //Delay before checking again
      await new Promise((f) => setTimeout(f, 1000));
      monitorEVMBurnTransfers(prisma, chainId, collectionAddress, burnAddress, last_polled_block, block_polling_interval);
    }
  } catch (err) {
    logger.error(err);
    console.warn("Errored out, retrying in 1 second...");
    await new Promise((f) => setTimeout(f, 1000));
    monitorEVMBurnTransfers(prisma, chainId, collectionAddress, burnAddress, last_polled_block, block_polling_interval);
  }
}

async function getIMXBurnTransfers(
  client: ImmutableX,
  collectionAddress: string,
  receiver: string,
  cursor?: string,
  maxTimestamp?: Date,
  minTimestamp?: Date
): Promise<ListTransfersResponse> {
  console.info("Getting IMX burn transfers, maxTimestamp: " + maxTimestamp?.toISOString() + ", minTimestamp: " + minTimestamp?.toISOString());
  const transfers = await client.listTransfers({
    direction: "asc",
    tokenAddress: collectionAddress,
    receiver: receiver,
    pageSize: 200,
    maxTimestamp: maxTimestamp?.toISOString(),
    minTimestamp: minTimestamp?.toISOString(),
    cursor: cursor,
  });
  return transfers;
}

async function monitorIMXBurnTransfers(
  client: ImmutableX,
  prisma: PrismaClient,
  collectionAddress: string,
  receiver: string,
  maxDelay?: number,
  minDelay?: number
) {
  let transfersArray: Transfer[] = [];
  let burns: burn[] = [];
  let oldCursor = "";
  let iterations: number = 0;

  //If there's a delay then we need to create a max timestamp
  let maxTimestamp = maxDelay ? new Date(Date.now() - maxDelay) : undefined;
  let minTimestamp = minDelay ? new Date(Date.now() - minDelay) : undefined;

  //Create the initial request
  let transfers = await getIMXBurnTransfers(client, collectionAddress, receiver, undefined, maxTimestamp, minTimestamp);

  while (true) {
    //If there's no cursor left then we've reached the end and need to continue polling the endpoint with the old cursor until something new arrives
    if (!transfers.cursor) {
      logger.info("No cursor...");
      //logger.info("Old cursor: " + oldCursor);
      if (!oldCursor) {
        logger.info("No old cursor...");
        let maxTimestamp = maxDelay ? new Date(Date.now() - maxDelay) : undefined;
        let minTimestamp = minDelay ? new Date(Date.now() - minDelay) : undefined;
        transfers = await getIMXBurnTransfers(client, collectionAddress, receiver, undefined, maxTimestamp, minTimestamp);
      } else {
        //If there's an old cursor then we need to continue polling with that
        logger.info("Old cursor, we're going to continue polling with that...");
        let maxTimestamp = maxDelay ? new Date(Date.now() - maxDelay) : undefined;
        transfers = await getIMXBurnTransfers(client, collectionAddress, receiver, oldCursor, maxTimestamp);
      }
    }
    //If there's a cursor then we need to add to our array and continue polling
    else {
      //logger.info("Cursor: " + transfers.cursor);
      logger.info("Cursor... adding to array and continuing to crawl...");
      transfersArray.push(...transfers.result);
      //logger.info(transfers.result);
      let maxTimestamp = maxDelay ? new Date(Date.now() - maxDelay) : undefined;
      oldCursor = transfers.cursor;
      transfers = await getIMXBurnTransfers(client, collectionAddress, receiver, transfers.cursor, maxTimestamp);
    }

    //We need some sort of trigger to determine when we load the database, for now we're just going to load every 1000 transfers or every 10 iterations
    if (transfersArray.length > 1000 || (iterations > 10 && transfersArray.length > 0)) {
      burns = convertIMXTransfersToBurns(transfersArray, 5001);
      loadBurnTransfers(prisma, burns);
      transfersArray = [];
      burns = [];
      iterations = 0;
    }
    iterations++;

    //Delay before checking again
    await new Promise((f) => setTimeout(f, 3000));
  }
}

//Loads the burn transfers into the database
async function loadBurnTransfers(prisma: PrismaClient, burnTransfers: burn[]): Promise<boolean> {
  try {
    logger.info("Loading " + burnTransfers.length + " burn transfers into the database");
    for (const element of burnTransfers) {
      try {
        const token = await prisma.token.create({
          data: {
            burned: true,
            minted: false,
            originChain: element.chain,
            blockNumber: element.blockNumber || null,
            burnTimestamp: element.timestamp,
            burnEVMTransactionHash: element.transactionHash || null,
            burnStarkTransaction_id: element.transaction_id || null,
            originTokenAddress: element.tokenAddress,
            originTokenId: element.tokenId,
            fromOriginAddress: element.fromAddress,
            toOriginAddress: element.toAddress,
          },
        });
      } catch (error) {
        logger.error("Error loading burn transfer into the database: ", error);
      }
    }
    prisma.$disconnect;
    return true;
  } catch (error) {
    logger.error("Error loading burn transfers into the database: ", error);
    return false;
  }
}

//Starts a watcher instance
async function watcher(chainId: number, collectionAddress: string, burnAddress: string, pollingInterval: number) {
  logger.info("Starting watcher...");
  const prisma = new PrismaClient();
  if (chainId === 5000 || chainId === 5001) {
    logger.info("IMX watcher on chainId: " + chainId + ", collectionAddress: " + collectionAddress + ", burnAddress: " + burnAddress);
    const config = chainId === 5000 ? Config.PRODUCTION : Config.SANDBOX;
    const client = new ImmutableX(config);
    //delayed one
    //monitorIMXBurnTransfers(client, prisma, "0x82633202e463d7a39e6c03a843f0f4e83b7e9aa3", "0x0000000000000000000000000000000000000000", 60000);
    monitorIMXBurnTransfers(client, prisma, collectionAddress, burnAddress, undefined, 60000);
  } else {
    logger.info("EVM watcher on chainId: " + chainId + ", collectionAddress: " + collectionAddress + ", burnAddress: " + burnAddress);
    await Moralis.start({
      apiKey: process.env.MORALIS_API_KEY,
    });
    const currentBlock = await getCurrentBlock(chainId);
    monitorEVMBurnTransfers(prisma, chainId, collectionAddress, burnAddress, currentBlock, pollingInterval);
  }
}

//watcher(originChainId, originCollectionAddress, burnAddress, EVMBlockPollingInterval);

//Polygon mainnet
//watcher(137, "0x0551b1C0B01928Ab22A565b58427FF0176De883C", "0x0000000000000000000000000000000000000000");

//IMX testnet
//watcher(5001, "0x82633202e463d7a39e6c03a843f0f4e83b7e9aa3", "0x0000000000000000000000000000000000000000");

//Test for backfilling
async function main() {
  const prisma = new PrismaClient();
  await Moralis.start({
    apiKey: process.env.MORALIS_API_KEY,
  });
  const currentBlock = await getCurrentBlock(originChainId);
  backFillEVMBurnTransfers(prisma, originChainId, originCollectionAddress, burnAddress, 39985828, currentBlock, 100000);
}
main();

//Test monitorIMXBurnTransfers
// async function main() {
//   const config = Config.SANDBOX;
//   const client = new ImmutableX(config);
//   const prisma = new PrismaClient();
//   //monitorIMXBurnTransfers(client, prisma, "0xc1f1da534e227489d617cd742481fd5a23f6a003", "0x0000000000000000000000000000000000000000", fiveMinute, new Date("2023-04-13T06:06:35.478763Z"));
//   //const transfers = await getIMXBurnTransfers(client, "0xc1f1da534e227489d617cd742481fd5a23f6a003", "0x0000000000000000000000000000000000000000");
//   //logger.info(transfers);
//   monitorIMXBurnTransfers(client, prisma, "0x82633202e463d7a39e6c03a843f0f4e83b7e9aa3", "0x0000000000000000000000000000000000000000", 60000);
//   monitorIMXBurnTransfers(client, prisma, "0x82633202e463d7a39e6c03a843f0f4e83b7e9aa3", "0x0000000000000000000000000000000000000000", 60000, 120000);
// }
// main();

//Test for getEVMBurnTransfersByBlockRange
// async function main() {
//   //Create the Moralis client
//   await Moralis.start({
//     apiKey: process.env.MORALIS_API_KEY,
//   });
//   const currentBlock = await getCurrentBlock(137);
//   const result = await getEVMBurnTransfersByBlockRange(
//     [],
//     137,
//     "0x0551b1C0B01928Ab22A565b58427FF0176De883C",
//     "0x0000000000000000000000000000000000000000",
//     40008245,
//     currentBlock
//   );
//   // console.log(result);
//   // for (const element of result) {
//   //   console.log(element.tokenAddress);
//   // }
// }
// main();
