import { config } from "@imtbl/sdk";
import { ServerConfig } from "./types";
require("dotenv").config();

// Environment-based configuration
export const environment = process.env.ENVIRONMENT === "PRODUCTION" ? config.Environment.PRODUCTION : config.Environment.SANDBOX;

// Environment-specific configurations with process.env at the top
const serverConfig: ServerConfig = {
  [config.Environment.SANDBOX]: {
    // Dynamic environment variables
    HUB_API_KEY: process.env.SANDBOX_HUB_IMMUTABLE_API_KEY!,
    RPS_API_KEY: process.env.SANDBOX_RPS_IMMUTABLE_API_KEY!,
    HOST_IP: process.env.SANDBOX_HOST_IP!,
    PORT: parseInt(process.env.SANDBOX_PORT!, 10),
    collectionAddress: process.env.SANDBOX_COLLECTION_ADDRESS!,
    originChain: parseInt(process.env.SANDBOX_ORIGIN_CHAIN!, 10),
    destinationChain: parseInt(process.env.SANDBOX_DESTINATION_CHAIN!, 10),
    originCollectionAddress: process.env.SANDBOX_ORIGIN_COLLECTION_ADDRESS!,
    destinationCollectionAddress: process.env.SANDBOX_DESTINATION_COLLECTION_ADDRESS!,

    // Hardcoded values for sandbox
    API_URL: "https://api.sandbox.immutable.com",
    chainName: "imtbl-zkevm-testnet",
    mintingAPIAddress: "0x9CcFbBaF5509B1a03826447EaFf9a0d1051Ad0CF",
    mintRequestURL: (chainName: string, collectionAddress: string, referenceId: string) => `https://api.sandbox.immutable.com/v1/chains/${chainName}/collections/${collectionAddress}/nfts/mint-requests/${referenceId}`,
    enableWebhookVerification: true,
    allowedTopicArn: "arn:aws:sns:us-east-2:783421985614:*",
    enableFileLogging: true,
    logLevel: "debug",
    burnAddress: "0x000000000000000000000000000000000000dead",
    EVMBlockPollingInterval: 5,
    EVMMintingRequestDelay: 1000,
    addressMappingEnabled: false,
    tokenIDOffset: 0,
  },
  [config.Environment.PRODUCTION]: {
    // Dynamic environment variables
    HUB_API_KEY: process.env.MAINNET_HUB_IMMUTABLE_API_KEY!,
    RPS_API_KEY: process.env.MAINNET_RPS_IMMUTABLE_API_KEY!,
    HOST_IP: process.env.MAINNET_HOST_IP!,
    PORT: parseInt(process.env.MAINNET_PORT!, 10),
    collectionAddress: process.env.MAINNET_COLLECTION_ADDRESS!,
    originChain: parseInt(process.env.MAINNET_ORIGIN_CHAIN!, 10),
    destinationChain: parseInt(process.env.MAINNET_DESTINATION_CHAIN!, 10),
    originCollectionAddress: process.env.MAINNET_ORIGIN_COLLECTION_ADDRESS!,
    destinationCollectionAddress: process.env.MAINNET_DESTINATION_COLLECTION_ADDRESS!,

    // Hardcoded values for production
    API_URL: "https://api.immutable.com",
    chainName: "imtbl-zkevm-mainnet",
    mintingAPIAddress: "0xbb7ee21AAaF65a1ba9B05dEe234c5603C498939E",
    mintRequestURL: (chainName: string, collectionAddress: string, referenceId: string) => `https://api.immutable.com/v1/chains/${chainName}/collections/${collectionAddress}/nfts/mint-requests/${referenceId}`,
    enableWebhookVerification: true,
    allowedTopicArn: "arn:aws:sns:us-east-2:362750628221:*",
    enableFileLogging: true,
    logLevel: "debug",
    burnAddress: "0x000000000000000000000000000000000000dead",
    EVMBlockPollingInterval: 5,
    EVMMintingRequestDelay: 1000,
    addressMappingEnabled: false,
    tokenIDOffset: 0,
  },
};

export default serverConfig;
