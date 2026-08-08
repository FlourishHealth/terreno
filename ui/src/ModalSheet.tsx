import {
  forwardRef,
  type MutableRefObject,
  type ReactNode,
  type Ref,
  useEffect,
  useRef,
} from "react";
import {Animated} from "react-native";
import {Modalize} from "react-native-modalize";
import {Portal} from "react-native-portalize";

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

export const SimpleContent = forwardRef((props: Props, ref) => {
  const modalizeRef = useRef(null);
  const combinedRef = useCombinedRefs(ref, modalizeRef);
  const animated = useRef(new Animated.Value(0)).current;

  // const renderHeader = () => (
  //   <Box paddingY={4} marginTop={4} marginBottom={4}>
  //     <Text>50 users online</Text>
  //   </Box>
  // );

  return (
    <Portal>
      <Modalize
        // HeaderComponent={renderHeader}
        adjustToContentHeight
        panGestureAnimatedValue={animated}
        ref={combinedRef}
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
