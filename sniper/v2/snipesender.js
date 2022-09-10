const sql = require('../../tools/commonSQL.js')//sql related commands are in here
const w = require('../../tools/winston.js')
var discord = require('../../clients/discordclient.js')
const client = discord.getClient()
const pround = (number, decimalPlaces) => Number(Math.round(Number(number + "e" + decimalPlaces)) + "e" + decimalPlaces * -1)
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

var nonPremiumDelay = 300000

//initialise servers
var supportedservers = []
async function initaliseServers() {
	supportedservers = []
	supportedservers = await sql.getSupportedServers()
}; module.exports.initaliseServers = initaliseServers

//work out where to send them
async function sendFilter(thisname, thiscollection, thisembedcolour, rarityRank, raritydescription, thislimit, thisfloorprice, thissnipeprice, thisprice, thisimage, thislistinglink, hotness, collectionSize) {
	w.log.info('starting sendFilter')
	var thisserverid = ''
	var channel = ''

	for (i = 0; i < supportedservers.length; i++) {

		//check if this snipe should be sent to a homechannel
		if (supportedservers[i].homechannel_enabled) {
			//w.log.info('homechannel was enabled for ' + supportedservers[i].serverid)
			//check if this snipe needs to do into a home channel
			var foundhome = false
			for (var j = 0; j < supportedservers[i].homechannel_collections.enabled.length; j++) {
				if (supportedservers[i].homechannel_collections.enabled[j] == thiscollection) {
					foundhome = true
					thisserverid = supportedservers[i].serverid
					channel = supportedservers[i].homechannel_id
					//w.log.info('matched this snipe to a home collection for server: ' + supportedservers[i].homechannel_id)
					break
				} else {//w.log.info('No homechannel match for this collection on this server')
				}
			}

			//if yes, send it to home channel
			if (foundhome) {
				//w.log.info('Foundhome was true sending snipe to homechannel')
				if (channel) {//filters out servers which are in pg but not setup yet by checking if the snipe channel is valid for this server

					if (supportedservers[i].premium != true) {
					  if (raritydescription == 'Rare' || raritydescription == 'Epic'){
					w.log.info(thisserverid + ' is not premium waiting before sending ' + thisname + '...')
					await wait(nonPremiumDelay)
					w.log.info(thisserverid + ' done waiting...' + 'now sending ' + thisname)
						sendsnipes(thisserverid, channel, thisname, thisembedcolour, rarityRank, raritydescription, thislimit, thisfloorprice, thissnipeprice, thisprice, thisimage, thislistinglink, hotness, collectionSize)
					  } else {w.log.info('hit the else 1 for '+ thisname)}
					} else {
						sendsnipes(thisserverid, channel, thisname, thisembedcolour, rarityRank, raritydescription, thislimit, thisfloorprice, thissnipeprice, thisprice, thisimage, thislistinglink, hotness, collectionSize)
					}
				}//end if snipe channel.
			} else {
				//w.log.info('Although homechannel was enabled for ' + supportedservers[i].serverid + 'this collection was not found. Sending the normal way')
				//if homechannel enabled, but not for this collection, send it through the normal process
				//get the snipes channel id to send the snipe to
				thisserverid = supportedservers[i].serverid
				if (raritydescription === 'Rare') { channel = supportedservers[i].raresnipes }
				if (raritydescription === 'Epic') { channel = supportedservers[i].epicsnipes }
				if (raritydescription === 'Legendary') { channel = supportedservers[i].legendarysnipes }
				if (raritydescription === 'Mythic') { channel = supportedservers[i].mythicsnipes }

				if (channel) {//filters out servers which are in pg but not setup yet by checking if the snipe channel is valid for this server
					//send snipes
					if (supportedservers[i].premium != true) {
					  if (raritydescription == 'Rare' || raritydescription == 'Epic'){
					w.log.info(thisserverid + ' is not premium waiting before sending ' + thisname + '...')
					await wait(nonPremiumDelay)
					w.log.info(thisserverid + ' done waiting...' + 'now sending ' + thisname)
						sendsnipes(thisserverid, channel, thisname, thisembedcolour, rarityRank, raritydescription, thislimit, thisfloorprice, thissnipeprice, thisprice, thisimage, thislistinglink, hotness, collectionSize)
					  } else {w.log.info('hit the else 2 for' + thisname)} 
					} else {
						sendsnipes(thisserverid, channel, thisname, thisembedcolour, rarityRank, raritydescription, thislimit, thisfloorprice, thissnipeprice, thisprice, thisimage, thislistinglink, hotness, collectionSize)
					}
					
				}//end if snipe channel.
			}

		} else {//if homechannel is not enabled - send normally
			//w.log.info('Homechannels not enabled for ' + supportedservers[i].serverid + ' sending the old fashioned way')
			//get the snipes channel id to send the snipe to
			thisserverid = supportedservers[i].serverid
			if (raritydescription === 'Rare') { channel = supportedservers[i].raresnipes }
			if (raritydescription === 'Epic') { channel = supportedservers[i].epicsnipes }
			if (raritydescription === 'Legendary') { channel = supportedservers[i].legendarysnipes }
			if (raritydescription === 'Mythic') { channel = supportedservers[i].mythicsnipes }

			if (channel) {//filters out servers which are in pg but not setup yet by checking if the snipe channel is valid for this server
				//send snipes
				if (supportedservers[i].premium != true) {
				  if (raritydescription == 'Rare' || raritydescription == 'Epic'){
					w.log.info(thisserverid + ' is not premium waiting before sending ' + thisname + '...')
					await wait(nonPremiumDelay)
					w.log.info(thisserverid + ' done waiting...' + 'now sending ' + thisname)
					sendsnipes(thisserverid, channel, thisname, thisembedcolour, rarityRank, raritydescription, thislimit, thisfloorprice, thissnipeprice, thisprice, thisimage, thislistinglink, hotness, collectionSize)
				  } else {w.log.info('hit the else 3 for ' + thisname)} 
				} else {
					sendsnipes(thisserverid, channel, thisname, thisembedcolour, rarityRank, raritydescription, thislimit, thisfloorprice, thissnipeprice, thisprice, thisimage, thislistinglink, hotness, collectionSize)
				}
			}//end if snipe channel.
		}
	}//for each supported server (from SQL)   

}; module.exports.sendFilter = sendFilter

