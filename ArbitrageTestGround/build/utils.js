"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bigNumberToDecimal = exports.ETHER = void 0;
const ethers_1 = require("ethers");
exports.ETHER = ethers_1.BigNumber.from(10).pow(18);
function bigNumberToDecimal(value, base = 18) {
    const divisor = ethers_1.BigNumber.from(10).pow(base);
    return value.mul(10000).div(divisor).toNumber() / 10000;
}
exports.bigNumberToDecimal = bigNumberToDecimal;
//# sourceMappingURL=utils.js.map