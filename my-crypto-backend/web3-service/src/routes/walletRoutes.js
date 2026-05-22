const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');

// 🔒 Import the clean transfer controller we just built from scratch
const ugfTransferController = require('../controllers/ugfTransferController');

// 🔒 Import the centralized token verification middleware
const { authMiddleware } = require('../middleware/authMiddleware');

// =========================================================================
// NOTE: Legacy authentication routing handlers (generate-nonce, verify-signature)
// have been successfully migrated over to authRoutes.js using the new JWT standard.
// =========================================================================

// ==========================================
// CORE WALLET ENGINE ROUTING (Protected/Private)
// ==========================================
// Fetches multi-chain token balances for the logged-in user profile
router.get('/wallet/balance', authMiddleware, walletController.getBalances);

// Compiles market metric data structures to prepare outcoming payloads
router.post('/transactions/prepare', authMiddleware, walletController.prepareTransaction);

// Verifies on-chain receipts and records status to local repository
router.get('/transactions/status', authMiddleware, walletController.checkTransactionStatus);

// Queries historical transaction records assigned to the user's secure ledger
router.get('/transactions/history', authMiddleware, walletController.getTransactionHistory);

// ==========================================
// PRICE ORACLE UTILITY ROUTING (Public Utility)
// ==========================================
// Kept open/public so the client UI can fetch conversion rates before a user authenticates
router.get('/utils/convert-price', walletController.getExchangeRate);

// ==========================================
// OFFICIAL TYCHI LABS UGF REMOTE ENTRY ROUTES (Protected/Private)
// ==========================================
// Processes secure, gasless asset transfer execution tunnels via the UGF server module
router.post('/transactions/ugf-remote-send', authMiddleware, walletController.executeUgfRemoteDonation);

// 🚀 NEW PROTECTED ENDPOINT: Direct gasless ERC-20 contract token transfers
router.post('/transactions/gasless-transfer', authMiddleware, ugfTransferController.executeGaslessTransfer);

module.exports = router;