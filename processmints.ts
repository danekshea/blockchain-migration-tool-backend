import Moralis from "moralis";

await Moralis.start({
  apiKey: process.env.MORALIS_API_KEY,
  // ...and any other configuration
});

const response = await Moralis.EvmApi.token.getWalletTokenBalances({
    chain: EvmChain.ETHEREUM,
    address: '0x73b638Dd4DB255513b7c67fD0513f588557c4045',
})

console.log(response);