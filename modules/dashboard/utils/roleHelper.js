function memberHasAnyAllowedRole(interaction, allowedSet) {
  const rolesObj = interaction.member?.roles;
  if (!rolesObj) return false;
  if (rolesObj.cache) return [...allowedSet].some(id => rolesObj.cache.has(id));
  if (Array.isArray(rolesObj)) return rolesObj.some(id => allowedSet.has(String(id)));
  return false;
}

module.exports = { memberHasAnyAllowedRole };
