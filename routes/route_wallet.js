const express = require('express')
const router = express.Router()
const wallet = require("../controllers/wallet");

//verify api key
router.use('/', function (req, res, next) {
    if (req.headers['x-api-key'] == process.env.API_KEY) {
        next()
    } else {
        res.status(400).send({
            message: "Invalid API key."
        })
    }
})

// .../wallet/create
//router.route("/create").post(wallet.create)

module.exports = router;