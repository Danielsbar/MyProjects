"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Arbitrage = exports.getBestCrossedMarket = void 0;
const _ = __importStar(require("lodash"));
const ethers_1 = require("ethers");
const addresses_1 = require("./addresses");
const utils_1 = require("./utils");
// TODO: implement binary search (assuming linear/exponential global maximum profitability)
const TEST_VOLUMES = [
    utils_1.ETHER.mul(5),
    utils_1.ETHER.mul(10),
    utils_1.ETHER.mul(15),
    utils_1.ETHER.mul(20),
    utils_1.ETHER.mul(25),
    utils_1.ETHER.mul(30),
    utils_1.ETHER.mul(35),
    utils_1.ETHER.mul(40),
    utils_1.ETHER.mul(45),
    utils_1.ETHER.mul(50),
    utils_1.ETHER.mul(75),
    utils_1.ETHER.mul(100),
    utils_1.ETHER.mul(150),
    utils_1.ETHER.mul(200),
    utils_1.ETHER.mul(250),
    utils_1.ETHER.mul(300),
    utils_1.ETHER.mul(350),
    utils_1.ETHER.mul(400),
    utils_1.ETHER.mul(450),
    utils_1.ETHER.mul(500),
    utils_1.ETHER.mul(750),
    utils_1.ETHER.mul(1000)
];
const flashloanFeePercentage = 9; // (0.09%) or 9/10000
function getBestCrossedMarket(crossedMarkets, tokenAddress) {
    let bestCrossedMarket = undefined;
    for (const crossedMarket of crossedMarkets) {
        const sellToMarket = crossedMarket[0];
        const buyFromMarket = crossedMarket[1];
        for (const size of TEST_VOLUMES) {
            const tokensOutFromBuyingSize = buyFromMarket.getTokensOut(addresses_1.WETH_ADDRESS, tokenAddress, size);
            const proceedsFromSellingTokens = sellToMarket.getTokensOut(tokenAddress, addresses_1.WETH_ADDRESS, tokensOutFromBuyingSize);
            const profit = proceedsFromSellingTokens.sub(size);
            if (bestCrossedMarket !== undefined && profit.lt(bestCrossedMarket.profit)) {
                // If the next size up lost value, meet halfway. TODO: replace with real binary search
                const trySize = size.add(bestCrossedMarket.volume).div(2);
                const tryTokensOutFromBuyingSize = buyFromMarket.getTokensOut(addresses_1.WETH_ADDRESS, tokenAddress, trySize);
                const tryProceedsFromSellingTokens = sellToMarket.getTokensOut(tokenAddress, addresses_1.WETH_ADDRESS, tryTokensOutFromBuyingSize);
                const tryProfit = tryProceedsFromSellingTokens.sub(trySize);
                if (tryProfit.gt(bestCrossedMarket.profit)) {
                    bestCrossedMarket = {
                        volume: trySize,
                        profit: tryProfit,
                        tokenAddress,
                        sellToMarket,
                        buyFromMarket
                    };
                }
                break;
            }
            bestCrossedMarket = {
                volume: size,
                profit: profit,
                tokenAddress,
                sellToMarket,
                buyFromMarket
            };
        }
    }
    return bestCrossedMarket;
}
exports.getBestCrossedMarket = getBestCrossedMarket;
class Arbitrage {
    constructor(executorWallet, flashbotsProvider, bundleExecutorContract) {
        this.executorWallet = executorWallet;
        this.flashbotsProvider = flashbotsProvider;
        this.bundleExecutorContract = bundleExecutorContract;
    }
    static printCrossedMarket(crossedMarket) {
        const buyTokens = crossedMarket.buyFromMarket.tokens;
        const sellTokens = crossedMarket.sellToMarket.tokens;
        console.log(`Profit: ${utils_1.bigNumberToDecimal(crossedMarket.profit)} Volume: ${utils_1.bigNumberToDecimal(crossedMarket.volume)}\n` +
            `${crossedMarket.buyFromMarket.protocol} (${crossedMarket.buyFromMarket.marketAddress})\n` +
            `  ${buyTokens[0]} => ${buyTokens[1]}\n` +
            `${crossedMarket.sellToMarket.protocol} (${crossedMarket.sellToMarket.marketAddress})\n` +
            `  ${sellTokens[0]} => ${sellTokens[1]}\n` +
            `\n`);
    }
    async evaluateMarkets(marketsByToken) {
        const bestCrossedMarkets = new Array();
        for (const tokenAddress in marketsByToken) {
            const markets = marketsByToken[tokenAddress];
            const pricedMarkets = _.map(markets, (ethMarket) => {
                return {
                    ethMarket: ethMarket,
                    buyTokenPrice: ethMarket.getTokensIn(tokenAddress, addresses_1.WETH_ADDRESS, utils_1.ETHER.div(100)),
                    sellTokenPrice: ethMarket.getTokensOut(addresses_1.WETH_ADDRESS, tokenAddress, utils_1.ETHER.div(100)),
                };
            });
            const crossedMarkets = new Array();
            for (const pricedMarket of pricedMarkets) {
                _.forEach(pricedMarkets, pm => {
                    if (pm.sellTokenPrice.gt(pricedMarket.buyTokenPrice)) {
                        crossedMarkets.push([pricedMarket.ethMarket, pm.ethMarket]);
                    }
                });
            }
            const bestCrossedMarket = getBestCrossedMarket(crossedMarkets, tokenAddress);
            if (bestCrossedMarket !== undefined && bestCrossedMarket.profit.gt(utils_1.ETHER.div(100))) {
                bestCrossedMarkets.push(bestCrossedMarket);
            }
        }
        bestCrossedMarkets.sort((a, b) => a.profit.lt(b.profit) ? 1 : a.profit.gt(b.profit) ? -1 : 0);
        return bestCrossedMarkets;
    }
    // TODO: take more than 1
    async takeCrossedMarkets(bestCrossedMarkets, blockNumber, minerRewardPercentage) {
        for (const bestCrossedMarket of bestCrossedMarkets) {
            const buyCalls = await bestCrossedMarket.buyFromMarket.sellTokensToNextMarket(addresses_1.WETH_ADDRESS, bestCrossedMarket.volume, bestCrossedMarket.sellToMarket);
            const inter = bestCrossedMarket.buyFromMarket.getTokensOut(addresses_1.WETH_ADDRESS, bestCrossedMarket.tokenAddress, bestCrossedMarket.volume);
            const sellCallData = await bestCrossedMarket.sellToMarket.sellTokens(bestCrossedMarket.tokenAddress, inter, this.bundleExecutorContract.address);
            const targets = [...buyCalls.targets, bestCrossedMarket.sellToMarket.marketAddress];
            const payloads = [...buyCalls.data, sellCallData];
            const flashloanFee = bestCrossedMarket.volume.mul(flashloanFeePercentage).div(10000);
            if (flashloanFee.lt(bestCrossedMarket.profit)) {
                const profitMinusFee = bestCrossedMarket.profit.sub(flashloanFee);
                try {
                    const minerReward = profitMinusFee.mul(minerRewardPercentage).div(100);
                    const profitMinusFeeMinusMinerReward = profitMinusFee.sub(minerReward);
                    console.log("Send this much WETH", bestCrossedMarket.volume.toString(), "get this much profit after fees", profitMinusFeeMinusMinerReward.toString());
                    const ethersAbiCoder = new ethers_1.utils.AbiCoder();
                    const typeParams = ['uint256', 'address[]', 'bytes[]'];
                    const inputParams = [minerReward.toString(), targets, payloads];
                    const params = ethersAbiCoder.encode(typeParams, inputParams);
                    console.log({ targets, payloads });
                    if (profitMinusFeeMinusMinerReward.gt(0)) {
                        const transaction = await this.bundleExecutorContract.populateTransaction.flashloan(addresses_1.WETH_ADDRESS, bestCrossedMarket.volume, params, {
                            gasPrice: ethers_1.BigNumber.from(0),
                            gasLimit: ethers_1.BigNumber.from(1400000),
                        });
                        try {
                            const estimateGas = await this.bundleExecutorContract.provider.estimateGas({
                                ...transaction,
                                from: this.executorWallet.address
                            });
                            if (estimateGas.gt(1400000)) {
                                console.log("EstimateGas succeeded, but suspiciously large: " + estimateGas.toString());
                                continue;
                            }
                            transaction.gasLimit = estimateGas.mul(2);
                        }
                        catch (e) {
                            console.warn(`Estimate gas failure for ${JSON.stringify(bestCrossedMarket)}`);
                            continue;
                        }
                        const bundlePromises = _.map([blockNumber + 1, blockNumber + 2], targetBlockNumber => this.flashbotsProvider.sendBundle([
                            {
                                signer: this.executorWallet,
                                transaction: transaction
                            }
                        ], targetBlockNumber));
                        await Promise.all(bundlePromises);
                    }
                    else {
                        console.log("Transaction would be unprofitable after the flashloan fee and miner reward.");
                        continue;
                    }
                }
                catch (e) {
                    console.warn("Error setting miner and flashloan payment:", e);
                }
            }
            else {
                console.log("Flashloan fee is greater than profit.");
            }
            return;
        }
        throw new Error("No arbitrage submitted to relay");
    }
}
exports.Arbitrage = Arbitrage;
//# sourceMappingURL=Arbitrage.js.map