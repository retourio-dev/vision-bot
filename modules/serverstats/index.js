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
    const counters = {};
    if (cfg.customerRoleId) counters.customers = [String(cfg.customerRoleId)];
    if (cfg.premiumRoleId) counters.premium = [String(cfg.premiumRoleId)];
    if (Object.keys(counters).length) return counters;
    return {};
  };

  const normalizeRoleCounter = (counter) => {
    if (Array.isArray(counter)) return { include: counter.map(String), exclude: [], mode: 'any' };
    if (counter && typeof counter === 'object') {
      const include = Array.isArray(counter.include) ? counter.include.map(String) : [];
      const exclude = Array.isArray(counter.exclude) ? counter.exclude.map(String) : [];
      const mode = counter.mode === 'all' ? 'all' : 'any';
      return { include, exclude, mode };
    }
    return { include: [], exclude: [], mode: 'any' };
  };

  const hasAnyRole = (member, roleIds) => {
    for (const id of roleIds) {
      if (member.roles.cache.has(id)) return true;
    }
    return false;
  };

  const hasAllRoles = (member, roleIds) => {
    for (const id of roleIds) {
      if (!member.roles.cache.has(id)) return false;
    }
    return true;
  };

  const countMembersByCounter = (guild, counter) => {
    const { include, exclude, mode } = normalizeRoleCounter(counter);
    if (!include.length) return 0;
    let count = 0;
    for (const member of guild.members.cache.values()) {
      const included = mode === 'all' ? hasAllRoles(member, include) : hasAnyRole(member, include);
      if (!included) continue;
      if (exclude.length && hasAnyRole(member, exclude)) continue;
      count++;
    }
    return count;
  };

  const getWatchedRoleIds = () => {
    const cfg = localConfig || {};
    const roleCounters = getRoleCountersConfig();
    const ids = new Set();
    if (cfg.customerRoleId) ids.add(String(cfg.customerRoleId));
    if (cfg.premiumRoleId) ids.add(String(cfg.premiumRoleId));
    for (const counter of Object.values(roleCounters)) {
      const n = normalizeRoleCounter(counter);
      for (const id of n.include) ids.add(String(id));
      for (const id of n.exclude) ids.add(String(id));
    }
    return ids;
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
        const count = countMembersByCounter(guild, roleIds);
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
      const watched = getWatchedRoleIds();
      if (!watched.size) return;
      for (const roleId of watched) {
        const had = oldM?.roles?.cache?.has?.(roleId) || false;
        const has = newM?.roles?.cache?.has?.(roleId) || false;
        if (had !== has) {
          scheduleUpdate();
          break;
        }
      }
    } catch {}
  });
};
