import { Burn, PrismaClient } from "@prisma/client";
import Moralis from "moralis";
import { ImmutableX, Config } from "@imtbl/core-sdk";
import {
  mintingBatchSize,
  mintingBatchDelay,
  mintingRequestDelay,
  IPFS_CID,
  destinationChainId,
  destinationCollectionAddress,
  contractABI,
  originCollectionAddress,
  originChainId,
} from "./config";
import * as dotenv from "dotenv";
import * as fs from "fs";
import { getBurnTransfersFromDB, getSigner, isIMXRegistered, setBurnTransferToMinted, transactionConfirmation } from "./utils";
import { ethers, Contract, Signer } from "ethers";
import { GetTransactionRequest } from "@moralisweb3/common-evm-utils";
dotenv.config();

//Mint an EVM asset
async function mintEVMAsset(signer: Signer, collectionAddress: string, to: string, tokenId: number, contractABI:string, gasPrice:number, gasLimit:number): Promise<string> {
  const gasPriceParam = ethers.utils.parseUnits(gasPrice.toString(), "gwei");

  // Set up the overrides object for gas settings
  const overrides = {
    gasPrice: gasPriceParam,
    gasLimit: gasLimit,
  };

  const collectionContract = new Contract(collectionAddress, contractABI, signer);

  const tx = await collectionContract.safeMint(to, tokenId, { ...overrides });
  return tx.hash;
}

async function mintEVMAssets(prisma: PrismaClient, signer:Signer, burnTransfers:Burn[], chainId:number, collectionAddress:string, contractABI:string, gasPrice:number, gasLimit:number) {
  for(const burn of burnTransfers) {
    if (burn.fromAddress) {
      const txhash = await mintEVMAsset(signer, collectionAddress, burn.fromAddress, burn.tokenId, contractABI, gasPrice, gasLimit);
      console.log(txhash);
      
      //Create a loop that waits for the asset to be in the Moralis API
      await transactionConfirmation(txhash, chainId, 3000);

      //Set the database entry to minted
      setBurnTransferToMinted(prisma, burn.id);
    }
  }
}


async function main() {
  const prisma = new PrismaClient();
  //setup Moralis
  await Moralis.start({
    apiKey: process.env.MORALIS_API_KEY,
  });
  const wallet = new ethers.Wallet(process.env.MINTER_PRIVATE_KEY!);
  const provider = new ethers.providers.JsonRpcProvider("https://polygon-mainnet.g.alchemy.com/v2/SDZoEM9UlLQXaSDZTfJLMLyQiH9pQRZr");
  const signer = wallet.connect(provider);

  const burnTransfers = await getBurnTransfersFromDB(prisma);

  mintEVMAssets(prisma, signer, burnTransfers, 137, originCollectionAddress, contractABI, 280, 146000);
}
main();

//Load an array of mints from tokens that haven't been minted, from the DB
async function loadIMXUserMintArray(imxclient: ImmutableX, prisma: PrismaClient) {
  //Pull tokens that haven't been minted yet from the DB
  const burnTransfers = await getBurnTransfersFromDB(prisma);

  //Go through each token and add an entry for each user or add to an additional user entry, mint requests are broken down by user
  let tokensArray: { [receiverAddress: string]: any[] } = {};
  for (const burn of burnTransfers) {
    if (burn.fromAddress) {
      //If the user already exists in the array then add the token to the array, otherwise create a new key entry
      if (tokensArray[burn.fromAddress]) {
        tokensArray[burn.fromAddress].push({
          id: burn.tokenId,
          blueprint: "ipfs://" + IPFS_CID + "/" + burn.tokenId,
        });
      } else {
        tokensArray[burn.fromAddress] = [
          {
            id: burn.tokenId,
            blueprint: "ipfs://" + IPFS_CID + "/" + burn.tokenId,
          },
        ];
      }
    }
  }

  let mintArray = [];
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
        contract_address: destinationCollectionAddress,
      };
      index++;
    } else {
      console.log("Recipient address " + key + " is not registered on IMX, skipping...");
    }
  }
  return mintArray;
}

//Batches the token mints and returns an array of mints
async function batchIMXMintArray(mintArray: any[]) {
  let batchifiedMintArray = [];

  for (const element of mintArray) {
    if (element.users[0].tokens.length > mintingBatchSize) {
      console.log("Batching " + element.users[0].tokens.length + " tokens for " + element.users[0].etherKey);

      //calculate the amount of batches
      const batchcount = Math.floor(element.users[0].tokens.length / mintingBatchSize);
      console.log("Batch count: " + batchcount);

      //calculate the remainder after the batches have been created
      const remainder = element.users[0].tokens.length % mintingBatchSize;
      console.log("Remainder: " + remainder);

      //loop for the batches
      let i: number = 0;
      let tokenindex: number = 0;
      while (i < batchcount) {
        let tokens = [];

        let j: number = 0;

        while (j < mintingBatchSize) {
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
              etherKey: element.users[0].etherKey,
              tokens: tokens,
            },
          ],
          contractAddress: element.contractAddress,
        });
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
            blueprint: "ipfs://" + IPFS_CID + "/" + (tokenindex + k).toString(),
          };
          k++;
        }
        batchifiedMintArray.push({
          users: [
            {
              etherKey: element.users[0].etherKey,
              tokens: tokens,
            },
          ],
          contractAddress: element.contractAddress,
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
  await new Promise((r) => setTimeout(r, mintingBatchDelay));
}

//Runs the minting function every 10 seconds
async function runIMXRegularMint(imxclient: ImmutableX, prisma: PrismaClient, network: string) {
  console.log("Checking for new mints...");
  //loads the mint array which is going to be passed to the minting function
  const batchArray = await batchIMXMintArray(await loadIMXUserMintArray(imxclient, prisma));
  mintIMXBatchArray(imxclient, prisma, batchArray, network);

  //Delay before running again
  await new Promise((r) => setTimeout(r, mintingRequestDelay));
  runIMXRegularMint(imxclient, prisma, network);
}

async function IMXminter(chainId: number, collectionAddress: string) {
  const prisma = new PrismaClient();
  if(chainId === 5000 || chainId === 5001) {
    const config = destinationChainId === 5000 ? Config.PRODUCTION : Config.SANDBOX;
    const imxclient = new ImmutableX(config);
    runIMXRegularMint(imxclient, prisma, process.env.NETWORK!);
  }
  else {
    //runEVMRegularMint(prisma, collectionAddress, chainId)
  }
}

//IMXminter();
