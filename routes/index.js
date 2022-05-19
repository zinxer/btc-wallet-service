const express = require('express')
const router = express.Router()
const rateLimit = require("express-rate-limit");

const authRL = (count) => {
    return rateLimit({
        windowMs: 1 * 60 * 1000, // 1 minutes
        max: count
    })
}

//TODO: check for valid JSON string and also suspicious payload

//routes
router.use(`${process.env.BCOIN_NETWORK == 'testnet' ? '/test' : ''}/btc/wallet`, authRL(1000), require('./route_wallet'))

module.exports = router;