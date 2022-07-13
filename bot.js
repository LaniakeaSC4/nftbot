const { Client, Intents } = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS] });

client.on('ready', () => {
  console.log(`I'm Ready!`);
});

client.on('ready', () => {
  client.api.applications(client.user.id).guilds('828194078113529856').commands.post({
    data: {
      name: "checkrarity",
      description: "Check Rarity Command", 
      
      "options": [
    {
      "type": 4,
      "name": "nftnumber",
      "description": "Enter NFT #",
      "required": true
    }
  ] 
      
    }
  });
});

  client.ws.on('INTERACTION_CREATE', async interaction => {
    const command = interaction.data.name.toLowerCase();
    const args = interaction.data.options;
    console.log('interaction channel ID is')
    console.log(interaction.channel_id);

    if (command === 'checkrarity') {
      // here you could do anything. in this sample
      
client.channels.cache.get(interaction.channel_id).send('Hello here!')
      
      // i reply with an api interaction
     client.api.interactions(interaction.id, interaction.token).callback.post({
        data: {
         type: 4,
         data: {
          content: 'NFT Number ' + args[0].value + ' is rarity: '
        }
       }
     })
     
    }
  });

client.login(process.env.BOTTOKEN);