import {type FC, useState} from "react";
import {Pressable} from "react-native";

import type {InfoModalIconProps} from "./Common";
import {Heading} from "./Heading";
import {Modal} from "./Modal";

export const InfoModalIcon: FC<InfoModalIconProps> = ({
  infoModalChildren,
  infoModalSubtitle,
  infoModalText,
  infoModalTitle,
}) => {
  const [infoModalVisibleState, setInfoModalVisibleState] = useState(false);
  return (
    <>
      <Modal
        onDismiss={() => setInfoModalVisibleState(false)}
        primaryButtonOnClick={() => setInfoModalVisibleState(false)}
        primaryButtonText="Close"
        size="md"
        subtitle={infoModalSubtitle}
        text={infoModalText}
        title={infoModalTitle}
        visible={infoModalVisibleState}
      >
        {infoModalChildren}
      </Modal>
      <Pressable
        aria-role="button"
        hitSlop={{bottom: 10, left: 10, right: 10, top: 10}}
        onPress={() => setInfoModalVisibleState(true)}
        style={{marginLeft: 8}}
        testID="info-icon"
      >
        <Heading color="secondaryLight" size="sm">
          ⓘ
        </Heading>
      </Pressable>
    </>
  );
};
