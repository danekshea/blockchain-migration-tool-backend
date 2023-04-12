export interface burn {
    chain: number,
    blockNumber?: number,
    timestamp: Date,
    transactionHash?: string,
    transaction_id?: number,
    tokenAddress: string,
    tokenId: number,
    fromAddress?: string,
    toAddress: string
}

export interface mint {

}