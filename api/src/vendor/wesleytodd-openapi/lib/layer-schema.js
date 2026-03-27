// Vendored from https://github.com/wesleytodd/express-openapi (branch: express-5)
// License: ISC (see ../LICENSE)
'use strict'
const schemas = new Map()

module.exports = {
  set: (handler, schema) => {
    schemas.set(handler, schema)
  },
  get: (handler) => {
    return schemas.get(handler)
  }
}
