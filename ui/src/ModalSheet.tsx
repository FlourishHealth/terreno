import {
  forwardRef,
  type MutableRefObject,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {Animated, Platform} from "react-native";
import {Modalize} from "react-native-modalize";

import {Box} from "./Box";
import {Modal} from "./Modal";
import {Portal} from "./PortalHost";

export interface SimpleContentHandle {
  close: () => void;
  open: () => void;
}

export const useCombinedRefs = <T,>(
  ...refs: Array<Ref<T> | undefined>
): MutableRefObject<T | null> => {
  const targetRef = useRef<T | null>(null);

  // Iterate through the refs array, and set the ref.current value to the targetRef
  useEffect(() => {
    refs.forEach((ref) => {
      if (!ref) {
        return;
      }

      if (typeof ref === "function") {
        ref(targetRef.current);
      } else {
        (ref as MutableRefObject<T | null>).current = targetRef.current;
      }
    });
  }, [refs]);

  return targetRef;
};

interface Props {
  children: ReactNode;
}

export const SimpleContent = forwardRef<SimpleContentHandle, Props>((props, ref) => {
  const modalizeRef = useRef<SimpleContentHandle | null>(null);
  const animated = useRef(new Animated.Value(0)).current;
  const [webVisible, setWebVisible] = useState(false);
  const isWeb = Platform.OS === "web";

  const openSheet = useCallback((): void => {
    if (isWeb) {
      setWebVisible(true);
      return;
    }
    modalizeRef.current?.open();
  }, [isWeb]);

  const closeSheet = useCallback((): void => {
    if (isWeb) {
      setWebVisible(false);
      return;
    }
    modalizeRef.current?.close();
  }, [isWeb]);

  useImperativeHandle(ref, () => ({
    close: closeSheet,
    open: openSheet,
  }));

  if (isWeb) {
    return (
      <Modal onDismiss={closeSheet} size="md" visible={webVisible}>
        <Box>{props.children}</Box>
      </Modal>
    );
  }

  return (
    <Portal>
      <Modalize
        adjustToContentHeight
        panGestureAnimatedValue={animated}
        ref={modalizeRef}
        scrollViewProps={{
          showsVerticalScrollIndicator: false,
          stickyHeaderIndices: [0],
        }}
      >
        {props.children}
      </Modalize>
    </Portal>
  );
});

SimpleContent.displayName = "SimpleContent";
