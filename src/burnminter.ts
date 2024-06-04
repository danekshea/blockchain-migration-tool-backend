import { Token, PrismaClient } from "@prisma/client";
import Moralis from "moralis";
import serverConfig, { environment } from "./config";
import * as dotenv from "dotenv";
import { blockchainData, config as sdkConfig } from "@imtbl/sdk";
import { Types } from "@imtbl/sdk/dist/blockchain_data";
import * as fs from "fs";
import { getTokensFromDB, getSigner, setEVMTokenToMinted, transactionConfirmation, chains, convertTokensToRequests } from "./utils";
import { ethers, Contract, Signer } from "ethers";
import { GetTransactionRequest } from "@moralisweb3/common-evm-utils";
import { v4 as uuidv4 } from "uuid";
import logger from "./logger";
dotenv.config();

async function mintIMXEVMAssetsViaMintingAPI(prisma: PrismaClient, tokens: Token[], destinationChain: number, destinationCollectionAddress: string) {
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
  //generate UUID for the mint request

  for (const token of tokens) {
    try {
      const uuid = uuidv4();
      const response = await client.createMintRequest({
        chainName: serverConfig[environment].chainName,
        contractAddress: destinationCollectionAddress,
        createMintRequestRequest: {
          assets: [
            {
              owner_address: token.toDestinationWalletAddress,
              reference_id: uuid,
              //Remove token_id line if you want to batch mint
              token_id: token.destinationTokenId.toString(),
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

      logger.info(`Mint request sent with UUID: ${uuid}`);
      logger.debug("Mint request response:", JSON.stringify(response, null, 2));
      console.log(response);
    } catch (error) {
      logger.error("Error sending mint request:", error);
      console.log(error);
      throw error;
    }
  }
}

async function runIMXEVMRegularMint(prisma: PrismaClient, destinationChain: number, destinationCollectionAddress: string, EVMMintingRequestDelay: number) {
  logger.info(`Checking for new EVM mints on chain ${destinationChain} and collection adddress ${destinationCollectionAddress}...`);
  try {
    const tokens = await getTokensFromDB(prisma);
    if (tokens.length > 0) {
      await mintIMXEVMAssetsViaMintingAPI(prisma, tokens, destinationChain, destinationCollectionAddress);
    }
  } catch (error) {
    logger.error("Error minting:", error);
  }

  await new Promise((r) => setTimeout(r, EVMMintingRequestDelay));
  await runIMXEVMRegularMint(prisma, destinationChain, destinationCollectionAddress, EVMMintingRequestDelay);
}

async function minter(chain: number, collectionAddress: string) {
  // Check if the provided chain is valid.
  if (!chains.hasOwnProperty(chain)) {
    logger.info(`Invalid chain: ${chain}`);
    throw new Error(`Invalid chain: ${chain}`);
  }

  const prisma = new PrismaClient();
  runIMXEVMRegularMint(prisma, chain, collectionAddress, serverConfig[environment].EVMMintingRequestDelay);
}

minter(serverConfig[environment].destinationChain, serverConfig[environment].destinationCollectionAddress);

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
