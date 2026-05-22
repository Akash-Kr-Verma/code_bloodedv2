const crypto = require("crypto");
const { verifyMessage } = require("ethers");
const jwt = require("jsonwebtoken");
const User = require("../models/User.js");
const Nonce = require("../models/Nonce.js");

// Endpoints match your exact current routing signatures

// POST: /api/auth/signup
exports.signup = async (req, res) => {
    try {
        const { email, walletAddress } = req.body;
        if (!email || !walletAddress) {
            return res.status(400).json({ message: "Missing required registration parameters." });
        }

        const cleanAddress = walletAddress.toLowerCase();
        const existingUser = await User.findOne({ where: { wallet_address: cleanAddress } });

        if (existingUser) {
            return res.status(400).json({ message: "Wallet already registered." });
        }

        const user = await User.create({ email, wallet_address: cleanAddress });
        const rawNonce = crypto.randomBytes(16).toString("hex");
        await Nonce.create({ nonce: rawNonce, userId: user.id });

        res.status(201).json({ nonce: `Login nonce: ${rawNonce}` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST: /api/auth/login
exports.login = async (req, res) => {
    try {
        const { walletAddress } = req.body;
        if (!walletAddress) {
            return res.status(400).json({ message: "Wallet address parameter required." });
        }

        const cleanAddress = walletAddress.toLowerCase();
        const user = await User.findOne({ where: { wallet_address: cleanAddress } });

        if (!user) {
            return res.status(400).json({ message: "User profile does not exist." });
        }

        // Clean out any stale nonces for this specific user before making a new one
        await Nonce.destroy({ where: { userId: user.id } });

        const rawNonce = crypto.randomBytes(16).toString("hex");
        await Nonce.create({ nonce: rawNonce, userId: user.id });

        res.status(200).json({ message: `Login nonce: ${rawNonce}` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST: /api/auth/verify
exports.verify = async (req, res) => {
    try {
        const { walletAddress, signature } = req.body;
        if (!walletAddress || !signature) {
            return res.status(400).json({ message: "Missing signature parameters." });
        }

        const cleanAddress = walletAddress.toLowerCase();
        const user = await User.findOne({
            where: { wallet_address: cleanAddress },
            include: [{ model: Nonce, as: "Nonce" }]
        });

        if (!user || !user.Nonce) {
            return res.status(400).json({ message: "Active login challenge session expired or not found." });
        }

        // Exact string format reconstruction matching the signed payload string
        const expectedMessage = `Login nonce: ${user.Nonce.nonce}`;
        const recoveredAddress = verifyMessage(expectedMessage, signature).toLowerCase();

        if (recoveredAddress !== cleanAddress) {
            return res.status(401).json({ message: "Cryptographic signature validation failed." });
        }

        // Complete the registration state if they were temporary
        if (user.temp) {
            user.temp = false;
            await user.save();
        }

        // Consume the nonce so it can never be re-used (replays security shield)
        await user.Nonce.destroy();

        // Sign a clean JWT payload containing user metadata
        const token = jwt.sign(
            { id: user.id, wallet: user.wallet_address },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.status(200).json({ token: token });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET: /api/auth/me
exports.getMe = async (req, res) => {
    res.status(200).json(req.user);
};