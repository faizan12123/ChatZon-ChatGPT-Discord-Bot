// Most up-to date bot runner/ Master-copy using chatgpt-4o model
require('dotenv').config()
const apiKey = process.env.OPENAI_API_KEY
const botKey = process.env.DISCORD_API_KEY
const { Configuration, OpenAIApi } = require("openai");
const { Client, GatewayIntentBits, EmbedBuilder} = require('discord.js');
const winston = require('winston');
const fs = require('fs');


let callCount = parseInt(fs.readFileSync('metrics/call-count.txt', 'utf8')) || 0;
let serverCount = parseInt(fs.readFileSync('metrics/server-count.txt', 'utf8')) || 0;
let channelID = 0
let conversationMap = {}

const configuration = new Configuration({
    apiKey: apiKey,
  });

const openai = new OpenAIApi(configuration);

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
});

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'discord-bot' },
  transports: [
    new winston.transports.File({ filename: 'metrics/combined-log.txt' }),
  ],
});

client.on('guildCreate', async (guild) => {
  
  //logging the server joined and the amount of servers
  serverCount++
  logger.info(`Joined server: ${guild.name} (${guild.id})`);
  logger.info(`Bot has been added to ${serverCount} servers`);
  fs.writeFileSync('metrics/server-count.txt', serverCount.toString());
      
      //the welcome message for when it joins a new server
      const embed = new EmbedBuilder()
      .setTitle('Welcome to ChatZon! :keyboard:')
      .setDescription(`Thanks for inviting ChatZon to ${guild.name}!\n\n ChatZon is a discord bot that integrates ChatGPT into your server!\n\n To use ChatZon simply type @ChatZon or reply to ChatZon's message and type away!\n\n Here are some of my key features:`)
      .setColor('#FFFF00')
      .setImage(client.user.displayAvatarURL())
      .setThumbnail(client.user.displayAvatarURL())
      .setFooter({
        text: "To keep ChatZon free to use, please consider subscribing to my patreon: patreon.com/TechZon. By subscribing to my Patreon, you'll not only help cover the computing costs but also gain access to chat with me about features or bots you would like and get notified about upcoming updates. Thank you!"
      })
      .setURL('https://www.patreon.com/TechZon/')
      .addFields([
        {
          name: 'Feature #1',
          value:'ChatZon can continue/remember conversations through multiple messages',
          inline: false
        },
        {
          name: 'Feature #2',
          value:'Each channel within a server can have its own independent group conversation with ChatZon, separate from other channels',
          inline: false
        },
        {
          name: 'Feature #3',
          value:'Get the features of ChatGPT Plus (paid version) for free!',
          inline: false
        },
        {
		      name: 'To add ChatZon to your discord server, click here:',
          value:'https://discord.com/api/oauth2/authorize?client_id=1080013041300668427&permissions=274877930496&scope=bot',
          inline: false
        },
      ])
      
      try {
        await guild.systemChannel.send({embeds:[embed]}).catch((e) => console.log('Bot does not have permission to send messages in the system channel'))
      } catch (e) {
        console.log('Bot could not send welcome message')
      }
});

