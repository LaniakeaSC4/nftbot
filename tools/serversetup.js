var discord = require('../clients/discordclient.js')
const client = discord.getClient()
const { ChannelType, PermissionFlagsBits, PermissionsBitField } = require('discord.js')

const w = require('./winston.js')
const sql = require('./commonSQL.js')//common sql related commands are in here

async function start(interaction) {
	//check if user has managechannels (or is admin)
	if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels, true)) { w.log.info('user didnt have manage channel permissions'); return null }

	//check if this server is in the table
	const guildid = interaction.message.guildId
	supportedservers = await sql.getSupportedServers()
	var validserver = false
	for (var i = 0; i < supportedservers.length; i++) {
		if (supportedservers[i].serverid === guildid) {
			validserver = true
			w.log.info('matched server in our database during installation: ' + guildid)
			break
		}//end if
	}//end for

	if (validserver) {

		//check if bot has manage channels on this server and if not return

		w.log.info('setting up guild ' + guildid)
		const guild = client.guilds.cache.get(guildid)

		//get saved sniper channels (if any)
		const existingchannels = await sql.getSniperChannels(guildid)
		w.log.info('log exisiting channels')
		w.log.info(existingchannels)

		var channelcheck = {
			"snipecategory": { "dbfound": false, "serverfound": false, "db_cid": '', "server_cid": '', "verified": false, "name": "LANIAKEA SNIPER BOT", "servercolumn": "snipecategory" },
			"raresnipes": { "dbfound": false, "serverfound": false, "db_cid": '', "server_cid": '', "verified": false, "name": "Rare Snipes", "servercolumn": "raresnipes" },
			"epicsnipes": { "dbfound": false, "serverfound": false, "db_cid": '', "server_cid": '', "verified": false, "name": "Epic Snipes", "servercolumn": "epicsnipes" },
			"legendarysnipes": { "dbfound": false, "serverfound": false, "db_cid": '', "server_cid": '', "verified": false, "name": "Legendary Snipes", "servercolumn": "legendarysnipes" },
			"mythicsnipes": { "dbfound": false, "serverfound": false, "db_cid": '', "server_cid": '', "verified": false, "name": "Mythic Snipes", "servercolumn": "mythicsnipes" }
		}

		if (existingchannels[0].snipecategory) { channelcheck.snipecategory.dbfound = true; channelcheck.snipecategory.db_cid = existingchannels[0].snipecategory }
		if (existingchannels[0].raresnipes) { channelcheck.raresnipes.dbfound = true; channelcheck.raresnipes.db_cid = existingchannels[0].raresnipes }
		if (existingchannels[0].epicsnipes) { channelcheck.epicsnipes.dbfound = true; channelcheck.epicsnipes.db_cid = existingchannels[0].epicsnipes }
		if (existingchannels[0].legendarysnipes) { channelcheck.legendarysnipes.dbfound = true; channelcheck.legendarysnipes.db_cid = existingchannels[0].legendarysnipes }
		if (existingchannels[0].mythicsnipes) { channelcheck.mythicsnipes.dbfound = true; channelcheck.mythicsnipes.db_cid = existingchannels[0].mythicsnipes }

		//get the guild channels to see if our saved ones still exist
		await guild.channels.fetch()
			.then(async channels => {
				channels.forEach(channel => {

					//check for the channels in server
					if (channel.id === channelcheck.snipecategory.db_cid) {
						w.log.info('Found the saved category channel')
						channelcheck.snipecategory.serverfound = true
						channelcheck.snipecategory.server_cid = channel.id
						channelcheck.snipecategory.verified = true
					}
					if (channel.id === channelcheck.raresnipes.db_cid) {
						w.log.info('Found the saved raresnipes channel')
						channelcheck.raresnipes.serverfound = true
						channelcheck.raresnipes.server_cid = channel.id
						channelcheck.raresnipes.verified = true
					}
					if (channel.id === channelcheck.epicsnipes.db_cid) {
						w.log.info('Found the saved epicsnipes channel')
						channelcheck.epicsnipes.serverfound = true
						channelcheck.epicsnipes.server_cid = channel.id
						channelcheck.epicsnipes.verified = true
					}
					if (channel.id === channelcheck.legendarysnipes.db_cid) {
						w.log.info('Found the saved legendarysnipes channel')
						channelcheck.legendarysnipes.serverfound = true
						channelcheck.legendarysnipes.server_cid = channel.id
						channelcheck.legendarysnipes.verified = true
					}
					if (channel.id === channelcheck.mythicsnipes.db_cid) {
						w.log.info('Found the saved mythicsnipes channel')
						channelcheck.mythicsnipes.serverfound = true
						channelcheck.mythicsnipes.server_cid = channel.id
						channelcheck.mythicsnipes.verified = true
					}

				})

				w.log.info('log final channelcheck')
				w.log.info(channelcheck)

				//first check and create the category channel
				if (channelcheck.snipecategory.verified === false) {
					w.log.info('Category channel was not found - creating it')
					guild.channels.create({
						name: channelcheck.snipecategory.name,
						type: ChannelType.GuildCategory,
						permissionOverwrites: [
							{
								id: guild.roles.everyone,
								deny: [PermissionFlagsBits.ViewChannel],
							},
							{
								id: '996170261353222219',//the bot ID
								allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
							},
						]
					}).then(async newchannel => {
						w.log.info('created new category channel it\'s ID is:')
						w.log.info(newchannel.id)
						channelcheck.snipecategory.server_cid = newchannel.id//save category channel ID to we can add children
						await sql.updateTableColumn('servers', 'serverid', guildid, 'snipecategory', newchannel.id)
					}).then(async result => {

						createchildren()

					})
				} else {
					w.log.info('Category channel already existed')
					createchildren()
				}


				async function createchildren() {
					//get the category channel object so we can add children
					w.log.info('fetching category channel')
					const laniakeacategory = await client.channels.fetch(channelcheck.snipecategory.server_cid)
					for (const key in channelcheck) {
						if (key != 'snipecategory') {//we have created the category already
							if (channelcheck[key].verified === false) {//if this one isnt verified as present

								guild.channels.create({
									name: channelcheck[key].name,
									type: ChannelType.GuildText,
									parent: laniakeacategory
								}).then(async newchannel => {
									w.log.info('created new channel ' + newchannel.name + ' it\'s ID is: ' + newchannel.id)
									channelcheck.snipecategory.server_cid = newchannel.id//save category channel ID to we can add children
									await sql.updateTableColumn('servers', 'serverid', guildid, channelcheck[key].servercolumn, newchannel.id)
								})

							}
						}
					}
				}
			})

		return 'complete'
	} else { return null }//end if valid server
} //module.exports.start = start

