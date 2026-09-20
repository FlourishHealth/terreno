const fs = require("fs");
import {USSTATESLIST} from "../../src/Constants";

// Converts Census county data into the generated lookup consumed by ui/src/Constants.ts.
// Run: bun processCounties.js [path/to/countyData.csv]
const filePath = process.argv[2] || "./countyData.csv";

const getStateName = (abbreviation) => {
  const state = USSTATESLIST.find((item) => item.label === abbreviation);
  return state ? state.value.toLowerCase().replace(/\s/g, "") : null;
};

const formatObjectAsString = (value) => {
  let output = "export const COUNTY_AND_COUNTY_EQUIVALENT_ENTITIES = {\n";
  for (const state in value) {
    output += `  ${state}: {\n`;
    for (const county in value[state]) {
      const {stateFP, countyFP} = value[state][county];
      output += `    ${county}: { stateFP: "${stateFP}", countyFP: "${countyFP}" },\n`;
    }
    output += "  },\n";
  }
  output += "};\n";
  return output;
};

const processCSV = (path) => {
  const data = fs.readFileSync(path, "utf8");
  const lines = data.split("\n");

  return lines.reduce((countyData, line, index) => {
    if (index === 0) {
      return countyData;
    }
    const [stateAbbrev, stateFP, countyFP, , countyName] = line.split("|");
    const stateName = getStateName(stateAbbrev);
    if (!stateName) {
      return countyData;
    }
    const countyKey = countyName
      .trim()
      .toLowerCase()
      .replace(/[\s.'-]/g, "");
    countyData[stateName] = countyData[stateName] || {};
    countyData[stateName][countyKey] = {stateFP, countyFP};
    return countyData;
  }, {});
};

const countyAndEquivalentEntities = processCSV(filePath);
const content = formatObjectAsString(countyAndEquivalentEntities);
if (fs.existsSync("CountyAndEquivalentEntities.js")) {
  fs.unlinkSync("CountyAndEquivalentEntities.js");
}
fs.writeFileSync("CountyAndEquivalentEntities.js", content, "utf8");
