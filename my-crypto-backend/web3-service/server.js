const express = require('express');
const cors = require('cors');
require('dotenv').config();
const walletRoutes = require('./src/routes/walletRoutes');
const authRoutes = require('./src/routes/authRoutes'); // 🔒 Mount your clean authentication router
const sequelize = require('./src/config/db');

// Sync Database Tables
sequelize.sync({ alter: true })
    .then(() => console.log('📂 PostgreSQL Tables Synced Successfully'))
    .catch(err => console.error('❌ Database Sync Failed:', err));

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// Bind our API routers cleanly
app.use('/api', walletRoutes);
app.use('/api/auth', authRoutes); // 🔒 Connects /signup, /login, and /verify routing lanes

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Integrated UGF + JWT Multi-Engine Tester</title>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css">
            <script src="https://cdn.jsdelivr.net/npm/toastify-js"></script>
            <style>
                body { font-family: 'Arial', monospace, sans-serif; padding: 20px; background: #f4f4f9; color: #333; }
                button { padding: 12px 24px; font-size: 14px; font-weight: bold; cursor: pointer; margin-bottom: 20px; margin-right: 10px; border-radius: 4px; border: 1px solid #ccc; }
                #connectBtn { background-color: #f6851b; color: white; border: none; }
                #sendToBackendBtn { background-color: #007bff; color: white; border: none; }
                #balanceBtn { background-color: #28a745; color: white; border: none; }
                #historyBtn { background-color: #6f42c1; color: white; border: none; }
                #sendTxBtn { background-color: #dc3545; color: white; border: none; }
                #sendGaslessBtn { background-color: #000000; color: white; border: none; width: 100%; margin-top: 5px; }
                button:disabled { opacity: 0.5; cursor: not-allowed; }
                .panel { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #ddd; }
                #logs { background: #111; color: #0f0; padding: 15px; border-radius: 5px; min-height: 250px; overflow-y: auto; font-size: 14px; line-height: 1.5; white-space: pre-wrap; }
                input, select { padding: 12px; width: 100%; box-sizing: border-box; font-family: monospace; margin-bottom: 15px; display: block; border-radius: 4px; border: 1px solid #ccc; }
                label { font-weight: bold; font-size: 13px; display: block; margin-bottom: 5px; }
                .flex-container { display: flex; gap: 20px; }
                .flex-child { flex: 1; min-width: 0; }
            </style>
        </head>
        <body>
            <h2>FasalIQ Integrated Wallet Tester Panel</h2>
            <div class="panel">
                <button id="connectBtn">1. Connect MetaMask</button>
                <button id="sendToBackendBtn" disabled>2. Secure Login (Teammate JWT Flow)</button>
                <button id="balanceBtn" disabled>3. Fetch Balances</button>
                <button id="historyBtn" disabled>4. Fetch Cloud Ledger History</button>
            </div>
            
            <div class="flex-container">
                <div class="panel flex-child">
                    <h3>Engine A: Quick Donation Router</h3>
                    <label>Target Blockchain Network:</label>
                    <select id="txNetwork">
                        <option value="base_sepolia" selected>Base Sepolia (ETH)</option>
                    </select>
                    
                    <label>Choose Currency Profile:</label>
                    <select id="fiatCurrency">
                        <option value="usd" selected>US Dollar (USD)</option>
                        <option value="inr">Indian Rupee (INR)</option>
                    </select>

                    <label>Enter Amount in Selected Fiat (Auto-Converted):</label>
                    <input type="number" id="fiatAmount" value="10">
                    
                    <label>Destination Wallet Address:</label>
                    <input type="text" id="txTo" value="0x71C7656EC7ab88b098defB751B7401B5f6d8976F" disabled>
                    
                    <button id="sendTxBtn" disabled style="width: 100%;">Execute Gasless UGF Transaction</button>
                </div>

                <div class="panel flex-child">
                    <h3>Engine B: True Gasless ERC20 Transfer</h3>
                    <p style="color: #666; font-size: 12px; margin-top: -10px;">Direct contract interactions routed through Standalone Port 4000</p>
                    
                    <label>Recipient Wallet Address:</label>
                    <input type="text" id="recipientInput" placeholder="Recipient address (0x...)">

                    <label>Token Amount to Send:</label>
                    <input type="number" id="amountInput" placeholder="Amount (e.g. 50)">

                    <button id="sendGaslessBtn" disabled>Send Gasless</button>
                </div>
            </div>

            <div id="logs">System Ready...<br></div>

            <script>
                const connectBtn = document.getElementById('connectBtn');
                const sendToBackendBtn = document.getElementById('sendToBackendBtn');
                const balanceBtn = document.getElementById('balanceBtn');
                const historyBtn = document.getElementById('historyBtn');
                const sendTxBtn = document.getElementById('sendTxBtn');
                const sendGaslessBtn = document.getElementById('sendGaslessBtn');
                const recipientInput = document.getElementById('recipientInput');
                const amountInput = document.getElementById('amountInput');
                const logs = document.getElementById('logs');
                
                let userWalletAddress = "";

                function log(msg) { logs.innerHTML += "> " + msg + "<br>"; }

                const toast = {
                    success: (msg) => Toastify({ text: msg, duration: 4000, style: { background: "#28a745" } }).showToast(),
                    error: (msg) => Toastify({ text: msg, duration: 4000, style: { background: "#dc3545" } }).showToast(),
                    info: (msg) => Toastify({ text: msg, duration: 3000, style: { background: "#17a2b8" } }).showToast()
                };

                connectBtn.onclick = async () => {
                    if (typeof window.ethereum !== 'undefined') {
                        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                        userWalletAddress = accounts[0];
                        log("Connected to: " + userWalletAddress);
                        toast.success("Wallet connected");
                        sendToBackendBtn.disabled = false;
                    } else {
                        toast.error("Install MetaMask");
                    }
                };

                sendToBackendBtn.onclick = async () => {
                    try {
                        log("Requesting unique challenge nonce via /api/auth/login endpoint...");
                        const nonceResponse = await fetch("/api/auth/login", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ walletAddress: userWalletAddress })
                        });
                        const nonceData = await nonceResponse.json();
                        
                        let challengeMessage = nonceData.message || nonceData.nonce;
                        
                        if (!challengeMessage && nonceResponse.status === 400) {
                            log("🔄 Wallet unregistered. Automatically registering user via /api/auth/signup lane...");
                            const signupResponse = await fetch("/api/auth/signup", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ walletAddress: userWalletAddress, email: "testuser@fasaliq.com" })
                            });
                            const signupData = await signupResponse.json();
                            challengeMessage = signupData.nonce;
                        }

                        log("Prompting user signature via MetaMask for payload: " + challengeMessage);
                        const signature = await window.ethereum.request({
                            method: 'personal_sign',
                            params: [challengeMessage, userWalletAddress]
                        });

                        log("Transmitting verification token payload to /api/auth/verify handler...");
                        const verifyResponse = await fetch("/api/auth/verify", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ walletAddress: userWalletAddress, signature: signature })
                        });
                        const verifyData = await verifyResponse.json();

                        if (verifyData.token) {
                            log("🔒 Securely Authenticated! JWT Passport Issued.");
                            toast.success("Securely Authenticated!");
                            sessionStorage.setItem("jwt_passport", verifyData.token);
                            
                            balanceBtn.disabled = false;
                            historyBtn.disabled = false;
                            sendTxBtn.disabled = false;
                            sendGaslessBtn.disabled = false;
                        } else {
                            log("❌ Auth failure: " + (verifyData.message || "Verification failed."));
                            toast.error("Verification failed");
                        }
                    } catch (error) {
                        log("Auth sequence halted: " + error.message);
                        toast.error("Connection failed");
                    }
                };

                balanceBtn.onclick = async () => {
                    log("Fetching live asset tracking array from secure wallet provider...");
                    const savedPassport = sessionStorage.getItem("jwt_passport");

                    try {
                        const response = await fetch("/api/wallet/balance?address=" + userWalletAddress, {
                            method: "GET",
                            headers: { "Authorization": "Bearer " + savedPassport }
                        });
                        const data = await response.json();
                        logs.innerHTML += "<h3>Live Balances:</h3><pre style='background: #222; padding: 10px; border-radius: 4px; color: #00ff66;'>" + 
                                          JSON.stringify(data, null, 2) + 
                                          "</pre><br>";
                    } catch (err) {
                        log("Error pulling balances: " + err.message);
                    }
                };

                historyBtn.onclick = async () => {
                    log("Querying secure PostgreSQL ledger repository for historical logs...");
                    const savedPassport = sessionStorage.getItem("jwt_passport");

                    try {
                        const response = await fetch("/api/transactions/history?address=" + userWalletAddress, {
                            method: "GET",
                            headers: { "Authorization": "Bearer " + savedPassport }
                        });
                        const data = await response.json();
                        const historyArray = data.data || (Array.isArray(data) ? data : []);
                        
                        log("<h3>Cloud Ledger Rows Found: (" + historyArray.length + ")</h3>");
                        
                        if (historyArray.length === 0) {
                            logs.innerHTML += "➔ No transactions found for this user in the database.<br>";
                        } else {
                            logs.innerHTML += "<pre style='background: #222; padding: 10px; border-radius: 4px; color: #00ff66; overflow-x: auto;'>" + 
                                              JSON.stringify(historyArray, null, 2) + 
                                              "</pre><br>";
                        }
                    } catch (err) {
                        log("Error pulling historical entries: " + err.message);
                    }
                };

                // ENGINE A ROUTE INTERACTION
                sendTxBtn.onclick = async () => {
                    const fiatValue = document.getElementById('fiatAmount').value;
                    const savedPassport = sessionStorage.getItem("jwt_passport");

                    log("🚀 [Engine A] Triggering secure gasless payment execution route...");
                    toast.info("Sending transaction...");

                    try {
                        const response = await fetch("/api/transactions/ugf-remote-send", {
                            method: "POST",
                            headers: { 
                                "Content-Type": "application/json",
                                "Authorization": "Bearer " + savedPassport
                            },
                            body: JSON.stringify({ amount_usd: fiatValue })
                        });
                        const resultData = await response.json();

                        if (response.status === 401) throw new Error("Middleware rejected token: Unauthorized.");
                        if (resultData.status !== 'success') throw new Error(resultData.message);

                        log("🎉 UGF Secure Remote Execution Completed Successfully!");
                        log("⛽ Gas fully settled on Base Sepolia backend!");
                        log("🔗 Transaction Hash: " + resultData.data.route_hash);
                        toast.success("Gasless transfer complete!");

                    } catch (error) {
                        log("❌ UGF Route Halting Error: " + error.message);
                        toast.error("Transfer failed");
                    }
                };

                // ✅ ENGINE B ROUTE INTERACTION (Fires directly to isolated microservice running on port 4000)
                sendGaslessBtn.onclick = async () => {
                    const recipient = recipientInput.value;
                    const amount = amountInput.value;

                    if (!recipient || !amount) {
                        toast.error("Fill all fields");
                        return;
                    }

                    log("🚀 [Engine B] Dispatching request payload to isolated Standalone Intercept Bridge...");
                    toast.info("Processing intercept bridge sequence...");

                    try {
                        sendGaslessBtn.disabled = true;
                        sendGaslessBtn.innerText = "Processing...";

                        const response = await fetch("http://localhost:4000/gasless-transfer", {
                            method: "POST",
                            headers: { 
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({ recipient, amount })
                        });
                        const result = await response.json();

                        if (!result.success) throw new Error(result.error || "Microservice execution error.");

                        // ✅ Enhanced Logging displaying both intercept and forwarding pipeline statuses
                        log("🎉 [Engine B] Two-Stage Intercept Sequence Executed Successfully!");
                        log("🔗 Stage 1 (Gasless Vault Collection): " + result.stage1TxHash);
                        log("🔗 Stage 2 (On-Chain Forward Payout):   " + result.stage2TxHash);
                        toast.success("Gasless intercept transfer complete!");

                        amountInput.value = "";
                        recipientInput.value = "";
                    } catch (err) {
                        log("❌ [Engine B] Microservice Communication Halted: " + err.message);
                        toast.error(err.message || "Transfer failed");
                    } finally {
                        sendGaslessBtn.disabled = false;
                        sendGaslessBtn.innerText = "Send Gasless";
                    }
                };
            </script>
        </body>
        </html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("=================================");
    console.log("🚀 Modular Server running on port: " + PORT);
    console.log("=================================");
});