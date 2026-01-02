import {useSegments} from "expo-router";
import {type AddressInterface, Box, Field, formatAddress, Text} from "@terreno/ui";
import {useEffect, useState} from "react";

export const AddressFieldDemo = ({googleMapsApiKey, includeCounty}: any) => {
  // Check if the component is being viewed in the detailed demo
  const segments = useSegments();
  const inDetailedDemo = segments.includes("[component]");

  const [demoAddress, setDemoAddress] = useState<AddressInterface>({
    address1: "1234 Main St",
    address2: "Apt 123",
    city: "Anytown",
    state: "California",
    zipcode: "12345",
  });

  const [formattedAddress, setFormattedAddress] = useState("");

  // Update formatted address
  useEffect(() => {
    setFormattedAddress(formatAddress(demoAddress));
  }, [demoAddress]);

  // Update Demo Address
  useEffect(() => {
    if (includeCounty) {
      setDemoAddress({
        address1: "1234 Main St",
        address2: "Apt 123",
        city: "Anytown",
        countyCode: "67890",
        countyName: "Any County",
        state: "California",
        zipcode: "12345",
      });
    } else {
      setDemoAddress({
        address1: "1234 Main St",
        address2: "Apt 123",
        city: "Anytown",
        state: "California",
        zipcode: "12345",
      });
    }
  }, [includeCounty]);

  // Only return the formatted address if not in detailed demo
  // since there is not enough space to display the actual address form
  return (
    <Box alignContent="center" direction="row" justifyContent="around" width="100%">
      <Box alignItems="center" justifyContent="center">
        <Text align="right">{formattedAddress}</Text>
      </Box>
      {inDetailedDemo && (
        <Box>
          <Field
            googleMapsApiKey={googleMapsApiKey}
            includeCounty={includeCounty}
            onChange={(val: AddressInterface) => setDemoAddress(val)}
            type="address"
            value={demoAddress}
          />
        </Box>
      )}
    </Box>
  );
};
