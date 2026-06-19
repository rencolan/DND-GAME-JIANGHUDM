import type { ObjectiveHint } from "../../types";

type ObjectiveCardProps = {
  objective: ObjectiveHint;
  locationName: string;
  tutorialActive: boolean;
  tutorialStoryActive: boolean;
  controlsBlocked: boolean;
  busy: boolean;
  onBeginTutorialCombat: () => void;
  onSkipTutorial: () => void;
};

export function ObjectiveCard({
  objective,
  locationName,
  tutorialActive,
  tutorialStoryActive,
  controlsBlocked,
  busy,
  onBeginTutorialCombat,
  onSkipTutorial
}: ObjectiveCardProps) {
  return (
    <article className="objective-card">
      <span>当前目标</span>
      <b>{objective.title}</b>
      <p>{objective.text}</p>
      <small>{objective.location || locationName}{objective.npc ? ` · ${objective.npc}` : ""}</small>
      {tutorialActive && (
        <div className="objective-actions">
          {tutorialStoryActive && (
            <button
              type="button"
              className="primary-inline"
              onClick={onBeginTutorialCombat}
              disabled={controlsBlocked || busy}
            >
              进入这一战
            </button>
          )}
          <button
            type="button"
            className="secondary-inline"
            onClick={onSkipTutorial}
            disabled={controlsBlocked || busy}
          >
            跳过教学
          </button>
        </div>
      )}
    </article>
  );
}
