import { PrismaClient } from '@prisma/client'
import { ImmutableX, Config, IMXError, UnsignedMintRequest } from '@imtbl/core-sdk';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { getSigner } from './utils';
dotenv.config();

async function loadUserMintArray(imxclient: ImmutableX, prisma: PrismaClient) {
    //Pull tokens that haven't been minted yet from the DB
    const burnTransfers = await prisma.burn.findMany({
      where: { minted: 0 },
    });
  
    //Go through each token and add an entry for each user or add to an additional user entry, mint requests are broken down by user
    let tokensArray: { [receiverAddress: string]: any[] } = {};
    for (const burn of burnTransfers) {
      if (burn.fromAddress) {
        if (tokensArray[burn.fromAddress]) {
          tokensArray[burn.fromAddress].push({
            id: burn.tokenId,
            blueprint: 'ipfs://' + process.env.IPFS_CID + '/' + burn.tokenId
          });
        }
        else {
          tokensArray[burn.fromAddress] = [{
            id: burn.tokenId,
            blueprint: 'ipfs://' + process.env.IPFS_CID + '/' + burn.tokenId
          }];
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
          users: [{
            user: key.toLowerCase(),
            tokens: tokensArray[key]
          }],
          contract_address: process.env.DESTINATION_COLLECTION_ADDRESS
        }
        index++;
      }
      else {
        console.log("Recipient address " + key + " is not registered on IMX, skipping...");
      }
    }
    return mintArray;
  }
  
  async function batchMintArray(mintArray: any[]) {
  
    //Mints per batch
    const batchsize = parseInt(process.env.MINTING_BATCH_SIZE!);
  
    //Delays between mint requests, recommendation is >200, at 200ms, we have 5 RPS
    const requestdelays = process.env.MINTING_BATCH_DELAY;
  
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
    console.log("Length of original: " + mintArray.length);
    console.log("Length of batchified version: " + batchifiedMintArray.length);
  
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
  
  async function mintBatchArray(imxclient: ImmutableX, prisma: PrismaClient, mintArray: any[]) {
    for(const element of mintArray) {
      const signer = await getSigner("sandbox", process.env.MINTER_PRIVATE_KEY!);
      console.log("Minting " + element.users[0].tokens.length + " tokens for " + element.users[0].user);
      try {
        const result = await imxclient.mint(signer, element);
        for(const user of element.users[0].tokens) {
            const updatetoken = await prisma.burn.update({
                where: {
                  tokenId: user.id,
                },
                data: {
                  minted: 1,
                },
              })
            console.log(user.id);
        }
        console.log(result);
        return result;
      }
      catch(error) {
        console.log("Error minting tokens for " + element.users[0].user);
        console.log(error);
      }
    }
  }

//Check if the user is registered onchain
async function isIMXRegistered(imxclient: ImmutableX, ethaddress: string): Promise<boolean> {
    try {
      const isRegistered = await imxclient.getUser(ethaddress);
      return true;
    }
    catch (err) {
      console.log(err);
      return false;
    }
  }

  async function runRegularMint() {
    console.log("Checking for new mints...");
    //loads the mint array which is going to be passed to the minting function
    const prisma = new PrismaClient();
    const config = Config.SANDBOX
    const imxclient = new ImmutableX(config);
    const batchArray = await batchMintArray(await loadUserMintArray(imxclient, prisma));
    mintBatchArray(imxclient, prisma, batchArray);

    //10 seconds delay
    await new Promise(r => setTimeout(r, 5000));
    runRegularMint();
  }

  async function main() {
    runRegularMint();
  }

  main();