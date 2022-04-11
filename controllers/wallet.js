const { NodeClient, WalletClient, Network } = require("bcoin");
const { configs, deposits } = require("../models/db");









async function getLatestRecordedBlockNumber() {
    try {
        let latestBlockNumberRow = await configs.findOne({
            where: {
                key: 'latestBlockNumber'
            }
        })
        let latestBlockNumber = latestBlockNumberRow.value
        var currentTime = Date.now();
        var updatedAt = new Date(latestBlockNumberRow.updatedAt).getTime()
        var duration = 20 * 1000 // 20 seconds
        if ((currentTime - updatedAt) < duration) {
            return Number(latestBlockNumber)
        } else {
            latestBlockNumber = await web3.eth.getBlockNumber()
            await latestBlockNumberRow.update({ value: latestBlockNumber })
            return Number(latestBlockNumber)
        }
    } catch (error) {
        throw error
    }
}

module.exports={ getLatestRecordedBlockNumber }