require("dotenv").config();
const express = require('express')
const db = require('./models/db').db
const bodyParser = require('body-parser')

const app = express()

//Middleware (app.use)
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }))
app.use(require('./routes'))

app.use((req, res) => {
    res.status(400).send('Unknown Request')
})

// Express listen
let port = process.env.PORT || 3000
app.listen(port, () => {
    console.log("\x1b[32m%s\x1b[0m", `-I-   App is listening on port ${port}`)
})

// Check if DB is authenticated
db.authenticate().then(async () => {
    console.log("\x1b[32m%s\x1b[0m", '-I-   SQL connected!');
    // app retart initialisations
    const notify = require('./bin/notify'); notify.run()
})
    .catch(err => {
        console.error("\x1b[31m%s\x1b[0m", '-E- Unable to connect to the SQL database:', err)
        process.exit()
    })
