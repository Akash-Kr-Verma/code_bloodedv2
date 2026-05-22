import "dotenv/config";

import express from "express";
import cors from "cors";

import { ethers } from "ethers";

import {
  BASE_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_TYPE,
  TYI_USD_PAYMENT_COIN,
  UGFClient,
} from "@tychilabs/ugf-testnet-js";

const app = express();

app.use(cors());
app.use(express.json());

const provider =
  new ethers.JsonRpcProvider(
    process.env.RPC_BASE_SEPOLIA
  );

const wallet =
  new ethers.Wallet(
    process.env.USER_PRIVATE_KEY,
    provider
  );

const client = new UGFClient({
  baseUrl:
    "https://gateway.universalgasframework.com",
});

const ERC20_ABI = [
  "function transfer(address to,uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
];

app.post("/gasless-transfer", async (req, res) => {
  try {
    const { recipient, amount } =
      req.body;

    const token =
      new ethers.Contract(
        process.env.TOKEN_ADDRESS,
        ERC20_ABI,
        wallet
      );

    const decimals =
      await token.decimals();

    const parsedAmount =
      ethers.parseUnits(
        amount,
        decimals
      );

    // AUTH
    await client.auth.login(wallet);

    // ENCODE TRANSFER
    const data =
      token.interface.encodeFunctionData(
        "transfer",
        [recipient, parsedAmount]
      );

    // GET QUOTE
    const quote =
      await client.quote.get({
        payment_coin:
          TYI_USD_PAYMENT_COIN,

        payer_address:
          wallet.address,

        payment_chain:
          BASE_SEPOLIA_CHAIN_ID,

        payment_chain_type:
          BASE_SEPOLIA_CHAIN_TYPE,

        tx_object:
          JSON.stringify({
            from: wallet.address,
            to: process.env.TOKEN_ADDRESS,
            data,
            value: "0",
          }),

        dest_chain_id:
          BASE_SEPOLIA_CHAIN_ID,

        dest_chain_type:
          BASE_SEPOLIA_CHAIN_TYPE,
      });

    // PAY WITH TYI
    await client.payment.x402.execute({
      quote,
      signer: wallet,
    });

    // EXECUTE SPONSORED TX
    const { userTxHash } =
      await client.chains.evm.sponsorAndExecute(
        quote.digest,
        wallet,
        async () => ({
          to: process.env.TOKEN_ADDRESS,
          data,
          value: 0n,
        })
      );

    res.json({
      success: true,
      txHash: userTxHash,
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      error:
        err?.message ||
        "Transfer failed",
    });
  }
});

app.listen(4000, () => {
  console.log(
    "Backend running on port 4000"
  );
});