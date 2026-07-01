import {useQuery, useSyncMutations} from "@terreno/syncdb";
import {Box, Button, IconButton, Text, TextField} from "@terreno/ui";
import type React from "react";
import {useCallback, useMemo, useState} from "react";

import {generateId} from "./ids";

export interface TodoCommentData {
  todoId: string;
  text: string;
}

/**
 * Local-first comments for a single todo, backed by the `todoComments`
 * collection. Demonstrates a related synced collection: comments are filtered
 * client-side by `todoId` and created/removed optimistically via syncdb.
 */
export const TodoComments: React.FC<{todoId: string}> = ({todoId}) => {
  const allComments = useQuery<TodoCommentData>({collection: "todoComments"});
  const {create, remove} = useSyncMutations<TodoCommentData>({collection: "todoComments"});
  const [expanded, setExpanded] = useState<boolean>(false);
  const [text, setText] = useState<string>("");

  const comments = useMemo(
    () => allComments.filter((comment) => comment.data.todoId === todoId),
    [allComments, todoId]
  );

  const handleAdd = useCallback((): void => {
    if (!text.trim()) {
      return;
    }
    create({data: {text: text.trim(), todoId}, id: generateId()});
    setText("");
  }, [text, todoId, create]);

  return (
    <Box gap={2} marginTop={2}>
      <Box alignSelf="start">
        <Button
          onClick={() => setExpanded((value) => !value)}
          testID={`todo-comments-toggle-${todoId}`}
          text={`Comments (${comments.length})`}
          variant="muted"
        />
      </Box>
      {expanded ? (
        <Box gap={2} testID={`todo-comments-${todoId}`}>
          {comments.map((comment) => (
            <Box
              alignItems="center"
              direction="row"
              gap={2}
              justifyContent="between"
              key={comment.id}
            >
              <Text size="sm">{comment.data.text}</Text>
              <IconButton
                accessibilityLabel="Delete comment"
                iconName="trash"
                onClick={() => remove({id: comment.id})}
                variant="destructive"
              />
            </Box>
          ))}
          <Box alignItems="end" direction="row" gap={2}>
            <Box flex="grow">
              <TextField
                onChange={setText}
                onEnter={handleAdd}
                placeholder="Add a comment"
                testID={`todo-comments-input-${todoId}`}
                value={text}
              />
            </Box>
            <IconButton
              accessibilityLabel="Add comment"
              iconName="plus"
              onClick={handleAdd}
              testID={`todo-comments-add-${todoId}`}
              variant="primary"
            />
          </Box>
        </Box>
      ) : null}
    </Box>
  );
};
