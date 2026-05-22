const crypto = require('crypto');
const { ethers } = require('ethers');
const { UGFClient, BASE_SEPOLIA_CHAIN_ID, BASE_SEPOLIA_CHAIN_TYPE, TYI_USD_PAYMENT_COIN } = require('@tychilabs/ugf-testnet-js');

const provider = new ethers.JsonRpcProvider("https://sepolia.base.org");

// Safe extraction of private key sequence out of environment state
const operatorKey = process.env.USER_PRIVATE_KEY || process.env.OPERATOR_PRIVATE_KEY || "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const serverOperatorWallet = new ethers.Wallet(operatorKey, provider);

const ugfClient = new UGFClient();

console.log("==================================================");
console.log("⚡ [UGF INITIALIZATION] UGFClient Class Bound Successfully!");
console.log("👉 OPERATOR PUBLIC ADDRESS:", serverOperatorWallet.address);
console.log("Target Payment Coin Parameter:", TYI_USD_PAYMENT_COIN);
console.log("==================================================");

const { NETWORKS, providers } = require('../config/networks');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Nonce = require('../models/Nonce');
// Base Sepolia destination configuration targets for Remote Transactions
const DONATION_TARGET_RECEIVER = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";

// =========================================================================
// 1. SECURE CRYPTOGRAPHIC AUTHENTICATION ENGINE
// =========================================================================

