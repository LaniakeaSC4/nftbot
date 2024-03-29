const https = require('https')
const w = require('../tools/winston.js')

//returns x number of recent listings from Magic Eden - should add try/catch/return null error handling here
function getnewremoteMElistings(collection, number) {
	return new Promise((resolve, reject) => {
		var thiscollection = 'https://api-mainnet.magiceden.dev/v2/collections/' + collection + '/listings?offset=0&limit=' + number//build collection URL

		https.get(thiscollection, (resp) => {
			let data = ''
			// A chunk of data has been received.
			resp.on('data', (chunk) => {
				data += chunk
			})
			// The whole response has been received.
			resp.on('end', () => {
				var thislistings = JSON.parse(data)
				resolve(thislistings)//return the recieved X listings
			})
		}).on("error", (err) => { w.log.info("Error: " + err.message) })
	}) //end promise
}; module.exports.getNewListings = getnewremoteMElistings

//returns floor price from Magic Eden API - should add try/catch/return null error handling here
async function getremotefloorprice(collection) {
	return new Promise((resolve, reject) => {

		//build collection URL
		var thiscollection = 'https://api-mainnet.magiceden.dev/v2/collections/' + collection + '/stats'

		https.get(thiscollection, (resp) => {
			let data = ''
			// A chunk of data has been received.
			resp.on('data', (chunk) => {
				data += chunk
			});
			// The whole response has been received. Print out the result.
			resp.on('end', () => {
				var rawFP = parseFloat(JSON.parse(data).floorPrice)//get FP in Sol
				var thisFP = rawFP / 1000000000
				resolve(thisFP)
			})
		}).on("error", (err) => { w.log.info("Error: " + err.message) })
	}) //end promise
}; module.exports.getFloorPrice = getremotefloorprice

//returns token details from Magic Eden
async function getremoteMEtokendetails(mintaddress) {
	return new Promise((resolve, reject) => {
		var thisurl = 'https://api-mainnet.magiceden.dev/v2/tokens/' + mintaddress//build token URL

		https.get(thisurl, (resp) => {
			let data = ''
			// A chunk of data has been received.
			resp.on('data', (chunk) => {
				data += chunk
			})

			// The whole response has been received.
			resp.on('end', () => {
				var thistoken = JSON.parse(data)
				if (thistoken.mintAddress) {
				resolve(thistoken)//return the recieved token details
				} else {
				  w.log.error("Got a response from ME but no mint address in the data (probably a 500 server error. NFT burned?")
				  resolve(null)
				} 
			})
		}).on("error", (err) => { 
		  w.log.error("General http error when getting token details from ME. Error: " + err.message)
		  resolve(null)})
	}) //end promise
}; module.exports.getTokenDetails = getremoteMEtokendetails
