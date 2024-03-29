var discord = require('../clients/discordclient.js')
const client = discord.getClient()

const w = require('../tools/winston.js')
const https = require('https')
var db = require('../clients/pgclient.js')
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const magicEden = require('../tools/magicedenRPC.js')

async function sqlGetCollections() {
	return new Promise((resolve, reject) => {
		var pgclient = db.getClient()

		//select the data in this column for a row which has this primary key
		var querystring = "SELECT meslug,servers,me_activities FROM sales"

		pgclient.query(querystring, (err, res) => {
			if (err) throw err
			resolve(res.rows)
		}) //end query
	}) //end promise
}//end get collections

async function saveActivities(meslug, activities) {
	return new Promise((resolve, reject) => {
		var pgclient = db.getClient()

		//update this table to add this data to this column where this key matches the table's primary key
		var querystring = "UPDATE sales SET me_activities = $1 WHERE meslug = '" + meslug + "'"
		var querydata = [activities]

		pgclient.query(querystring, querydata, (err, res) => {
			if (err) throw err
			resolve(true)
		})//end query
	})//end promise
}

function getMEactivities(collection, number) {
	return new Promise((resolve, reject) => {
		var thiscollection = 'https://api-mainnet.magiceden.dev/v2/collections/' + collection + '/activities?offset=0&limit=' + number//build collection URL
		w.log.info('getting: ' + thiscollection)
		//https://api-mainnet.magiceden.dev/v2/collections/crypto_coral_tribe/activities?offset=0&limit=5

		https.get(thiscollection, (resp) => {
			let data = ''
			// A chunk of data has been received.
			resp.on('data', (chunk) => {
				data += chunk
			})
			// The whole response has been received.
			resp.on('end', () => {

				var thislistings = JSON.parse(data)
				w.log.info('returning ' + thislistings.length + ' activities from ME.')
				resolve(thislistings)//return the recieved X listings

			})
		}).on("error", (err) => { w.log.info("Error: " + err.message) })
	}) //end promise
}

async function getActivities() {

	var collections = await sqlGetCollections()

	for (var i = 0; i < collections.length; i++) {//for each sql row (collection)
		
		//get activities
		var magicactivities = await getMEactivities(collections[i].meslug, 100)
		var newactivities = magicactivities
		w.log.info(collections[i].meslug + ': length of newactivities is: ' + newactivities.length)

		var salesActivities = []
		for (var s = 0; s < newactivities.length; s++) {
			if (newactivities[s].type == "buyNow") {
				newactivities[s]['findkey'] = newactivities[s].type + newactivities[s].tokenMint + newactivities[s].price
				salesActivities.push(newactivities[s])
			}
		}
		w.log.info(collections[i].meslug + ': salesactivities.length is: ' + salesActivities.length)

		var oldactivities = collections[i].me_activities
		var newSales = []
		newactivities: for (var j = 0; j < salesActivities.length; j++) {//for each sale
			await wait(50)
			var found = false
			for (var k = 0; k < oldactivities.length; k++) {
				try {
					if (oldactivities[k].findkey === salesActivities[j].findkey) {
						//w.log.info('Matched: ' + oldactivities[k].findkey)
						found = true
						continue newactivities
					} else {
						//w.log.info('did not match ' + salesActivities[j].findkey + ' is it new?')
					}
				} catch { w.log.info('newactivities[j].tokenMint is: ' + newactivities[j]?.tokenMint + ". oldactivities[k].tokenMint is: " + oldactivities[k]?.tokenMint) }
			}//end for each old avtivities
			if (found === false) {
				newSales.push(salesActivities[j])
			}
		}//end for each recieved activity

		w.log.info(collections[i].meslug + ': length of newSales is: ' + newSales.length)
		if (oldactivities.length > 0) {
			//add newactivities to oldactivities
			var storeActivities = newSales.concat(oldactivities)//add actual new ones to old ones
			storeActivities = storeActivities.slice(0, 200)//keep last 20

			w.log.info(collections[i].meslug + ': saveing up to 200 activities. This time it is ' + storeActivities.length + ' activities')

			await saveActivities(collections[i].meslug, JSON.stringify(storeActivities))
		} else {
			await saveActivities(collections[i].meslug, JSON.stringify(salesActivities))
		}

		w.log.info(collections[i].meslug + ': these are the new buys:')
		w.log.info(JSON.stringify(newSales))

		for (var l = 0; l < collections[i].servers.data.length; l++) {//for each server signed up to that collection
			w.log.info(JSON.stringify(collections[i].servers.data[l]))

			for (var m = 0; m < newSales.length; m++) {
			  var tokendetails = await magicEden.getTokenDetails(newSales[m].tokenMint)
				try {
					const channel = await client.channels.fetch(collections[i].servers.data[l].channel)
					channel.send({
						embeds: [
							{
								"title": tokendetails.name + ' sold for ' + newSales[m].price + 'SOL',
								"image": {"url" : newSales[m].image} ,
													"fields": [
													  {
							"name": "👛 __Transaction Details__",
							"value": "Buyer; \nSeller: ",
							"inline": false
						}, 
						{
							"name": "🎯 __Collection Details__",
							"value": "collection stats",
							"inline": false
						},
					],
								"footer": {
									"text": "D: https://discord.gg/CgF7neAte2 | W: nftsniperbot.xyz"
								},
							}
						]//end embed
					}).catch((err) => { w.log.error('there was a message send error: ' + err) })//end message send
				} catch (err) { w.log.error('there was an nft sending error. Perhaps channel deleted? Error was: ' + err) }
				await wait(1000)
			}
			
		}//end for each new sale
		await wait(2000)
	}
} module.exports.getActivities = getActivities
