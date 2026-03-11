/**
 * MIT License
 *
 * Copyright (c) 2017-2021 Alberto Schiabel
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Vendored from https://github.com/jkomyno/react-native-user-inactivity
 */

import {type FC, useCallback, useEffect, useRef, useState} from "react";
import {Keyboard, PanResponder, View, type ViewStyle} from "react-native";

import type {UserInactivityProps} from "./Common";

const DEFAULT_TIME_FOR_INACTIVITY = 10000;
const DEFAULT_STYLE: ViewStyle = {
  flex: 1,
};

export const UserInactivity: FC<UserInactivityProps> = ({
  children,
  isActive: isActiveProp,
  onAction,
  skipKeyboard = false,
  style,
  timeForInactivity = DEFAULT_TIME_FOR_INACTIVITY,
}) => {
  const actualStyle = style ?? DEFAULT_STYLE;

  const initialActive = isActiveProp === undefined ? true : isActiveProp;
  const [active, setActive] = useState(initialActive);
  const [_resetKey, setResetKey] = useState(0);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const resetTimerDueToActivity = useCallback(() => {
    clearTimer();
    setActive(true);
    setResetKey((prev) => prev + 1);
  }, [clearTimer]);

  // Handle isActive prop changes
  useEffect(() => {
    if (isActiveProp) {
      resetTimerDueToActivity();
    }
  }, [isActiveProp, resetTimerDueToActivity]);

  // Setup the inactivity timeout
  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      setActive(false);
      onAction(false);
    }, timeForInactivity);

    return clearTimer;
  }, [timeForInactivity, onAction, clearTimer]);

  // Trigger onAction when active state changes (except on first render)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
    } else {
      if (active) {
        onAction(true);
      }
    }
  }, [active, onAction]);

  // Setup keyboard listeners
  useEffect(() => {
    if (skipKeyboard) {
      return;
    }

    const hideEvent = Keyboard.addListener("keyboardDidHide", resetTimerDueToActivity);
    const showEvent = Keyboard.addListener("keyboardDidShow", resetTimerDueToActivity);

    return () => {
      hideEvent.remove();
      showEvent.remove();
    };
  }, [skipKeyboard, resetTimerDueToActivity]);

  const resetTimerForPanResponder = useCallback(() => {
    resetTimerDueToActivity();
    return false;
  }, [resetTimerDueToActivity]);

  // Initialize PanResponder once
  const [panResponder] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: resetTimerForPanResponder,
      onPanResponderTerminationRequest: resetTimerForPanResponder,
      onStartShouldSetPanResponderCapture: resetTimerForPanResponder,
    })
  );

  return (
    <View collapsable={false} style={actualStyle} {...panResponder.panHandlers}>
      {children}
    </View>
  );
};
