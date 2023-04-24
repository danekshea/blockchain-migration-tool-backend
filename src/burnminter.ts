import { Burn, PrismaClient } from "@prisma/client";
import Moralis from "moralis";
import { ImmutableX, Config, MintTokenDataV2, MintRequest, MintUser } from "@imtbl/core-sdk";
import {
  IMXMintingBatchSize,
  IMXMintingBatchDelay,
  IMXMintingRequestDelay,
  IPFS_CID,
  destinationChainId,
  destinationCollectionAddress,
  contractABI,
  originCollectionAddress,
  originChainId,
  EVMMintingGasPrice,
  EVMMintingGasLimit,
  transactionConfirmationPollingDelay,
  EVMMintingRequestDelay,
} from "./config";
import * as dotenv from "dotenv";
import * as fs from "fs";
import { getBurnTransfersFromDB, getSigner, isIMXRegistered, setBurnTransferToMinted, transactionConfirmation } from "./utils";
import { ethers, Contract, Signer } from "ethers";
import { GetTransactionRequest } from "@moralisweb3/common-evm-utils";
import { MintRequestWithoutAuth } from "./type";
dotenv.config();

//Mint an EVM asset
async function mintEVMAsset(
  signer: Signer,
  collectionAddress: string,
  to: string,
  tokenId: number,
  contractABI: string,
  EVMMintingGasPrice: number,
  EVMMintingGasLimit: number
): Promise<string> {
  try {
    const EVMMintingGasPriceParam = ethers.utils.parseUnits(EVMMintingGasPrice.toString(), "gwei");

    // Set up the overrides object for gas settings
    const overrides = {
      gasPrice: EVMMintingGasPriceParam,
      gasLimit: EVMMintingGasLimit,
    };

    const collectionContract = new Contract(collectionAddress, contractABI, signer);

    const tx = await collectionContract.safeMint(to, tokenId, { ...overrides });
    return tx.hash;
  } catch (error) {
    console.error("Error while minting EVM asset:", error);
    throw error;
  }
}

//Mints a batch of EVM assets
async function mintEVMAssets(
  prisma: PrismaClient,
  signer: Signer,
  burnTransfers: Burn[],
  chainId: number,
  collectionAddress: string,
  contractABI: string,
  transactionConfirmationPollingDelay: number,
  EVMMintingGasPrice: number,
  gasLimit: number
) {
  for (const burn of burnTransfers) {
    try {
      if (burn.fromAddress) {
        const txhash = await mintEVMAsset(signer, collectionAddress, burn.fromAddress, burn.tokenId, contractABI, EVMMintingGasPrice, gasLimit);
        console.log(txhash);

        //Create a loop that waits for the asset to be in the Moralis API
        await transactionConfirmation(txhash, chainId, transactionConfirmationPollingDelay);

        //Set the database entry to minted
        setBurnTransferToMinted(prisma, burn.id);
      }
    } catch (error) {
      console.error(`Error while minting EVM asset for tokenId ${burn.tokenId}:`, error);
      // Optionally, you can decide how to handle the error (e.g., skip the current iteration, retry, etc.)
    }
  }
}

async function runEVMRegularMint(
  prisma: PrismaClient,
  signer: Signer,
  chainId: number,
  collectionAddress: string,
  contractABI: string,
  EVMMintingRequestDelay: number,
  transactionConfirmationPollingDelay: number,
  EVMMintingGasPrice: number,
  gasLimit: number
) {
  console.log(`Checking for new EVM mints on chain ${chainId}...`);
  const burnTransfers = await getBurnTransfersFromDB(prisma);
  await mintEVMAssets(
    prisma,
    signer,
    burnTransfers,
    chainId,
    collectionAddress,
    contractABI,
    transactionConfirmationPollingDelay,
    EVMMintingGasPrice,
    gasLimit
  );

  await new Promise((r) => setTimeout(r, EVMMintingRequestDelay));
  runEVMRegularMint(
    prisma,
    signer,
    chainId,
    collectionAddress,
    contractABI,
    EVMMintingRequestDelay,
    transactionConfirmationPollingDelay,
    EVMMintingGasPrice,
    gasLimit
  );
}

