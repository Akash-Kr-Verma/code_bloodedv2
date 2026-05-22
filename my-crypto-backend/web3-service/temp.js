const { ethers } = require("ethers");
const {
  BASE_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_TYPE,
  TYI_USD_PAYMENT_COIN,
  UGFClient,
} = require("@tychilabs/ugf-testnet-js");

const PRIVATE_KEY = "YOUR_PRIVATE_KEY";

// Wrap everything in async function since CommonJS
// does not support top-level await
async function main() {
  try {
    // Provider
    const provider = new ethers.JsonRpcProvider(
      "https://sepolia.base.org"
    );

    // Wallet
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    // Client
    const client = new UGFClient();

    console.log("Wallet:", wallet.address);

    // 1. Authenticate — prove wallet ownership to UGF
    await client.auth.login(wallet);

    console.log("Authenticated!");

    // 2. Quote — describe the destination action
    const quote = await client.quote.get({
      payer_address: wallet.address,
      tx_object: JSON.stringify({
        from: wallet.address,
        to: "0xRecipient",
        data: "0x",
        value: "0",
      }),
    });

    console.log("Quote received:");
    console.log(quote);

    // 3. Settle — authorize TYI transfer
    await client.payment.x402.execute({
      quote,
      signer: wallet,
    });

    console.log("Payment settled!");

    // 4. Execute — sponsored transaction
    const { userTxHash } =
      await client.chains.evm.sponsorAndExecute(
        quote.digest,
        wallet,
        async () => ({
          to: "0xRecipient",
          data: "0x",
          value: 0n,
        })
      );

    console.log("Transaction successful!");
    console.log("Tx Hash:", userTxHash);
  } catch (error) {
    console.error("Error:");
    console.error(error);
  }
}

main();