client.on('messageCreate', async (message) => {
  // Ignore messages from other bots
    if (message.author.bot) return;
    
    //telling people to not use the old command
    if (message.content.toLowerCase().startsWith('!chatzon')) {
      try{
        message.reply("!chatzon is no longer the command to trigger ChatZon. To use ChatZon, please either use @ChatZon or reply to a message from ChatZon.")
      } catch (e) {

      }
     
    };
    
    //only respond to messages that use @chatzon or reply to chatzon
    if (!(message.mentions.has(client.user))) return

    channelID = message.channel.id

    let prompt = message.content
    //get rid of the bot ID and username from the request
    if (message.reference) {
      // const referencedMessage = await message.channel.messages.fetch(message.reference.messageID);
      prompt = message.content
    } else if (message.mentions.has(client.user)) {
      prompt = message.content.replace(new RegExp(`<@!?${client.user.id}>|@${client.user.username}|<@&\\d+>`, 'g'), '');
    }

    // console.log("prompt: " + prompt)
	
    //making sure inputs are not too long
	if(prompt.length > 1900) {
    try{
      await message.channel.send("``` Message too long. Please make a shorter request or split your requests into multiple messages ```")
      return
    } catch(e){

    }

	}

  //creating channels in the conversationMap or pushing the request to the existing channel in the map
    if (!conversationMap[channelID]) {
      conversationMap[channelID] = [{"role": "system", "content": "You are a helpful assistant named ChatZon developed by a software developer named TechZon."},{"role": "user", "content": prompt}]    
      try {
        await message.channel.send("Due to high computing costs, ChatZon has been down. Please consider subscribing to my patreon to keep ChatZon alive and free: https://www.patreon.com/TechZon/")
      }catch (e) {
        
      }
    } else {
      await conversationMap[channelID].push({"role": "user", "content": prompt});
    }

    //requesting the openAI API
    try{
      let response
      response = await openai.createChatCompletion({
        model: "gpt-4o-mini",
        messages: conversationMap[channelID],
        temperature: 1,
        max_tokens: 1000,
        top_p: .5,
        frequency_penalty: 0.5,
        presence_penalty: 0.5,
      })

      //log how many times the bot has been called
    callCount++;
    logger.info(`Bot has been called ${callCount} times`);
    fs.writeFileSync('metrics/call-count.txt', callCount.toString());

    //update the conversationMap with the conversation
    await conversationMap[channelID].push({"role": "assistant", "content": response.data.choices[0].message.content})

    //if the response contains embedded code
    const codeBlockRegex = /```([\s\S]*?)```|\`([\s\S]*?)\`/

    // console.log(response.data.choices[0].message.content);
    let responseTemp = response.data.choices[0].message.content
    //sending multiple replies to the user if the response is too long
    if (responseTemp.length > 1950){
      while (responseTemp.length > 1950){
        if (responseTemp.match(codeBlockRegex)){
          await message.reply(responseTemp.slice(0, 1950))
          responseTemp = responseTemp.slice(1950)
        } else {
         await message.reply("```" + responseTemp.slice(0, 1950) + "```")
          responseTemp = responseTemp.slice(1950)
        }
      }

      if (responseTemp.match(codeBlockRegex)){
        await message.reply(responseTemp)
      } else {
        await message.reply("```" + responseTemp + "```")
      }
    } else {
      //if the response isn't too long, then just send it normally
      if (response.data.choices[0].message.content.match(codeBlockRegex)){
       await message.reply(response.data.choices[0].message.content)
      } else {
       await message.reply("```" + response.data.choices[0].message.content + "```")
      }
    }

  // sending this advertisement every 50, 100, 200, 400th, ... and so on message
    if ((conversationMap[channelID].length + 1) % (50 * Math.pow(2, Math.floor(Math.log2(conversationMap[channelID].length / 50)))) == 0 && conversationMap[channelID].length > 0) {
     await message.reply("Enjoying ChatZon? Please consider leaving me a review and upvote to help grow the bot: https://top.gg/bot/1080013041300668427#reviews \n To help keep ChatZon free to use, please consider subscribing to my patreon: https://patreon.com/TechZon. Thank you!")
  }

  //calculating how long the conversation is
    let conversationLength = 0
    let temp = await conversationMap[channelID]
    for (let i of temp) {
      conversationLength += await i.content.split(" ").length
    }
    // console.log("initial length: " + conversationLength)
    //deleting parts of the conversation once it gets longer than 2500 words
    while(conversationLength>2000){
      let cutConversation = await conversationMap[channelID].splice(1, 1)[0]
      conversationLength -= await cutConversation.content.split(" ").length
    }
    // console.log(conversationMap)
    // console.log("converted length: " + conversationLength)
    } catch (e) {
	    conversationMap[channelID] = [{"role": "system", "content": "You are a helpful assistant named ChatZon developed by a software developer named TechZon."}]
      try {
        await message.channel.send("``` Sorry, ChatZon was unable to process your request. Our conversation has restarted. Please try again! ```" )
      } catch (e) {
        console.log("message deleted")
      }
      console.log(e)
    }
    })
    client.login(botKey);