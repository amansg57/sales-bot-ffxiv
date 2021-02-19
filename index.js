const Discord = require("discord.js");
const client = new Discord.Client({partials: ['CHANNEL', 'MESSAGE', 'REACTION']});
const { Client } = require('pg');
const config = require("./config.json");
const XRegExp = require('xregexp');

const dbclient = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

client.login(config.token);
dbclient.connect();

client.on("ready", () => {
  // This event will run if the bot starts, and logs in, successfully.
  console.log(`Bot has started, with ${client.users.cache.size} users, in ${client.channels.cache.size} channels of ${client.guilds.cache.size} guilds.`);
});

client.on("message", message => {
  // This event will run on every single message received, from any channel or DM.
  
  // Ignore messages without config prefix
  if(message.content.indexOf(config.prefix) !== 0) return;

  // Here we separate our "command" name, and our "arguments" for the command.
  const command = (message.content.substr(0, message.content.indexOf(' '))).substr(1);
  const argsString = message.content.substr(message.content.indexOf(' ')+1);

  // Pings all members of a sale with the PF password
	if(command === "PF")
  {
		// index 0 is saleID, 1 is PF password
    info = argsString.split(" ");

    dbtext = 'SELECT * FROM sale WHERE id = $1';
    dbvalues = [info[0]];

    dbclient.query(dbtext, dbvalues).then(res => {
      currentSale = res.rows[0];

      dbtext = 'SELECT * FROM saleuser WHERE sale_id = $1';

      dbclient.query(dbtext, dbvalues).then(res => {
        currentSaleUsers = res.rows;

        var saleHealers = [], saleTanks = [], saleDps = [], saleAnys = [];

        for (i = 0; i < currentSaleUsers.length; i++)
        {
          switch (currentSaleUsers[i].role) {
            case "healer":
              saleHealers.push(currentSaleUsers[i].user_id);
              break;
            case "tank":
              saleTanks.push(currentSaleUsers[i].user_id);
              break;
            case "dps":
              saleDps.push(currentSaleUsers[i].user_id);
              break;
            case "any":
              saleAnys.push(currentSaleUsers[i].user_id);
              break;
          }
        }

        fullMembersList = saleHealers.slice(0, currentSale.healers).concat(saleTanks.slice(0, currentSale.tanks), saleDps.slice(0, currentSale.dps), saleAnys.slice(0, currentSale.any_role))

        messageString = `PF is up for the ${currentSale.duty} sale \nPW: ${info[1]}`;
        for (i = 0; i < fullMembersList.length; i++) {
          messageString += `\n<@${fullMembersList[i]}>`;
        }

        DCchannel = getChannel(currentSale.dc);

        message.guild.channels.cache.find(val => val.name === DCchannel).send(messageString);

      });
    });
  }

  // Posts sale with given arguments and adds to database
  if(command === "sale")
  {
    argMap = mapArgs(argsString);

    if(message.channel.name !== "sale-registration") return;

    if(!(argMap.has("duty") && argMap.has("price") && argMap.has("dc"))) return;

    var DCchannel = getChannel(argMap.get("dc"));
    if (!DCchannel) return;

    messageText = `${message.author} is hosting a sale: ${argMap.get("duty")} for ${argMap.get("price")}`;
    if (argMap.get("dc")) messageText += ` on ${argMap.get("dc")}`;
    messageText += "\n\n**Roles Requested**";

    if(argMap.get("tank") > 0) {
      messageText += `\n${client.emojis.cache.find(val => val.name === config.tankEmoji)}`;
      messageText += `${message.guild.roles.cache.find(val => val.name === config.tankRole).toString()} - ${argMap.get("tank")}`;
    }
    if(argMap.get("healer") > 0) {
      messageText += `\n${client.emojis.cache.find(val => val.name === config.healerEmoji)}`;
      messageText += `${message.guild.roles.cache.find(val => val.name === config.healerRole).toString()} - ${argMap.get("healer")}`;
    }
    if(argMap.get("dps") > 0) {
      messageText += `\n${client.emojis.cache.find(val => val.name === config.dpsEmoji)}`
      messageText += `${message.guild.roles.cache.find(val => val.name === config.dpsRole).toString()} - ${argMap.get("dps")}`;
    }
    if(argMap.get("any") > 0) {
      messageText += `\n${client.emojis.cache.find(val => val.name === config.anyEmoji)}`
      messageText += ` @everyone **ANY ROLE** - ${argMap.get("any")}`;
    }

    messageText += "\n\n**Time of sale**";
    if(argMap.has("time")) {
      messageText += `\n${argMap.get("time")}`;
    } else {
      messageText += "\nASAP";
    }

    if(argMap.has("notes")) {
      messageText += "\n\n**Notes**:\n"
      messageText += argMap.get("notes");
    }

    dbtext = 'INSERT INTO sale(duty, price, dc, tanks, healers, dps, any_role, time, notes) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *';
    dbvalues = [argMap.get("duty"), argMap.get("price"), argMap.get("dc").toLowerCase(), argMap.get("tank"), argMap.get("healer"), argMap.get("dps")
    , argMap.get("any"), argMap.get("time"), argMap.get("notes")];

    dbclient.query(dbtext, dbvalues).then(res => {
      saleid = res.rows[0].id;

      messageText += `\n\nSale ID: \`${saleid}\``;
      client.user.setActivity(argMap.get("duty"));

      message.guild.channels.cache.find(val => val.name === DCchannel).send(messageText).then(function(message) {
        setTimeout(async function() {
          if(argMap.get("tank") > 0) {
            await message.react(client.emojis.cache.find(val => val.name === config.tankEmoji))
          }
          if(argMap.get("healer") > 0) {
            await message.react(client.emojis.cache.find(val => val.name === config.healerEmoji))
          }
          if(argMap.get("dps") > 0) {
            await message.react(client.emojis.cache.find(val => val.name === config.dpsEmoji))
          }
          if(argMap.get("any") > 0) {
            await message.react(client.emojis.cache.find(val => val.name === config.anyEmoji))
          }
        }, config.reactionDelay * 1000);
      });
    });

  }

});

