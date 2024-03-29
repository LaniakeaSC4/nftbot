/*
This file is for functions which connect to the sql database

Postgress client established and connected in pgclint.js

If postgress client is already established and connected, it's returned.
Otherwise, a new clinet is established and connected, then returned.

Get the connected client in each function with - var pgclient = db.getClient()
Then query databse with - pgclient.query()
*/
var db = require('../clients/pgclient.js')
const w = require('./winston.js')

// ====================
// Generic SQL commands
//=====================

//creates a table row and adds data to one column - use if row dosent already exist
async function createTableRow(table, tableprimarykey, thisprimarykey, column, data) {
  return new Promise((resolve, reject) => {
    var pgclient = db.getClient()

    //insert into thistable a new row with primary key data into primary key column plus thisdata into thiscolumn
    var querystring = 'INSERT INTO ' + table + '( ' + tableprimarykey + ', ' + column + ' ) VALUES ( $1, $2 ) ON CONFLICT (' + tableprimarykey + ') DO NOTHING'
    var querydata = [thisprimarykey, data]

    pgclient.query(querystring, querydata, (err, res) => {
      if (err) throw err
      resolve('success')
    })//end query
  })//end promise
}; module.exports.createTableRow = createTableRow

//adds data to a column in an existing row
async function updateTableColumn(table, tableprimarykey, thisprimarykey, column, data) {
  return new Promise((resolve, reject) => {
    var pgclient = db.getClient()

    //update this table to add this data to this column where this key matches the table's primary key
    var querystring = "UPDATE " + table + " SET " + column + " = $1 WHERE " + tableprimarykey + " = '" + thisprimarykey + "'"
    var querydata = [data]

    pgclient.query(querystring, querydata, (err, res) => {
      if (err) throw err
      resolve('success')
    })//end query
  })//end promise
}; module.exports.updateTableColumn = updateTableColumn

//generic get data from table
async function getData(table, tableprimarykey, thisprimarykey, column) {
  return new Promise((resolve, reject) => {
    var pgclient = db.getClient()

    //select the data in this column for a row which has this primary key
    var querystring = "SELECT " + column + " FROM " + table + " WHERE " + tableprimarykey + " = '" + thisprimarykey + "'"

    pgclient.query(querystring, (err, res) => {
      if (err) throw err
      resolve(res.rows[0][column])//rows[0] because single result expected. Data from this particular column is at rows[0][column]
    })//end query
  })//end promise
}; module.exports.getData = getData

//generic delete column data from table
async function deleteColumnData(table, tableprimarykey, thisprimarykey, column) {
  return new Promise((resolve, reject) => {
    var pgclient = db.getClient()

    //select the data in this column for a row which has this primary key
    var querystring = "UPDATE " + table + " SET " + column + " = null WHERE " + tableprimarykey + " = '" + thisprimarykey + "'"

    pgclient.query(querystring, (err, res) => {
      if (err) throw err
      resolve('success')//rows[0] because single result expected. Data from this particular column is at rows[0][column]
    })//end query
  })//end promise
}; module.exports.deleteColumnData = deleteColumnData

//get a particular column for all rows
async function getRowsForColumn(table, column) {
  return new Promise((resolve, reject) => {
    var pgclient = db.getClient()

    //select the data in this column for a row which has this primary key
    var querystring = "SELECT " + column + " FROM " + table

    pgclient.query(querystring, (err, res) => {
      if (err) throw err
      resolve(res.rows)
    }) //end query
  }) //end promise
};
module.exports.getRowsForColumn = getRowsForColumn

//get entire server settings row - needs error handling like getNFTdata
async function getServerRow(serverid) {
  return new Promise((resolve, reject) => {
    var pgclient = db.getClient()

    var querystring = "SELECT * FROM servers WHERE serverid = '" + serverid + "'"

    pgclient.query(querystring, (err, res) => {
      if (err) throw err
      resolve(res.rows)
    })//end query
  })//end promise
}; module.exports.getServerRow = getServerRow

//===================
// Multi-use commands
//===================

//get a particular column for all rows
async function getSupportedCollections() {
  return new Promise((resolve, reject) => {
    var pgclient = db.getClient()

    //select the data in this column for a row which has this primary key
    var querystring = "SELECT collectionkey, collectioncount, meslug, floor_history FROM \"solanametaplex\""

    pgclient.query(querystring, (err, res) => {
      if (err) throw err
      resolve(res.rows)
    }) //end query
  }) //end promise
}; module.exports.getSupportedCollections = getSupportedCollections

//get a single NFT collection by collectionKey and NFT ID - needs error handling like getNFTdata
async function getNFTdata(collectionKey, tokenAddress) {
  return new Promise((resolve, reject) => {
    var pgclient = db.getClient()
    var querystring = 'SELECT jsonb_path_query_first(finaldata, \'$.data[*] ?  (@.tokenAddress == "' + tokenAddress + '")\') AS nftdata FROM solanametaplex WHERE collectionkey = \'' + collectionKey + '\''
    pgclient.query(querystring).then(res => {

      if (res.rows[0]) {
        resolve(res.rows[0]['nftdata'])
      } else {
        w.log.error('SQL error - row was empty')//is this needed or will the if (err) throw err prevent this?
        resolve(null)
      }
    }).catch(e => {
      w.log.error('error getting that nft data: ' + e)
      resolve(null)//if there was an error getting NFT data return null to be handled by the calling function
    })
  })//end promise
}; module.exports.getNFTdata = getNFTdata

//get supported servers - needs error handling like getNFTdata
async function getSupportedServers() {
  return new Promise((resolve, reject) => {
    var pgclient = db.getClient()

    var querystring = "SELECT serverid,raresnipes,epicsnipes,legendarysnipes,mythicsnipes,premium,inserver,singlefeedmode,rare_enabled,epic_enabled,legendary_enabled,mythic_enabled,min_price,max_price,pingrole,enable_ping,alphaconfig FROM servers"

    pgclient.query(querystring, (err, res) => {
      if (err) throw err
      resolve(res.rows)
    })//end query
  })//end promise
}; module.exports.getSupportedServers = getSupportedServers

//get list of servers with status of bot (is it in our out) - needs error handling like getNFTdata
async function getBotActiveStatus() {
  return new Promise((resolve, reject) => {
    var pgclient = db.getClient()

    var querystring = "SELECT serverid,inserver FROM servers"

    pgclient.query(querystring, (err, res) => {
      if (err) throw err
      resolve(res.rows)
    })//end query
  })//end promise
}; module.exports.getBotActiveStatus = getBotActiveStatus

//get servers where bot is active - needs error handling like getNFTdata
async function getBotActiveServers() {
  return new Promise((resolve, reject) => {
    var pgclient = db.getClient()

    var querystring = "SELECT serverid FROM servers WHERE inserver = true"

    pgclient.query(querystring, (err, res) => {
      if (err) throw err
      resolve(res.rows)
    })//end query
  })//end promise
}; module.exports.getBotActiveServers = getBotActiveServers
