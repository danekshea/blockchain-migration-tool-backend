import { ImmutableX, Transfer } from '@imtbl/core-sdk';
import { ethers, Wallet } from 'ethers';
import Moralis from "moralis";
import { Token, PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv';
import { EvmNftTransfer, GetTransactionRequest } from '@moralisweb3/common-evm-utils';
import { NftTransfer, burn, chainDetails } from './type';
import logger from './logger';
dotenv.config();

export async function getSigner(network: string, privateKey: string):Promise<Wallet> {
  if (!privateKey) throw new Error('Private key is required.');

  const providerUrl = network === 'mainnet' ? process.env.MAINNET_ETH_PROVIDER_URL : process.env.SANDBOX_ETH_PROVIDER_URL;

  if (!providerUrl) throw new Error('Provider URL not found.');

  const provider = new ethers.providers.JsonRpcProvider(providerUrl);
  const signer = new Wallet(privateKey).connect(provider);
  return signer;
}

//Gets the current block
export async function getCurrentBlock(chainId: number): Promise<number> {
  try {
    const todayDate = new Date();
    const currentBlockResponse = await Moralis.EvmApi.block.getDateToBlock({
      date: todayDate.toString(),
      chain: chainId,
    });
    const currentBlock = currentBlockResponse.result.block;
    return currentBlock;
  } catch (error:any) {
    logger.error('Failed to fetch the current block:', error.message);
    throw new Error('Failed to fetch the current block');
  }
}

//Check if the user is registered onchain
export async function isIMXRegistered(imxclient: ImmutableX, ethaddress: string): Promise<boolean> {
  try {
    await imxclient.getUser(ethaddress);
    return true;
  }
  catch (err) {
    logger.error(err);
    return false;
  }
}

async function findDBMinMax(prisma: PrismaClient):Promise<[number, number]> {
  try {
    const results = await prisma.token.findMany({
      where: {
        originBlockNumber: {
          not: null,
        },
      },
      orderBy: [
        {
          originBlockNumber: 'desc',
        },
      ],
    });

    if (results.length === 0) {
      throw new Error('No records with non-null blockNumbers were found');
    }

    return [results[0].originBlockNumber as number, results[results.length - 1].originBlockNumber as number];
  } catch (error:any) {
    logger.error('Failed to fetch block numbers:', error.message);
    throw new Error('Failed to fetch block numbers');
  }
}

export function convertEvmNftTransferToBurn(evmt: NftTransfer): burn {
  return {
    chain: evmt.chainId, 
    timestamp: evmt.blockTimestamp,
    blockNumber: evmt.blockNumber,
    transactionHash: evmt.transactionHash,
    tokenAddress: evmt.tokenAddress, 
    tokenId: evmt.tokenId,
    fromAddress: evmt.fromAddress, 
    toAddress: evmt.toAddress, 
  };
}

export function convertEvmNftTransferToBurnList(evmtList: NftTransfer[]): burn[] {
  return evmtList.map(convertEvmNftTransferToBurn);
}

export function convertIMXTransferToBurn(transfer: Transfer, chainId:number): burn {
  if(transfer.token.data.token_address == null || transfer.token.data.token_id == null) throw new Error("Token address or token id is null");
  return {
    chain: chainId, // Assuming Ethereum as the chain; update accordingly
    blockNumber: undefined, // Assuming no blockNumber available; update accordingly
    timestamp: transfer.timestamp ? new Date(transfer.timestamp) : new Date(),
    transactionHash: undefined, // Assuming no transactionHash available; update accordingly
    transaction_id: transfer.transaction_id,
    tokenAddress: transfer.token.data.token_address,
    tokenId: parseInt(transfer.token.data.token_id),
    fromAddress: transfer.user,
    toAddress: transfer.receiver
  };
}

export function convertIMXTransfersToBurns(transfers: Transfer[], chainId: number): burn[] {
  return transfers.map(transfer => convertIMXTransferToBurn(transfer, chainId));
}

export async function getTokensFromDB(prisma: PrismaClient): Promise<Token[]> {
  try {
    const burnTransfers = await prisma.token.findMany({
      where: { minted: false },
    });
    return burnTransfers;
  } catch (error:any) {
    logger.error('Failed to fetch burn transfers from the database:', error.message);
    return [];
  }
}

export async function setEVMTokenToMinted(prisma: PrismaClient,  destinationTokenId:number, mintEVMTransactionHash:string): Promise<boolean> {
  try {
    await prisma.token.update({
      where: { destinationTokenId: destinationTokenId },
      data: { minted: true,
              mintEVMTransactionHash: mintEVMTransactionHash,
      },
    });
    return true;
  } catch (error:any) {
    logger.error('Failed to set token with destinationTokenId: ' + destinationTokenId + " to minted:", error.message);
    return false;
  }
}

export async function setStarkTokenToMinted(prisma: PrismaClient, destinationTokenId:number, mintStarkTransaction_id:number, toDestinationAddress:string): Promise<boolean> {
  try {
    await prisma.token.update({
      where: { originTokenId: destinationTokenId },
      data: { minted: true,
              mintStarkTransaction_id: mintStarkTransaction_id,
             },
    });
    return true;
  } catch (error:any) {
    logger.error('Failed to set burn transfer for ' + destinationTokenId + " to minted:", error.message);
    return false;
  }
}

//The Moralis API getting a transaction should, according to them, be at least 1 confirmation
export async function transactionConfirmation(txhash:string, chainId:number, pollingDelay:number): Promise<boolean> {
  try {
    const txrequest:GetTransactionRequest = {transactionHash: txhash, chain: chainId}
    let tx = await Moralis.EvmApi.transaction.getTransaction(txrequest);
    while (tx === null || tx.result === null) {
      logger.info("Waiting for transaction " + txrequest.transactionHash + " to be confirmed...");
      await new Promise((r) => setTimeout(r, pollingDelay));
      tx = await Moralis.EvmApi.transaction.getTransaction(txrequest);
    }
    return true;
  } catch (error:any) {
    logger.error("Failed to fetch transaction details:", error.message);
    throw new Error("Failed to fetch transaction details");
  }
}

//Key value pairs for the different chains, contains chain details
export const chains: { [key: number]: chainDetails } = {
  1: {name: "Ethereum", shortName: "eth"},
  5: {name: "Goerli", shortName: "goerli"},
  25: {name: "Cronos", shortName: "cro"},
  56: {name: "BNB Chain", shortName: "bnb"},
  97: {name: "BNB Chain Testnet", shortName: "bsc testnet"},
  137: {name: "Polygon", shortName: "polygon"},
  250: {name: "Fantom", shortName: "fantom"},
  5000: {name: "ImmutableX", shortName: "imx"},
  5001: {name: "ImmutableX Testnet", shortName: "imx testnet"},
  42161: {name: "Arbitrum", shortName: "arbitrum"},
  43114: {name: "Avalanche", shortName: "avalanche"},
  //polygon testnet
  80001: {name: "Mumbai", shortName: "mumbai"},
  11155111: {name: "Sepolia", shortName: "sepolia"},
}