//Load an array of mints from tokens that haven't been minted, from the DB
async function loadIMXUserMintArray(imxclient: ImmutableX, prisma: PrismaClient, collectionAddress: string): Promise<MintRequestWithoutAuth[]> {
  //Pull tokens that haven't been minted yet from the DB
  const burnTransfers = await getBurnTransfersFromDB(prisma);

  //Go through each token and add an entry for each user or add to an additional user entry, mint requests are broken down by user
  let tokensArray: { [receiverAddress: string]: MintTokenDataV2[] } = {};
  for (const burn of burnTransfers) {
    if (burn.fromAddress) {
      //If the user already exists in the array then add the token to the array, otherwise create a new key entry
      if (tokensArray[burn.fromAddress]) {
        tokensArray[burn.fromAddress].push({
          id: burn.tokenId.toString(),
          blueprint: "ipfs://" + IPFS_CID + "/" + burn.tokenId,
        });
      } else {
        tokensArray[burn.fromAddress] = [
          {
            id: burn.tokenId.toString(),
            blueprint: "ipfs://" + IPFS_CID + "/" + burn.tokenId,
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
    console.log("Checking if recipient address " + key + " is registered on IMX");
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
      console.log("Recipient address " + key + " is not registered on IMX, skipping...");
    }
  }
  return mintArray;
}

//Batches the token mints and returns an array of mints
async function batchIMXMintArray(mintArray: MintRequestWithoutAuth[]) {
  let batchifiedMintArray: MintRequestWithoutAuth[] = [];

  for (const element of mintArray) {
    if (element.users[0].tokens.length > IMXMintingBatchSize) {
      console.log("Batching " + element.users[0].tokens.length + " tokens for " + element.users[0].user);

      //calculate the amount of batches
      const batchcount = Math.floor(element.users[0].tokens.length / IMXMintingBatchSize);
      console.log("Batch count: " + batchcount);

      //calculate the remainder after the batches have been created
      const remainder = element.users[0].tokens.length % IMXMintingBatchSize;
      console.log("Remainder: " + remainder);

      //loop for the batches
      let i: number = 0;
      let tokenindex: number = 0;
      while (i < batchcount) {
        let tokens: MintTokenDataV2[] = [];

        let j: number = 0;

        while (j < IMXMintingBatchSize) {
          //Create the token array according to the batch size
          tokens[j] = {
            id: element.users[0].tokens[j + tokenindex].id,
            blueprint: "ipfs://" + IPFS_CID + "/" + element.users[0].tokens[j + tokenindex].id,
          };
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
        //console.log('tokenid after batches complete: ' + tokenid);
        let tokens: MintTokenDataV2[] = [];

        //Create the last remainder tokens which didn't get included in a batch
        let k: number = 0;
        while (k < remainder) {
          tokens[k] = {
            id: element.users[0].tokens[tokenindex + k].id,
            blueprint: "ipfs://" + IPFS_CID + "/" + (tokenindex + k).toString(),
          };
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
    console.log(element.users[0].tokens.length);
    //console.log(element[0][1]);
    //console.log(element[0][1].length);
  }
  console.log("Length of original: " + mintArray.length);
  console.log("Length of batchified version: " + batchifiedMintArray.length);

  //Write everything to file
  fs.writeFile("src/testing/mintArray.json", JSON.stringify(mintArray, null, "\t"), (err) => {
    if (err) {
      console.error(err);
    } else {
      console.log("Mint array written to data/mintArray.json");
    }
  });

  //Write everything to file
  fs.writeFile("src/testing/batchifiedMintArray.json", JSON.stringify(batchifiedMintArray, null, "\t"), (err) => {
    if (err) {
      console.error(err);
    } else {
      console.log("Batchified mint array written to data/batchifiedMintArray.json");
    }
  });

  return mintArray;
}

//Mints the batches of a mint array
async function mintIMXBatchArray(imxclient: ImmutableX, prisma: PrismaClient, mintArray: any[], network: string) {
  for (const element of mintArray) {
    const signer = await getSigner(network, process.env.MINTER_PRIVATE_KEY!);
    console.log("Minting " + element.users[0].tokens.length + " tokens for " + element.users[0].user);
    try {
      const result = await imxclient.mint(signer, element);
      for (const user of element.users[0].tokens) {
        const updatetoken = await prisma.burn.update({
          where: {
            tokenId: user.id,
          },
          data: {
            minted: 1,
          },
        });
        console.log(user.id);
      }
      console.log(result);
      return result;
    } catch (error) {
      console.log("Error minting tokens for " + element.users[0].user);
      console.log(error);
    }
  }
  //Optional timeout to prevent rate limiting
  await new Promise((r) => setTimeout(r, IMXMintingBatchDelay));
}

//Runs the minting function every 10 seconds
async function runIMXRegularMint(
  imxclient: ImmutableX,
  prisma: PrismaClient,
  collectionAddress: string,
  EVMMintingRequestDelay: number,
  network: string
) {
  console.log("Checking for new IMX StarkEx mints...");
  //loads the mint array which is going to be passed to the minting function
  const batchArray = await batchIMXMintArray(await loadIMXUserMintArray(imxclient, prisma, collectionAddress));
  mintIMXBatchArray(imxclient, prisma, batchArray, network);

  //Delay before running again
  await new Promise((r) => setTimeout(r, EVMMintingRequestDelay));
  runIMXRegularMint(imxclient, prisma, collectionAddress, EVMMintingRequestDelay, network);
}

async function minter(chainId: number, collectionAddress: string) {
  const prisma = new PrismaClient();
  if (chainId === 5000 || chainId === 5001) {
    const config = destinationChainId === 5000 ? Config.PRODUCTION : Config.SANDBOX;
    const imxclient = new ImmutableX(config);
    runIMXRegularMint(imxclient, prisma, collectionAddress, IMXMintingRequestDelay, process.env.NETWORK!);
  } else {
    //setup Moralis
    await Moralis.start({
      apiKey: process.env.MORALIS_API_KEY,
    });
    const wallet = new ethers.Wallet(process.env.MINTER_PRIVATE_KEY!);
    const provider = new ethers.providers.JsonRpcProvider(process.env.EVM_PROVIDER_URL!);
    const signer = wallet.connect(provider);
    runEVMRegularMint(
      prisma,
      signer,
      chainId,
      collectionAddress,
      contractABI,
      transactionConfirmationPollingDelay,
      EVMMintingRequestDelay,
      EVMMintingGasPrice,
      EVMMintingGasLimit
    );
  }
}

//minter(137, originCollectionAddress);

//Test loadIMXUserMintArray
async function main() {
  const config = Config.SANDBOX;
  const imxclient = new ImmutableX(config);
  const prisma = new PrismaClient();
  const mintArray = await loadIMXUserMintArray(imxclient, prisma, "0x82633202e463d7a39e6c03a843f0f4e83b7e9aa3");
  console.log(JSON.stringify(mintArray, null, 2));
}
main();
