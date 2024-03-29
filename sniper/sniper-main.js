const w = require('../tools/winston.js')
const magiceden = require('../tools/magicedenRPC.js')//Magic Eden related commands are in here
const nfttools = require('../tools/nfttools.js')//generic nft tools like get rarity description from rank in here
const sql = require('../tools/commonSQL.js')//sql related commands are in here
const snipersender = require('./snipe-sender.js')

const pround = (number, decimalPlaces) => Number(Math.round(Number(number + "e" + decimalPlaces)) + "e" + decimalPlaces * -1)
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

var logging = false//disable logging of snipe found messages. Could transiently enable this later with command

var collections = {}

//build array of [0,1,2,etc] for each collection we have. These integers can be used to key access to sniperCollections arrary to loop other functions through all supported collections
var sniperSequencer = []

var initialget = 15//how many listings will sniper get initially (max 20)
var refreshget = 10//how many will sniper get on each check (max 20) - should be less then initial get or extras will count as new
var maxlength = 40//how many records history will we keep for each collection
var minutes = 2.5, the_interval = minutes * 60 * 1000//refresh interval for sniper bot

//set multipliers above floor price at which listings become snipes
var mythiclimit = 15
var legendarylimit = 7.5
var epiclimit = 2.5
var rarelimit = 1.25

var supportedservers = []

const initaliseSniperCollections = async () => {
  //reset globals incase this is a restart
  supportedservers = []; sniperSequencer = []; collections = {}

  collections = await sql.getSupportedCollections()

  var currentcollections = ""
  for (var i = 0; i < collections.length; i++) { sniperSequencer.push(i); currentcollections = (currentcollections + "| " + collections[i].collectionkey + " |") }
  w.log.info('Starting sniper with: ' + currentcollections)

  for (const seq of sniperSequencer) {//for each collection
    //get initial set of listings and store them in the local history arrary for that collection
    await magiceden.getNewListings(collections[seq]['meslug'], initialget).then(async thislistings => {
      collections[seq]['listings'] = thislistings//fill tracked listings with the listings we just got
      //w.log.info('SniperV2: added initial ' + initialget + ' Listings for ' + collections[seq]['meslug'])
    })//end then
    await wait(1200)//add delay between API requests
  }//for seq of sniperSequencer

  //get servers and load into supported servers var
  supportedservers = await sql.getSupportedServers()

  startsniper()
}//end initaliseSniperCollections
module.exports.initialise = initaliseSniperCollections

//store the setInterval ids for the sniper recheck loops we start so we can retrieve and kill them later.
var currentloops = []
var serversinitalized = false