async function sendsnipes(server, channel, nftname, embedcolour, thisrarity, raritydescription, thislimit, floorprice, thissnipeprice, thisprice, thisimage, listinglink, hotness, collectionSize) {
	return new Promise((resolve, reject) => {
	  try {
		client.guilds.cache.get(server).channels.cache.get(channel).send({
			embeds: [
				{
					"title": hotness + ' Snipe Opportunity__\n' + nftname,
					"color": embedcolour,
					"fields": [
						{
							"name": "🎯 __Snipe Details__",
							"value": "**Rarity**: " + thisrarity + "/" + collectionSize + ' - ' + raritydescription + "\n**List price**: " + pround(parseFloat(thisprice), 3) + ' SOL\n**Floor price**: ' + pround(parseFloat(floorprice), 3) + ' SOL\n[Buy on Magic Eden](' + listinglink + ')\n',
							"inline": false
						},
						{
							"name": "⚡ __Snipe Price Info__",
							"value": 'For ' + raritydescription + ' NFTs, any price less than ' + parseFloat(thislimit) + 'x the floor price of ' + pround(parseFloat(floorprice), 3) + ' SOL is a snipe (i.e. less than ' + pround(parseFloat(thissnipeprice), 3) + ' SOL)',
							"inline": true
						},
						{
							"name": "🐍 __Laniakea Bot v2.3__",
							"value": "Hand crafted by Laniakea#3683 and brought to you by the Secret Snake Society. Visit us [on Discord](https://discord.gg/Dr2Vb7Rt6u).",
							"inline": false
						}
					],
					"thumbnail": {
						"url": thisimage,
						"height": 75,
						"width": 75
					}
				}
			]//end embed
		})//end message send
	  } catch (err) {w.log.error('there was an nft sending error. Perhaps channel deleted? Error was: ' + err)} 
	}) //end promise
}//end sendsnipes function
