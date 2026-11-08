import { Type, type Static } from "typebox";
import { Value } from "typebox/value";

const label = () => Type.String({ minLength: 1, maxLength: 1000 });
export const researchActionsSchema = Type.Object({
  question: label(),
  hypotheses: Type.Array(label(), { minItems: 2, maxItems: 12, uniqueItems: true }),
  actions: Type.Array(Type.Object({
    id: label(), purpose: Type.Union([Type.Literal("learn"), Type.Literal("replicate")]),
    available: Type.Boolean(), answerKnown: Type.Boolean(), independentEvidence: Type.Boolean(),
    cost: Type.Number({ exclusiveMinimum: 0, maximum: 1000000 }),
    outcomes: Type.Array(Type.Object({ observation: label(), compatibleHypotheses: Type.Array(label(), { maxItems: 12, uniqueItems: true }) }, { additionalProperties: false }), { minItems: 1, maxItems: 20 }),
  }, { additionalProperties: false }), { minItems: 1, maxItems: 20 }),
}, { additionalProperties: false });
export type ResearchActions = Static<typeof researchActionsSchema>;

/** Compare declared possible outcomes; this is not a measured information gain. */
export function compareResearchActions(value: unknown) {
  if (!Value.Check(researchActionsSchema, value)) throw new Error("Invalid research actions. Supply alternatives, availability, prior knowledge and possible outcomes.");
  const { hypotheses, actions } = value;
  if (new Set(actions.map(action => action.id)).size !== actions.length) throw new Error("Action IDs must be unique.");
  const comparisons = actions.map(action => {
    if (action.outcomes.some(outcome => outcome.compatibleHypotheses.some(id => !hypotheses.includes(id)))) throw new Error("An outcome refers to an unknown hypothesis.");
    if (new Set(action.outcomes.map(outcome => outcome.observation)).size !== action.outcomes.length) throw new Error("Outcome observations must be distinct.");
    const uncovered = hypotheses.filter(id => !action.outcomes.some(outcome => outcome.compatibleHypotheses.includes(id)));
    let separatedPairs = 0;
    for (const [i, left] of hypotheses.entries()) for (const right of hypotheses.slice(i + 1)) {
      if (action.outcomes.some(outcome => outcome.compatibleHypotheses.includes(left) !== outcome.compatibleHypotheses.includes(right))) separatedPairs++;
    }
    const reasons: string[] = [];
    if (!action.available) reasons.push("Required resources or data are unavailable.");
    if (action.purpose === "learn" && action.answerKnown) reasons.push("The answer is already supplied; this action adds no declared information.");
    if (action.purpose === "learn" && (!separatedPairs || action.outcomes.length < 2)) reasons.push("Declared outcomes do not distinguish the alternatives.");
    if (action.purpose === "learn" && uncovered.length) reasons.push("Possible outcomes omit an alternative; revise the proposed test before ranking it.");
    if (action.purpose === "replicate" && !action.independentEvidence) reasons.push("Replication requires new independent evidence, not rereading or rerunning the same result.");
    const eligible = reasons.length === 0;
    return { id: action.id, purpose: action.purpose, eligible, separatedPairs, cost: action.cost,
      score: eligible ? (action.purpose === "replicate" ? 1 : separatedPairs) / action.cost : 0, reasons };
  });
  return { question: value.question, comparisons,
    rankings: Object.fromEntries(["learn", "replicate"].map(purpose => [purpose, comparisons.filter(action => action.eligible && action.purpose === purpose).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).map(action => action.id)])),
    caveat: "Availability, independence and outcome compatibility are declared assumptions, not verified facts. Scores compare declared distinctions per cost, not probabilities or measured information gain. A replication score is not comparable to a discovery score without specifying the question." };
}
