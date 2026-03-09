function hasCommandPermission(member, config) {
  if (!config.botSettings?.commandAllowedRoles?.length) return true;
  return config.botSettings.commandAllowedRoles.some(r => member.roles.cache.has(r));
}

module.exports = { hasCommandPermission };
