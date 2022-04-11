/*
* This script is tasked to notify main app of deposit and withdrawal transaction statuses.
* Use https://webhook.site/ to test webhook
*/
require("dotenv").config();
const { db, wallets, configs, withdrawals, deposits } = require("../models/db");
const { currTime, sleep } = require("./utils/utils");
const { getLatestRecordedBlockNumber } = require('./scheduleSweep')
const https = require('https') // TODO: use https when in production
const crypto = require('crypto')
const { createAlchemyWeb3 } = require("@alch/alchemy-web3");
const web3 = createAlchemyWeb3(`https://${process.env.WEB3_NETWORK}.alchemyapi.io/v2/${process.env.ALCH_KEY}`);

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

async function notifyWithdrawals(withdrawalTxs) {
    try {
        withdrawalTxs = await preCheckNotify(withdrawalTxs)
        if (withdrawalTxs.length == 0) { return }
        for (var withdrawal of withdrawalTxs) {
            notify({
                type: 'WITHDRAWAL',
                network: 'ETHEREUM',
                status: 'SUCCESS',
                uuid: withdrawal.uuid,
                hash: withdrawal.hash,
                from: withdrawal.fromAddress,
                to: withdrawal.toAddress,
                contract: withdrawal.contractAddress,
                value: withdrawal.value
            }).then((resultNotify) => {
                if (resultNotify.status) {
                    withdrawals.update({ isNotified: true }, { where: { hash: resultNotify.hash } })
                }
            })
        }
    } catch (error) {
        console.log(`-E- ${currTime()}`, "Error in notifyWithdrawals.", error)
        return
    }
}

async function run() {
    try {
        let depositTxs = await deposits.findAll({ where: { isNotified: false } })
        let withdrawalTxs = await withdrawals.findAll({ where: { isNotified: false, status: 'SUCCESS', isReplaced: false } })

        notifyDeposits(depositTxs)
        notifyWithdrawals(withdrawalTxs)

        //recursion
        await sleep(process.env.NOTIFY_SLEEP)
        await run()
    } catch (error) {
        throw error
    }
}

async function notifyWithdrawalPending(withdrawalTxs) {
    try {
        if (withdrawalTxs.length == 0) { return }
        for (var withdrawal of withdrawalTxs) {
            notify({
                type: 'WITHDRAWAL',
                network: 'ETHEREUM',
                status: 'PENDING',
                uuid: withdrawal.uuid,
                hash: withdrawal.hash
            })
        }
    } catch (error) {
        console.log(`-E- ${currTime()}`, "Error in notifyWithdrawals.", error)
        return
    }
}

module.exports = { run, notifyWithdrawalPending }
