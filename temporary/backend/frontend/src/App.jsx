import { useState } from "react";

import axios from "axios";

import { ethers } from "ethers";

import toast, {
  Toaster,
} from "react-hot-toast";

export default function App() {
  const [address, setAddress] =
    useState("");

  const [recipient, setRecipient] =
    useState("");

  const [amount, setAmount] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  async function connectWallet() {
    try {
      if (!window.ethereum) {
        toast.error(
          "Install MetaMask"
        );

        return;
      }

      const provider =
        new ethers.BrowserProvider(
          window.ethereum
        );

      await provider.send(
        "eth_requestAccounts",
        []
      );

      const signer =
        await provider.getSigner();

      const addr =
        await signer.getAddress();

      setAddress(addr);

      toast.success(
        "Wallet connected"
      );

    } catch (err) {
      console.error(err);

      toast.error(
        "Connection failed"
      );
    }
  }

  async function sendGasless() {
    try {
      if (!recipient || !amount) {
        toast.error(
          "Fill all fields"
        );

        return;
      }

      setLoading(true);

      toast.loading(
        "Sending gasless transaction...",
        {
          id: "tx",
        }
      );

const res = await axios.post(
  "http://localhost:4000/gasless-transfer",
  {
    recipient,
    amount,
    userAddress: address,
  }
);

      toast.success(
        "Gasless transfer complete!",
        {
          id: "tx",
        }
      );

      console.log(
        res.data.txHash
      );

    } catch (err) {
      console.error(err);

      toast.error(
        err?.response?.data
          ?.error ||
          "Transfer failed",
        {
          id: "tx",
        }
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: 500,
        margin: "40px auto",
        padding: 20,
        fontFamily: "Arial",
      }}
    >
      <Toaster />

      <h1>
        True Gasless Transfer
      </h1>

      <p>
        Powered by UGF +
        TYI_MOCK_USD
      </p>

      {!address ? (
        <button
          onClick={
            connectWallet
          }
        >
          Connect MetaMask
        </button>
      ) : (
        <>
          <p>
            Connected:
            <br />
            {address}
          </p>

          <input
            placeholder="Recipient"
            value={recipient}
            onChange={(e) =>
              setRecipient(
                e.target.value
              )
            }
            style={{
              width: "100%",
              padding: 10,
              marginBottom: 10,
            }}
          />

          <input
            placeholder="Amount"
            value={amount}
            onChange={(e) =>
              setAmount(
                e.target.value
              )
            }
            style={{
              width: "100%",
              padding: 10,
              marginBottom: 10,
            }}
          />

          <button
            disabled={loading}
            onClick={
              sendGasless
            }
          >
            {loading
              ? "Processing..."
              : "Send Gasless"}
          </button>
        </>
      )}
    </div>
  );
}