require("dotenv").config();
const sequelize = require("sequelize");
const Op = require("sequelize").Op;
const fs = require('fs');
const rdsCa = fs.readFileSync(__dirname + '/rds-ca-2019-root.pem');

const sqlOptions = {
    host: process.env.DB_HOST,
    logging: process.env.DEBUG === "true" ? console.log : false,
    maxConcurrentQueries: 100,
    dialect: 'mysql',
    dialectOptions: {
        /*
        ssl: {
            rejectUnauthorized: true,
            ca: [rdsCa]
        }
        */
    },
    pool: {
        maxConnections: 10,
        maxIdleTime: 15
    },
    language: 'en'
}

const db = new sequelize(process.env.DB_SCHEMA, process.env.DB_USER, process.env.DB_PASSWORD, sqlOptions)

/*
/   ******************
/   Table Definitions
/   ******************
*/
const configs = db.define("configs", {
    key: {
        type: sequelize.STRING,
        primaryKey: true,
        unique: true,
    },
    value: sequelize.STRING
})

const deposits = db.define("deposits", {
    id: {
        type: sequelize.INTEGER,
        autoIncrement: true
    },
    isNotified: sequelize.BOOLEAN,
    hash: {
        type: sequelize.STRING,
        primaryKey: true
    },
    fromAddress: sequelize.STRING,
    toAddress: sequelize.STRING,
    blockNum: sequelize.STRING,
    value: sequelize.STRING,
    walletId: sequelize.STRING,
    txTime: sequelize.STRING,
    txDate: sequelize.STRING,
    confirmations: sequelize.STRING,
})

const wallets = db.define("wallets", {
    id: {
        autoIncrement: true,
        type: sequelize.INTEGER
    },
    label: sequelize.STRING,
    address: {
        type: sequelize.STRING,
        primaryKey: true
    },
    walletId: sequelize.STRING,
    masterPK: sequelize.STRING
})

module.exports = { db, Op, configs, wallets, deposits }