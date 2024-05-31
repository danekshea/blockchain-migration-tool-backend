import { Token, PrismaClient } from "@prisma/client";
import Moralis from "moralis";
import { ImmutableX, Config, MintTokenDataV2, MintRequest, MintUser, MintTokensResponse, IMXError } from "@imtbl/core-sdk";
import {
  IMXMintingBatchSize,
  IMXMintingBatchDelay,
  IMXMintingRequestDelay,
  IPFS_CID,
  destinationChain,
  destinationCollectionAddress,
  contractABI,
  EVMMintingGasPrice,
  EVMMintingGasLimit,
  transactionConfirmationPollingDelay,
  EVMMintingRequestDelay,
  originCollectionAddress,
  IMX_API_URL,
} from "./config";
import * as dotenv from "dotenv";
import { getDefaultProvider, Wallet } from "ethers"; // ethers v5
import { Provider, TransactionResponse } from "@ethersproject/providers"; // ethers v5
import { ERC721Client } from "@imtbl/contracts";
import { blockchainData, config as sdkConfig } from "@imtbl/sdk";
import { Types } from "@imtbl/sdk/dist/blockchain_data";
import * as fs from "fs";
import { getTokensFromDB, getSigner, isIMXRegistered, setEVMTokenToMinted, setStarkTokenToMinted, transactionConfirmation, chains, convertTokensToRequests } from "./utils";
import { ethers, Contract, Signer } from "ethers";
import { GetTransactionRequest } from "@moralisweb3/common-evm-utils";
import { MintRequestWithoutAuth, MintResult } from "./types";
import logger from "./logger";
dotenv.config();

//Mints a batch of EVM assets
async function mintEVMAssets(prisma: PrismaClient, signer: Signer, tokens: Token[], destinationChain: number, destinationCollectionAddress: string, contractABI: string, transactionConfirmationPollingDelay: number) {
  for (const token of tokens) {
    try {
      logger.info(`Attempting to mint token:\n` + JSON.stringify(token, null, 2));
      const txhash = await mintEVMAsset(signer, destinationCollectionAddress, token.toDestinationWalletAddress, token.destinationTokenId, contractABI, EVMMintingGasPrice, gasLimit);

      logger.info("Transaction hash: " + txhash);

      //Create a loop that waits for the asset to be in the Moralis API
      await transactionConfirmation(txhash, destinationChain, transactionConfirmationPollingDelay);

      logger.info("Transaction confirmed, setting token to minted in DB");

      //Set the database entry to minted
      setEVMTokenToMinted(prisma, token.destinationTokenId, txhash);
    } catch (error) {
      logger.error(`Error while minting EVM asset for destinationTokenID ${token.destinationTokenId}:`, error);
      // Optionally, you can decide how to handle the error (e.g., skip the current iteration, retry, etc.)
    }
  }
}

async function mintIMXEVMAssetsViaMintingAPI(prisma: PrismaClient, tokens: Token[], destinationChain: number, destinationCollectionAddress: string) {
  //Remember to grant the minting role to the mintingAPIAddress
  const config: blockchainData.BlockchainDataModuleConfiguration = {
    baseConfig: new sdkConfig.ImmutableConfiguration({
      environment: sdkConfig.Environment.SANDBOX,
    }),
    overrides: {
      basePath: IMX_API_URL,
      headers: {
        "x-immutable-api-key": process.env.IMMUTABLE_API_KEY!,
      },
    },
  };

  const client = new blockchainData.BlockchainData(config);
  //generate UUID for the mint request

  const response = await client.createMintRequest({
    chainName: chains[destinationChain].shortName,
    contractAddress: destinationCollectionAddress,
    createMintRequestRequest: {
      assets: [
        {
          owner_address: tokens[0].toDestinationWalletAddress,
          reference_id: "10",
          //Remove token_id line if you want to batch mint
          token_id: tokens[0].destinationTokenId.toString(),
          metadata: {
            name: "Amar Gambit",
            description: null,
            image: "https://raw.githubusercontent.com/danekshea/imx-zkevm-testing-kit/master/data/chessnfts/images/1.svg",
            animation_url: null,
            youtube_url: null,
            attributes: [
              {
                trait_type: "eco",
                value: "A00",
              },
              {
                trait_type: "FEN",
                value: "rn1qkbnr/ppp2ppp/8/3p4/5p2/6PB/PPPPP2P/RNBQK2R w KQkq - 0 5",
              },
            ],
          },
        },
      ],
    },
  });
  return response;
}

