const { Events, ChannelType, PermissionFlagsBits } = require("discord.js");
const localConfig = require("./config.json");

let channelIds = {};
let cachedCounts = { members: null, customers: null };
let updateTimeout = null;
let lastFullFetchAt = 0;
let warnedMissingMembersIntent = false;

module.exports = (client) => {
  const getRoleCountersConfig = () => {
    const cfg = localConfig || {};
    if (cfg.roleCounters && typeof cfg.roleCounters === 'object') return cfg.roleCounters;
    if (cfg.customerRoleId) return { customers: [String(cfg.customerRoleId)] };
    return {};
  };

  const countMembersWithAnyRole = (guild, roleIds) => {
    const ids = (Array.isArray(roleIds) ? roleIds : [roleIds]).filter(Boolean).map(String);
    if (ids.length === 0) return 0;
    const set = new Set(ids);
    let count = 0;
    for (const member of guild.members.cache.values()) {
      for (const roleId of set) {
        if (member.roles.cache.has(roleId)) {
          count++;
          break;
        }
      }
    }
    return count;
  };

  const ensureChannels = async () => {
    const guild = await client.guilds.fetch(localConfig.guildId);
    for (const key in localConfig.channelNames) {
      const baseName = localConfig.channelNames[key].split(":")[0];
      let channel = guild.channels.cache.find(c => c.name.startsWith(baseName));
      if (!channel) {
        try {
          channel = await guild.channels.create({
            name: localConfig.channelNames[key].replace("{count}", 0),
            type: ChannelType.GuildVoice,
            permissionOverwrites: [
              { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.Connect] }
            ]
          });
        } catch (e) {
          console.error("[serverstats] Konnte Channel nicht erstellen (fehlende Rechte?):", e?.message || e);
          continue;
        }
      }
      channelIds[key] = channel.id;
    }
  };

  const updateChannels = async () => {
    try {
      const guild = await client.guilds.fetch(localConfig.guildId);
      const fullFetchIntervalMs = Number(localConfig.fullFetchIntervalMs || 10 * 60 * 1000);
      const cacheLikelyIncomplete = guild.members.cache.size > 0 && guild.memberCount && guild.members.cache.size < guild.memberCount;
      const shouldFullFetch = cacheLikelyIncomplete || !lastFullFetchAt || (Date.now() - lastFullFetchAt) > fullFetchIntervalMs;
      if (shouldFullFetch) {
        try {
          await guild.members.fetch();
          lastFullFetchAt = Date.now();
        } catch (e) {
          if (!warnedMissingMembersIntent) {
            warnedMissingMembersIntent = true;
            console.warn("[serverstats] Konnte nicht alle Members fetchen. Stelle sicher, dass 'Server Members Intent' im Dev-Portal aktiviert ist und der Bot GuildMembers Intent hat.", e?.message || e);
          }
        }
      }
      const realMemberCount = guild.memberCount;
      const roleCounters = getRoleCountersConfig();
      const updates = {};
      updates.header = { name: localConfig.channelNames.header };
      updates.members = { name: localConfig.channelNames.members.replace("{count}", realMemberCount), count: realMemberCount };

      for (const [key, roleIds] of Object.entries(roleCounters)) {
        const template = localConfig.channelNames?.[key];
        if (!template) continue;
        const count = countMembersWithAnyRole(guild, roleIds);
        updates[key] = { name: template.replace("{count}", count), count };
      }
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
    try {
      await ensureChannels();
      await updateChannels();
      setInterval(updateChannels, localConfig.updateInterval || 60000);
    } catch (e) {
      console.error("[serverstats] Fehler beim Initialisieren:", e);
    }
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
  client.on(Events.GuildMemberUpdate, (oldM, newM) => {
    try {
      if (newM.guild?.id !== localConfig.guildId) return;
      const roleId = localConfig.customerRoleId;
      if (!roleId) return;
      const had = oldM?.roles?.cache?.has?.(roleId) || false;
      const has = newM?.roles?.cache?.has?.(roleId) || false;
      if (had !== has) scheduleUpdate();
    } catch {}
  });
};
