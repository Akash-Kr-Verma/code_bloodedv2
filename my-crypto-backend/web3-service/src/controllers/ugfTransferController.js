const { ethers } = require("ethers");
const { 
    BASE_SEPOLIA_CHAIN_ID, 
    BASE_SEPOLIA_CHAIN_TYPE, 
    TYI_USD_PAYMENT_COIN, 
    UGFClient 
} = require("@tychilabs/ugf-testnet-js");
const Transaction = require("../models/Transaction");

// Initialize the Tychi Labs Client Staging Gateway
const client = new UGFClient({
    baseUrl: "https://gateway.universalgasframework.com",
});

const ERC20_ABI = [
    "function transfer(address to,uint256 amount) returns (bool)",
    "function decimals() view returns (uint8)",
];

// =========================================================================
// GASLESS ERC20 TOKEN TRANSFER CONTROLLER (NATIVE COIN BOUND)
// =========================================================================
exports.executeGaslessTransfer = async (req, res) => {
    const { recipient, amount } = req.body;
    const authenticatedUser = req.user; 

    if (!recipient || !amount) {
        return res.status(400).json({ success: false, error: "Missing parameters: recipient and amount required." });
    }

    try {
        console.log(`\n[UGF TRANSFER] Initializing gasless token asset transfer pipeline...`);

        const provider = new ethers.JsonRpcProvider("https://sepolia.base.org");
        const operatorKey = process.env.USER_PRIVATE_KEY || process.env.OPERATOR_PRIVATE_KEY;
        const serverOperatorWallet = new ethers.Wallet(operatorKey, provider);

        // ✅ Uses process.env.TOKEN_ADDRESS if specified, fallback to official USDC address
        const tokenAddress = process.env.TOKEN_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

        const token = new ethers.Contract(tokenAddress, ERC20_ABI, serverOperatorWallet);
        const decimals = await token.decimals();
        const parsedAmount = ethers.parseUnits(amount.toString(), decimals);

        console.log(`[UGF TRANSFER] Authenticating operator context: ${serverOperatorWallet.address}`);
        await client.auth.login(serverOperatorWallet);

        const data = token.interface.encodeFunctionData("transfer", [
            recipient.toLowerCase(), 
            parsedAmount
        ]);

        console.log(`[UGF TRANSFER] Fetching optimized transaction route quote...`);
        
        // ✅ Uses the exact SDK-exported TYI_MOCK_USD reference token constant
        const quote = await client.quote.get({
            payment_coin: TYI_USD_PAYMENT_COIN, 
            payer_address: serverOperatorWallet.address.toLowerCase(),
            payment_chain: BASE_SEPOLIA_CHAIN_ID,
            payment_chain_type: BASE_SEPOLIA_CHAIN_TYPE,
            tx_object: JSON.stringify({
                from: serverOperatorWallet.address.toLowerCase(),
                to: tokenAddress.toLowerCase(),
                data,
                value: "0",
            }),
            dest_chain_id: BASE_SEPOLIA_CHAIN_ID,
            dest_chain_type: BASE_SEPOLIA_CHAIN_TYPE,
        });

        console.log(`[UGF TRANSFER] Settling gas premium via x402 module...`);
        await client.payment.x402.execute({
            quote,
            signer: serverOperatorWallet,
        });

        console.log(`[UGF TRANSFER] Broadcasting sponsored transaction block to network...`);
        const { userTxHash } = await client.chains.evm.sponsorAndExecute(
            quote.digest,
            serverOperatorWallet,
            async () => ({
                to: tokenAddress.toLowerCase(),
                data,
                value: 0n,
            })
        );

        console.log(`[UGF SUCCESS] Gasless transfer confirmed! Hash: ${userTxHash}`);

        await Transaction.create({
            userId: parseInt(authenticatedUser.id),
            tx_hash: userTxHash.toLowerCase(),
            network: 'base_sepolia',
            from_address: serverOperatorWallet.address.toLowerCase(),
            to_address: recipient.toLowerCase(),
            amount: amount.toString(),
            token_symbol: 'TYI_MOCK_USD',
            status: 'SUCCESS'
        });

        res.status(200).json({
            success: true,
            txHash: userTxHash,
            message: "Gasless token transfer executed and archived successfully!"
        });

    } catch (err) {
        console.log("\n============= 🛠️ UGF GATEWAY DIAGNOSTIC LOG =============");
        if (err.response && err.response.data) {
            console.error("❌ UGF Gateway Rejected Request with status:", err.response.status);
            console.error("📝 Error Message Details:", JSON.stringify(err.response.data, null, 2));
        } else {
            console.error("❌ System Exception Message:", err.message || err);
        }
        console.log("=========================================================\n");

        res.status(500).json({
            success: false,
            error: err.response?.data?.message || err.message || "Internal gasless transfer failure."
        });
    }
};