import {Box, Button, Card, Heading, Spinner, Text} from "@terreno/ui";
import React, {useState} from "react";
import type {LangfuseCachedPrompt, PromptListItem} from "../../backend/types";
import {PromptEditor} from "../components/PromptEditor";
import {PromptPlayground} from "../components/PromptPlayground";
import {usePrompts} from "../hooks/usePrompts";

type View = "list" | "edit" | "playground";

export const PromptsPage: React.FC = () => {
  const {prompts, total, isLoading, error, page, setPage, refetch} = usePrompts();
  const [view, setView] = useState<View>("list");
  const [selected, setSelected] = useState<PromptListItem | null>(null);

  if (isLoading) {
    return (
      <Box alignItems="center" justifyContent="center" padding={8}>
        <Spinner />
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding={4}>
        <Text color="error">{error}</Text>
      </Box>
    );
  }

  if (view === "edit" && selected) {
    const cachedPrompt: LangfuseCachedPrompt = {
      config: {},
      labels: selected.labels,
      name: selected.name,
      prompt: "",
      tags: selected.tags,
      type: selected.type,
      version: selected.version,
    };
    return (
      <Box gap={3} padding={4}>
        <Button onClick={() => setView("list")} text="← Back" variant="muted" />
        <PromptEditor
          onSaved={() => {
            setView("list");
            refetch();
          }}
          prompt={cachedPrompt}
        />
      </Box>
    );
  }

  if (view === "playground" && selected) {
    return (
      <Box gap={3} padding={4}>
        <Button onClick={() => setView("list")} text="← Back" variant="muted" />
        <PromptPlayground promptName={selected.name} />
      </Box>
    );
  }

  return (
    <Box gap={4} padding={4}>
      <Box alignItems="center" direction="row" justifyContent="between">
        <Heading size="lg">Prompts</Heading>
        <Text color="secondaryDark">{total} total</Text>
      </Box>

      {prompts.length === 0 ? (
        <Text color="secondaryDark">No prompts found.</Text>
      ) : (
        <Box gap={2}>
          {prompts.map((prompt) => (
            <Card key={`${prompt.name}:${prompt.version}`} padding={3}>
              <Box alignItems="center" direction="row" justifyContent="between">
                <Box gap={1}>
                  <Text bold>{prompt.name}</Text>
                  <Text color="secondaryDark" size="sm">
                    v{prompt.version} · {prompt.type} · {prompt.labels.join(", ")}
                  </Text>
                </Box>
                <Box direction="row" gap={2}>
                  <Button
                    onClick={() => {
                      setSelected(prompt);
                      setView("edit");
                    }}
                    text="Edit"
                    variant="secondary"
                  />
                  <Button
                    onClick={() => {
                      setSelected(prompt);
                      setView("playground");
                    }}
                    text="Playground"
                    variant="outline"
                  />
                </Box>
              </Box>
            </Card>
          ))}
        </Box>
      )}

      {total > 20 && (
        <Box direction="row" gap={2} justifyContent="center">
          <Button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            text="Previous"
            variant="muted"
          />
          <Text>Page {page}</Text>
          <Button
            disabled={prompts.length < 20}
            onClick={() => setPage(page + 1)}
            text="Next"
            variant="muted"
          />
        </Box>
      )}
    </Box>
  );
};
