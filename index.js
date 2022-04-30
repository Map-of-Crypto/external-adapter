const { Requester, Validator } = require('@chainlink/external-adapter')

const Moralis = require("moralis/node")

const MapOfCrypto = require("./MapOfCrypto.json")

// Define custom error scenarios for the API.
// Return true for the adapter to retry.
const customError = (data) => {
  if (data.Response === 'Error') return true
  return false
}

// Define custom parameters to be used by the adapter.
// Extra parameters can be stated in the extra object,
// with a Boolean value indicating whether or not they
// should be required.
// const customParams = {
//   base: ['base', 'from', 'coin'],
//   quote: ['quote', 'to', 'market'],
//   endpoint: false
// }

// First we will call the tracking API.. we will return the list of all products with the status
const createRequest = async (input, callback) => {
  // The Validator helps you validate the Chainlink request data

  const serverUrl = "https://pmdvzjdaz3qr.usemoralis.com:2053/server";
  const appId = "x0oyqC34SORc7FpG2VH9Byu7nHe6350m6nyNLgo6";
  const masterKey = "a2Dl0Chlb4JlaUOBihwzevG3PuKIyQQ1jj0YQCnN";

  await Moralis.start({ serverUrl, appId, masterKey });

  const ABI = MapOfCrypto.abi;

  const options = {
    chain: "kovan",
    address: "0xcb2E631887B15B815AD02aE88Dc0326374f37b16",
    function_name: "returnRequestedPurchaseList",
    abi: ABI,
    // params: { who: "0x3355d6E71585d4e619f4dB4C7c5Bfe549b278299" },
  };

  const pendingRequests = await Moralis.Web3API.native.runContractFunction(options);

  const validator = new Validator(callback, input)
  const jobRunID = validator.validated.id



  let pendingFundingList = [];
  for (let i = 0; i < pendingRequests.length; i++) {
    // confirmed but not paid 
    if (!pendingRequests[i][0] && pendingRequests[i][2]) {
      let pendingFunding = {
        paid: pendingRequests[i][0],
        id: pendingRequests[i][1],
        confirmed: pendingRequests[i][2]
      }
      pendingFundingList.push(pendingFunding);
    }
  }

  // const endpoint = validator.validated.data.endpoint || 'price'
  const url = `https://mapofcrypto-cdppi36oeq-uc.a.run.app/tracking`
  // const fsym = validator.validated.data.base.toUpperCase()
  // const tsyms = validator.validated.data.quote.toUpperCase()

  // const params = {
  //   fsym,
  //   tsyms
  // }

  // This is where you would add method and headers
  // you can add method like GET or POST and add it to the config
  // The default is GET requests
  // method = 'get' 
  // headers = 'headers.....'
  const config = {
    url,
    // params
  }

  // The Requester allows API calls be retry in case of timeout
  // or connection failure
  Requester.request(config, customError)
    .then(response => {

      const trackingApiResponse = response.data.tracking;

      const trackingFiltered = trackingApiResponse.filter(tracking => tracking["status"] = "Delivered");

      let productIdFunding = [];
      for (let i = 0; i < pendingFundingList.length; i++) {
        let id = pendingFundingList[i]["id"];
        const find = trackingFiltered.find(element => element.productId === id)
        if (find) {
          productIdFunding.push(find.productId);
        }
      }

      response.data = productIdFunding;

      callback(response.status, Requester.success(jobRunID, response))
    })
    .catch(error => {
      callback(500, Requester.errored(jobRunID, error))
    })
}



// This is a wrapper to allow the function to work with
// GCP Functions
exports.gcpservice = (req, res) => {
  createRequest(req.body, (statusCode, data) => {
    res.status(statusCode).send(data)
  })
}

// This is a wrapper to allow the function to work with
// AWS Lambda
exports.handler = (event, context, callback) => {
  createRequest(event, (statusCode, data) => {
    callback(null, data)
  })
}

// This is a wrapper to allow the function to work with
// newer AWS Lambda implementations
exports.handlerv2 = (event, context, callback) => {
  createRequest(JSON.parse(event.body), (statusCode, data) => {
    callback(null, {
      statusCode: statusCode,
      body: JSON.stringify(data),
      isBase64Encoded: false
    })
  })
}

// This allows the function to be exported for testing
// or for running in express
module.exports.createRequest = createRequest
