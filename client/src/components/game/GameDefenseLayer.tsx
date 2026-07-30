import { INFIELD_DEFENSE_POSITIONS, defendingSideFromInningHalf, type TeamSide } from "./fieldPositions";
import GameFielderSprite from "./GameFielderSprite";
import { FIELDER_WIDTH } from "./gameLayoutSizes";
import "./gameAnimations.css";

interface GameDefenseLayerProps {
  visible: boolean;
  inningHalf?: "top" | "bottom";
  /** gamePhase 없을 때 기본 수비 팀 */
  defendingSide?: TeamSide;
}

export default function GameDefenseLayer({
  visible,
  inningHalf,
  defendingSide,
}: GameDefenseLayerProps) {
  if (!visible) return null;

  const side = defendingSide ?? defendingSideFromInningHalf(inningHalf);

  return (
    <div className="absolute inset-0 z-[12] pointer-events-none opacity-75" data-testid="defense-layer">
      {INFIELD_DEFENSE_POSITIONS.map(({ role, point, facing }) => (
        <div
          key={role}
          className="absolute"
          style={{
            left: point.left,
            top: point.top,
            transform: "translate(-50%, -100%)",
          }}
          data-testid={`fielder-${role.toLowerCase()}`}
        >
          <div className="animate-fielder-idle">
            <GameFielderSprite
              side={side}
              facing={facing}
              className="h-auto game-sprite"
              style={{ width: FIELDER_WIDTH }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
