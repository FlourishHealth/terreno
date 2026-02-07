const {withEntitlementsPlist} = require("expo/config-plugins");

const withRemovePushEntitlement = (config) => {
  return withEntitlementsPlist(config, (mod) => {
    delete mod.modResults["aps-environment"];
    return mod;
  });
};

module.exports = withRemovePushEntitlement;
