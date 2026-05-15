import { env, capabilities } from "../env";

export interface ResearchHit {
  title: string;
  url: string;
  content: string;
  score?: number;
}

export interface ResearchQuery {
  query: string;
  maxResults?: number;
}

export async function search(q: ResearchQuery): Promise<ResearchHit[]> {
  if (!capabilities.hasTavily) {
    return mockHits(q.query);
  }

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: env.tavilyKey,
        query: q.query,
        max_results: q.maxResults ?? 5,
        search_depth: "basic",
        include_answer: false,
      }),
    });
    if (!res.ok) throw new Error(`Tavily ${res.status}`);
    const json = (await res.json()) as {
      results: Array<{ title: string; url: string; content: string; score?: number }>;
    };
    return json.results.map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      score: r.score,
    }));
  } catch (e) {
    console.warn("Tavily failed, falling back to mock", e);
    return mockHits(q.query);
  }
}

function mockHits(query: string): ResearchHit[] {
  const q = query.toLowerCase();

  if (q.includes("plg") || q.includes("saas") || q.includes("analytics")) {
    return [
      {
        title: "The PLG Activation Metric Nobody Tracks (And Should)",
        url: "https://example.com/plg-activation",
        content:
          "Most teams optimize for sign-ups while ignoring the second-session retention curve — a far stronger predictor of paid conversion. Companies that instrument 'time to first value' under 9 minutes see 2.3x conversion to paid.",
        score: 0.94,
      },
      {
        title: "Amplitude vs. Mixpanel vs. PostHog (2025 buyer fatigue)",
        url: "https://example.com/analytics-buyer-fatigue",
        content:
          "Buyer surveys show 41% of growth leads regret their analytics stack within 12 months — driven by data team bottlenecks, not the tools themselves. The unbundling toward warehouse-native tools accelerated through Q1.",
        score: 0.91,
      },
      {
        title: "What 'good activation' looks like — benchmarks by ACV",
        url: "https://example.com/activation-benchmarks",
        content:
          "For sub-$10k ACV PLG products: 35–45% trial-to-activated is healthy. Above $25k ACV, activation is a ceremony — the qualifying conversation matters more than the metric.",
        score: 0.88,
      },
      {
        title: "Why your activation dashboard is lying to you",
        url: "https://example.com/activation-dashboard-lies",
        content:
          "Vanity activation events (sign-up + 1 click) inflate funnel health by 60–80%. Teams reporting 'activation up 12% QoQ' often see flat or declining revenue cohort behavior.",
        score: 0.85,
      },
      {
        title: "PLG instrumentation: SQL-first beats SDK-first in 2025",
        url: "https://example.com/plg-instrumentation",
        content:
          "Warehouse-native tools shorten time-to-first-insight from weeks (event SDK installs + product changes) to days (write a SQL view). The DX win is becoming a wedge against incumbents.",
        score: 0.82,
      },
    ];
  }

  if (q.includes("fitness") || q.includes("strength") || q.includes("women")) {
    return [
      {
        title: "Why progressive overload is the only honest fitness metric",
        url: "https://example.com/progressive-overload",
        content:
          "Across multiple meta-analyses, progressive overload remains the single highest-effect-size variable for hypertrophy and strength — yet only 18% of recreational lifters track loads week-over-week.",
        score: 0.93,
      },
      {
        title: "The 30–45 demographic is the fastest-growing strength-training segment",
        url: "https://example.com/strength-demographic",
        content:
          "Gyms report 34% YoY growth in women 30–45 starting structured strength programs, driven by long-form podcast education (Huberman, Attia) and skepticism of HIIT-only routines.",
        score: 0.9,
      },
      {
        title: "Protein, sleep, and recovery — what actually moves the needle",
        url: "https://example.com/recovery-basics",
        content:
          "Sleep <7h compresses lifting performance by 14–22%. Protein under 1.4g/kg bodyweight blunts hypertrophy by ~25% even with perfect training. Recovery is undertrained, not overrated.",
        score: 0.86,
      },
      {
        title: "The form vs. volume debate is mostly a marketing problem",
        url: "https://example.com/form-vs-volume",
        content:
          "Coaching content optimizes for view-time, which favors flashy volume. Form-focused content underperforms on watch metrics but produces 3x higher long-term retention in coaching businesses.",
        score: 0.83,
      },
      {
        title: "Recovery-first programming is winning the 35+ market",
        url: "https://example.com/recovery-programming",
        content:
          "Coaches programming 3 lifting days + 2 recovery walks see better adherence and outcomes than 5-day splits for working women. Sustainability beats intensity in the long-tail retention curve.",
        score: 0.8,
      },
    ];
  }

  // Generic fallback
  return [
    {
      title: `Top trending topics in ${query}`,
      url: "https://example.com/trends",
      content: `The conversation around ${query} has shifted toward outcomes-focused content — audiences are filtering out polish and rewarding specifics.`,
      score: 0.8,
    },
    {
      title: `Competitor content audit — ${query}`,
      url: "https://example.com/competitors",
      content: `Most competitors in ${query} are publishing 3–4x/week but with ~30% topical overlap. Whitespace exists in long-tail tactical guides.`,
      score: 0.78,
    },
    {
      title: `Audience pain points in ${query}`,
      url: "https://example.com/pain",
      content: `Survey data shows the top three pain points center on jargon, lack of practical examples, and difficulty applying advice to constrained contexts.`,
      score: 0.74,
    },
  ];
}
