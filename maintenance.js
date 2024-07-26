// Script for when ChatZon is under maintenance

require('dotenv').config()
const botKey = process.env.DISCORD_API_KEY
const { Client, GatewayIntentBits } = require('discord.js');
const winston = require('winston');
const fs = require('fs');
let callCount = parseInt(fs.readFileSync('metrics/call-count.txt', 'utf8')) || 0;
let serverCount = parseInt(fs.readFileSync('metrics/server-count.txt', 'utf8')) || 0;

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

client.on('guildCreate', (guild) => {
  serverCount++
  logger.info(`Joined server: ${guild.name} (${guild.id})`);
  logger.info(`Bot has been added to ${serverCount} servers`);
  fs.writeFileSync('server-count.txt', serverCount.toString());
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return; // Ignore messages from other bots
    if (message.content.toLowerCase().startsWith('!chatzon')) {
      message.reply("!chatzon is no longer the command to trigger ChatZon. To use ChatZon, please either use @ChatZon or reply to a message from ChatZon.")
    };

    if (!(message.mentions.has(client.user))) return
        callCount++;
        logger.info(`Bot has been called ${callCount} times`);
        fs.writeFileSync('call-count.txt', callCount.toString());
        message.reply("```" + "Hello! ChatZon is currently under maintenance, but it will be back up shortly!" + "```")
    })
 
    client.login(botKey);