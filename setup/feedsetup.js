var discord = require('../clients/discordclient.js')
const client = discord.getClient()
const { ChannelType, PermissionFlagsBits, PermissionsBitField,
	ModalBuilder, ActionRowBuilder, TextInputBuilder,
	TextInputStyle, ButtonBuilder, ButtonStyle } = require('discord.js')

const w = require('../tools/winston.js')
const sql = require('../tools/commonSQL.js')//common sql related commands are in here

//Main feed setup dialogue. Does the user want single channel mode? 
async function whichMode(interaction) {
	//build a new button row for the command reply
	const row = new ActionRowBuilder()
		.addComponents(
			new ButtonBuilder()
				.setCustomId('standardfeed-button')
				.setLabel('Enable Standard Feed')
				.setStyle(ButtonStyle.Primary),
		).addComponents(
			new ButtonBuilder()
				.setCustomId('singlefeed-button')
				.setLabel('Enable Single Feed')
				.setStyle(ButtonStyle.Primary),
		)
	//send the reply (including button row)
	await interaction.reply({ content: "**__Which feed mode would you like?__**\n\n\"**Standard Feed**\" mode will create 4 channels (as below) and seperate snipes into those 4 channels depending on NFT rarity. This mode allows you to control access to the highest rarity snipes to your biggest holders by granting access to those channels.\n\n```LANIAKEA SNIPER BOT\n|-rare-snipes\n|-epic-snipes\n|-legendary-snipes🌟\n|-mythic-snipes🌟```\n\"**Single Feed**\" mode will only create one channel and deliver **all** snipes to that channel regardless of rarity. In this mode, you will have less discord channels to manage, but the feed will scroll fast.\n\nIf you switch from Standard Feed mode to Single Feed mode, all snipes will start being delivered to the Rare-Snipes channel. If you switch from Singlee Feed mode to Standard Feed mode, the Single Feed channel will start recieving Rare snipes only and Epic, Legendary and Mythic channels will be created for those Snipes.\n\n🌟 In both modes Legendary and Mythic snipes are a premium feature. Rare and Epic snipes will also be delivered with a delay behind premium servers.", components: [row], ephemeral: true })
} module.exports.whichMode = whichMode

async function start(interaction, feedmode) {
	//check if user has managechannels (or is admin)
	if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels, true)) { w.log.info('user didnt have manage channel permissions'); return null }

	var thisserver
	//check if this server is in the table
	const guildid = interaction.message.guildId
	supportedservers = await sql.getSupportedServers()
	var validserver = false
	for (var i = 0; i < supportedservers.length; i++) {
		if (supportedservers[i].serverid === guildid && supportedservers[i].inserver === true) {//if this server ID was found and bot is active in server
			validserver = true
			thisserver = supportedservers[i]
			w.log.info('matched server in our database during installation: ' + guildid)
			break
		}//end if
	}//end for

	if (validserver) {

		w.log.info('setting up guild ' + guildid)
		const guild = await client.guilds.fetch(guildid)

		//get saved sniper channels (if any)
		const existingchannels = await sql.getServerRow(guildid)

		//temporty checking object to mark off what was found or what needs created
		var channelcheck = {
			"snipecategory": { "dbfound": false, "serverfound": false, "db_cid": '', "server_cid": '', "verified": false, "name": "LANIAKEA SNIPER BOT", "servercolumn": "snipecategory" },
			"raresnipes": { "dbfound": false, "serverfound": false, "db_cid": '', "server_cid": '', "verified": false, "name": "Rare Snipes", "servercolumn": "raresnipes", "premium": false },
			"epicsnipes": { "dbfound": false, "serverfound": false, "db_cid": '', "server_cid": '', "verified": false, "name": "Epic Snipes", "servercolumn": "epicsnipes", "premium": false },
			"legendarysnipes": { "dbfound": false, "serverfound": false, "db_cid": '', "server_cid": '', "verified": false, "name": "Legendary Snipes", "servercolumn": "legendarysnipes", "premium": true },
			"mythicsnipes": { "dbfound": false, "serverfound": false, "db_cid": '', "server_cid": '', "verified": false, "name": "Mythic Snipes", "servercolumn": "mythicsnipes", "premium": true }
		}

		//if any of the channels are found in SQL, update channelcheck to say we have found them
		if (existingchannels[0].snipecategory) { channelcheck.snipecategory.dbfound = true; channelcheck.snipecategory.db_cid = existingchannels[0].snipecategory }
		if (existingchannels[0].raresnipes) { channelcheck.raresnipes.dbfound = true; channelcheck.raresnipes.db_cid = existingchannels[0].raresnipes }
		if (existingchannels[0].epicsnipes) { channelcheck.epicsnipes.dbfound = true; channelcheck.epicsnipes.db_cid = existingchannels[0].epicsnipes }
		if (existingchannels[0].legendarysnipes) { channelcheck.legendarysnipes.dbfound = true; channelcheck.legendarysnipes.db_cid = existingchannels[0].legendarysnipes }
		if (existingchannels[0].mythicsnipes) { channelcheck.mythicsnipes.dbfound = true; channelcheck.mythicsnipes.db_cid = existingchannels[0].mythicsnipes }

		//get the guild channels to see if our saved ones still exist
		await guild.channels.fetch()
			.then(async channels => {
				channels.forEach(async channel => {
					if (channel) {
						//check for the channels in server. If channel wasnt found db_cid would be null. Incorrect or null means serverfound wont get updated to true.
						//verified gets set true if both server and SQL are found and matched. If not, we will recreate
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
					}
				})//end channels for each

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
						await createchildren(guildid)
					})
				} else {
					w.log.info('Category channel already existed')
					await createchildren(guildid)
				}

				async function createchildren(guildid) {
					//get the category channel object so we can add children
					w.log.info('fetching category channel')
					const laniakeacategory = await client.channels.fetch(channelcheck.snipecategory.server_cid)

					if (feedmode === 'multichannel') {
						sql.updateTableColumn('servers', 'serverid', guildid, 'singlefeedmode', false)
						for (const key in channelcheck) {
							if (key != 'snipecategory') {//we have created the category already
								if (channelcheck[key].verified === false) {//if this one isnt verified as present
									//only create premium channels if premium server
									if (thisserver.premium === true || channelcheck[key].premium === false) {
										guild.channels.create({
											name: channelcheck[key].name,
											type: ChannelType.GuildText,
											parent: laniakeacategory
										}).then(async newchannel => {
											w.log.info('created new channel ' + newchannel.name + ' it\'s ID is: ' + newchannel.id)
											await sql.updateTableColumn('servers', 'serverid', guildid, channelcheck[key].servercolumn, newchannel.id)
										})//end then
									}//end if premium
								}//end if verified was false
							}//end if key isnt snipecategory
						}//end for each key in channelcheck
					} else {//else, if feedmode wasn't multichannel
						sql.updateTableColumn('servers', 'serverid', guildid, 'singlefeedmode', true)
						//if there wasn't already a raresnipes channel
						if (channelcheck.raresnipes.verified === false) {
							guild.channels.create({
								name: "Snipe-Feed",
								type: ChannelType.GuildText,
								parent: laniakeacategory
							}).then(async newchannel => {
								w.log.info('created new channel ' + newchannel.name + ' it\'s ID is: ' + newchannel.id)
								//save channel id in raresnipes column. That's where single mode snipes are always sent.
								await sql.updateTableColumn('servers', 'serverid', guildid, channelcheck.raresnipes.servercolumn, newchannel.id)
							})//end then
						}
					}
				}//end createchildren
			})//end then after get channels
		return true
	} else { return null }//end if valid server
} module.exports.start = start