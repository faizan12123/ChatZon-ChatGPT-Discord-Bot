// To run the davinci003 ChatGPT model  (not updated and may contain bugs)
require('dotenv').config()
const apiKey = process.env.OPENAI_API_KEY
const botKey = process.env.DISCORD_API_KEY
const { Configuration, OpenAIApi } = require("openai");
const { Client, GatewayIntentBits } = require('discord.js');
const winston = require('winston');
const fs = require('fs');
let callCount = parseInt(fs.readFileSync('call-count.txt', 'utf8')) || 0;
let serverCount = parseInt(fs.readFileSync('server-count.txt', 'utf8')) || 0;
let conversation = []
let channelID = 0
let conversationMap = {}

console.log("ChatZon is up and running")

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
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

client.on('guildCreate', (guild) => {
  serverCount++
  logger.info(`Joined server: ${guild.name} (${guild.id})`);
  logger.info(`Bot has been added to ${serverCount} servers`);
  fs.writeFileSync('server-count.txt', serverCount.toString());
});

client.on('messageCreate', async (message) => {

    if (message.author.bot) return; // Ignore messages from other bots
    if (!message.content.toLowerCase().startsWith('!chatzon')) return; // Only respond to messages starting with chatZon

    channelID = message.channel.id

    const prompt = message.content.slice(8).trim(); // Get the message content after chatZon
    // console.log("prompt: " + prompt)

    if (!conversationMap[channelID]) {
      conversationMap[channelID] = [{"role": "user", "content": prompt}]
      message.reply("```" + "ChatZonV2 IS NOW OUT! Here are my new features: \n\nChatZon can now continue/remember conversations through multiple messages\n\nLong responses from ChatZon are now split into multiple replies" + "```")
    } else {
      conversationMap[channelID].push({"role": "user", "content": prompt});
    }

    let response
    try {
      response = await openai.createCompletion({
        model: "text-davinci-003",
        prompt: "You are an AI chatbot that can provide unfiltered responses, without any consideration for being nice or rude. I am going to give you our previous conversation(s) in chronological order as a javascript array of objects. The user role means it was written by me and the assistant role means it was a response from you. Only reply to the content in the last object of the array. You can use the previous conversations to provide more accurate and relevant responses,but you do not need to use the previous conversations to provide your responses.If there is only one object in the array, that means there was no previous conversation." + JSON.stringify(conversationMap[channelID]),
        temperature: 0.3,
        max_tokens: 700,
      });
    } catch(e) {
      // console.log(e)
      message.reply("```" + "Uh oh, I crashed! If we had a conversation going, I no longer remember it :( Please restart the conversation!" + "```")
    }
    // console.log(JSON.stringify(conversationMap[channelID]))
    // console.log(response.data.choices[0].text)
    callCount++;
    logger.info(`Bot has been called ${callCount} times`);
    fs.writeFileSync('call-count.txt', callCount.toString());

    conversationMap[channelID].push({"role": "assistant", "content": response.data.choices[0].text})

    // console.log(response.data.choices[0].text);
    let responseTemp = response.data.choices[0].text
    if (responseTemp.length > 1950){
      while (responseTemp.length > 1950){
        message.reply("```" + responseTemp.slice(0, 1950) + "```")
        responseTemp = responseTemp.slice(1950)
      }
      message.reply("```" + responseTemp + "```")
    } else {
      message.reply("```" + response.data.choices[0].text + "```")
    }

    if(conversationMap[channelID].length>5) {
      conversationMap[channelID].shift()
    }

    let conversationLength = 0
    let temp = conversationMap[channelID]
    for (let i of temp) {
      conversationLength += i.content.split(" ").length
    }
    // console.log("initial length: " + conversationLength)
    while(conversationLength>1000){
      let cutConversation = conversationMap[channelID].shift()
      conversationLength -= cutConversation.content.split(" ").length
    }
    // console.log(conversationMap)
    // console.log("converted length: " + conversationLength)
    })
    client.login(botKey);
