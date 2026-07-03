import {Badge, Box, Heading, Text} from "@terreno/ui";
import React from "react";
import {Text as RNText} from "react-native";

import {formatRatio} from "./colorUtils";
import type {ContrastResult} from "./paletteTypes";

/**
 * Runs the generated palette through the curated WCAG 2.1 contrast checks and flags any pairing
 * that will not meet its required AA threshold. Each row shows the measured ratio, a live preview
 * of the foreground-on-background text, and a pass/fail (plus AAA) badge.
 */

interface ContrastRowProps {
  result: ContrastResult;
}

const ContrastRow: React.FC<ContrastRowProps> = ({result}) => {
  const requirement = result.largeText ? "AA large 3:1" : "AA 4.5:1";
  return (
    <Box
      alignItems="center"
      border="default"
      direction="row"
      gap={3}
      justifyContent="between"
      padding={3}
      rounding="md"
      wrap
    >
      <Box
        alignItems="center"
        dangerouslySetInlineStyle={{__style: {backgroundColor: result.backgroundHex}}}
        justifyContent="center"
        minWidth={64}
        paddingX={3}
        paddingY={2}
        rounding="sm"
      >
        {/* Sample text uses the exact generated foreground hex, which the themed Text color prop
            cannot express, so a raw RN Text style is required here. */}
        <RNText style={{color: result.foregroundHex, fontSize: 16, fontWeight: "700"}}>Aa</RNText>
      </Box>
      <Box flex="grow" gap={1} minWidth={160}>
        <Text bold size="sm">
          {result.label}
        </Text>
        <Text color="secondaryLight" size="sm">
          {formatRatio(result.ratio)} · needs {requirement}
        </Text>
      </Box>
      <Box direction="row" gap={2}>
        <Badge
          status={result.passes ? "success" : "error"}
          value={result.passes ? "AA pass" : "AA fail"}
        />
        {result.passes && result.passesAaa && <Badge status="info" value="AAA" />}
      </Box>
    </Box>
  );
};

interface ContrastReportProps {
  results: ContrastResult[];
}

export const ContrastReport: React.FC<ContrastReportProps> = ({results}) => {
  const failures = results.filter((result) => !result.passes).length;
  return (
    <Box gap={3}>
      <Box alignItems="center" direction="row" gap={2}>
        <Heading size="sm">Accessibility (WCAG)</Heading>
        <Badge
          status={failures === 0 ? "success" : "error"}
          value={failures === 0 ? "All pass" : `${failures} issue${failures === 1 ? "" : "s"}`}
        />
      </Box>
      <Box gap={2}>
        {results.map((result) => (
          <ContrastRow key={result.label} result={result} />
        ))}
      </Box>
    </Box>
  );
};
