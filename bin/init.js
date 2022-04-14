const { configs, deposits } = require("../models/db");
const { errorServer, logError, currTime } = require("../bin/utils/utils");

// bcoin initialisation
const { NodeClient, WalletClient, Network } = require("bcoin");
const { config } = require("dotenv");
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

async function createWallet() {
    try {
        const xpubKey = (await configs.findOne({ where: { key: process.env.BCOIN_NETWORK = 'testnet' ? 'testnet_xpub' : 'legacy_xpub' } })).value
        const id = (await configs.findOne({ where: { key: 'bcoin_wallet_id' } })).value

        //first check if wallet exist
        const wallet = walletClient.wallet(id);
        const walletInfo = await wallet.getInfo();
        if (walletInfo) { return }

        const watchWalletOptions = { ...options, accountKey: xpubKey };
        await walletClient.createWallet(id, watchWalletOptions);
        console.log(currTime(), `Wallet ${id} not found on bcoin node, creating it...`)
    } catch (error) {
        throw error
    }
}

async function getWatchedWalletAddresses() {
    try {
        const id = (await configs.findOne({ where: { key: 'bcoin_wallet_id' } })).value
        const result = await walletClient.execute('listreceivedbyaddress', [1, true, true])
        return result
    } catch (error) {
        throw error
    }
}

async function importAddresses() {
    try {
        const walletAddresses = await getWatchedWalletAddresses()
        //console.log("mpragasa", walletAddresses)

    } catch (error) {
        throw error
    }
}


async function init() {
    await Promise.all([
        createWallet(), // check if wallet created on Node (from xpub), create the wallet if it's not created.
        //importAddress()
        importAddresses()
    ])
    console.log(`-I- ${currTime()}`, `Init: Complete.`)
    return
}

module.exports = {
    init
}