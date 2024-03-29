//takes the ranges for this collection and returns string of its rarity description
async function getraritydescription(collectionsize, thisrarity) {
  return new Promise((resolve, reject) => {

    //set rarity threshold percentages
    const pmythic = 0.01
    const plegendary = 0.05
    const pepic = 0.15
    const prare = 0.35
    const puncommon = 0.6

    //initialise threshold variables
    var mythicstart = 0; var mythicend = 0
    var legendarystart = 0; var legendaryend = 0
    var epicstart = 0; var epicend = 0
    var rarestart = 0; var rareend = 0
    var uncommonstart = 0; var uncommonend = 0
    var commonend = 0; var commonend = 0

    //mythic range (start of range is 1)
    mythicstart = 1;
    mythicend = Math.floor(collectionsize * pmythic)

    //legendary range
    legendarystart = Math.ceil(collectionsize * pmythic)
    if (legendarystart === mythicend) { legendarystart = legendarystart + 1 }
    legendaryend = Math.floor(collectionsize * plegendary)

    //epic range
    epicstart = Math.ceil(collectionsize * plegendary)
    if (epicstart === legendaryend) { epicstart = epicstart + 1 }
    epicend = Math.floor(collectionsize * pepic)

    //rare range
    rarestart = Math.ceil(collectionsize * pepic)
    if (rarestart === epicend) { rarestart = rarestart + 1 }
    rareend = Math.floor(collectionsize * prare)

    //uncommon range
    uncommonstart = Math.ceil(collectionsize * prare)
    if (uncommonstart === rareend) { Uncommonstart = uncommonstart + 1 }
    uncommonend = Math.floor(collectionsize * puncommon)

    //common range (end of range is same as NFT count)
    commonstart = Math.ceil(collectionsize * puncommon)
    if (commonstart === uncommonend) { commonstart = commonstart + 1 }
    commonend = collectionsize

    //from ranges calcualted above, return a description

    //if mythic
    if (thisrarity >= mythicstart && thisrarity <= mythicend) {
      resolve('Mythic')
    }
    //if Legendary
    else if (thisrarity >= legendarystart && thisrarity <= legendaryend) {
      resolve('Legendary')
    }
    //if epic
    else if (thisrarity >= epicstart && thisrarity <= epicend) {
      resolve('Epic')
    }
    //if rare
    else if (thisrarity >= rarestart && thisrarity <= rareend) {
      resolve('Rare')
    }
    //if uncommon
    else if (thisrarity >= uncommonstart && thisrarity <= uncommonend) {
      resolve('Uncommon')
    }
    //if common
    else if (thisrarity >= commonstart && thisrarity <= commonend) {
      resolve('Common')
    }
    else {//this shouldnt trigger if the key is found and the data is complete
      resolve('Not found')
    }//end else
  })//end promise
}; module.exports.getraritydescription = getraritydescription

//function to get embed color
async function getembedcolour(raritydescription) {
  return new Promise((resolve, reject) => {
    if (raritydescription === 'Mythic') { resolve(parseInt('0xed2839', 16)) }
    else if (raritydescription === 'Legendary') { resolve(parseInt('0xfe8100', 16)) }
    else if (raritydescription === 'Epic') { resolve(parseInt('0x9901f6', 16)) }
    else if (raritydescription === 'Rare') { resolve(parseInt('0x19aaeb', 16)) }
    else if (raritydescription === 'Uncommon') { resolve(parseInt('0x20d48a', 16)) }
    else if (raritydescription === 'Common') { resolve(parseInt('0x939394', 16)) }
    else { resolve(parseInt('0x939394', 16)) }//this shouldnt trigger but if it does, return common grey
  }) //end promise
}; module.exports.getembedcolour = getembedcolour