async function setuphomechannel(interaction) {
	//check if this server is in the table
	const guildid = interaction.message.guildId
	supportedservers = await sql.getSupportedServers()
	var validserver = false
	for (var i = 0; i < supportedservers.length; i++) {
		if (supportedservers[i].serverid === guildid) {
			validserver = true
			w.log.info('matched server in our database during homechannel setup: ' + guildid)
			break
		}//end if
	}//end for

	if (validserver) {
		w.log.info('setting up home channel for guild ' + guildid)
		const guild = client.guilds.cache.get(guildid)

		//get saved sniper channels (if any)
		const existingchannels = await sql.getSniperChannels(guildid)//need to add the home channel to the sql function
		//
		//
		//
		//
		//
		//
		/*
		w.log.info('log exisiting channels')
		//w.log.info(existingchannels)//winston error? 

		var channelcheck = {
			"snipecategory": { "dbfound": false, "serverfound": false, "db_cid": '', "server_cid": '', "verified": false, "name": "LANIAKEA SNIPER BOT", "servercolumn": "snipecategory" },
			"raresnipes": { "dbfound": false, "serverfound": false, "db_cid": '', "server_cid": '', "verified": false, "name": "Rare Snipes", "servercolumn": "raresnipes" },
			"epicsnipes": { "dbfound": false, "serverfound": false, "db_cid": '', "server_cid": '', "verified": false, "name": "Epic Snipes", "servercolumn": "epicsnipes" },
			"legendarysnipes": { "dbfound": false, "serverfound": false, "db_cid": '', "server_cid": '', "verified": false, "name": "Legendary Snipes", "servercolumn": "legendarysnipes" },
			"mythicsnipes": { "dbfound": false, "serverfound": false, "db_cid": '', "server_cid": '', "verified": false, "name": "Mythic Snipes", "servercolumn": "mythicsnipes" }
		}

		if (existingchannels[0].snipecategory) { channelcheck.snipecategory.dbfound = true; channelcheck.snipecategory.db_cid = existingchannels[0].snipecategory }
		if (existingchannels[0].raresnipes) { channelcheck.raresnipes.dbfound = true; channelcheck.raresnipes.db_cid = existingchannels[0].raresnipes }
		if (existingchannels[0].epicsnipes) { channelcheck.epicsnipes.dbfound = true; channelcheck.epicsnipes.db_cid = existingchannels[0].epicsnipes }
		if (existingchannels[0].legendarysnipes) { channelcheck.legendarysnipes.dbfound = true; channelcheck.legendarysnipes.db_cid = existingchannels[0].legendarysnipes }
		if (existingchannels[0].mythicsnipes) { channelcheck.mythicsnipes.dbfound = true; channelcheck.mythicsnipes.db_cid = existingchannels[0].mythicsnipes }

		//get the guild channels to see if our saved ones still exist
		await guild.channels.fetch()
			.then(async channels => {
				channels.forEach(channel => {

					//check for the channels in server
					if (channel.id === channelcheck.snipecategory.db_cid) {
						w.log.info('Found the saved category channel')
						channelcheck.snipecategory.serverfound = true
						channelcheck.snipecategory.server_cid = channel.id
						channelcheck.snipecategory.verified = true
					}
					if (channel.id === channelcheck.raresnipes.db_cid) {
						w.log.info('Found the saved raresnipes channel')
						channelcheck.raresnipes.serverfound = true
						channelcheck.raresnipes.server_cid = channel.id
						channelcheck.raresnipes.verified = true
					}
					if (channel.id === channelcheck.epicsnipes.db_cid) {
						w.log.info('Found the saved epicsnipes channel')
						channelcheck.epicsnipes.serverfound = true
						channelcheck.epicsnipes.server_cid = channel.id
						channelcheck.epicsnipes.verified = true
					}
					if (channel.id === channelcheck.legendarysnipes.db_cid) {
						w.log.info('Found the saved legendarysnipes channel')
						channelcheck.legendarysnipes.serverfound = true
						channelcheck.legendarysnipes.server_cid = channel.id
						channelcheck.legendarysnipes.verified = true
					}
					if (channel.id === channelcheck.mythicsnipes.db_cid) {
						w.log.info('Found the saved mythicsnipes channel')
						channelcheck.mythicsnipes.serverfound = true
						channelcheck.mythicsnipes.server_cid = channel.id
						channelcheck.mythicsnipes.verified = true
					}

				})

				w.log.info('log final channelcheck')
				w.log.info(channelcheck)

				//first check and create the category channel
				if (channelcheck.snipecategory.verified === false) {
					w.log.info('Category channel was not found - creating it')
					guild.channels.create({
						name: channelcheck.snipecategory.name,
						type: ChannelType.GuildCategory,
						permissionOverwrites: [
							{
								id: guild.roles.everyone,
								deny: [PermissionFlagsBits.ViewChannel],
							},
							{
								id: '996170261353222219',//the bot ID
								allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
							},
						]
					}).then(async newchannel => {
						w.log.info('created new category channel it\'s ID is:')
						w.log.info(newchannel.id)
						channelcheck.snipecategory.server_cid = newchannel.id//save category channel ID to we can add children
						await sql.updateTableColumn('servers', 'serverid', guildid, 'snipecategory', newchannel.id)
					}).then(async result => {

						createchildren()

					})
				} else {
					w.log.info('Category channel already existed')
					createchildren()
				}


				async function createchildren() {
					//get the category channel object so we can add children
					w.log.info('fetching category channel')
					const laniakeacategory = await client.channels.fetch(channelcheck.snipecategory.server_cid)
					for (const key in channelcheck) {
						if (key != 'snipecategory') {//we have created the category already
							if (channelcheck[key].verified === false) {//if this one isnt verified as present

								guild.channels.create({
									name: channelcheck[key].name,
									type: ChannelType.GuildText,
									parent: laniakeacategory
								}).then(async newchannel => {
									w.log.info('created new channel ' + newchannel.name + ' it\'s ID is: ' + newchannel.id)
									channelcheck.snipecategory.server_cid = newchannel.id//save category channel ID to we can add children
									await sql.updateTableColumn('servers', 'serverid', guildid, channelcheck[key].servercolumn, newchannel.id)
								})

							}
						}
					}
				}
			})

		return 'complete'*/
	} else { return null }//end if valid server
} //module.exports.setuphomechannel = setuphomechannel

