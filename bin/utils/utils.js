//const { telegramLog } = require('../telegramBot')

async function sleep(m) {
    return new Promise((r) => setTimeout(r, m));
}

async function loop(
    func,
    args,
    errorMessage = "Loop stuck. No error message defined.",
    wait = 30,
    waitMultiplier = 2,
    count = 1,
    countToEnd = 10
) {
    let check = null;
    while (!check) {
        try {
            check = true;
            if (count > countToEnd) {
                // insert telegram here
                console.log(errorMessage);
                continue;
            }
            await sleep(wait * 1000);
            await func.apply(this, args);
        } catch (error) {
            count += 1;
            wait *= waitMultiplier;
            check = null;
        }
    }
}

function errorHandler(res, error) {
    console.log(`-E- ${currTime()}`, error);
    if (error instanceof Error) {
        let message = error.message;
        let httpStatusCode = error.httpStatusCode || 400;
        if (
            error.name === "SequelizeValidationError" ||
            error.name === "SequelizeUniqueConstraintError"
        ) {
            message = [];
            if (error.errors.length === 1) {
                message = error.errors[0].message;
            } else {
                for (let err of error.errors) {
                    message.push({ type: err.type, error: err.message });
                }
            }
        }
        res.status(httpStatusCode).json({
            error: message,
        });
    } else {
        res.status(502).json({
            error: error,
        });
    }
}

function errorInRequest(res, message){
    //bad request
    res.status(400).json({
        error: message,
    });
}

function errorServer(res, message){
    //bad request
    res.status(500).json({
        error: message,
    });
    //telegramLog(`${message}`)
}

function logError(message = null, errorCode = '000') {
    if (message == null) { message = `Error happened at ${errorCode}` }
    //telegramLog(message)
    console.log(`-E- ${currTime()}`, message)
    return
}

function isEmpty(obj) {
    for(var key in obj) {
        if(obj.hasOwnProperty(key))
            return false;
    }
    return true;
}

function logError(message = null, errorCode = '000') {
    if (message == null) { message = `Error happened at ${errorCode}` }
    //telegramLog(message)
    console.log(`-E- ${currTime()}`, message)
    return
}

function logWarning(message = null, warningCode = '001') {
    if (message == null) { message = `Warning happened at ${errorCode}` }
    console.log(`-W- ${currTime()}`, message)
    return
}

function currTime() {
    var city = 'Singapore'
    var offset = '+8'


    var d = new Date()
    var utc = d.getTime() + (d.getTimezoneOffset() * 60000)
    var nd = new Date(utc + (3600000 * offset))
    var datetime = nd.toLocaleString()
    datetime = datetime.replace(" AM", 'AM')
    datetime = datetime.replace(" PM", 'PM')
    datetime = datetime.replace(" ", '')

    return datetime
}

function hasDuplicates(a) {

    const noDups = new Set(a);
  
    if (a.length !== noDups.size) {
      return true;
    } else {
      return false;
    }
  }

module.exports = { sleep, loop, errorHandler, errorInRequest, errorServer, logError, isEmpty, logWarning, currTime, hasDuplicates};
