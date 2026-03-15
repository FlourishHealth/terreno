import {Badge, Box, Button, Card, Heading, MarkdownView, Page, Spinner, Text} from "@terreno/ui";
import {DateTime} from "luxon";
import React, {useCallback, useState} from "react";
import {Image} from "react-native";
import {generateConsentPdf} from "./generateConsentPdf";
import {useAdminApi} from "./useAdminApi";

interface ConsentResponseViewerProps {
  baseUrl: string;
  api: any;
  id: string;
}

const formatDate = (value: any): string => {
  if (!value) {
    return "";
  }
  const dt = DateTime.fromISO(String(value));
  if (!dt.isValid) {
    return String(value);
  }
  return dt.toLocaleString(DateTime.DATETIME_FULL);
};

export const ConsentResponseViewer: React.FC<ConsentResponseViewerProps> = ({baseUrl, api, id}) => {
  const routePath = `${baseUrl}/consent-responses`;
  const {useReadQuery} = useAdminApi(api, routePath, "ConsentResponse");

  const {data: response, isLoading} = useReadQuery(id, {skip: !id});

  if (isLoading) {
    return (
      <Page maxWidth="100%">
        <Box alignItems="center" justifyContent="center" padding={6}>
          <Spinner />
        </Box>
      </Page>
    );
  }

  if (!response) {
    return (
      <Page maxWidth="100%">
        <Box alignItems="center" padding={6}>
          <Text color="secondaryDark">Response not found.</Text>
        </Box>
      </Page>
    );
  }

  const formTitle =
    typeof response.consentFormId === "object"
      ? (response.consentFormId?.title ?? "Unknown Form")
      : "Unknown Form";

  const userId =
    typeof response.userId === "object"
      ? (response.userId?._id ?? String(response.userId))
      : String(response.userId ?? "");

  // checkboxValues is stored as a Map serialized to {index: boolean} by the backend
  const checkboxEntries: Array<{index: string; checked: boolean}> =
    response.checkboxValues && typeof response.checkboxValues === "object"
      ? Object.entries(response.checkboxValues as Record<string, boolean>).map(
          ([index, checked]) => ({
            checked,
            index,
          })
        )
      : [];

  const hasAuditTrail =
    response.ipAddress ||
    response.userAgent ||
    response.contentSnapshot ||
    response.formVersionSnapshot;

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadPdf = useCallback(async () => {
    setIsDownloading(true);
    try {
      await generateConsentPdf(response);
    } catch (err) {
      console.error("Failed to generate PDF", err);
    } finally {
      setIsDownloading(false);
    }
  }, [response]);

  return (
    <Page maxWidth="100%" scroll>
      <Box gap={4} padding={4}>
        <Box alignItems="center" direction="row" justifyContent="between">
          <Heading size="lg">Consent Response</Heading>
          <Button
            iconName="download"
            loading={isDownloading}
            onClick={handleDownloadPdf}
            text="Download PDF"
            variant="outline"
          />
        </Box>

        {/* Core Fields */}
        <Card padding={4}>
          <Box gap={3}>
            <Heading size="sm">Response Details</Heading>

            <Box alignItems="center" direction="row" gap={2}>
              <Text color="secondaryDark">Form:</Text>
              <Text>{formTitle}</Text>
            </Box>

            <Box alignItems="center" direction="row" gap={2}>
              <Text color="secondaryDark">User ID:</Text>
              <Text>{userId}</Text>
            </Box>

            <Box alignItems="center" direction="row" gap={2}>
              <Text color="secondaryDark">Decision:</Text>
              <Badge
                status={response.agreed ? "success" : "error"}
                value={response.agreed ? "Agreed" : "Declined"}
              />
            </Box>

            {response.agreedAt && (
              <Box alignItems="center" direction="row" gap={2}>
                <Text color="secondaryDark">Agreed At:</Text>
                <Text>{formatDate(response.agreedAt)}</Text>
              </Box>
            )}

            {response.locale && (
              <Box alignItems="center" direction="row" gap={2}>
                <Text color="secondaryDark">Locale:</Text>
                <Text>{response.locale}</Text>
              </Box>
            )}
          </Box>
        </Card>

        {/* Checkbox Values */}
        {checkboxEntries.length > 0 && (
          <Card padding={4}>
            <Box gap={3}>
              <Heading size="sm">Checkbox Responses</Heading>
              {checkboxEntries.map((cb) => (
                <Box
                  alignItems="center"
                  direction="row"
                  gap={2}
                  key={cb.index}
                  testID={`consent-response-checkbox-${cb.index}`}
                >
                  <Badge
                    status={cb.checked ? "success" : "neutral"}
                    value={cb.checked ? "Checked" : "Unchecked"}
                  />
                  <Text>Checkbox {cb.index}</Text>
                </Box>
              ))}
            </Box>
          </Card>
        )}

        {/* Signature */}
        {response.signature && (
          <Card padding={4}>
            <Box gap={3}>
              <Heading size="sm">Signature</Heading>
              <Image
                accessibilityLabel="User signature"
                accessible
                resizeMode="contain"
                source={{uri: response.signature}}
                style={{height: 120, width: "100%"}}
                testID="consent-response-signature"
              />
            </Box>
          </Card>
        )}

        {/* Audit Trail */}
        {hasAuditTrail && (
          <Card padding={4}>
            <Box gap={3}>
              <Heading size="sm">Audit Trail</Heading>

              {response.ipAddress && (
                <Box alignItems="center" direction="row" gap={2}>
                  <Text color="secondaryDark">IP Address:</Text>
                  <Text>{response.ipAddress}</Text>
                </Box>
              )}

              {response.userAgent && (
                <Box alignItems="center" direction="row" gap={2}>
                  <Text color="secondaryDark">User Agent:</Text>
                  <Text>{response.userAgent}</Text>
                </Box>
              )}

              {response.contentSnapshot && (
                <Box gap={2}>
                  <Text color="secondaryDark">Content Snapshot:</Text>
                  <Box border="default" padding={3} rounding="sm">
                    <MarkdownView>{response.contentSnapshot}</MarkdownView>
                  </Box>
                </Box>
              )}

              {response.formVersionSnapshot && (
                <Box gap={2}>
                  <Text color="secondaryDark">Form Version Snapshot:</Text>
                  <Box border="default" padding={3} rounding="sm">
                    <Text>{JSON.stringify(response.formVersionSnapshot, null, 2)}</Text>
                  </Box>
                </Box>
              )}
            </Box>
          </Card>
        )}
      </Box>
    </Page>
  );
};
