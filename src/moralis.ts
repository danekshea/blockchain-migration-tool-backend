import axios from "axios";
import "dotenv/config";
import {
  TokenTransferResponse,
} from "./type";
import * as fs from "fs";
import { originCollectionAddress } from "./config";

async function getTransfersFromContract(collectionAddress:string, pagePointer:string) {
  const chain: string = "polygon";
  const pagePointerQueryString = pagePointer ? `cursor=${pagePointer}` : "";

  // [?] Undocumented direction=to
  const url = `https://deep-index.moralis.io/api/v2/nft/${collectionAddress}/transfers?chain=${chain}&format=decimal&direction=to&${pagePointerQueryString}`;

  try {
    // console.log(`Fetching data from ${url}`)
    const { status, data } = await axios.get<TokenTransferResponse>(url, {
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.MORALIS_API_KEY || "",
      },
    });

    console.log(data.result);

    if (status !== 200) {
      throw new Error(`Unable to retrieve transfers from contract ${collectionAddress}`);
    }

    console.log(`Fetched ${data.result.length} transfers from contract ${collectionAddress}`);
  } catch (err) {
    console.log(err);
  }
};

getTransfersFromContract(originCollectionAddress, "");