//main sniper function
async function startsniper() {
  w.log.info('SniperV2: starting main function')
  await Promise.all(sniperSequencer.map(async value => {//this was added to make sure to sequentially initiate the sniper loops. Not sure its working as intended, but loops are spread out
    var thisinterval = the_interval + (value * 1100)//interval for each collection is 1.1 seconds longer to avoid more than 2 ME API requests per second
    //w.log.info('SniperV2: Initialising recheckloop for collection: ' + collections[value].collectionkey + '. Setting interval for this collection to: ' + thisinterval)

    var thisintervalid = await setInterval(async function (k) {//do this every X minutes
      await magiceden.getNewListings(collections[k]['meslug'], refreshget).then(async thislistings => {//get latest X listings from Magic Eden
        /* heartbeat logging - enable if you want update each minute for each collection */
        //w.log.info("I am doing my " + minutes + " minute check for " + sniperCollections[k][0] + '. I have this many in my history at start: ' + sniperCollections[k][1].length)

        var rebuildarrary = collections[k]['listings']//save all the acquired listings in a temporary arrary

        for (var i = 0; i < thislistings.length; i++) {//for all listings recieved from magiceden.getNewListings function

          if (collections[k]['listings'].some(e => (e.tokenAddress === thislistings[i].tokenAddress && e.price === thislistings[i].price))) {
            //actions if token address and price match (i.e. we've seen this one before)
          } else {
            //actions if token address or price does not match one we have seen before
            //w.log.info('SniperV2: New/updated ' + collections[k]['meslug'] + ' entry ' + thislistings[i].tokenMint + ' at price ' + thislistings[i].price)
            rebuildarrary.unshift(thislistings[i])//add the new entry to the start of the rebuild arrary so we can remember this one if we see it later

            var seller = thislistings[i].seller
            var thisprice = pround(thislistings[i].price, 6)//set price of this lisitng
            var recievedtoken = await magiceden.getTokenDetails(thislistings[i].tokenMint)//added 25ms delay at the end of the loop to slow this down a little. Getting occasional me API and sql errors.

            if (recievedtoken) {//check if we got data from Magic Eden

              var thistoken = recievedtoken
              var thisname = thistoken.name
              var thisimage = thistoken.image
              var thislistinglink = 'https://magiceden.io/item-details/' + thistoken.mintAddress

              //get nft ID from name
              var thisnftid = 0
              //regex last number in string
              var regex = /(\d+)(?!.*\d)/
              var matchid = thistoken.name.match(regex)
              if (matchid) { thisnftid = parseFloat(matchid[0]) }//if there is an NFT ID in the name, set thisnftid to it. Else it stays 0

              var NFTdata = await sql.getNFTdata(collections[k]['collectionkey'], thistoken.mintAddress)
              if (NFTdata) {
                //should make this promise.all instead of sequential awaits
                var collectionSize = await sql.getData("solanametaplex", "collectionkey", collections[k]['collectionkey'], 'collectioncount')
                var raritydescription = await nfttools.getraritydescription(collectionSize, NFTdata.rarityRank)
                var thisembedcolour = await nfttools.getembedcolour(raritydescription)
                try {
                  var floorprice = await magiceden.getFloorPrice(collections[k]['meslug'])
                } catch (err) {
                  w.log.info('Error getting ME FP: ' + err)
                  return
                }
                var thisfloorprice = pround(parseFloat(floorprice), 6)
                var snipe = await testifsnipe(raritydescription, parseFloat(thisprice), parseFloat(thisfloorprice))

                if (snipe) {//after testing, if this one was a snipe...
                  var lastfloor = await sql.getData("solanametaplex", "collectionkey", collections[k]['collectionkey'], "lastfloor")
                  var floordrop = 0
                  if (thisfloorprice < lastfloor && thisfloorprice == thisprice) {
                    floordrop = lastfloor - thisfloorprice
                  }

                  var thissnipeprice = parseFloat(snipe[1])
                  var thislimit = parseFloat(snipe[2])
                  var snipe_ping = snipe[3]
                  var hotness = await snipeHotness(parseFloat(thisprice), thisfloorprice, parseFloat(thissnipeprice))//how hot is this snipe?

                  if (logging === true) { w.log.info('SniperV2: we have a ' + raritydescription + ' ' + collections[k]['collectionkey'] + ' snipe! ' + thislistings[i].tokenMint + ' at price ' + thislistings[i].price) }

                  //initialise servers if not already
                  if (!serversinitalized) { await snipersender.initaliseServers(); serversinitalized = true }
                  //send snipe into the send filter where server specific filters are applied (e.g. premium, price limits, etc)
                  snipersender.sendFilter(thisname, collections[k]['collectionkey'], thisembedcolour, NFTdata.rarityRank, raritydescription, thislimit, thisfloorprice, thissnipeprice, thisprice, thisimage, thislistinglink, hotness, collectionSize, collections[k]['floor_history'], snipe_ping, seller, floordrop)
                } else { /* w.log.info('this was not a snipe') */ } //end if not false
              } else {//end else if we got data from ME
                w.log.error('error getting nft data for ' + collections[k]['collectionkey'] + ' ' + thisnftid)
              }//end else if get nft data failed
            } else { w.log.error('error getting listing at magic Eden for this snipe test') }
            //save record of last seen time and floor price
            await lastSeen(collections[k]['collectionkey'], thisfloorprice)
            await wait(50)//added a delay between loops so we are not sending too many requests to ME or our SQL DB
          }//end else for a token we havnt seen before
        }//end for loop of each listing recieved

        //for each collection we store a max history. Clear the oldest ones if it's longer than that. 
        if (rebuildarrary.length > maxlength) {
          var numbertoremove = rebuildarrary.length - maxlength
          //w.log.info('SniperV2: number to remove is: ' + numbertoremove)
          for (var i = 0; i < numbertoremove; i++) {
            rebuildarrary.pop()//remove oldest entry
          }//end for number to remove
        }//end if rebuildarrary is longer than max length

        collections[k]['listings'] = rebuildarrary//overwrite main listings arrary with the temp rebuild one

      })//end then after getting 
    }, thisinterval, value)//end recheck listing loop
    //save this interval id so we can kill it in a restart using stopsniper()
    currentloops.push(thisintervalid)
  })//end snipersequencer values
  )//end promise.all
}//end startsniper
module.exports.start = startsniper

