const { configs, deposits, wallets } = require("../models/db");
const { errorServer, logError, errorInRequest } = require("../bin/utils/utils");

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
            (await configs.findOne({ where: { key: process.env.BCOIN_NETWORK == 'testnet' ? 'testnet_xpub' : 'legacy_xpub' } })).value,
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
        await wallet.createAddress("default")
            .then(async ({ address }) => {
                //store address in DB
                await wallets.upsert({
                    address: address,
                    walletId: id,
                    masterPK: xpubKey
                })
                return res.status(200).json({ address: address })
            })
    } catch (error) {
        logError(error)
        return errorServer(res, "E01 - Error at wallet create.")
    }
}

async function resync(req, res) {
    try {
        const block = req.body.block || null
        if (!block) { return errorInRequest(res, "Missing or empty block number param.") }
        const result = await nodeClient.reset(Number(block) - 1);
        res.status(200).json({ success: true, block: block });
    } catch (error) {
        logError(error)
        return errorServer(res, "E02 - Error at resync")
    }
}

const processCallback = async (id, tx) => {
    try {
        await walletClient.execute("selectwallet", [id]);
        const transaction = await walletClient.execute("gettransaction", [
            tx.hash,
            true,
        ]);
        for (let detail of transaction.details) {
            if (detail.category === "receive") {
                console.log(`-I- ${currTime()} Deposit detected `, {
                    walletId: id,
                    toAddress: detail.address,
                    value: String(detail.amount),
                    blockNum: String(tx.height),
                    hash: transaction.txid,
                    txTime: String(tx.time),
                    txDate: tx.date,
                    confirmations: String(tx.confirmations),
                })

                await deposits.upsert({
                    walletId: id,
                    toAddress: detail.address,
                    value: String(detail.amount),
                    blockNum: String(tx.height),
                    hash: transaction.txid,
                    txTime: String(tx.time),
                    txDate: tx.date,
                    confirmations: String(tx.confirmations),
                })

            }
        }
    } catch (error) {
        console.log(error.response ? error.response.data : error);
        throw error;
    }
};

const watchConfirmedTxs = async (walletClient) => {
    try {
        await walletClient.open();
        await walletClient.join("*");
        // Listen for new transactions
        walletClient.bind("confirmed", processCallback);
    } catch (error) {
        logError(error)
    }
};

watchConfirmedTxs(walletClient);

module.exports = { getLatestRecordedBlockNumber, create, resync }