const Datastore = require('nedb-promises');
const path = require('path');

const dbPath = path.join(__dirname, '../data');
require('fs').mkdirSync(dbPath, { recursive: true });

const db = {
  users:    Datastore.create({ filename: path.join(dbPath, 'users.db'),    autoload: true }),
  leads:    Datastore.create({ filename: path.join(dbPath, 'leads.db'),    autoload: true }),
  payments: Datastore.create({ filename: path.join(dbPath, 'payments.db'), autoload: true }),
};

// Create indexes
db.users.ensureIndex({ fieldName: 'email', unique: true });
db.leads.ensureIndex({ fieldName: 'userId' });

module.exports = db;
