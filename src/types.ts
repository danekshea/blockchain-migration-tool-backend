export interface burn {
  chain: number;
  blockNumber?: number;
  timestamp: Date;
  transactionHash?: string;
  transaction_id?: number;
  tokenAddress: string;
  tokenId: number;
  fromAddress: string;
  toAddress: string;
}

export interface TokenTransferResponse {
  total: number;
  page: number;
  page_size: number;
  cursor?: string;
  result: NftTransfer[];
}

export interface NftTransfer {
  chain: number;
  tokenAddress: string;
  tokenId: number;
  fromAddress: string;
  toAddress: string;
  blockNumber: number;
  blockTimestamp: Date;
  transactionHash: string;
}

export interface MoralisGetNFTContractTransfersResponse {
  transfers: NftTransfer[];
  cursor: string | undefined;
}

export interface chainDetails {
  name: string;
  shortName: string;
}

interface IMXCSVData {
  ContractAddress: string;
  ID: string;
  OwnerAddress: string;
  Status: string;
  URI: string;
  Name: string;
  Description: string;
  ImageURL: string;
  LastMetadataRefreshTime: string;
  LastMetadataRefreshStatusCode: string;
  LastUpdateTransactionHash: string;
  LastUpdateBlockNumber: string;
  TokenID: string;
  Blueprint: string;
}

interface EnvironmentConfig {
  API_URL: string;
  HUB_API_KEY: string;
  RPS_API_KEY: string;
  HOST_IP: string;
  PORT: number;
  collectionAddress: string;
  chainName: string;
  mintRequestURL: (chainName: string, collectionAddress: string, referenceId: string) => string;
  enableWebhookVerification: boolean;
  allowedTopicArn: string;
  enableFileLogging: boolean;
  logLevel: string;
  originChain: number;
  destinationChain: number;
  originCollectionAddress: string;
  destinationCollectionAddress: string;
  mintingAPIAddress: string;
  burnAddress: string;
  EVMBlockPollingInterval: number;
  EVMMintingRequestDelay: number;
  addressMappingEnabled: boolean;
  tokenIDOffset: number;
}

export interface ServerConfig {
  [key: string]: EnvironmentConfig; // Dynamic keys based on possible environments
}
