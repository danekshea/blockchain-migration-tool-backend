import { ImmutableX, Transfer } from "@imtbl/core-sdk";
import { ethers, Wallet } from "ethers";
import Moralis from "moralis";
import { Token, PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import { EvmNftTransfer, GetTransactionRequest } from "@moralisweb3/common-evm-utils";
import { IMXCSVData, NFTMetadata, NftTransfer, burn, chainDetails } from "./types";
import logger from "./logger";
import * as fs from "fs";
import { loadBurnTransfers } from "./burnwatcher";
import { get } from "http";
import serverConfig, { environment } from "./config";
import { blockchainData, config as sdkConfig } from "@imtbl/sdk";
const csv = require("csv-parser");
dotenv.config();

export async function getSigner(network: string, privateKey: string): Promise<Wallet> {
  if (!privateKey) throw new Error("Private key is required.");

  const providerUrl = network === "mainnet" ? process.env.MAINNET_ETH_PROVIDER_URL : process.env.SANDBOX_ETH_PROVIDER_URL;

  if (!providerUrl) throw new Error("Provider URL not found.");

  const provider = new ethers.JsonRpcProvider(providerUrl);
  const signer = new Wallet(privateKey).connect(provider);
  return signer;
}

//Gets the current block
export async function getCurrentBlock(chain: number): Promise<number> {
  try {
    const todayDate = new Date();
    const currentBlockResponse = await Moralis.EvmApi.block.getDateToBlock({
      date: todayDate.toString(),
      chain: chain,
    });
    const currentBlock = currentBlockResponse.result.block;
    return currentBlock;
  } catch (error: any) {
    logger.error("Failed to fetch the current block:", error.message);
    throw new Error("Failed to fetch the current block");
  }
}

export async function convertTokensToRequests(tokens: Token[]) {
  const groupedByAddress: { [address: string]: number[] } = {};

  tokens.forEach((token) => {
    // Ensure the token has a destination address before proceeding.
    if (token.toDestinationWalletAddress) {
      // If the address is not yet a key in groupedByAddress, add it with the token ID.
      if (!groupedByAddress[token.toDestinationWalletAddress]) {
        groupedByAddress[token.toDestinationWalletAddress] = [];
      }
      // Push the token ID to the array of IDs for this address.
      groupedByAddress[token.toDestinationWalletAddress].push(token.destinationTokenId);
    }
  });

  // Convert the object to the desired array format.
  const requests = Object.keys(groupedByAddress).map((address) => ({
    to: address,
    tokenIds: groupedByAddress[address],
  }));

  return requests;
}

export function convertEvmNftTransferToBurn(evmt: NftTransfer): burn {
  return {
    chain: evmt.chain,
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

export const mintByMintingAPI = async (contractAddress: string, walletAddress: string, uuid: string, metadata: NFTMetadata | null): Promise<string> => {
  const config: blockchainData.BlockchainDataModuleConfiguration = {
    baseConfig: new sdkConfig.ImmutableConfiguration({
      environment: environment,
    }),
    overrides: {
      basePath: serverConfig[environment].API_URL,
      headers: {
        "x-immutable-api-key": serverConfig[environment].HUB_API_KEY!,
        "x-api-key": serverConfig[environment].RPS_API_KEY!,
      },
    },
  };

  const client = new blockchainData.BlockchainData(config);

  const asset: any = {
    owner_address: walletAddress,
    reference_id: uuid,
    token_id: null,
  };

  if (metadata !== null) {
    asset.metadata = metadata;
  }

  try {
    const response = await client.createMintRequest({
      chainName: serverConfig[environment].chainName,
      contractAddress,
      createMintRequestRequest: {
        assets: [asset],
      },
    });

    logger.info(`Mint request sent with UUID: ${uuid}`);
    logger.debug("Mint request response:", JSON.stringify(response, null, 2));
    console.log(response);

    return uuid;
  } catch (error) {
    logger.error("Error sending mint request:", error);
    console.log(error);
    throw error;
  }
};

export async function getTokensFromDB(prisma: PrismaClient): Promise<Token[]> {
  try {
    const burnTransfers = await prisma.token.findMany({
      where: { minted: false },
    });
    return burnTransfers;
  } catch (error: any) {
    logger.error("Failed to fetch burn transfers from the database:", error.message);
    return [];
  }
}

export async function setEVMTokenToMinted(prisma: PrismaClient, destinationTokenId: number, mintEVMTransactionHash: string): Promise<boolean> {
  try {
    await prisma.token.update({
      where: { destinationTokenId: destinationTokenId },
      data: { minted: true, mintEVMTransactionHash: mintEVMTransactionHash },
    });
    return true;
  } catch (error: any) {
    logger.error("Failed to set token with destinationTokenId: " + destinationTokenId + " to minted:", error.message);
    return false;
  }
}

// Check to make sure that a transaction is confirmed
export async function transactionConfirmation(txhash: string, chain: number, pollingDelay: number): Promise<boolean> {
  try {
    const txrequest: GetTransactionRequest = { transactionHash: txhash, chain: chain };
    let tx = await Moralis.EvmApi.transaction.getTransaction(txrequest);
    while (tx === null || tx.result === null || tx.result.receiptStatus !== 1) {
      if (tx !== null && tx.result !== null && tx.result.receiptStatus === 0) {
        logger.error("Transaction " + txrequest.transactionHash + " has failed.");
        throw new Error("Transaction has failed.");
      }

      logger.info("Waiting for transaction " + txrequest.transactionHash + " to be confirmed...");
      await new Promise((r) => setTimeout(r, pollingDelay));
      tx = await Moralis.EvmApi.transaction.getTransaction(txrequest);
    }
    return true;
  } catch (error: any) {
    logger.error("Failed to fetch transaction details:", error.message);
    throw new Error("Failed to fetch transaction details");
  }
}

export function parseCSV(file: string): Promise<IMXCSVData[]> {
  return new Promise((resolve, reject) => {
    let data: IMXCSVData[] = [];
    fs.createReadStream(file)
      .pipe(csv())
      .on("data", (row: any) => {
        data.push({
          ContractAddress: row["Contract Address"],
          ID: row["ID"],
          OwnerAddress: row["Owner Address"],
          Status: row["Status"],
          URI: row["URI"],
          Name: row["Name"],
          Description: row["Description"],
          ImageURL: row["Image URL"],
          LastMetadataRefreshTime: row["Last Metadata Refresh Time"],
          LastMetadataRefreshStatusCode: row["Last Metadata Refresh Status Code"],
          LastUpdateTransactionHash: row["Last Update Transaction Hash"],
          LastUpdateBlockNumber: row["Last Update Block Number"],
          TokenID: row["Token ID"],
          Blueprint: row["Blueprint"],
        });
      })
      .on("end", () => {
        resolve(data);
      })
      .on("error", reject);
  });
}

export function transformToBurn(data: IMXCSVData[]): burn[] {
  return data.map((item) => ({
    chain: 5000, // default value, modify as needed
    blockNumber: undefined,
    timestamp: new Date(), // default value, modify as needed
    transactionHash: undefined,
    transaction_id: undefined,
    tokenAddress: item.ContractAddress,
    tokenId: parseInt(item.TokenID),
    fromAddress: item.OwnerAddress, // default value, modify as needed
    toAddress: "0x00000", // default value, modify as needed
  }));
}

//Key value pairs for the different chains, contains chain details
export const chains: { [key: number]: chainDetails } = {
  1: { name: "Ethereum", shortName: "eth" },
  5: { name: "Goerli", shortName: "goerli" },
  10: { name: "Optimism", shortName: "optimism" },
  25: { name: "Cronos", shortName: "cro" },
  56: { name: "BNB Chain", shortName: "bnb" },
  97: { name: "BNB Chain Testnet", shortName: "bsc testnet" },
  137: { name: "Polygon", shortName: "polygon" },
  250: { name: "Fantom", shortName: "fantom" },
  8453: { name: "Base", shortName: "base" },
  13473: { name: "Immutable zkEVM Testnet", shortName: "imtbl-zkevm-testnet" },
  13371: { name: "Immutable zkEVM Mainnet", shortName: "imtbl-zkevm-mainnet" },
  42161: { name: "Arbitrum", shortName: "arbitrum" },
  43114: { name: "Avalanche", shortName: "avalanche" },
  //polygon testnet
  80002: { name: "Amoy", shortName: "amoy" },
  11155111: { name: "Sepolia", shortName: "sepolia" },
};

// (async () => {
//   await Moralis.start({
//     apiKey: process.env.MORALIS_API_KEY,
//   });
//   console.log(await getCurrentBlock(80002));
// })();
