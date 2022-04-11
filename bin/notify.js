/*
* This script is tasked to notify main app of deposit and withdrawal transaction statuses.
* Use https://webhook.site/ to test webhook
*/
require("dotenv").config();
const { configs, deposits } = require("../models/db");
const { currTime, sleep } = require("./utils/utils");
const https = require('https') // TODO: use https when in production
const crypto = require('crypto')


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
            // TODO: bcoin get latest block number
            latestBlockNumber = await web3.eth.getBlockNumber()
            await latestBlockNumberRow.update({ value: latestBlockNumber })
            return Number(latestBlockNumber)
        }
    } catch (error) {
        throw error
    }
}

async function notify(body) {
    const data = JSON.stringify(body)
    const notifyUrl = (await configs.findOne({ where: { key: 'notifyUrl' } })).value

    //prepare POST signature
    const hmac = crypto.createHmac('sha256', process.env.API_SECRET)
    hmac.update(data, 'utf8')
    const signature = hmac.digest('hex')

    let urlParser = new URL(notifyUrl)
    const options = {
        hostname: urlParser.hostname,
        path: `${urlParser.pathname}`,
        //port: 443,
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
            "x-wallet-server-signature": signature
        }
    }

    let p = new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            res.setEncoding('utf8');
            if (res.statusCode == 200) {
                resolve({
                    status: true,
                    hash: body.hash
                })
            } else {
                resolve({ status: false })
            }
        })

        req.on('error', error => {
            resolve({ status: false })
        })
        req.write(data)
        req.end()
    })
    return await p
}

async function preCheckNotify(txs) {
    try {
        let minConfirmationsRow = await configs.findOne({ where: { key: 'minConfirmations' } })
        let currBlockNum = await getLatestRecordedBlockNumber()
        let safeTxs = []
        if (txs.length !== 0) {
            for (var tx of txs) {
                let safeBlockNum = Number(tx.blockNum) + Number(minConfirmationsRow.value)
                if (safeBlockNum > currBlockNum) {
                    //Skip iteration as tx had not passed safeBlockNum
                    continue;
                } else {
                    safeTxs.push(tx)
                }
            }
        }
        return safeTxs
    } catch (error) {
        console.log(`-E- ${currTime()}`, "Error at preCheckNotify", error)
        return []
    }
}

async function notifyDeposits(depositTxs) {
    try {
        depositTxs = await preCheckNotify(depositTxs)
        if (depositTxs.length == 0) { return }
        for (var deposit of depositTxs) {
            notify({
                type: 'DEPOSIT',
                network: 'ETHEREUM',
                status: 'SUCCESS',
                hash: deposit.hash,
                from: deposit.fromAddress,
                to: deposit.toAddress,
                contract: deposit.contractAddress,
                value: deposit.value,
                decimals: deposit.decimals
            }).then((resultNotify) => {
                if (resultNotify.status) {
                    deposits.update({ isNotified: true }, { where: { hash: resultNotify.hash } })
                }
            })
        }
    } catch (error) {
        console.log(`-E- ${currTime()}`, "Error in notifyDeposits.", error)
        return
    }
}

async function run() {
    try {
        let depositTxs = await deposits.findAll({ where: { isNotified: false } })

        notifyDeposits(depositTxs)

        //recursion
        await sleep(process.env.NOTIFY_SLEEP)
        await run()
    } catch (error) {
        throw error
    }
}

module.exports = { run }
