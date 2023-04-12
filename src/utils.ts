import { ImmutableX } from '@imtbl/core-sdk';
import { ethers, Wallet } from 'ethers';
import Moralis from "moralis";
import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv';
import { originChainId } from './config';
import { EvmNftTransfer } from '@moralisweb3/common-evm-utils';
import { burn } from './type';
dotenv.config();

export async function getSigner(network: string, privateKey: string):Promise<Wallet> {
      const provider = new ethers.providers.JsonRpcProvider((network == "mainnet") ? process.env.MAINNET_ETH_PROVIDER_URL : process.env.SANDBOX_ETH_PROVIDER_URL);
      const signer = new Wallet(privateKey).connect(provider)
      ethers.utils.verifyMessage
      return signer
}

//Gets the current block
export async function getCurrentBlock(chainId: number): Promise<number> {
  const todayDate = new Date();
  const currentblockresponse = await Moralis.EvmApi.block.getDateToBlock({
    date: todayDate.toString(),
    chain: chainId,
  });
  const currentblock = currentblockresponse.result.block;
  return currentblock;
}

//Check if the user is registered onchain
export async function isIMXRegistered(imxclient: ImmutableX, ethaddress: string): Promise<boolean> {
  try {
    const isRegistered = await imxclient.getUser(ethaddress);
    return true;
  }
  catch (err) {
    console.log(err);
    return false;
  }
}

async function findDBMinMax(prisma: PrismaClient):Promise<[number, number]> {
  const results = await prisma.burn.findMany({
    where: {
      blockNumber: {
        not: null,
      },
    },
    orderBy: [
      {
        blockNumber: 'desc',
      },
    ],
  });
    if (results.length === 0) {
      // Handle the case where no records were found
      throw new Error('No records with non-null blockNumbers were found');
    }
  
    return [results[0].blockNumber as number, results[results.length - 1].blockNumber as number];
}

export function convertEvmNftTransferToBurn(evmt: EvmNftTransfer): burn {
  return {
    chain: evmt.chain.decimal, // You might need to convert the chain value to a number if it isn't already
    timestamp: evmt.blockTimestamp,
    blockNumber: parseInt(evmt.blockNumber.toString()),
    transactionHash: evmt.transactionHash,
    tokenAddress: evmt.tokenAddress.lowercase, // You might need to convert the tokenAddress value to a string if it isn't already
    tokenId: parseInt(evmt.tokenId),
    fromAddress: evmt.fromAddress?.lowercase, // You might need to convert the fromAddress value to a string if it isn't already
    toAddress: evmt.toAddress.lowercase, // You might need to convert the toAddress value to a string if it isn't already
  };
}

export function convertEvmNftTransferToBurnList(evmtList: EvmNftTransfer[]): burn[] {
  return evmtList.map(convertEvmNftTransferToBurn);
}






