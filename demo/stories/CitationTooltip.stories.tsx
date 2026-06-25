import {Box, CitationTooltip, Heading, Text} from "@terreno/ui";
import type React from "react";

export const CitationTooltipDemo = (): React.ReactElement => (
  <Box alignItems="center" justifyContent="center" minHeight={200} padding={4}>
    <Text skipLinking>
      This is a finding from clinical literature
      <CitationTooltip
        actions={[
          {iconName: "arrow-up-right-from-square", label: "View", onClick: () => {}},
          {iconName: "copy", label: "Copy", onClick: () => {}},
        ]}
        content="Smith J, et al. (2023). A randomized controlled trial demonstrating the efficacy of the intervention across multiple patient populations with diverse comorbidities."
        header="Smith et al., 2023"
        marker="1"
        onThumbsDown={() => console.info("Thumbs down: Smith et al., 2023")}
        onThumbsUp={() => console.info("Thumbs up: Smith et al., 2023")}
      />
      and supported by additional evidence
      <CitationTooltip
        content="Johnson A, et al. (2022). Meta-analysis of 24 studies with over 10,000 participants."
        header="Johnson et al., 2022"
        marker="2"
        onThumbsDown={() => console.info("Thumbs down: Johnson et al., 2022")}
        onThumbsUp={() => console.info("Thumbs up: Johnson et al., 2022")}
      />
      .
    </Text>
  </Box>
);

export const CitationTooltipPositions = (): React.ReactElement => (
  <Box
    alignItems="center"
    direction="column"
    gap={4}
    justifyContent="center"
    minHeight={300}
    padding={4}
  >
    {(["top", "bottom", "left", "right"] as const).map((pos) => (
      <Box alignItems="center" direction="row" gap={2} justifyContent="center" key={pos}>
        <Text color="secondaryLight" size="sm">
          {pos}
        </Text>
        <CitationTooltip
          actions={[{label: "View", onClick: () => {}}]}
          content="Sample citation content for position testing."
          header={`Position: ${pos}`}
          idealPosition={pos}
          marker="?"
        />
      </Box>
    ))}
  </Box>
);