async function snipeHotness(thisprice, floorprice, thislimit) {
  //calculate steps between list price and the snipe limit
  var blazinglimit = floorprice + ((thislimit - floorprice) * 0.2)
  var redhotlimit = floorprice + ((thislimit - floorprice) * 0.4)
  var hotlimit = floorprice + ((thislimit - floorprice) * 0.6)
  var warmlimit = floorprice + ((thislimit - floorprice) * 0.8)
  var coollimit = thislimit
  //assign 🔥 depedending on how close to the bottom this listing is
  if (thisprice <= blazinglimit) { return 'Blazing Hot 🔥🔥🔥🔥🔥' }
  if (thisprice <= redhotlimit && thisprice > blazinglimit) { return 'Red Hot 🔥🔥🔥🔥' }
  if (thisprice <= hotlimit && thisprice > redhotlimit) { return 'Hot 🔥🔥🔥' }
  if (thisprice <= warmlimit && thisprice > hotlimit) { return 'Warm 🔥🔥' }
  if (thisprice <= coollimit && thisprice > warmlimit) { return 'Cool 🔥' }
}//end fnction snipeHotness

//returns rarity description (i.e. "Mythic" if its a snipe, else returns 'false') also returns 
async function testifsnipe(raritydescription, thisprice, floorprice) {
  return new Promise((resolve, reject) => {
    //w.log.info('SniperV2: testing for snipe with an ' + raritydescription + ' at a list price of ' + thisprice + ' and the floor price is ' + floorprice)

    //make calculation of if this is a snipe using rarity, floor price and nft price
    var hotrarities = ['Mythic', 'Legendary', 'Epic', 'Rare']

    if (hotrarities.includes(raritydescription)) {
      //calculate snipe limits of x*fp
      var mythicsnipe = mythiclimit * floorprice
      var legendarysnipe = legendarylimit * floorprice
      var epicsnipe = epiclimit * floorprice
      var raresnipe = rarelimit * floorprice

      if ((raritydescription === 'Mythic') && (thisprice <= mythicsnipe)) {
        //check if this mythic is within 20% of FP. If so, send alert.
        let alertlimit = floorprice * 1.2
        if (thisprice <= alertlimit) {
          resolve([raritydescription, mythicsnipe, mythiclimit, true])
        } else {//not within 20%. No alert.
          resolve([raritydescription, mythicsnipe, mythiclimit, false])
        }
      } else if ((raritydescription === 'Legendary') && (thisprice <= legendarysnipe)) {
        //check if this legendary is within 5% of FP. If so, send alert.
        let alertlimit = floorprice * 1.05
        if (thisprice <= alertlimit) {
          resolve([raritydescription, legendarysnipe, legendarylimit, true])
        } else {//not within 5%. No alert.
          resolve([raritydescription, legendarysnipe, legendarylimit, false])
        }
      } else if ((raritydescription === 'Epic') && (thisprice <= epicsnipe)) {
        resolve([raritydescription, epicsnipe, epiclimit, false])
      } else if ((raritydescription === 'Rare') && (thisprice <= raresnipe)) {
        resolve([raritydescription, raresnipe, rarelimit, false])
      } else {
        resolve(null)
      }
    }//end if hotrarities
  }) //end promise
}//end testifsnipe function

//function to kill all the sniper loops by interval ID. Used during a hot restart
async function stopsniper() {
  w.log.info('stopping sniper bot with clearinterval')
  for (var i = 0; i < currentloops.length; i++) {//for each establised loop
    clearInterval(currentloops[i])
  }//end for
  currentloops = []//reset it
} module.exports.stop = stopsniper

var db = require('../clients/pgclient.js')
//save last seen time and floorprice
async function lastSeen(collectionkey, floorprice) {
  return new Promise((resolve, reject) => {
    var pgclient = db.getClient()

    //update this table to add this data to this column where this key matches the table's primary key
    var querystring = "UPDATE solanametaplex SET lastfloor = $1, lastseen = current_timestamp WHERE collectionkey = '" + collectionkey + "'"
    var querydata = [floorprice]

    pgclient.query(querystring, querydata, (err, res) => {
      if (err) throw err
      resolve(true)
    })//end query
  })//end promise
} module.exports.lastSeen = lastSeen
