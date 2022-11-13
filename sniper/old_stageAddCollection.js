/* 

Gets all NFTs by verified creator address from quiknode (private RPC), then completes metadata (also via quiknode), then saves to DB
stageAddCollection saves each stage to SQL and retrieves it again

*/

const { Metaplex, keypairIdentity, bundlrStorage } = require("@metaplex-foundation/js")
const { Connection, Keypair, PublicKey } = require("@solana/web3.js")
const sql = require('../tools/commonSQL.js')//common sql related commands are in here
const w = require('../tools/winston.js')
const sniper = require('./sniper-main.js')

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

//fulladd - do all steps
async function addNewNFT(creatoraddress, meslug) {

  await getMetaplexData(creatoraddress)
  await calculateTraitPercentages(creatoraddress)
  await combineTraitRarity(creatoraddress, meslug)
  await rankNFTs(creatoraddress)
  await cleanupDatabase(creatoraddress)
  await sniper.stop()
  await sniper.initialise()

}; module.exports.addNewNFT = addNewNFT

//addstep1
async function getMetaplexData(creatoraddress) {
  //establish connection
  const connection = new Connection(process.env.QUICKNODE)
  const wallet = Keypair.generate()
  const metaplex = Metaplex.make(connection)
    .use(keypairIdentity(wallet))
    .use(bundlrStorage())

  var creatorkey = new PublicKey(creatoraddress)//make the verified creator address into a public key

  w.log.info('Metaplex: getting metadata from RPC - should take about 1 minute per 100 NFTs in collection')
  const metadata = await metaplex.nfts().findAllByCreator({ "creator": creatorkey }).run()

  w.log.info('Metaplex: adding NFT JSON to the ' + metadata.length + ' NFTs we recieved - 1 API request per 65ms')
  var withjson = { "data": [], "fails": [] }
  var heartbeat = 0//start at 0 and count for each NFT. Send log every 50

  for (var i = 0; i < metadata.length; i++) {//for each of the recieved NFTs (without metadata)
    var thisnft = await metaplex.nfts().load({ "metadata": metadata[i] }).run()//request NFT metadata

    if (thisnft.json != null) {//if the response did indeed have metadata
      withjson.data.push(thisnft)//add it to the final object
      heartbeat = heartbeat + 1//count up heartbeat logger
      if ((heartbeat % 50) == 0) { w.log.info('Metaplex: I\'ve sent ' + heartbeat + ' json load requests') }//console log every 50 requests (so we know process is alive)
      await wait(60)//wait to slow API requests.
    } else {//if recieved NFT didnt have metadata, we can retry is. push it to a fail object.
      w.log.info('Metaplex: ' + thisnft.name + ' failed to add JSON. Pushing metadata[i] to fail list')
      withjson.fails.push(metadata[i])
    }//end else if no NFT metadata
  }//end for each NFT metadata

  //retry the fails - only one retry, should probably do at least a 2nd retry (or more?)
  w.log.info('Metaplex: retrying ' + withjson.fails.length + ' fails')
  var heartbeat = 0
  for (var i = 0; i < withjson.fails.length; i++) {//loop hrough fails object
    var thisnft = await metaplex.nfts().load({ "metadata": withjson.fails[i] }).run()//request NFT metadata

    if (thisnft.json != null) {//if we got metadata
      w.log.info('Metaplex: ' + thisnft.name + ' got data on retry')
      withjson.data.push(thisnft)
      heartbeat = heartbeat + 1
      if ((heartbeat % 5) == 0) { w.log.info('Metaplex: I\'ve sent ' + heartbeat + ' json load requests') }
      await wait(80)//wait to slow API requests.
    } else {
      w.log.info("Metaplex: failed to add JSON twice. " + thisnft.name + " will not be in final obj.data")
    }//end else if we got metadata
  }//end for each fail

  w.log.info('Metaplex: storing metaplex data (with JSON) in DB')
  await sql.createTableRow("solanametaplex", "creatoraddress", creatoraddress, "withjson", JSON.stringify(withjson))
  await wait(5000)//making sure data has all been sucessfully transfer into SQL (could be a several MB of data)
}; module.exports.getMetaplexData = getMetaplexData