client.on("messageReactionAdd", async (reaction, user) => {

  if (reaction.message.partial) await reaction.message.fetch();

  if(reaction.count === 1 || !(reaction.message.channel.name == config.chaosChannel || reaction.message.channel.name == config.lightChannel || reaction.message.channel.name == config.aetherChannel)) return;

  var currentSale;
  var currentSaleUsers;
  currentSaleID = reaction.message.content.match(/`([^`]+)`/)[1];
  console.log(currentSaleID);

  dbtext = 'SELECT * FROM sale WHERE id = $1';
  dbvalues = [currentSaleID];

  dbclient.query(dbtext, dbvalues).then(res => {
    currentSale = res.rows[0];

    if (currentSale.full) return;

    dbtext = 'SELECT * FROM saleuser WHERE sale_id = $1';

    dbclient.query(dbtext, dbvalues).then(res => {
      currentSaleUsers = res.rows;

      var saleHealers = [], saleTanks = [], saleDps = [], saleAnys = [];

      for (i = 0; i < currentSaleUsers.length; i++)
      {
        if (currentSaleUsers[i].user_id == user.id) return;

        switch (currentSaleUsers[i].role) {
          case "healer":
            saleHealers.push(currentSaleUsers[i].user_id);
            break;
          case "tank":
            saleTanks.push(currentSaleUsers[i].user_id);
            break;
          case "dps":
            saleDps.push(currentSaleUsers[i].user_id);
            break;
          case "any":
            saleAnys.push(currentSaleUsers[i].user_id);
            break;
        }
      }

      var nextRolePriority;
      var currentRole;

      function FindNextRolePriority(users, role)
      {
        var currHighestRolePriority = 0;
        for (i = 0; i < users.length; i++) {
          if (users[i].role == role && users[i].role_priority > currHighestRolePriority) {
            currHighestRolePriority = users[i].role_priority;
          }
        }
        return currHighestRolePriority + 1;
      }

      switch (reaction.emoji.name) {
        case config.tankEmoji:
          nextRolePriority = FindNextRolePriority(currentSaleUsers, "tank");
          currentRole = "tank";
          saleTanks.push(user.id);
          break;
        case config.healerEmoji:
          nextRolePriority = FindNextRolePriority(currentSaleUsers, "healer");
          currentRole = "healer";
          saleHealers.push(user.id);
          break;
        case config.dpsEmoji:
          nextRolePriority = FindNextRolePriority(currentSaleUsers, "dps");
          currentRole = "dps";
          saleDps.push(user.id);
          break;
        case config.anyEmoji:
          nextRolePriority = FindNextRolePriority(currentSaleUsers, "any");
          currentRole = "any";
          saleAnys.push(user.id);
          break;
      }

      dbtext = 'INSERT INTO saleuser(sale_id, role, user_id, role_priority) VALUES($1, $2, $3, $4)';
      dbvalues = [currentSaleID, currentRole, user.id, nextRolePriority];
      
      dbclient.query(dbtext, dbvalues, (err, res) => {
        if (err) console.log(err.stack)
      });

      if (saleHealers.length >= currentSale.healers && saleTanks.length >= currentSale.tanks && saleDps.length >= currentSale.dps && saleAnys.length >= currentSale.any_role)
      {
        console.log("salefull");
        dbtext = 'UPDATE sale SET "full" = $1 WHERE id = $2';
        dbvalues = [true, currentSaleID];

        dbclient.query(dbtext, dbvalues, (err, res) => {
          if (err) console.log(err.stack)
        });

        // Concats arrays of saleusers into full list, taking only first x users of each type corresponding to number needed for sale
        fullMembersList = saleHealers.slice(0, currentSale.healers).concat(saleTanks.slice(0, currentSale.tanks), saleDps.slice(0, currentSale.dps), saleAnys.slice(0, currentSale.any_role))

        messageString = `**Members participating in the ${currentSale.duty} sale for ${currentSale.price}:**\n\n`;
        for (i = 0; i < fullMembersList.length; i++) {
          messageString += "<@" + fullMembersList[i] + ">" + "\n";
        }

        reaction.message.channel.send(messageString);
      }
    });
  });

});

client.on("messageReactionRemove", async (reaction, user) => {

  if (reaction.message.partial) await reaction.message.fetch();

  currentSaleID = reaction.message.content.match(/`([^`]+)`/)[1];

  dbtext = 'DELETE FROM saleuser WHERE sale_id = $1 AND user_id = $2';
  dbvalues = [currentSaleID, user.id];

  dbclient.query(dbtext, dbvalues, (err, res) => {
    if (err) console.log(err.stack)
  });

});

// Takes user-inputted string of arguments in form "key(value)" and creates a map for us to use
function mapArgs(argsString)
{
  var matchArray;
  var argMap = new Map();
  
  matchArray = XRegExp.matchRecursive(argsString, '\\(', '\\)', 'g', {
    valueNames: ['key', null, 'match', null]
  });

  for (var i = 0, len = matchArray.length; i < len; i += 2) {
    argMap.set(matchArray[i].value.toLowerCase().trim(), matchArray[i + 1].value.trim());
  }

  return argMap;
}

// Takes string value of data centre name and returns appropriate channel name
function getChannel(dc)
{
  var channel;
  switch(dc) {
    case "light":
      channel = config.lightChannel;
      break;
    case "chaos":
      channel = config.chaosChannel;
      break;
    case "na":
      channel = config.aetherChannel;
      break;
    // Here for completion's sake but currently all use same channel
    case "aether":
      channel = config.aetherChannel;
      break;
    case "primal":
      channel = config.primalChannel;
      break;
    case "crystal":
      channel = config.crystalChannel;
      break;
    default:
      channel = null;
      break;
  }
  return channel;
}