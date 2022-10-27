var discord = require('../clients/discordclient.js')
const client = discord.getClient()
const { ChannelType, PermissionFlagsBits, PermissionsBitField,
	ModalBuilder, ActionRowBuilder, TextInputBuilder,
	TextInputStyle, ButtonBuilder, ButtonStyle } = require('discord.js')

const w = require('../tools/winston.js')
const sql = require('../tools/commonSQL.js')//common sql related commands are in here

//respond to alerts config button press
async function configPanel(interaction) {
	//build a new button row for the command reply
	const row = new ActionRowBuilder()
		.addComponents(
			new ButtonBuilder()
				.setCustomId('enable_alerts-button')
				.setLabel('Enable Alerts')
				.setStyle(ButtonStyle.Primary),
		)
		.addComponents(
			new ButtonBuilder()
				.setCustomId('disable_alerts-button')
				.setLabel('Disable Alerts')
				.setStyle(ButtonStyle.Primary),
		)
	//send the reply (including button row)
	await interaction.reply({ content: "Enable or disable alerts?", components: [row], ephemeral: true })
} module.exports.configPanel = configPanel

async function enableAlerts(interaction) {
  var pingrole = await sql.getdata("servers", "serverid", interaction.message.guildId, "pingrole")
  var ping_enabled = await sql.getdata("servers", "serverid", interaction.message.guildId, "ping_enabled")
  
  if (ping_enabled === true) {
    if (pingrole) {//enabled and existing. Check if role still exists and confirm back to the user that all is good
      
    } else {//make a new pingrole. Somehow DB is blank?
    const thisGuild = client.guilds.cache.get(interaction.message.guildId)
      thisGuild.roles.create({ name: 'Snipe Alerts'});
      
    }//end else pingrole was enabled but no role existed.
    
  } else {//if pingrole not enabled
  
    if (pingrole) {//wasn't enabled, but there was a previous pingrole. Check if that role still exists, renable pings and respond to the user confirming the role
      
    } else {//there wasn't an exisiting pingrole. Make one and enable pingrolez
      
    }//end else pingrole wasn't enabled and role didn't exist
  }//end else pingrole not enabled
}//end function
module.exports.enableAlerts = enableAlerts
