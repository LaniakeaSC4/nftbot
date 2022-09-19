const w = require('./winston.js')
const sql = require('./commonSQL.js')//common sql related commands are in here
/**
 * Adds time to a date. Modelled after MySQL DATE_ADD function.
 * Example: dateAdd(new Date(), 'minute', 30)  //returns 30 minutes from now.
 * https://stackoverflow.com/a/1214753/18511
 * 
 * @param date  Date to start with
 * @param interval  One of: year, quarter, month, week, day, hour, minute, second
 * @param units  Number of units of the given interval to add.
 */
function dateAdd(date, interval, units) {
  if(!(date instanceof Date))
    return undefined;
  var ret = new Date(date); //don't change original date
  var checkRollover = function() { if(ret.getDate() != date.getDate()) ret.setDate(0);};
  switch(String(interval).toLowerCase()) {
    case 'year'   :  ret.setFullYear(ret.getFullYear() + units); checkRollover();  break;
    case 'quarter':  ret.setMonth(ret.getMonth() + 3*units); checkRollover();  break;
    case 'month'  :  ret.setMonth(ret.getMonth() + units); checkRollover();  break;
    case 'week'   :  ret.setDate(ret.getDate() + 7*units);  break;
    case 'day'    :  ret.setDate(ret.getDate() + units);  break;
    case 'hour'   :  ret.setTime(ret.getTime() + units*3600000);  break;
    case 'minute' :  ret.setTime(ret.getTime() + units*60000);  break;
    case 'second' :  ret.setTime(ret.getTime() + units*1000);  break;
    default       :  ret = undefined;  break;
  }
  return ret;
}

async function updatePremium(serverid, hours){
  var premiumExpire = await sql.getPremiumExpiry(serverid)
  w.log.info('premiumexpire is:' + premiumExpire)
  if (premiumExpire) {
    w.log.info('There was an exisiting expiry time')
  } else {
    w.log.info('There was no existing expiry time')
    var now = new Date(Date.now()).toISOString()
    w.log.info('now is: ' + now)
    var expirydate = now + "+" + hours + ":00"
    w.log.info('expiry time is: ' + expirydate)
    await sql.updateTableColumn('servers', 'serverid', serverid, 'premiumexpire', expirydate)
  }
  
} module.exports.update = updatePremium
