import {type FC, useCallback, useEffect, useState} from "react";
import {Pressable, View} from "react-native";

import type {AiSuggestionProps} from "./Common";
import {Icon} from "./Icon";
import {Text} from "./Text";
import {useTheme} from "./Theme";

export interface AiSuggestionBoxProps extends AiSuggestionProps {
  testID?: string;
}

export const AiSuggestionBox: FC<AiSuggestionBoxProps> = ({
  status,
  text,
  onAdd,
  onFeedback,
  feedback,
  notStartedText = "AI note will be generated once the session ends.",
  generatingText = "AI note generation in progress...",
  testID,
}) => {
  const {theme} = useTheme();
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (status === "ready" || status === "added") {
      setExpanded(true);
    }
  }, [status]);

  const isAdded = status === "added";

  const backgroundColor = isAdded
    ? theme.surface.successLight
    : status === "not-started"
      ? theme.primitives.neutral050
      : theme.primitives.primary000;

  const borderColor = isAdded
    ? "#9BE7B2"
    : status === "not-started"
      ? theme.surface.secondaryLight
      : theme.primitives.primary100;

  const containerStyle = {
    backgroundColor,
    borderColor,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 8,
    width: "100%" as const,
  };

  const headingText =
    status === "not-started"
      ? notStartedText
      : status === "generating"
        ? generatingText
        : isAdded
          ? "AI-generated note added!"
          : expanded
            ? "AI-generated note"
            : "AI-generated note (hidden)";

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const handleThumbsUp = useCallback(() => {
    if (!onFeedback) {
      return;
    }
    onFeedback(feedback === "like" ? null : "like");
  }, [onFeedback, feedback]);

  const handleThumbsDown = useCallback(() => {
    if (!onFeedback) {
      return;
    }
    onFeedback(feedback === "dislike" ? null : "dislike");
  }, [onFeedback, feedback]);

  const renderFeedback = () => (
    <View
      style={{alignItems: "center", flexDirection: "row"}}
      testID={testID ? `${testID}-feedback` : undefined}
    >
      <Pressable
        accessibilityLabel="Thumbs up"
        accessibilityRole="button"
        onPress={handleThumbsUp}
        style={{alignItems: "center", height: 24, justifyContent: "center", width: 24}}
        testID={testID ? `${testID}-thumbs-up` : undefined}
      >
        <Icon
          color={feedback === "like" ? "secondaryDark" : "secondaryLight"}
          iconName="thumbs-up"
          size="xs"
          type={feedback === "like" ? "solid" : "regular"}
        />
      </Pressable>
      <Pressable
        accessibilityLabel="Thumbs down"
        accessibilityRole="button"
        onPress={handleThumbsDown}
        style={{alignItems: "center", height: 24, justifyContent: "center", width: 24}}
        testID={testID ? `${testID}-thumbs-down` : undefined}
      >
        <Icon
          color={feedback === "dislike" ? "secondaryDark" : "secondaryLight"}
          iconName="thumbs-down"
          size="xs"
          type={feedback === "dislike" ? "solid" : "regular"}
        />
      </Pressable>
    </View>
  );

  if (status === "not-started" || status === "generating") {
    return (
      <View style={containerStyle} testID={testID}>
        <View style={{alignItems: "center", flexDirection: "row", gap: 4, width: "100%"}}>
          <Icon color="secondaryDark" iconName="wand-magic-sparkles" size="xs" />
          <View style={{flex: 1}}>
            <Text color="secondaryDark" size="sm">
              {headingText}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (!expanded) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={toggleExpanded}
        style={{...containerStyle, flexDirection: "column"}}
        testID={testID}
      >
        <View style={{alignItems: "center", flexDirection: "row", gap: 4, width: "100%"}}>
          <Icon color="secondaryDark" iconName="wand-magic-sparkles" size="xs" />
          <View style={{flex: 1}}>
            <Text color="secondaryDark" size="sm">
              {headingText}
            </Text>
          </View>
          <View style={{alignItems: "center", flexDirection: "row", gap: 4}}>
            <Pressable
              accessibilityLabel="Show suggestion"
              accessibilityRole="button"
              onPress={toggleExpanded}
              style={{height: 28, justifyContent: "center", paddingHorizontal: 16}}
              testID={testID ? `${testID}-show` : undefined}
            >
              <Text bold color="secondaryDark" size="sm">
                Show
              </Text>
            </Pressable>
            {renderFeedback()}
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={{...containerStyle, alignItems: "flex-end"}} testID={testID}>
      <View style={{alignItems: "center", flexDirection: "row", gap: 4, width: "100%"}}>
        <Icon color="secondaryDark" iconName="wand-magic-sparkles" size="xs" />
        <View style={{flex: 1}}>
          <Text color="secondaryDark" size="sm">
            {headingText}
          </Text>
        </View>
        {renderFeedback()}
      </View>

      {Boolean(text) && (
        <View style={{paddingBottom: 4, width: "100%"}}>
          <Text size="md">{text}</Text>
        </View>
      )}

      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          gap: 8,
          justifyContent: "flex-end",
          width: "100%",
        }}
      >
        <Pressable
          accessibilityLabel="Hide suggestion"
          accessibilityRole="button"
          onPress={toggleExpanded}
          style={{height: 28, justifyContent: "center", paddingHorizontal: 16}}
          testID={testID ? `${testID}-hide` : undefined}
        >
          <Text bold color="secondaryDark" size="sm">
            Hide
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Add to note"
          accessibilityRole="button"
          onPress={onAdd}
          style={{
            alignItems: "center",
            backgroundColor: theme.surface.secondaryDark,
            borderRadius: 360,
            height: 28,
            justifyContent: "center",
            paddingHorizontal: 16,
          }}
          testID={testID ? `${testID}-add` : undefined}
        >
          <Text bold color="inverted" size="sm">
            Add to note
          </Text>
        </Pressable>
      </View>
    </View>
  );
};
