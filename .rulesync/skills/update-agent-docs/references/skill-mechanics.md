# Skill mechanics

## Invocation choice

A model-invoked skill keeps its description in every agent context. Use it when autonomous discovery or skill-to-skill discovery is required.

A user-invoked skill sets `disable-model-invocation: true`. It costs no permanent model context but requires the human to remember and invoke it.

The description is a context pointer. For model-invoked skills, write it for trigger reliability. For user-invoked skills, keep it as a short human-facing summary.

## Split by invocation

Create a separately discoverable skill only when it has a distinct trigger or another skill must reach it. Shared reference needed by user-invoked skills belongs in a plain reference file that both can link.

## Router skills

When many user-invoked skills become hard to remember, add one user-invoked router that names each workflow and its use case. The router points; it does not duplicate their procedures.
