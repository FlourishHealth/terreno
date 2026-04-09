// Vendored from https://github.com/wesleytodd/express-openapi (branch: express-5)
// License: ISC (see ../LICENSE)
const YAML = require('yaml')

/**
 * Converts a json to yaml
 * @param {object} jsonObject
 * @returns {string} yamlString
 */
module.exports = function (jsonObject) {
  const doc = YAML.stringify(jsonObject)
  return doc
}
