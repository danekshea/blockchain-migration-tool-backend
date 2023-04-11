import { ImmutableX } from '@imtbl/core-sdk';
import { ethers, Wallet } from 'ethers';
import Moralis from "moralis";
import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv';
import { originChainId } from './config';
dotenv.config();

export async function getSigner(network: string, privateKey: string):Promise<Wallet> {
      const provider = new ethers.providers.JsonRpcProvider((network == "mainnet") ? process.env.MAINNET_ETH_PROVIDER_URL : process.env.SANDBOX_ETH_PROVIDER_URL);
      const signer = new Wallet(privateKey).connect(provider)
      ethers.utils.verifyMessage
      return signer
}

//Gets the current block
export async function getCurrentBlock(): Promise<number> {
  const todayDate = new Date();
  const currentblockresponse = await Moralis.EvmApi.block.getDateToBlock({
    date: todayDate.toString(),
    chain: originChainId,
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

async function findDBMax(prisma: PrismaClient):Promise<[number, number]> {
  const results = await prisma.burn.findMany({
    orderBy: [
      {
        blockNumber: 'desc',
      }
    ]
  })
  return [parseInt(results[0].blockNumber), parseInt(results[results.length - 1].blockNumber)];
}