var discord = require('../clients/discordclient.js')
const client = discord.getClient()
const { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, InteractionType } = require('discord.js')

//server setup
//const setup = require('./tools/serversetup.js')
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;
  if (interaction.customId === 'beginsetup') {
    var setupstatus = await start(interaction)//creates category and 4 sniper channels if the ones in database dont already exist.
    if (setupstatus) { w.log.info('setup status was sucessful') } else {w.log.info('there was an error during a setup attempt')}
  }//end if button is 'beginsetup'

  if (interaction.customId === 'homechannelsetup') {
    const modal = new ModalBuilder()
        .setCustomId('verification-modal')
        .setTitle('Verify yourself')
        .addComponents([
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('verification-input')
              .setLabel('Answer')
              .setStyle(TextInputStyle.Short)
              .setMinLength(4)
              .setMaxLength(12)
              .setPlaceholder('ABCDEF')
              .setRequired(true),
          ),
        ]);
  }//end if button is 'beginsetup'

      await interaction.showModal(modal);
    
    if (interaction.type === InteractionType.ModalSubmit) {
    if (interaction.customId === 'verification-modal') {
      const response =
        interaction.fields.getTextInputValue('verification-input');
      interaction.reply(`Yay, your answer is submitted: "${response}"`);
    }
  }
  
    //var setupstatus = await setuphomechannel(interaction)//

})//end on interactionCreate 