async function runIMXEVMRegularMint(prisma: PrismaClient, wallet: Wallet, destinationChain: number, destinationCollectionAddress: string, EVMMintingRequestDelay: number) {
  logger.info(`Checking for new EVM mints on chain ${destinationChain} and collection adddress ${destinationCollectionAddress}...`);
  const tokens = await getTokensFromDB(prisma);
  if (tokens.length > 0) {
    await mintIMXEVMAssetsViaMintingAPI(prisma, tokens, destinationChain, destinationCollectionAddress);
  }

  await new Promise((r) => setTimeout(r, EVMMintingRequestDelay));
  await runIMXEVMRegularMint(prisma, wallet, destinationChain, destinationCollectionAddress, EVMMintingRequestDelay);
}

async function runEVMRegularMint(
  prisma: PrismaClient,
  signer: Signer,
  destinationChain: number,
  destinationCollectionAddress: string,
  contractABI: string,
  EVMMintingRequestDelay: number,
  transactionConfirmationPollingDelay: number,
  EVMMintingGasPrice: number,
  gasLimit: number
) {
  logger.info(`Checking for new EVM mints on chain ${destinationChain} and collection adddress ${destinationCollectionAddress}...`);
  const tokens = await getTokensFromDB(prisma);
  await mintEVMAssets(prisma, signer, tokens, destinationChain, destinationCollectionAddress, contractABI, transactionConfirmationPollingDelay, EVMMintingGasPrice, gasLimit);

  await new Promise((r) => setTimeout(r, EVMMintingRequestDelay));
  runEVMRegularMint(prisma, signer, destinationChain, destinationCollectionAddress, contractABI, EVMMintingRequestDelay, transactionConfirmationPollingDelay, EVMMintingGasPrice, gasLimit);
}

//Load an array of mints from tokens that haven't been minted, from the DB
async function loadIMXUserMintArray(imxclient: ImmutableX, prisma: PrismaClient, collectionAddress: string): Promise<MintRequestWithoutAuth[]> {
  //Pull tokens that haven't been minted yet from the DB
  const tokens = await getTokensFromDB(prisma);

  //Go through each token and add an entry for each user or add to an additional user entry, mint requests are broken down by user
  let tokensArray: { [receiverAddress: string]: MintTokenDataV2[] } = {};
  for (const token of tokens) {
    if (token.destinationCollectionAddress === collectionAddress) {
      //If the user already exists in the array then add the token to the array, otherwise create a new key entry
      if (tokensArray[token.toDestinationWalletAddress]) {
        tokensArray[token.toDestinationWalletAddress].push({
          id: token.destinationTokenId.toString(),
          blueprint: "ipfs://" + IPFS_CID + "/" + token.destinationTokenId,
        });
      } else {
        tokensArray[token.toDestinationWalletAddress] = [
          {
            id: token.destinationTokenId.toString(),
            blueprint: "ipfs://" + IPFS_CID + "/" + token.destinationTokenId,
          },
        ];
      }
    }
  }

  let mintArray: MintRequestWithoutAuth[] = [];
  let index = 0;
  for (let key in tokensArray) {
    //Check if the user is registered on IMX
    const isRegistered = await isIMXRegistered(imxclient, key);
    logger.info("Checking if recipient address " + key + " is registered on IMX");
    if (isRegistered) {
      mintArray[index] = {
        users: [
          {
            user: key.toLowerCase(),
            tokens: tokensArray[key],
          },
        ],
        contract_address: collectionAddress,
      };
      index++;
    } else {
      console.warn("Recipient address " + key + " is not registered on IMX, skipping...");
    }
  }
  return mintArray;
}

