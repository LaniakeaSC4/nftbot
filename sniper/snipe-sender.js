const sql = require('../tools/commonSQL.js')//sql related commands are in here
const w = require('../tools/winston.js')
var discord = require('../clients/discordclient.js')
const client = discord.getClient()
const pround = (number, decimalPlaces) => Number(Math.round(Number(number + "e" + decimalPlaces)) + "e" + decimalPlaces * -1)
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

var nonPremiumDelay = 300000

//initialise servers
var supportedservers = []
var initalisecount = 1
async function initaliseServers() {
	supportedservers = []
	supportedservers = await sql.getSupportedServers()
	initalisecount = initalisecount + 1
	if ((initalisecount % 5) == 0) { w.log.info('Servers have been initalised 5 times since last log message') }
}; module.exports.initaliseServers = initaliseServers

//work out where to send them
async function sendFilter(thisname, thiscollection, thisembedcolour, rarityRank, raritydescription, thislimit, thisfloorprice, thissnipeprice, thisprice, thisimage, thislistinglink, hotness, collectionSize, floor_history) {
	for (i = 0; i < supportedservers.length; i++) {
		if (supportedservers[i].inserver === true) {//only proceed if bot is in server
			var thisserver = supportedservers[i]; var thisserverid = ''; var feedchannel = ''

			//Skip this loop altogether if this server has a rarity disabled
			if (raritydescription === "Rare" && supportedservers[i].rare_enabled === false) { continue }
			if (raritydescription === "Epic" && supportedservers[i].epic_enabled === false) { continue }
			if (raritydescription === "Legendary" && supportedservers[i].legendary_enabled === false) { continue }
			if (raritydescription === "Mythic" && supportedservers[i].mythic_enabled === false) { continue }

			//filter out snipes below global minimum list price (e.g. less than 2 sol)
			if (parseFloat(thisprice) < parseFloat(supportedservers[i].min_price) || parseFloat(thisprice) >= parseFloat(supportedservers[i].max_price)) { continue }

			/*
			//filter by global blackslist (make /blacklist command)
			Loop through blacklist same as alpha channels
			*/

			//check if this snipe should be redirected to a homechannel from the main feed
			var foundhome = false//start with false
			if (thisserver.homechannel_enabled === true && thisserver.premium === true) {
				//w.log.info('homechannel was enabled for ' + thisserver.serverid)
				//check if this snipe needs to go into a home channel
				for (var j = 0; j < thisserver.homechannel_collections.enabled.length; j++) {//for enabled homechannel collections (could be 0)
					if (thisserver.homechannel_collections.enabled[j] == thiscollection) {//if we match on meslug
						if (thisserver.homechannel_id) {//if there is a homechannel ID (perhaps there are defined home collections, but channel has been deleted)
							thisserverid = thisserver.serverid//this is the server where we are going to send it
							feedchannel = thisserver.homechannel_id//this is (home)channel we should send it to
							foundhome = true//set true, we found a homechannel
						}//end if there is a homechannel id
						break//no need to loop further
					} else {/*w.log.info('No homechannel match for this collection on this server')*/ }
				}//end loop through saved home channels
			}//end if homechannel is enabled and server is premium

			//check if this server has this collection enabled for an alpha channel send a duplicate there
			var foundalpha = false; var alphachannelid = ''
			if (thisserver.alpha_channels != null && thisserver.premium === true) {//if there is an alpha channel config and server is premium
				for (var k = 0; k < thisserver.alpha_channels.enabled.length; k++) {//for each enables alpha channel (for this server)
					if (thisserver.alpha_channels.enabled[k].meslug === thiscollection) {//if match this collection
						foundalpha = true
						alphachannelid = thisserver.alpha_channels.enabled[k].channelid//save the alpha channel id for sending
						//w.log.info('Matched an alpha channel for this snipe we should send it to channel: ' + thisserver.alpha_channels.enabled[k].channelid)
						break
					}//end if match this collection
				}//end for enabled alpha channels 
			}//end if this server is premium and has an alpha config

			//if alpha channel is matched, send straight away.
			if (foundalpha === true) {
				sendsnipes(thisserverid, alphachannelid, null, thisname, thisembedcolour, rarityRank, raritydescription, thislimit, thisfloorprice, thissnipeprice, thisprice, thisimage, thislistinglink, hotness, collectionSize, thiscollection, floor_history)
			}//end if alpha

			//if foundhome is true (will only be if server is still premium, homechannel is enabled and this collection was found as a homechannel collection)
			//finding a homechannel will filter a message out of the snipe feed and into the home channel
			if (foundhome === true) {
				sendsnipes(thisserverid, feedchannel, null, thisname, thisembedcolour, rarityRank, raritydescription, thislimit, thisfloorprice, thissnipeprice, thisprice, thisimage, thislistinglink, hotness, collectionSize, thiscollection, floor_history)
			} else {//if valid homechannel was not found enter normal send filter process

				thisserverid = thisserver.serverid
				//check if single feed mode is enabled
				if (thisserver.singlefeedmode === true) {//if it is, use the raresnipes channel
					feedchannel = thisserver.raresnipes
				} else {//get the snipes channel id to send the snipe to
					if (raritydescription === 'Rare') { feedchannel = thisserver.raresnipes }
					if (raritydescription === 'Epic') { feedchannel = thisserver.epicsnipes }
					if (raritydescription === 'Legendary') { feedchannel = thisserver.legendarysnipes }
					if (raritydescription === 'Mythic') { feedchannel = thisserver.mythicsnipes }
				}//end else not single feed mode

				if (feedchannel) {//filters out servers which are in pg but not setup yet by checking if the snipe channel is valid for this server
					//send snipes
					if (thisserver.premium === false) {//if this isnt a premium server. Send after wait
						if (raritydescription == 'Rare' || raritydescription == 'Epic') {//as this inst a premium server, send only rare or epic snipes
							//w.log.info(thisserverid + ' is not premium waiting before sending ' + thisname + '...')
							//w.log.info(thisserverid + ' done waiting...' + 'now sending ' + thisname)
							sendsnipes(thisserverid, feedchannel, nonPremiumDelay, thisname, thisembedcolour, rarityRank, raritydescription, thislimit, thisfloorprice, thissnipeprice, thisprice, thisimage, thislistinglink, hotness, collectionSize, thiscollection, floor_history)
						} else { /*w.log.info('NFT: ' + thisname + ' was better than rare or epic, not posting to ' + thisserverid)*/ }
					} else {//if this is a premium server, just send it
						sendsnipes(thisserverid, feedchannel, null, thisname, thisembedcolour, rarityRank, raritydescription, thislimit, thisfloorprice, thissnipeprice, thisprice, thisimage, thislistinglink, hotness, collectionSize, thiscollection, floor_history)
					}//end else
				}//end if snipe channel.
			}//end else if homechannel was not enabled - send normally

		}//if bot is active in this server
	}//for each supported server (from SQL)   
}; module.exports.sendFilter = sendFilter

