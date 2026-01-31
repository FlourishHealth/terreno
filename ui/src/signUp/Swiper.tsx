import {type FC, useCallback, useRef, useState} from "react";
import {Dimensions, Image, View} from "react-native";
import {SwiperFlatList, type SwiperFlatListRefProps} from "react-native-swiper-flatlist";

import {Box} from "../Box";
import {Button} from "../Button";
import {Heading} from "../Heading";
import {Text} from "../Text";
import {useTheme} from "../Theme";

import type {SwiperProps} from "./signUpTypes";

const {width: SCREEN_WIDTH} = Dimensions.get("window");

export const Swiper: FC<SwiperProps> = ({
  pages,
  onComplete,
  skipText = "Skip",
  nextText = "Next",
  getStartedText = "Get Started",
}) => {
  const {theme} = useTheme();
  const swiperRef = useRef<SwiperFlatListRefProps>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const isLastPage = currentIndex === pages.length - 1;

  const handleNext = useCallback(() => {
    if (isLastPage) {
      onComplete();
    } else {
      swiperRef.current?.scrollToIndex({animated: true, index: currentIndex + 1});
    }
  }, [currentIndex, isLastPage, onComplete]);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const renderPage = (page: (typeof pages)[number]) => {
    if (page.renderContent) {
      return (
        <View
          key={page.id}
          style={{
            alignItems: "center",
            flex: 1,
            justifyContent: "center",
            padding: 24,
            width: SCREEN_WIDTH,
          }}
        >
          {page.renderContent()}
        </View>
      );
    }

    return (
      <View
        key={page.id}
        style={{
          alignItems: "center",
          flex: 1,
          justifyContent: "center",
          padding: 24,
          width: SCREEN_WIDTH,
        }}
      >
        {Boolean(page.logoSource) && (
          <Image
            resizeMode="contain"
            source={page.logoSource!}
            style={{
              height: 120,
              marginBottom: 32,
              width: 120,
            }}
          />
        )}
        {Boolean(page.header) && (
          <Heading align="center" size="lg">
            {page.header}
          </Heading>
        )}
        {Boolean(page.subheader) && (
          <Box marginTop={4}>
            <Text align="center" color="secondaryDark">
              {page.subheader}
            </Text>
          </Box>
        )}
      </View>
    );
  };

  return (
    <Box color="base" flex="grow" height="100%">
      <SwiperFlatList
        onChangeIndex={({index}) => setCurrentIndex(index)}
        paginationActiveColor={theme.surface.primary}
        paginationDefaultColor={theme.surface.neutralDark}
        paginationStyle={{bottom: 100}}
        ref={swiperRef}
        showPagination
      >
        {pages.map(renderPage)}
      </SwiperFlatList>

      <Box direction="row" justifyContent="between" paddingX={6} paddingY={4} width="100%">
        {!isLastPage ? (
          <Button onClick={handleSkip} text={skipText} variant="outline" />
        ) : (
          <Box width={80} />
        )}

        <Button
          onClick={handleNext}
          text={isLastPage ? getStartedText : nextText}
          variant="primary"
        />
      </Box>
    </Box>
  );
};