//Batches the token mints and returns an array of mints
async function batchIMXMintArray(mintArray: MintRequestWithoutAuth[], IMXMintingBatchSize: number): Promise<MintRequestWithoutAuth[]> {
  let batchifiedMintArray: MintRequestWithoutAuth[] = [];

  for (const element of mintArray) {
    if (element.users[0].tokens.length > IMXMintingBatchSize) {
      logger.info("Batching " + element.users[0].tokens.length + " tokens for " + element.users[0].user);

      //calculate the amount of batches
      const batchcount = Math.floor(element.users[0].tokens.length / IMXMintingBatchSize);
      logger.info("Batch count: " + batchcount);

      //calculate the remainder after the batches have been created
      const remainder = element.users[0].tokens.length % IMXMintingBatchSize;
      logger.info("Remainder: " + remainder);

      //loop for the batches
      let i: number = 0;
      let tokenindex: number = 0;
      while (i < batchcount) {
        let tokens: MintTokenDataV2[] = [];

        let j: number = 0;

        while (j < IMXMintingBatchSize) {
          //Create the token array according to the batch size
          tokens[j] = element.users[0].tokens[j + tokenindex];
          j++;
        }
        tokenindex = tokenindex + j;

        batchifiedMintArray.push({
          users: [
            {
              user: element.users[0].user,
              tokens: tokens,
            },
          ],
          contract_address: element.contract_address,
        });
        i++;
      }

      if (remainder != 0) {
        //logger.info('tokenid after batches complete: ' + tokenid);
        let tokens: MintTokenDataV2[] = [];

        //Create the last remainder tokens which didn't get included in a batch
        let k: number = 0;
        while (k < remainder) {
          tokens[k] = element.users[0].tokens[tokenindex + k];
          k++;
        }
        batchifiedMintArray.push({
          users: [
            {
              user: element.users[0].user,
              tokens: tokens,
            },
          ],
          contract_address: element.contract_address,
        });
      }
    } else {
      batchifiedMintArray.push(element);
    }
  }
  logger.info("Length of original mint array: " + mintArray.length);
  logger.info("Length of batchified mint array: " + batchifiedMintArray.length);

  return batchifiedMintArray;
}

// async function mintIMXBatchArray(imxclient: ImmutableX, prisma: PrismaClient, signer: Signer, mintArray: MintRequestWithoutAuth[], IMXMintingBatchDelay: number): Promise<MintResult> {
//   for (const element of mintArray) {
//     logger.info("Minting " + element.users[0].tokens.length + " tokens for " + element.users[0].user);
//     try {
//       const result = await imxclient.mint(signer, element);
//       for (const token of result.results) {
//         await setStarkTokenToMinted(prisma, parseInt(token.token_id), token.tx_id);
//       }
//       logger.info(result);
//       return { status: "success", result };
//     } catch (error) {
//       logger.error("Error minting tokens for " + element.users[0].user);
//       logger.error(JSON.stringify(error, Object.getOwnPropertyNames(error)));
//       if (error instanceof Error) {
//         logger.info(error);
//         return { status: "error", errorMessage: error.message };
//       } else {
//         logger.error("An unknown error occurred.");
//         return { status: "error", errorMessage: "An unknown error occurred during minting." };
//       }
//     } finally {
//       // Optional timeout to prevent rate limiting
//       await new Promise((r) => setTimeout(r, IMXMintingBatchDelay));
//     }
//   }

//   // Return an error status if no minting attempt was made (e.g., empty mintArray)
//   return { status: "error", errorMessage: "No minting attempts were made." };
// }

//Runs the minting function every 10 seconds
// async function runIMXRegularMint(imxclient: ImmutableX, prisma: PrismaClient, signer: Signer, chain: number, collectionAddress: string, IMXMintingBatchSize: number, IMXMintingRequestDelay: number) {
//   logger.info(`Checking for new IMX StarkEx mints on chain ${chain} and destinationCollectionAddress ${collectionAddress}...`);
//   //loads the mint array which is going to be passed to the minting function
//   const mintArray = await loadIMXUserMintArray(imxclient, prisma, collectionAddress);

//   if (mintArray.length > 0) {
//     const batchArray = await batchIMXMintArray(mintArray, IMXMintingBatchSize);
//     await mintIMXBatchArray(imxclient, prisma, signer, batchArray, IMXMintingBatchDelay);
//   }

//   //Delay before running again
//   //Delay before running again
//   setTimeout(() => {
//     runIMXRegularMint(imxclient, prisma, signer, chain, collectionAddress, IMXMintingBatchSize, IMXMintingRequestDelay);
//   }, IMXMintingRequestDelay);
// }

