const { ethers } = require('ethers');

const NETWORKS = {
    ethereum_sepolia: {
        name: "Ethereum Sepolia",
        ticker: "ETH",
        rpc: "https://ethereum-sepolia-rpc.publicnode.com",
        chainId: "0xaa36a7",
         coingeckoId: "ethereum" // Uses ETH market data
    },
    base_sepolia: {
        name: "Base Sepolia",
        ticker: "ETH",
        rpc: "https://sepolia.base.org",
        chainId: "0x14a34",
         coingeckoId: "ethereum" // Uses ETH market data
    },
    polygon_amoy: {
        name: "Polygon Amoy",
        ticker: "POL",
        rpc: "https://rpc-amoy.polygon.technology",
        chainId: "0x13882",
        coingeckoId: "polygon-ecosystem-token" // POL token pricing
    }
};

// Initialize providers
const providers = {
    ethereum_sepolia: new ethers.JsonRpcProvider(NETWORKS.ethereum_sepolia.rpc),
    base_sepolia: new ethers.JsonRpcProvider(NETWORKS.base_sepolia.rpc),
    polygon_amoy: new ethers.JsonRpcProvider(NETWORKS.polygon_amoy.rpc)
};

module.exports = { NETWORKS, providers };