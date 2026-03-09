const fs = require('fs');
const path = require('path');

async function saveTranscript(channel, userWhoClosed, logChannel) {
  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    const sorted = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    let content = `Transcript für ${channel.name} (geschlossen von ${userWhoClosed.tag})\n\n`;
    for (const msg of sorted) {
      const time = new Date(msg.createdTimestamp).toLocaleString();
      const author = `${msg.author.tag}`;
      const text = msg.content || '';
      content += `[${time}] ${author}: ${text}\n`;
    }

    const filePath = path.join(__dirname, `../transcript_${channel.id}.txt`);
    fs.writeFileSync(filePath, content, 'utf8');

    if (logChannel) {
      await logChannel.send({
        content: `Transcript für ${channel.name}:`,
        files: [filePath]
      });
    }

    fs.unlink(filePath, () => {});
  } catch (err) {
    console.error('[ticketsystem] transcript error:', err);
  }
}

module.exports = { saveTranscript };
