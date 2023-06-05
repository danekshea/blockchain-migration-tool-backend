import { MintTokensResponse, MintUser } from "@imtbl/core-sdk";

export interface burn {
  chain: number;
  blockNumber?: number;
  timestamp: Date;
  transactionHash?: string;
  transaction_id?: number;
  tokenAddress: string;
  tokenId: number;
  fromAddress?: string;
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

export interface GetTransferResponse {
    result: GetTransferResponseResult[]
  }
  
  export interface GetTransferResponseResult {
    transaction_hash: string
    token_id: string
    from_address: string
    to_address: string
    token_address: string
    amount: string
    block_number: string
  }
  
  export interface TokenTransferResponse {
    total: number
    page: number
    page_size: number
    cursor?: string
    result: NftTransfer[]
  }
  
  export interface NftTransfer {
    token_address: string
    token_id: string
    from_address: string
    to_address: string
    value: string | null
    amount: string
    contract_type: string
    block_number: string
    block_timestamp: string
    block_hash: string
    transaction_hash: string
    transaction_type: string
    transaction_index: string
    log_index: number
    operator: string
    verified: number
  }
  
  export interface GetTransfersFromContract {
    collectionAddress: string
    pagePointer?: string
    currentResult?: NftTransfer[]
    lastBlock?: number
  }
  
  export interface TransferFromContractResult {
    latest_transfers : NftTransfer[]
    latest_block_number : number
    contract_address : string
  }