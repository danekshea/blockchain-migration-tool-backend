import axios from "axios";
import "dotenv/config";
import { MoralisGetNFTContractTransfersResponse, NftTransfer, TokenTransferResponse } from "./type";
import { chains } from "./utils";
import logger from "./logger";

export async function getTransfersFromContract(
  collectionAddress:string,
  chain:number,
  fromBlock:number,
  toBlock:number,
  cursor:string | undefined

): Promise<MoralisGetNFTContractTransfersResponse> {
  const pagePointerQueryString = cursor ? `cursor=${cursor}` : "";

  const url = `https://deep-index.moralis.io/api/v2/nft/${collectionAddress}/transfers?chain=${chains[chain].shortName}&to_block=${toBlock}&from_block=${fromBlock}&format=decimal&limit=5&${pagePointerQueryString}`;

  try {
    const { status, data } = await axios.get<TokenTransferResponse>(url, {
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.MORALIS_API_KEY || "",
      },
    });

    const transfers: NftTransfer[] = data.result.map((item: any) => ({
      chain: chain,
      tokenAddress: item.token_address.toLowerCase(),
      tokenId: parseInt(item.token_id),
      fromAddress: item.from_address.toLowerCase(),
      toAddress: item.to_address.toLowerCase(),
      blockNumber: parseInt(item.block_number),
      blockTimestamp: new Date(item.block_timestamp),
      transactionHash: item.transaction_hash.toLowerCase(),
    }));
    
    const response: MoralisGetNFTContractTransfersResponse = {
      transfers: transfers,
      cursor: data.cursor,
    };
    return response;
  } catch (err) {
    logger.error(err);
    throw new Error(`Failed to fetch transfers from contract ${collectionAddress}`);
  }
}