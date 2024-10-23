function parseTemplate(template, contact) {
  let parsedMessage = template;

  // Replace {{name}} with contact's name
  parsedMessage = parsedMessage.replace(/{{name}}/g, contact.fullName);

  // Add more replacements as needed, e.g.:
  // parsedMessage = parsedMessage.replace(/{{email}}/g, contact.email);

  return parsedMessage;
}

module.exports = {
  parseTemplate,
};