//addstep2 - gets the metaplex data and caculates the percentages of each trait. Stores as seperate object in DB
async function calculateTraitPercentages(creatoraddress) {

  w.log.info('Metaplex: Calculating trait percentages')
  const metaplexdata = await sql.getData("solanametaplex", "creatoraddress", creatoraddress, "withjson")//get data from DB
  var traitPercentages = {}//establish output object

  for (var i = 0; i < metaplexdata.data.length; i++) {//for each nft in the metaplex data

    try {
      if (metaplexdata.data[i].json) {//if there is JSON metadata. This shouldnt happen now we retry fails.
        for (var j = 0; j < metaplexdata.data[i].json.attributes.length; j++) { //for each attribute of this NFT
          var maintype = metaplexdata.data[i].json.attributes[j].trait_type
          var subtype = ''
          if (metaplexdata.data[i].json.attributes[j].value.toString()) {//if the atribute has a value (not sure why it wouldn't or why I added this!)
            subtype = metaplexdata.data[i].json.attributes[j].value//set subtype to it
          } else { subtype = 'none' }//else set it to "none" which essentially adds a count for it

          if (maintype in traitPercentages) {//if maintype is already a key in the object
            if (subtype in traitPercentages[maintype]) {//if maintype and subtype already exist, +1 to timesSeen and +1 to total count for that maintype
              traitPercentages[maintype][subtype]['timesSeen'] = traitPercentages[maintype][subtype]['timesSeen'] + 1
              traitPercentages[maintype]['totalcount'] = traitPercentages[maintype]['totalcount'] + 1
            } else {//maintype exists, but subtype does not. Create new subtype object and start at 1 timesSeen
              traitPercentages[maintype][subtype] = {}
              traitPercentages[maintype][subtype]['timesSeen'] = 1
              traitPercentages[maintype]['totalcount'] = traitPercentages[maintype]['totalcount'] + 1//maintype already existed, so we can add 1 to it
            }
          } else {//if maintype isnt already a key, subtype won't exist either first create the objects, then start at 1 timesSeen and totalcount
            traitPercentages[maintype] = {}
            traitPercentages[maintype][subtype] = {}
            traitPercentages[maintype][subtype]['timesSeen'] = 1
            traitPercentages[maintype]['totalcount'] = 1
          }//end else
        }//end for each trait
      } else { throw 'Metaplex: var i = ' + i + ' var j = ' + j + ' maintype is: ' + maintype + 'subtype is: ' + subtype + ' for ' + metaplexdata.data[i].name }
    } catch (err) {
      w.log.info('Metaplex: Error finding traits: ' + err)
    }//end catch error
  }//end for each nft

  //work out percentages
  Object.keys(traitPercentages).forEach(maintype => {//for each maintype
    Object.keys(traitPercentages[maintype]).forEach(subtype => {//go into each subtype
      if (traitPercentages[maintype][subtype] != 'timesSeen') {//for all except the 'timesSeen' key
        traitPercentages[maintype][subtype]['percentage'] = traitPercentages[maintype][subtype]['timesSeen'] / traitPercentages[maintype]['totalcount']
      }//end if not 'timesSeen'
    })//end for each subtype
  })//end for each maintype

  //store in DB
  w.log.info('Metaplex: Storing trait percentages in DB')
  await sql.updateTableColumn("solanametaplex", "creatoraddress", creatoraddress, "traitrarity", traitPercentages)
}; module.exports.calculateTraitPercentages = calculateTraitPercentages