export const CitationTooltipScrollableContent = (): React.ReactElement => (
  <Box direction="column" gap={4} maxWidth={720} padding={4}>
    <Heading size="lg">Long-Term Outcomes of Early Intervention: A Narrative Review</Heading>

    <Text skipLinking>
      Early intervention programs have been studied extensively over the past two decades, with a
      growing consensus that timing is the single most important modifiable factor
      <CitationTooltip
        actions={[{iconName: "arrow-up-right-from-square", label: "View", onClick: () => {}}]}
        content="Smith J, et al. (2023). A randomized controlled trial demonstrating the efficacy of the intervention across multiple patient populations with diverse comorbidities."
        dismissOnScroll={false}
        header="Smith et al., 2023"
        idealPosition="bottom"
        marker="1"
      />
      . Programs initiated within the first six months consistently outperform delayed enrollment
      across nearly every measured outcome.
    </Text>

    <Text skipLinking>
      The mechanisms behind this advantage remain an active area of research. Neuroplasticity during
      early developmental windows is the leading hypothesis, but social and environmental
      reinforcement likely play substantial roles as well. Observational cohorts have struggled to
      disentangle these factors because enrollment timing correlates strongly with socioeconomic
      status, caregiver availability, and geographic access to services.
    </Text>

    <Text skipLinking>
      Methodological quality across the literature varies widely. Earlier studies frequently relied
      on convenience samples, unblinded assessments, and short follow-up periods, which inflated
      effect estimates. More recent trials have adopted preregistered protocols, independent outcome
      adjudication, and intention-to-treat analyses, producing more conservative but more credible
      results.
    </Text>

    <Text skipLinking>
      The strongest single piece of evidence comes from a large multi-site replication effort
      <CitationTooltip
        content="Johnson A, et al. (2022). Meta-analysis of 24 studies with over 10,000 participants. Pooled effect size of 0.42 (95% CI 0.31–0.53) on the primary composite outcome."
        dismissOnScroll
        header="Johnson et al., 2022"
        marker="2"
      />
      , which reproduced the original findings in three independent populations with effect sizes
      within ten percent of one another.
    </Text>

    <Text skipLinking>
      Cost-effectiveness analyses tell a similar story. Although early programs carry higher upfront
      costs — staffing, screening infrastructure, and family outreach — downstream savings in
      remedial services, healthcare utilization, and lost productivity dominate within a decade.
      Sensitivity analyses across discount rates from one to seven percent did not change the
      direction of the conclusion.
    </Text>

    <Text skipLinking>
      This claim is backed by an extensive systematic review published last year
      <CitationTooltip
        actions={[{iconName: "arrow-up-right-from-square", label: "View", onClick: () => {}}]}
        content={
          <Box gap={2}>
            <Text size="sm">
              Williams R, et al. (2024). Systematic review and meta-analysis of longitudinal
              outcomes across 47 randomized controlled trials conducted between 2010 and 2023.
            </Text>
            <Text size="sm">
              The pooled analysis included 38,452 participants across 14 countries, with follow-up
              periods ranging from 6 months to 8 years. Heterogeneity was moderate (I² = 54%) and
              sensitivity analyses confirmed the robustness of the primary findings.
            </Text>
            <Text size="sm">
              Subgroup analyses showed consistent effects across age groups, baseline severity
              strata, and treatment settings. Publication bias was assessed via funnel plot
              asymmetry and Egger's test (p = 0.31), suggesting minimal small-study effects.
            </Text>
            <Text size="sm">
              Secondary endpoints included quality-of-life measures, adverse event rates, and
              healthcare utilization. All secondary outcomes favored the intervention, though effect
              sizes were smaller than the primary endpoint.
            </Text>
            <Text size="sm">
              The authors conclude that the evidence base is strong enough to inform clinical
              guidelines, while noting that further research in pediatric populations is warranted.
            </Text>
          </Box>
        }
        dismissOnScroll={false}
        header="Williams et al., 2024 — Systematic Review"
        marker="3"
        onThumbsDown={() => console.info("Thumbs down: Williams et al., 2024")}
        onThumbsUp={() => console.info("Thumbs up: Williams et al., 2024")}
      />
      . Its content area is taller than the popover, so the middle section scrolls independently of
      the page.
    </Text>

    <Text skipLinking>
      Implementation science has lagged behind the efficacy literature. Programs that perform well
      in tightly controlled trials often lose a third or more of their effect when scaled through
      public systems. Staff turnover, fidelity drift, and inconsistent referral pathways are the
      most commonly cited culprits, and few studies have tested remediation strategies head-to-head.
    </Text>

    <Text skipLinking>
      Equity considerations deserve particular attention. Access to early screening is unevenly
      distributed, and families in rural or under-resourced areas face longer waits at every step of
      the pathway. Several jurisdictions have piloted telehealth-first models to close this gap,
      with early results suggesting comparable detection rates and substantially shorter
      time-to-enrollment.
    </Text>

    <Text skipLinking>
      Telehealth-first screening was evaluated directly in a recent pragmatic trial
      <CitationTooltip
        actions={[{iconName: "copy", label: "Copy", onClick: () => {}}]}
        content="Garcia M, et al. (2024). Pragmatic cluster-randomized trial of telehealth-first developmental screening across 62 rural clinics. Time-to-enrollment fell from 142 to 58 days."
        dismissOnScroll
        header="Garcia et al., 2024"
        idealPosition="right"
        marker="4"
      />
      , which cut median time-to-enrollment by more than half without reducing diagnostic accuracy.
    </Text>

    <Text skipLinking>
      Long-term durability remains the largest open question. Most trials end follow-up within three
      years, and the handful of studies extending into adolescence show gradual attenuation of
      academic effects alongside persistent gains in social functioning. Whether booster
      interventions can preserve the academic component is the subject of two ongoing trials
      expected to report in the next several years.
    </Text>

    <Text skipLinking>
      Policy translation is already underway in several countries. Universal screening mandates,
      bundled reimbursement for early services, and workforce development grants have all been
      enacted in the last five years, though rigorous evaluation of these policies is sparse.
      Researchers have called for stepped-wedge rollouts so that policy changes themselves can be
      studied with credible counterfactuals.
    </Text>

    <Text skipLinking>
      A recent economic modeling study projected the fiscal impact of universal screening
      <CitationTooltip
        content="Lee K, et al. (2025). Microsimulation of universal early screening across 4.2 million births. Projected net savings of $1.8B over ten years under base-case assumptions."
        dismissOnScroll={false}
        header="Lee et al., 2025"
        idealPosition="top"
        marker="5"
      />
      , estimating net savings under every scenario except the most pessimistic uptake assumptions.
      This citation sits near the bottom of the page — open it and scroll to test dismissal.
    </Text>

    <Text skipLinking>
      In summary, the evidence base for early intervention is broad, increasingly rigorous, and
      consistent in direction. The field's remaining challenges are practical rather than
      conceptual: scaling with fidelity, reaching underserved families, and sustaining effects over
      time.
    </Text>
  </Box>
);

export const CitationTooltipRichContent = (): React.ReactElement => (
  <Box
    alignItems="center"
    direction="row"
    gap={1}
    justifyContent="center"
    minHeight={200}
    padding={4}
    wrap
  >
    <Text>Patients showed significant improvement</Text>
    <CitationTooltip
      actions={[
        {iconName: "book-open", label: "View Full Text", onClick: () => {}},
        {iconName: "file-export", label: "Export", onClick: () => {}, variant: "muted"},
      ]}
      content={
        <Box gap={2}>
          <Text bold size="sm">
            Study Details
          </Text>
          <Text size="sm">N = 1,248 participants | Duration: 12 months | RCT, double-blind</Text>
          <Text color="secondaryLight" size="sm">
            Primary endpoint: 40% reduction in symptom severity score (p &lt; 0.001)
          </Text>
        </Box>
      }
      header="Chen et al., NEJM 2023"
      marker="3"
      onThumbsDown={() => console.info("Thumbs down: Chen et al., NEJM 2023")}
      onThumbsUp={() => console.info("Thumbs up: Chen et al., NEJM 2023")}
    />
    <Text>over the 12-month period.</Text>
  </Box>
);
