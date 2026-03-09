module.exports = {
  replacePlaceholders(str, data) {
    if (!str) return str;
    return str.replace(/\{user\}/g, data.user || '')
              .replace(/\{channel\}/g, data.channel || '')
              .replace(/\{ticketId\}/g, data.ticketId || '');
  }
};