//addstep3 - get the nft and trait % data from SQL (added with getMetaplexData) and calculate the statistical rarity of each nft
async function combineTraitRarity(creatoraddress, meslug) {

  w.log.info('Metaplex: Building final object with statistical rarity')
  var traitdata = {}; var nftdata = {}//establish objects

  //load NFT and trait data and 
  const loaddata = Promise.all([sql.getData("solanametaplex", "creatoraddress", creatoraddress, "traitrarity"), sql.getData("solanametaplex", "creatoraddress", creatoraddress, "withjson")])
  try {
    const thisdata = await loaddata
    traitdata = thisdata[0]
    nftdata = thisdata[1]
  } catch (error) { w.log.info('Metaplex: Error getting data') }

  var output = { "data": [] }//establish output object

  //save some collection specific data into the top level of the output object
  output['collectionSymbol'] = nftdata.data[0].json.symbol
  output['verifiedCreator'] = creatoraddress
  output['totalNFTs'] = nftdata.data.length
  output['collectionCommonName'] = nftdata.data[0].name.substring(0, (nftdata.data[0].name.indexOf('#') - 1))
  output['collectionKey'] = nftdata.data[0].name.substring(0, (nftdata.data[0].name.indexOf('#') - 1)).toString().replace(/[^0-9a-z]/gi, '')
  output['description'] = nftdata.data[0].json.description

  //log any with null JSON. This shouldnt happen no we are retrying fails and excluding failed metadata requests
  /*
  for (var i = 0; i < nftdata.data.length; i++) {
    if (nftdata.data[i].json == null) {
      w.log.info('Metaplex: there was a null json')
      w.log.info(nftdata.data[i])
    }
  }*/

  var jsonerrors = 0
  for (var i = 0; i < nftdata.data.length; i++) {//for each NFT
    var thesepercentages = []

    //add the percentage rarity of each attribute of this NFT to an arrary
    try {
      if (nftdata.data[i].json) {//if there is metadata
        for (var j = 0; j < nftdata.data[i].json.attributes.length; j++) { //for each attribute
          try {
            //if there are any attributes (should be)
            if (nftdata.data[i].json.attributes[j]) {
              var maintype = nftdata.data[i].json.attributes[j].trait_type

              //if the attribute has a value, else set to none. As mentioned in calculate percentages. This may not be needed
              var subtype = ''
              if (nftdata.data[i].json.attributes[j].value.toString()) {
                subtype = nftdata.data[i].json.attributes[j].value
              } else { subtype = 'none' }

              //push percentage into an arrary
              var thispercentage = traitdata[maintype][subtype]['percentage']
              thesepercentages.push(thispercentage)
            } else { throw 'Metaplex: var i = ' + i + ' var j = ' + j + '.  maintype is a ' + typeof maintype + ': ' + maintype + '. subtype is a ' + typeof subtype + ': ' + subtype }
          } catch (err) {
            w.log.info('Metaplex: Error finding traits: ' + err)
          }
        }//end for each attribute

        //multiply the percentages together to get statistical rarity
        var thisrarity = (parseFloat(thesepercentages[0]) * 10)//first % is the starting point (don't want 1 or 0)
        for (var k = 1; k < thesepercentages.length; k++) {//from k = 1
          thisrarity = thisrarity * (parseFloat(thesepercentages[k]) * 10)//multiplying percentage 10x so we don't loose any resolution off the right side
        }//end for percentages

        //these addresses are not always in the metadata. Set them if we can.
        var tokenAddress = ''
        try { if (nftdata.data[i].address) { tokenAddress = nftdata.data[i].address } } catch { tokenAddress = 'not found' }
        var mintAuthorityAddress = ''
        try { if (nftdata.data[i].mint.mintAuthorityAddress) { mintAuthorityAddress = nftdata.data[i].mint.mintAuthorityAddress } } catch { mintAuthorityAddress = 'not found' }
        var collectionAddress = ''
        try { if (nftdata.data[i].collection.address) { collectionAddress = nftdata.data[i].collection.address } } catch { collectionAddress = 'not found' }
        var metadataAddress = ''
        try { if (nftdata.data[i].metadataAddress) { metadataAddress = nftdata.data[i].metadataAddress } } catch { metadataAddress = 'not found' }

        //get nft ID from name - regex last number in name
        var thisnftid = 0
        var regex = /(\d+)(?!.*\d)/
        var matchid = nftdata.data[i].json.name.match(regex)
        thisnftid = parseFloat(matchid[0])

        //now store the NFT with this info into out output object
        output.data[i] = {
          "nftid": thisnftid,
          "name": nftdata.data[i].json.name,
          "statisticalRarity": thisrarity,
          "image": nftdata.data[i].json.image,
          "symbol": nftdata.data[i].json.symbol,
          "attributes": nftdata.data[i].json.attributes,
          "uri": nftdata.data[i].uri,
          "tokenAddress": tokenAddress,
          "mintAuthorityAddress": mintAuthorityAddress,
          "collectionAddress": collectionAddress,
          "metadataAddress": metadataAddress
        }//end output data load for this NFT
      } else { jsonerrors = jsonerrors + 1 }
    } catch (err) {
      w.log.info(err)
    }//end catch error
  }//end for each NFT
  w.log.info('Metaplex: ' + jsonerrors + '/' + nftdata.data.length + ' gave JSON errors')
  //store new nft arrary in SQL
  w.log.info('Metaplex: Storing object with ' + output.data.length + ' NFTs + Statistical Rarity + collectionkey ' + nftdata.data[0].name.substring(0, (nftdata.data[0].name.indexOf('#') - 1)).toString().replace(/[^0-9a-z]/gi, ''))
  await sql.updateTableColumn("solanametaplex", "creatoraddress", creatoraddress, "withrarity", output)
  w.log.info('Metaplex: storing collection count of: ' + parseFloat(output.data.length))
  await sql.updateTableColumn("solanametaplex", "creatoraddress", creatoraddress, "collectioncount", parseFloat(output.data.length))
  w.log.info('Metaplex: storing collection key: ' + meslug.replace(/[^0-9a-z]/gi, '').toLowerCase())
  await sql.updateTableColumn("solanametaplex", "creatoraddress", creatoraddress, "collectionkey", meslug.replace(/[^0-9a-z]/gi, '').toLowerCase())
  w.log.info('Metaplex: storing meslug: ' + meslug)
  await sql.updateTableColumn("solanametaplex", "creatoraddress", creatoraddress, "meslug", meslug)
}; module.exports.combineTraitRarity = combineTraitRarity

