const { Events, ChannelType, PermissionFlagsBits } = require("discord.js");
const localConfig = require("./config.json");

let channelIds = {};
let cachedCounts = { members: null, customers: null };
let updateTimeout = null;

module.exports = (client) => {
  const ensureChannels = async () => {
    const guild = await client.guilds.fetch(localConfig.guildId);
    for (const key in localConfig.channelNames) {
      const baseName = localConfig.channelNames[key].split(":")[0];
      let channel = guild.channels.cache.find(c => c.name.startsWith(baseName));
      if (!channel) {
        channel = await guild.channels.create({
          name: localConfig.channelNames[key].replace("{count}", 0),
          type: ChannelType.GuildVoice,
          permissionOverwrites: [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.Connect] }
          ]
        });
      }
      channelIds[key] = channel.id;
    }
  };

  const updateChannels = async () => {
    try {
      const guild = await client.guilds.fetch(localConfig.guildId);
      const realMemberCount = guild.memberCount;
      const customerRole = guild.roles.cache.get(localConfig.customerRoleId);
      const customerCount = customerRole ? customerRole.members.size : 0;
      const updates = {
        members: { name: localConfig.channelNames.members.replace("{count}", realMemberCount), count: realMemberCount },
        customers: { name: localConfig.channelNames.customers.replace("{count}", customerCount), count: customerCount },
        header: { name: localConfig.channelNames.header }
      };
      for (const key in updates) {
        const channel = guild.channels.cache.get(channelIds[key]);
        const newName = updates[key].name;
        if (channel && channel.name !== newName) {
          await channel.setName(newName);
          if (key !== "header") cachedCounts[key] = updates[key].count;
        }
      }
    } catch (e) {
      console.error("[serverstats] Update-Fehler:", e);
    }
  };

  const scheduleUpdate = () => {
    if (updateTimeout) return;
    updateTimeout = setTimeout(() => {
      updateTimeout = null;
      updateChannels();
    }, 5000);
  };

  client.once(Events.ClientReady, async () => {
    await ensureChannels();
    await updateChannels();
    setInterval(updateChannels, localConfig.updateInterval || 60000);
  });

  client.on(Events.GuildMemberAdd, m => {
    if (m.guild.id === localConfig.guildId) scheduleUpdate();
  });
  client.on(Events.GuildMemberRemove, m => {
    if (m.guild.id === localConfig.guildId) scheduleUpdate();
  });
  client.on(Events.GuildBanAdd, b => {
    if (b.guild.id === localConfig.guildId) scheduleUpdate();
  });
  client.on(Events.GuildBanRemove, b => {
    if (b.guild.id === localConfig.guildId) scheduleUpdate();
  });
};