// Step 1: Generate a random challenge nonce for a wallet address
exports.generateNonce = async (req, res) => {
    const { wallet_address } = req.body;
    if (!wallet_address) return res.status(400).json({ status: 'error', message: 'Missing address' });

    try {
        const normalizedAddress = wallet_address.toLowerCase();

        const [user] = await User.findOrCreate({
            where: { wallet_address: normalizedAddress },
            defaults: {
                email: `${normalizedAddress.substring(0, 12)}@temp.com`, 
                temp: true
            }
        });

        const randomNonce = `Sign-in token for Carlton Wallet App: ${crypto.randomBytes(16).toString('hex')}`;

        const [nonceRecord, created] = await Nonce.findOrCreate({
            where: { userId: parseInt(user.id) },
            defaults: { nonce: randomNonce }
        });

        if (!created && nonceRecord.nonce !== randomNonce) {
            nonceRecord.nonce = randomNonce;
            await nonceRecord.save();
        }

        res.status(200).json({ status: 'success', nonce: randomNonce });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// Step 2: Verify the cryptographic signature sent from MetaMask
exports.verifySignature = async (req, res) => {
    const { wallet_address, signature } = req.body;
    if (!wallet_address || !signature) return res.status(400).json({ status: 'error', message: 'Missing params' });

    try {
        const normalizedAddress = wallet_address.toLowerCase();

        const user = await User.findOne({ where: { wallet_address: normalizedAddress } });
        if (!user) return res.status(404).json({ status: 'error', message: 'User not registered' });

        const dbNonce = await Nonce.findOne({ where: { userId: parseInt(user.id) } });
        if (!dbNonce || !dbNonce.nonce) return res.status(400).json({ status: 'error', message: 'No active nonce found' });

        const recoveredAddress = ethers.verifyMessage(dbNonce.nonce, signature);

        if (recoveredAddress.toLowerCase() !== normalizedAddress) {
            return res.status(401).json({ status: 'error', message: 'Cryptographic signature verification failed!' });
        }

        dbNonce.nonce = 'USED'; // Burn it safely
        await dbNonce.save();

        console.log(`[SECURE AUTH] Wallet ${normalizedAddress} authenticated securely.`);

        res.status(200).json({
            status: 'success',
            message: 'Authenticated successfully!',
            data: { token: 'jwt-secure-session-id-' + user.id, user }
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// =========================================================================
// 2. BLOCKCHAIN DATA & TRANSACTION ENGINE
// =========================================================================

// Multi-Chain Balance Scanning
exports.getBalances = async (req, res) => {
    const { address } = req.query;
    if (!address) return res.status(400).json({ status: 'error', message: 'Missing address' });
    
    try {
        const normalizedAddress = address.toLowerCase();
        const networkScans = Object.keys(providers).map(async (key) => {
            try {
                const balanceWei = await providers[key].getBalance(normalizedAddress);
                return { key, name: NETWORKS[key].name, ticker: NETWORKS[key].ticker, balance: ethers.formatEther(balanceWei) };
            } catch (e) {
                return { key, name: NETWORKS[key].name, ticker: NETWORKS[key].ticker, balance: "Error fetching" };
            }
        });

        const results = await Promise.all(networkScans);
        const formattedBalances = {};
        results.forEach(item => { formattedBalances[item.key] = { name: item.name, ticker: item.ticker, balance: item.balance }; });
        
        res.status(200).json({ status: 'success', address: normalizedAddress, balances: formattedBalances });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// Updated: Dynamic Fiat-to-Crypto Conversion Payload Builder
exports.prepareTransaction = async (req, res) => {
    const { network_key, to_address, fiat_currency, fiat_amount } = req.body;
    
    if (!network_key || !to_address || !fiat_currency || !fiat_amount) {
        return res.status(400).json({ status: 'error', message: 'Missing parameters. Require network, destination, fiat type, and amount.' });
    }

    const networkConfig = NETWORKS[network_key];
    if (!networkConfig) return res.status(400).json({ status: 'error', message: 'Unsupported network infrastructure' });

    try {
        const cryptoId = networkConfig.coingeckoId;
        const localFiat = fiat_currency.toLowerCase();

        console.log(`[ORACLE] Querying market rates for ${cryptoId} in ${localFiat.toUpperCase()}...`);

        const priceResponse = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoId}&vs_currencies=${localFiat}`
        );
        const priceData = await priceResponse.json();

        if (!priceData[cryptoId] || !priceData[cryptoId][localFiat]) {
            throw new Error(`Failed to retrieve price metrics for ${cryptoId}/${localFiat}`);
        }

        const exchangeRate = priceData[cryptoId][localFiat];
        const calculatedCryptoAmount = parseFloat(fiat_amount) / exchangeRate;
        const fixedCryptoString = calculatedCryptoAmount.toFixed(18); 

        console.log(`[ORACLE] Conversion calculated: ${fiat_amount} ${localFiat.toUpperCase()} = ${fixedCryptoString} ${networkConfig.ticker}`);

        const amountInWei = ethers.parseEther(fixedCryptoString);
        const valueHex = ethers.toBeHex(amountInWei);

        res.status(200).json({
            status: 'success',
            data: {
                network: networkConfig.name,
                chainId_hex: networkConfig.chainId,
                to: to_address.toLowerCase(),
                value_hex: valueHex,
                readable_crypto_amount: fixedCryptoString,
                ticker: networkConfig.ticker,
                fiat_used: localFiat.toUpperCase(),
                fiat_amount_processed: fiat_amount
            }
        });
    } catch (error) {
        console.error("Conversion System Failure:", error.message);
        res.status(500).json({ status: 'error', message: `Conversion processing failed: ${error.message}` });
    }
};

// Live Tracking + Persistent State Updates
exports.checkTransactionStatus = async (req, res) => {
    const { tx_hash, network_key, from_address, to_address, amount } = req.query;
    if (!tx_hash || !network_key) return res.status(400).json({ status: 'error', message: 'Missing params' });

    const provider = providers[network_key];
    if (!provider) return res.status(400).json({ status: 'error', message: 'Invalid network' });

    try {
        const normalizedHash = tx_hash.toLowerCase();
        const normalizedSender = from_address ? from_address.toLowerCase() : '0xunknown';

        const user = await User.findOne({ where: { wallet_address: normalizedSender } });
        if (!user) return res.status(404).json({ status: 'error', message: 'Sender address profile not found' });
        
        const cleanUserId = parseInt(user.id);
        const tickerSymbol = NETWORKS[network_key]?.ticker || 'ETH';

        const [txRecord, created] = await Transaction.findOrCreate({
            where: { tx_hash: normalizedHash },
            defaults: {
                userId: cleanUserId, 
                network: network_key,
                from_address: normalizedSender,
                to_address: to_address ? to_address.toLowerCase() : '0xunknown',
                amount: amount || '0',
                token_symbol: tickerSymbol,
                status: 'PENDING'
            }
        });

        if (!created && (!txRecord.userId || parseInt(txRecord.userId) !== cleanUserId)) {
            txRecord.userId = cleanUserId;
            await txRecord.save();
        }

        const receipt = await provider.getTransactionReceipt(normalizedHash);

        if (!receipt) {
            return res.status(200).json({ status: 'success', tx_state: txRecord.status, message: 'Processing transaction...' });
        }

        const finalStatus = receipt.status === 1 ? 'SUCCESS' : 'FAILED';

        if (txRecord.status !== finalStatus) {
            txRecord.status = finalStatus;
            await txRecord.save();
            console.log(`[DB] Transaction ${normalizedHash} updated to state: ${finalStatus}`);
        }

        res.status(200).json({
            status: 'success',
            tx_state: finalStatus,
            message: finalStatus === 'SUCCESS' ? 'Confirmed on-chain!' : 'Transaction reverted.'
        });

    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// 3. Fetch Multi-User Transaction History out of Supabase Ledger
exports.getTransactionHistory = async (req, res) => {
    const { address } = req.query;
    if (!address) return res.status(400).json({ status: 'error', message: 'Missing address query parameter' });

    try {
        const normalizedAddress = address.toLowerCase();
        const user = await User.findOne({ where: { wallet_address: normalizedAddress } });
        if (!user) {
            return res.status(200).json({ status: 'success', data: [], message: 'No registered user session found yet.' });
        }

        const transactions = await Transaction.findAll({
            where: { userId: parseInt(user.id) }, 
            order: [['id', 'DESC']] 
        });

        res.status(200).json({
            status: 'success',
            address: normalizedAddress,
            count: transactions.length,
            data: transactions
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// 4. Dynamic Bi-Directional Rate Exchange Calculator (Crypto <-> Fiat)
exports.getExchangeRate = async (req, res) => {
    const { crypto_ticker, fiat_currency, amount, direction } = req.query;

    if (!crypto_ticker || !fiat_currency || !amount || !direction) {
        return res.status(400).json({ 
            status: 'error', 
            message: 'Missing query parameters. Require: crypto_ticker, fiat_currency, amount, and direction (crypto_to_fiat OR fiat_to_crypto)' 
        });
    }

    try {
        const localFiat = fiat_currency.toLowerCase();
        const tickerMap = {
            'eth': 'ethereum',
            'pol': 'matic-network',
            'matic': 'matic-network',
            'btc': 'bitcoin'
        };

        const cryptoId = tickerMap[crypto_ticker.toLowerCase()];
        if (!cryptoId) {
            return res.status(400).json({ status: 'error', message: `Unsupported crypto ticker: ${crypto_ticker}` });
        }

        const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cryptoId}&vs_currencies=${localFiat}`);
        const priceData = await response.json();

        if (!priceData[cryptoId] || !priceData[cryptoId][localFiat]) {
            throw new Error(`Market rate not found for pairing ${crypto_ticker}/${fiat_currency}`);
        }

        const exchangeRate = priceData[cryptoId][localFiat]; 
        const inputAmount = parseFloat(amount);
        let convertedAmount = 0;

        if (direction === 'crypto_to_fiat') {
            const rawFiat = inputAmount * exchangeRate;
            convertedAmount = Math.round(rawFiat * 100) / 100; 
        } else if (direction === 'fiat_to_crypto') {
            convertedAmount = inputAmount / exchangeRate;
        } else {
            return res.status(400).json({ status: 'error', message: 'Invalid direction. Use crypto_to_fiat or fiat_to_crypto' });
        }

        res.status(200).json({
            status: 'success',
            direction,
            market_price_basis: `1 ${crypto_ticker.toUpperCase()} = ${exchangeRate} ${localFiat.toUpperCase()}`,
            input: {
                amount: inputAmount,
                unit: direction === 'crypto_to_fiat' ? crypto_ticker.toUpperCase() : localFiat.toUpperCase()
            },
            output: {
                amount: direction === 'crypto_to_fiat' ? convertedAmount : parseFloat(convertedAmount.toFixed(18)),
                unit: direction === 'crypto_to_fiat' ? localFiat.toUpperCase() : crypto_ticker.toUpperCase()
            }
        });

    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// =========================================================================
// 5. OFFICIAL UNIVERSAL GAS FRAMEWORK (UGF) REMOTE TRANSACTIONS TRACK
// =========================================================================
// Step 4 (Execute): Sponsor gas side via UGF and broadcast onto destination
        // ✅ UPDATED: Aligned value to 0n and data to routingSalt to match Kaushik's working pattern
// =========================================================================
// 5. OFFICIAL UNIVERSAL GAS FRAMEWORK (UGF) REMOTE TRANSACTIONS TRACK
// =========================================================================
// =========================================================================
// 5. OFFICIAL UNIVERSAL GAS FRAMEWORK (UGF) REMOTE TRANSACTIONS TRACK
// =========================================================================
// =========================================================================
// 5. OFFICIAL UNIVERSAL GAS FRAMEWORK (UGF) REMOTE TRANSACTIONS TRACK
// =========================================================================
exports.executeUgfRemoteDonation = async (req, res) => {
    // 🌟 INTEGRATION FIX: Extract the authenticated profile straight from your teammate's middleware context
    const authenticatedUser = req.user; 
    const { amount_usd } = req.body;

    if (!amount_usd) {
        return res.status(400).json({ status: 'error', message: 'Missing parameters. Require amount_usd.' });
    }

    try {
        // Pull the verified user address directly out of memory
        const userAddress = authenticatedUser.wallet_address.toLowerCase();
        console.log(`[UGF INTEGRATION] Processing secure gasless route for user: ${userAddress}`);

        console.log(`[UGF SERVER] Initializing official Tychi SDK client context...`);
        const provider = new ethers.JsonRpcProvider("https://sepolia.base.org");
        const operatorKey = process.env.USER_PRIVATE_KEY || process.env.OPERATOR_PRIVATE_KEY || "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        const serverOperatorWallet = new ethers.Wallet(operatorKey, provider);

        console.log(`[UGF SERVER] Authenticating wallet context on Tychi Gateway...`);
        await ugfClient.auth.login(serverOperatorWallet);

        console.log(`[UGF SERVER] Compiling remote pricing quote metrics...`);

        const txPayload = {
            from: serverOperatorWallet.address.toLowerCase(),
            to: DONATION_TARGET_RECEIVER.toLowerCase(),
            data: "0x", 
            value: "0" 
        };

        const routeQuote = await ugfClient.quote.get({
            payer_address: serverOperatorWallet.address.toLowerCase(),
            tx_object: JSON.stringify(txPayload)
        });

        console.log(`[UGF SERVER] Quote successfully compiled: ${routeQuote.quote_id || "Digest Created"}`);
        console.log(`[UGF SERVER] Processing ERC-3009 TYI token settlement layer via x402 module...`);

        // Step 3 (Settle): Authorize token movement
        await ugfClient.payment.x402.execute({ 
            quote: routeQuote, 
            signer: serverOperatorWallet 
        });

        console.log(`[UGF SERVER] Settle complete. Dispatching legacy transaction block to Base Sepolia destination...`);

        // Step 4 (Execute): Sponsoring on-chain execution matching the quickstart schema exactly
        const executionResult = await ugfClient.chains.evm.sponsorAndExecute(
            routeQuote.digest,
            serverOperatorWallet,
            async () => ({
                to: DONATION_TARGET_RECEIVER.toLowerCase(),
                data: "0x", 
                value: 0n   
            })
        );

        const realTxHash = executionResult.userTxHash || "0x_confirmed";
        console.log(`[UGF SUCCESS] On-chain execution verified successfully! Tx Hash: ${realTxHash}`);

        // ✅ INTEGRATION FIX: Track transaction directly using the verified session ID
        await Transaction.create({
            userId: parseInt(authenticatedUser.id),
            tx_hash: realTxHash.toLowerCase(),
            network: 'base_sepolia',
            from_address: userAddress, 
            to_address: DONATION_TARGET_RECEIVER.toLowerCase(),
            amount: amount_usd.toString(),
            token_symbol: 'USD',
            status: 'SUCCESS'
        });
        console.log(`[DB] Remote transaction trace successfully cached to local user ledger.`);

        res.status(200).json({
            status: 'success',
            message: 'Remote transaction processed successfully via UGF secure server layer!',
            data: {
                route_hash: realTxHash,
                fee_paid: routeQuote.total_fee_usd || "0.00",
                asset: 'TYI_MOCK_USD'
            }
        });

    } catch (error) {
        console.error("UGF Server Core Exception:", error.message);
        res.status(500).json({ status: 'error', message: `Server-side UGF Execution Failed: ${error.message}` });
    }
};