//addstep4 - get the unranked NFTs with statistical rarity and rank them for the final data
async function rankNFTs(creatoraddress) {

  w.log.info('Metaplex: Ranking NFTs')
  //get data from DB
  const input = await sql.getData("solanametaplex", "creatoraddress", creatoraddress, "withrarity")//get data from DB
  w.log.info('Metaplex: input.data.length is: ' + input.data.length)

  //make sure there are no null entries in our ranking. There shouldn't be as preceeding functions should handle this, but best be safe.
  var filtered = []
  for (var i = 0; i < input.data.length; i++) {
    if (input.data[i] != null) {
      filtered.push(input.data[i])
    }//end if not null
  }//end for

  //rank NFTs based on statistical rarity
  var sorted = filtered.sort((a, b) => a.statisticalRarity - b.statisticalRarity)

  for (i = 0; i < sorted.length; i++) { sorted[i]['rarityRank'] = (i + 1) }//add a rank value to object which will be output

  var output = input//set output equal to what we got from DB
  output.data = []//clear just the data part (so we keep the other data)
  output.data = sorted//set the NFT data equal to the sorted data.

  w.log.info('Metaplex: Storing final object with ' + output.data.length + ' NFTs')
  await sql.updateTableColumn("solanametaplex", "creatoraddress", creatoraddress, "finaldata", output)

}; module.exports.rankNFTs = rankNFTs

//addstep5 - delete data we no longer need from sql columns
async function cleanupDatabase(creatoraddress) {

  w.log.info('Metaplex: clearing raw metaplex + JSON data')
  await sql.deleteColumnData("solanametaplex", "creatoraddress", creatoraddress, "withjson")
  w.log.info('Metaplex: clearing unranked data with rarity')
  await sql.deleteColumnData("solanametaplex", "creatoraddress", creatoraddress, "withrarity")
  w.log.info('Metaplex: clearing trait rarity')
  await sql.deleteColumnData("solanametaplex", "creatoraddress", creatoraddress, "traitrarity")

}; module.exports.cleanupDatabase = cleanupDatabase