// The booking form on the home page posts here. See server/api.js.
module.exports = (req, res) => require('../server/api').handleBook(req, res);