async function sendsnipes(server, thischannel, delay, nftname, embedcolour, thisrarity, raritydescription, thislimit, floorprice, thissnipeprice, thisprice, thisimage, listinglink, hotness, collectionSize, thiscollection, floor_history) {
	//don't need server ID, channel ID is enough
	if (delay) { await wait(delay) }//delay delivery if one was set
	
	floor_history.fp_5daverage = 'coming soon'
	floor_history.fp_5dchange = 'coming soon'
	floor_history.collection_24h_strength = 'coming soon'
	
	//send it
	try {
		const channel = await client.channels.fetch(thischannel)
		channel.send({
			embeds: [
				{
					"title": nftname,
					"color": embedcolour,
					"footer": {
						"text": 'For ' + raritydescription.toLowerCase() + ' NFTs, listing price <' + parseFloat(thislimit) + 'x the floor price of ' + pround(parseFloat(floorprice), 3) + ' SOL is a snipe (i.e. less than ' + pround(parseFloat(thissnipeprice), 3) + ' SOL)' + "\nSearch \"Snipe" + thiscollection + "\" for more snipes in this collection.\nD: https://discord.gg/CgF7neAte2 | W: nftsniperbot.xyz"
					},
					"fields": [
						{
							"name": "🎯 __Snipe Details__",
							"value": "**Rarity**: " + thisrarity + "/" + collectionSize + ' - ' + raritydescription + "\n**Hotness**: " + hotness + "\n**List price**: " + pround(parseFloat(thisprice), 3) + ' SOL\n**Current FP**: ' + pround(parseFloat(floorprice), 3) + " SOL\n[Buy on Magic Eden](" + listinglink + ')\n',
							"inline": false
						},
						{
							"name": "📌 __Collection Stats__",
							"value": "**5 Day avg FP**: " + floor_history?.fp_5daverage + "\n**5 Day FP change**: " + floor_history?.fp_5dchange + "\n**24h Strength**: " + floor_history?.collection_24h_strength,
							"inline": false
						},
					],
					"thumbnail": {
						"url": thisimage,
						"height": 75,
						"width": 75
					}
				}
			]//end embed
		}).catch((err) => { w.log.error('there was a message send error: ' + err) })//end message send
	} catch (err) { w.log.error('there was an nft sending error. Perhaps channel deleted? Error was: ' + err) }
}//end sendsnipes function
