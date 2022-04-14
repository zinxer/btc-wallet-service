const { Op, wallets, deposits, configs } = require("../models/db");
const { errorHandler, isEmpty, currTime, sleep } = require("../bin/utils/utils")

// bcoin initialisation
const { NodeClient, WalletClient, Network } = require("bcoin");
const network = Network.get(process.env.BCOIN_NETWORK);

const walletOptions = {
    host: process.env.BCOIN_HOST,
    network: network.type,
    port: Number(process.env.BCOIN_WALLET_PORT),
    apiKey: process.env.BCOIN_WALLET_API_KEY,
};

const nodeOptions = {
    host: process.env.BCOIN_HOST,
    network: network.type,
    port: Number(process.env.BCOIN_NODE_PORT),
    apiKey: process.env.BCOIN_NODE_API_KEY,
};

const walletClient = new WalletClient(walletOptions);
const nodeClient = new NodeClient(nodeOptions);
const options = {
    witness: false,
    watchOnly: true,
};

async function run() {
    try {
        const id = (await configs.findOne({ where: { key: 'bcoin_wallet_id' } })).value
        const wallet = walletClient.wallet(id);
        let unconfirmedDepositRows = await deposits.findAll({ where: { confirmations: { [Op.lt]: 3 } } })

        if (unconfirmedDepositRows.length == 0) {
            await sleep(1 * 60 * 1000)
            await run()
        }
        for (var tx of unconfirmedDepositRows) {
            let txData = await wallet.getTX(tx.hash)
            if (isEmpty(txData)) {
                await sleep(1 * 60 * 1000) // 1 minute
                await run()
            } else {
                if (txData.confirmations > tx.confirmations) { await deposits.update({ confirmations: txData.confirmations }, { where: { hash: tx.hash } }) }
            }
            await sleep(200) //avoid hitting spamming bcoin node.
        }
        await sleep(1 * 60 * 1000) // 1 minute
        await run()
    } catch (error) {
        await sleep(1 * 60 * 1000) // 1 minute
        await run()
    }
}

module.exports = { run }