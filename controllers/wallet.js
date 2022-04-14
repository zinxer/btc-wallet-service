const { configs, deposits, wallets } = require("../models/db");
const { errorServer, logError } = require("../bin/utils/utils");

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
            latestBlockNumber = await nodeClient.execute("getblockcount")
            await latestBlockNumberRow.update({ value: latestBlockNumber })
            return Number(latestBlockNumber)
        }
    } catch (error) {
        throw error
    }
}

async function getXpubKeyAndId() {
    try {
        return [
            (await configs.findOne({ where: { key: process.env.BCOIN_NETWORK = 'testnet' ? 'testnet_xpub' : 'legacy_xpub' } })).value,
            (await configs.findOne({ where: { key: 'bcoin_wallet_id' } })).value
        ]
    } catch (error) {
        return null
    }
}

async function create(req, res) {
    try {
        const [xpubKey, id] = await getXpubKeyAndId()
        const wallet = walletClient.wallet(id);
        const { address } = await wallet.createAddress("default");

        //store address in DB
        await wallets.upsert({
            address: address,
            walletId: id,
            masterPK: xpubKey
        })

        return res.status(200).json({ address: address })
    } catch (error) {
        logError(error)
        return errorServer(res, "E01 - Error at wallet create.")
    }
}


module.exports = { getLatestRecordedBlockNumber, create }