async function minter(chain: number, collectionAddress: string) {
  const prisma = new PrismaClient();

  // Check if the provided chain is valid.
  if (!chains.hasOwnProperty(chain)) {
    logger.info(`Invalid chain: ${chain}`);
    throw new Error(`Invalid chain: ${chain}`);
  }

  if (chain === 5000 || chain === 5001) {
    const config = destinationChain === 5000 ? Config.PRODUCTION : Config.SANDBOX;
    const network = destinationChain === 5000 ? "production" : "sandbox";
    const imxclient = new ImmutableX(config);
    const signer = await getSigner(network, process.env.MINTER_PRIVATE_KEY!);
    //runIMXRegularMint(imxclient, prisma, signer, chain, collectionAddress, IMXMintingBatchSize, IMXMintingRequestDelay);
  } else if (chain === 13472) {
    //If it's IMX zkEVM
    const testProvider = getDefaultProvider("https://rpc.testnet.immutable.com");
    const testWallet = new ethers.Wallet(process.env.MINTER_PRIVATE_KEY!, testProvider);
    const prisma = new PrismaClient();

    runIMXEVMRegularMint(prisma, testWallet, destinationChain, destinationCollectionAddress, EVMMintingRequestDelay);
  } else {
    //setup Moralis
    await Moralis.start({
      apiKey: process.env.MORALIS_API_KEY,
    });
    const wallet = new ethers.Wallet(process.env.MINTER_PRIVATE_KEY!);
    const provider = new ethers.JsonRpcProvider(process.env.EVM_PROVIDER_URL!);
    const signer = wallet.connect(provider);
    runEVMRegularMint(prisma, signer, chain, collectionAddress, contractABI, transactionConfirmationPollingDelay, EVMMintingRequestDelay, EVMMintingGasPrice, EVMMintingGasLimit);
  }
}

//minter(destinationChain, destinationCollectionAddress);

//IMX testnet
//minter(5001, destinationCollectionAddress);

//Polygon mainnet
//minter(137, originCollectionAddress);

//Test IMX mint via minting API
// async function testMintingViaAPI() {
//   const prisma = new PrismaClient();
//   const tokens: any[] = [];
//   const result = await mintIMXEVMAssetsViaMintingAPI(prisma, tokens, 13473, "0xa8d248fa82e097df14b3bcda5515af97d4a62365");
//   console.log(result);
// }
// testMintingViaAPI();

//Test loadIMXUserMintArray
// async function loadIMXUserMintArrayTest() {
//   const config = Config.SANDBOX;
//   const imxclient = new ImmutableX(config);
//   const prisma = new PrismaClient();
//   const mintArray = await loadIMXUserMintArray(imxclient, prisma, "0x82633202e463d7a39e6c03a843f0f4e83b7e9aa3");
//   logger.info(JSON.stringify(mintArray, null, 2));

//   //optional write to file
//   // fs.writeFile("src/testing/mintArray.json", JSON.stringify(mintArray, null, "\t"), (err) => {
//   //   if (err) {
//   //     logger.error(err);
//   //   } else {
//   //     logger.info("Mint array written to data/mintArray.json");
//   //   }
//   // });
// }
// loadIMXUserMintArrayTest();

// async function testBatchIMXMintArray() {
//   const config = Config.SANDBOX;
//   const imxclient = new ImmutableX(config);
//   const prisma = new PrismaClient();
//   const mintArray = await loadIMXUserMintArray(imxclient, prisma, "0x82633202e463d7a39e6c03a843f0f4e83b7e9aa3");

//   const batchifiedMintArray = await batchIMXMintArray(mintArray, 3);

//   logger.info(JSON.stringify(mintArray, null, 2));
//   logger.info(JSON.stringify(batchifiedMintArray, null, 2));

//   // //Optional write to file
//   // fs.writeFile("src/testing/batchifiedMintArray.json", JSON.stringify(batchifiedMintArray, null, "\t"), (err) => {
//   //   if (err) {
//   //     logger.error(err);
//   //   } else {
//   //     logger.info("Batchified mint array written to data/batchifiedMintArray.json");
//   //   }
//   // });
// }
// testBatchIMXMintArray();

// async function testMintIMXBatchArray() {
//   const config = Config.SANDBOX;
//   const imxclient = new ImmutableX(config);
//   const prisma = new PrismaClient();
//   const signer = await getSigner("sandbox", process.env.MINTER_PRIVATE_KEY!);

//   const mintArray = await loadIMXUserMintArray(imxclient, prisma, "0x82633202e463d7a39e6c03a843f0f4e83b7e9aa3");

//   const batchifiedMintArray = await batchIMXMintArray(mintArray, 10);

//   await mintIMXBatchArray(imxclient, prisma, signer, batchifiedMintArray, 200);

//   // //Optional write to file
//   // fs.writeFile("src/testing/batchifiedMintArray.json", JSON.stringify(batchifiedMintArray, null, "\t"), (err) => {
//   //   if (err) {
//   //     logger.error(err);
//   //   } else {
//   //     logger.info("Batchified mint array written to data/batchifiedMintArray.json");
//   //   }
//   // });
// }
// testMintIMXBatchArray();
