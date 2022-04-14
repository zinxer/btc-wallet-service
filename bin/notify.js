/*
* This script is tasked to notify main app of deposit transaction statuses.
* Use https://webhook.site/ to test webhook
*/
const { Op, configs, deposits } = require("../models/db");
const { currTime, sleep } = require("./utils/utils");
const { getLatestRecordedBlockNumber } = require('../controllers/wallet')
const https = require('https') // TODO: use https when in production
const crypto = require('crypto')

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

async function notifyDeposits(depositTxs) {
    try {
        if (depositTxs.length == 0) { return }
        for (var deposit of depositTxs) {
            notify({
                type: 'DEPOSIT',
                network: 'BITCOIN',
                status: 'SUCCESS',
                hash: deposit.hash,
                from: deposit.fromAddress,
                to: deposit.toAddress,
                value: deposit.value
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
        const minConfirmations = (await configs.findOne({ where: { key: 'minConfirmations' } })).value
        let depositTxs = await deposits.findAll({ where: { isNotified: false, confirmations: { [Op.gte]: minConfirmations } } })
        notifyDeposits(depositTxs)

        //recursion
        await sleep(process.env.NOTIFY_SLEEP)
        await run()
    } catch (error) {
        throw error
    }
}

module.exports = { run }
