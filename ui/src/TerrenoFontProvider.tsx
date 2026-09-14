import {
  Nunito_400Regular,
  Nunito_400Regular_Italic,
  Nunito_500Medium,
  Nunito_500Medium_Italic,
  Nunito_700Bold,
  Nunito_700Bold_Italic,
  useFonts as useTextFonts,
} from "@expo-google-fonts/nunito";
import {
  TitilliumWeb_600SemiBold,
  TitilliumWeb_700Bold,
  useFonts as useHeadingFonts,
} from "@expo-google-fonts/titillium-web";
import {createContext, type FC, type ReactNode, useContext} from "react";

interface TerrenoFontProviderProps {
  children: ReactNode;
}

const TerrenoFontLoadContext = createContext(true);

export const TerrenoFontProvider: FC<TerrenoFontProviderProps> = ({children}) => {
  const [areTextFontsLoaded] = useTextFonts({
    text: Nunito_400Regular,
    "text-bold": Nunito_700Bold,
    "text-bold-italic": Nunito_700Bold_Italic,
    "text-medium": Nunito_500Medium,
    "text-medium-italic": Nunito_500Medium_Italic,
    "text-regular": Nunito_400Regular,
    "text-regular-italic": Nunito_400Regular_Italic,
  });
  const [areHeadingFontsLoaded] = useHeadingFonts({
    heading: TitilliumWeb_600SemiBold,
    "heading-bold": TitilliumWeb_700Bold,
    "heading-semibold": TitilliumWeb_600SemiBold,
  });

  const areFontsLoaded = areTextFontsLoaded && areHeadingFontsLoaded;

  return (
    <TerrenoFontLoadContext.Provider value={areFontsLoaded}>
      {children}
    </TerrenoFontLoadContext.Provider>
  );
};

export const useTerrenoFontsLoaded = (): boolean => {
  return useContext(TerrenoFontLoadContext);
};
