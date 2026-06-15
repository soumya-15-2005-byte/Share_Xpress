const express = require('express');
const app = require('./api/index');

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Listening on port ${PORT}.`));
}

module.exports = app;
