"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_provider_bundle_1 = require("@flashbots/ethers-provider-bundle");
const ethers_1 = require("ethers");
const abi_1 = require("./abi");
const UniswappyV2EthPair_1 = require("./UniswappyV2EthPair");
const addresses_1 = require("./addresses");
const Arbitrage_1 = require("./Arbitrage");
const https_1 = require("https");
const ETHEREUM_RPC_URL = process.env.ETHEREUM_RPC_URL || "http://127.0.0.1:8545";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const BUNDLE_EXECUTOR_ADDRESS = process.env.BUNDLE_EXECUTOR_ADDRESS || "";
const FLASHBOTS_KEY_ID = process.env.FLASHBOTS_KEY_ID || "";
const FLASHBOTS_SECRET = process.env.FLASHBOTS_SECRET || "";
const MINER_REWARD_PERCENTAGE = parseInt(process.env.MINER_REWARD_PERCENTAGE || "80");
if (PRIVATE_KEY === "") {
    console.warn("Must provide PRIVATE_KEY environment variable");
    process.exit(1);
}
if (BUNDLE_EXECUTOR_ADDRESS === "") {
    console.warn("Must provide BUNDLE_EXECUTOR_ADDRESS environment variable. Please see README.md");
    process.exit(1);
}
if (FLASHBOTS_KEY_ID === "" || FLASHBOTS_SECRET === "") {
    console.warn("Must provide FLASHBOTS_KEY_ID and FLASHBOTS_SECRET environment variable. Please see https://hackmd.io/@flashbots/rk-qzgzCD");
    process.exit(1);
}
const HEALTHCHECK_URL = process.env.HEALTHCHECK_URL || "";
const provider = new ethers_1.providers.StaticJsonRpcProvider(ETHEREUM_RPC_URL);
function healthcheck() {
    if (HEALTHCHECK_URL === "") {
        return;
    }
    https_1.get(HEALTHCHECK_URL).on('error', console.error);
}
async function main() {
    const markets = await UniswappyV2EthPair_1.UniswappyV2EthPair.getUniswapMarketsByToken(provider, addresses_1.FACTORY_ADDRESSES);
    const arbitrage = new Arbitrage_1.Arbitrage(new ethers_1.Wallet(PRIVATE_KEY), await ethers_provider_bundle_1.FlashbotsBundleProvider.create(provider, FLASHBOTS_KEY_ID, FLASHBOTS_SECRET), new ethers_1.Contract(BUNDLE_EXECUTOR_ADDRESS, abi_1.BUNDLE_EXECUTOR_ABI, provider));
    provider.on('block', async (blockNumber) => {
        await UniswappyV2EthPair_1.UniswappyV2EthPair.updateReserves(provider, markets.allMarketPairs);
        const bestCrossedMarkets = await arbitrage.evaluateMarkets(markets.marketsByToken);
        if (bestCrossedMarkets.length === 0) {
            console.log("No crossed markets");
            return;
        }
        bestCrossedMarkets.forEach(Arbitrage_1.Arbitrage.printCrossedMarket);
        arbitrage.takeCrossedMarkets(bestCrossedMarkets, blockNumber, MINER_REWARD_PERCENTAGE).then(healthcheck).catch(console.error);
    });
}
main();
//# sourceMappingURL=index.js.map