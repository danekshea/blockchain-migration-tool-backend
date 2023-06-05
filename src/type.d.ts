import { MintTokensResponse, MintUser } from "@imtbl/core-sdk";

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

export interface MintRequestWithoutAuth {
  users: MintUser[];
  contract_address: string;
}

interface MintResult {
  status: "success" | "error";
  result?: MintTokensResponse;
  errorMessage?: string;
}

export interface TokenTransferResponse {
  total: number;
  page: number;
  page_size: number;
  cursor?: string;
  result: NftTransfer[];
}

export interface NftTransfer {
  chainId: number;
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
