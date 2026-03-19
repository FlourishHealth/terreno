const {execSync} = require("child_process");

module.exports = ({config}) => {
  let buildNumber = 0;
  try {
    buildNumber = parseInt(execSync("git rev-list --count HEAD").toString().trim(), 10);
  } catch {
    // Fallback for environments without git (e.g. CI pre-checkout)
  }

  return {
    ...config,
    extra: {
      ...config.extra,
      buildNumber,
    },
  };
};
